import { supabase, fallbackDepartments } from './services/supabase.js';
import { brMoney, brPercent, toNumber } from './modules/formatters.js';

const state = {
  currentSimulationId: null,
  departments: [],
  fixedData: new Map(),
  currentOverrides: new Map(),
};

function setStatus(message, ok = true) {
  const el = document.getElementById('statusMsg');
  el.textContent = message || '';
  el.className = 'status ' + (ok ? 'ok' : 'warn');
}

function getWeights() {
  return {
    v1: toNumber(document.getElementById('pesoV1').value) / 100,
    v2: toNumber(document.getElementById('pesoV2').value) / 100,
    v3: toNumber(document.getElementById('pesoV3').value) / 100,
    v4: toNumber(document.getElementById('pesoV4').value) / 100,
  };
}

function getResourceTotal() {
  return toNumber(document.getElementById('recursoTotal').value);
}

function buildRows() {
  const body = document.getElementById('matrizBody');
  body.innerHTML = '';

  state.departments.forEach((depto) => {
    const fixed = state.fixedData.get(depto) || { v1: 0, v2: 0, v3: 0, v4: 0 };
    const override = state.currentOverrides.get(depto) || {};

    const v1 = override.v1 ?? fixed.v1;
    const v2 = override.v2 ?? fixed.v2;
    const v3 = override.v3 ?? fixed.v3;
    const v4 = override.v4 ?? fixed.v4;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${depto}</td>
      <td class="text-center"><input type="number" step="0.0001" data-depto="${depto}" data-var="v1" value="${v1}"></td>
      <td class="text-center"><input type="number" step="0.0001" data-depto="${depto}" data-var="v2" value="${v2}"></td>
      <td class="text-center"><input type="number" step="0.0001" data-depto="${depto}" data-var="v3" value="${v3}"></td>
      <td class="text-center"><input type="number" step="0.0001" data-depto="${depto}" data-var="v4" value="${v4}"></td>
      <td class="text-right" data-out="indice">0</td>
      <td class="text-right" data-out="part">0,00%</td>
      <td class="text-right" data-out="valor">R$ 0,00</td>
    `;
    body.appendChild(tr);
  });

  body.querySelectorAll('input[type="number"]').forEach((input) => {
    input.addEventListener('input', recalculateMatrix);
  });

  document.getElementById('kpiDepartamentos').textContent = String(state.departments.length);
  recalculateMatrix();
}

function collectRows() {
  const grouped = new Map();
  document.querySelectorAll('#matrizBody input[type="number"]').forEach((input) => {
    const depto = input.dataset.depto;
    const variable = input.dataset.var;
    if (!grouped.has(depto)) {
      grouped.set(depto, { departamento: depto, v1: 0, v2: 0, v3: 0, v4: 0 });
    }
    grouped.get(depto)[variable] = toNumber(input.value);
  });
  return Array.from(grouped.values());
}

function recalculateMatrix() {
  const rows = collectRows();
  const weights = getWeights();
  const recursoTotal = getResourceTotal();

  const weighted = rows.map((row) => {
    const indice = row.v1 * weights.v1 + row.v2 * weights.v2 + row.v3 * weights.v3 + row.v4 * weights.v4;
    return { ...row, indice };
  });

  const somaIndice = weighted.reduce((acc, item) => acc + item.indice, 0);
  let somaValor = 0;

  document.querySelectorAll('#matrizBody tr').forEach((tr, idx) => {
    const item = weighted[idx];
    const part = somaIndice > 0 ? (item.indice / somaIndice) : 0;
    const valor = recursoTotal * part;
    somaValor += valor;

    tr.querySelector('[data-out="indice"]').textContent = item.indice.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    tr.querySelector('[data-out="part"]').textContent = brPercent(part * 100);
    tr.querySelector('[data-out="valor"]').textContent = brMoney(valor);
  });

  const pesoTotal = (weights.v1 + weights.v2 + weights.v3 + weights.v4) * 100;
  const diferenca = recursoTotal - somaValor;

  document.getElementById('kpiPesoTotal').textContent = brPercent(pesoTotal);
  document.getElementById('kpiDistribuido').textContent = brMoney(somaValor);
  document.getElementById('kpiDiferenca').textContent = brMoney(diferenca);

  document.getElementById('totalIndice').textContent = somaIndice.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  document.getElementById('totalValor').textContent = brMoney(somaValor);
  document.getElementById('totalParticipacao').textContent = '100,00%';

  if (Math.abs(pesoTotal - 100) > 0.001) {
    setStatus('Atenção: a soma dos pesos está diferente de 100%.', false);
  } else {
    setStatus('Matriz recalculada com sucesso.', true);
  }
}

async function loadDepartments() {
  const { data, error } = await supabase
    .schema('utfprct')
    .from('matriz_orc_unidades')
    .select('sigla')
    .eq('ativo', true)
    .order('sigla', { ascending: true });

  if (error || !data || !data.length) {
    state.departments = [...fallbackDepartments];
    return;
  }

  state.departments = data.map((d) => d.sigla).filter(Boolean);
}

async function loadFixedData() {
  state.fixedData.clear();
  const { data, error } = await supabase
    .schema('utfprct')
    .from('vw_matriz_orc_resultado')
    .select('sigla,score_v1,score_v2,score_v3,score_v4');

  if (!error && data) {
    data.forEach((row) => {
      state.fixedData.set(row.sigla, {
        v1: toNumber(row.score_v1),
        v2: toNumber(row.score_v2),
        v3: toNumber(row.score_v3),
        v4: toNumber(row.score_v4),
      });
    });
  }
}

async function loadSimulations() {
  const select = document.getElementById('simulacaoSelect');
  select.innerHTML = '<option value="">Nova simulação</option>';

  const { data, error } = await supabase
    .schema('utfprct')
    .from('matriz_orc_simulacoes')
    .select('id,nome')
    .order('created_at', { ascending: false });

  if (error || !data) {
    setStatus('Não foi possível carregar as simulações salvas.', false);
    return;
  }

  data.forEach((item) => {
    const option = document.createElement('option');
    option.value = String(item.id);
    option.textContent = item.nome;
    select.appendChild(option);
  });
}

function clearSimulationForm() {
  state.currentSimulationId = null;
  state.currentOverrides.clear();
  document.getElementById('simulacaoSelect').value = '';
  document.getElementById('simulacaoNome').value = '';
  document.getElementById('recursoTotal').value = '0';
  document.getElementById('observacoes').value = '';
  document.getElementById('pesoV1').value = '20';
  document.getElementById('pesoV2').value = '30';
  document.getElementById('pesoV3').value = '25';
  document.getElementById('pesoV4').value = '25';
  buildRows();
}

async function loadSimulation(simulationId) {
  if (!simulationId) {
    clearSimulationForm();
    return;
  }

  const id = Number(simulationId);
  const { data: header, error: headerError } = await supabase
    .schema('utfprct')
    .from('matriz_orc_simulacoes')
    .select('*')
    .eq('id', id)
    .single();

  if (headerError || !header) {
    setStatus('Erro ao carregar cabeçalho da simulação.', false);
    return;
  }

  state.currentSimulationId = id;
  state.currentOverrides.clear();

  document.getElementById('simulacaoNome').value = header.nome || '';
  document.getElementById('recursoTotal').value = String(toNumber(header.recurso_total));
  document.getElementById('observacoes').value = header.observacoes || '';
  document.getElementById('pesoV1').value = String(toNumber(header.peso_v1));
  document.getElementById('pesoV2').value = String(toNumber(header.peso_v2));
  document.getElementById('pesoV3').value = String(toNumber(header.peso_v3));
  document.getElementById('pesoV4').value = String(toNumber(header.peso_v4));

  buildRows();
  setStatus('Simulação carregada para edição.', true);
}

async function saveSimulation(isUpdate) {
  const nome = document.getElementById('simulacaoNome').value.trim();
  if (!nome) {
    setStatus('Informe um nome para a simulação.', false);
    return;
  }

  const payload = {
    nome,
    recurso_total: getResourceTotal(),
    peso_v1: toNumber(document.getElementById('pesoV1').value),
    peso_v2: toNumber(document.getElementById('pesoV2').value),
    peso_v3: toNumber(document.getElementById('pesoV3').value),
    peso_v4: toNumber(document.getElementById('pesoV4').value),
    observacoes: document.getElementById('observacoes').value.trim() || null,
  };

  let simulationId = state.currentSimulationId;

  if (isUpdate) {
    if (!simulationId) {
      setStatus('Selecione uma simulação para atualizar.', false);
      return;
    }

    const { error } = await supabase
      .schema('utfprct')
      .from('matriz_orc_simulacoes')
      .update(payload)
      .eq('id', simulationId);

    if (error) {
      setStatus('Erro ao atualizar simulação: ' + error.message, false);
      return;
    }
  } else {
    const { data, error } = await supabase
      .schema('utfprct')
      .from('matriz_orc_simulacoes')
      .insert(payload)
      .select('id')
      .single();

    if (error || !data) {
      setStatus('Erro ao salvar simulação: ' + (error ? error.message : 'sem retorno de ID'), false);
      return;
    }

    simulationId = data.id;
    state.currentSimulationId = simulationId;
  }

  await loadSimulations();
  document.getElementById('simulacaoSelect').value = String(simulationId);
  setStatus(isUpdate ? 'Simulação atualizada com sucesso.' : 'Simulação criada com sucesso.', true);
}

async function deleteSimulation() {
  if (!state.currentSimulationId) {
    setStatus('Selecione uma simulação para excluir.', false);
    return;
  }

  const ok = window.confirm('Deseja realmente excluir a simulação selecionada?');
  if (!ok) {
    return;
  }

  const { error } = await supabase
    .schema('utfprct')
    .from('matriz_orc_simulacoes')
    .delete()
    .eq('id', state.currentSimulationId);

  if (error) {
    setStatus('Erro ao excluir simulação: ' + error.message, false);
    return;
  }

  await loadSimulations();
  clearSimulationForm();
  setStatus('Simulação excluída com sucesso.', true);
}

function bindEvents() {
  document.getElementById('simulacaoSelect').addEventListener('change', (event) => {
    loadSimulation(event.target.value);
  });

  ['pesoV1', 'pesoV2', 'pesoV3', 'pesoV4', 'recursoTotal'].forEach((id) => {
    document.getElementById(id).addEventListener('input', recalculateMatrix);
  });

  document.getElementById('btnRecalcular').addEventListener('click', recalculateMatrix);
  document.getElementById('btnSalvar').addEventListener('click', () => saveSimulation(false));
  document.getElementById('btnAtualizar').addEventListener('click', () => saveSimulation(true));
  document.getElementById('btnExcluir').addEventListener('click', deleteSimulation);
  document.getElementById('btnNova').addEventListener('click', () => {
    clearSimulationForm();
    setStatus('Formulário limpo para nova simulação.', true);
  });
}

async function init() {
  bindEvents();
  await loadDepartments();
  await loadFixedData();
  await loadSimulations();
  buildRows();
  setStatus('Página carregada. Informe os parâmetros para iniciar a simulação.', true);
}

init().catch((error) => {
  console.error(error);
  setStatus('Erro ao inicializar página: ' + error.message, false);
});
