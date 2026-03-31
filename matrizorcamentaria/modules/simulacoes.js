import { supabase } from '../services/supabase.js';
import { brMoney, brPercent, toNumber } from './formatters.js';
import { renderNav } from './nav.js';
import { canEdit, SENHAS } from './auth.js';

renderNav('simulacoes.html');

const $ = id => document.getElementById(id);
let currentId = null;
let v1Data = [], v2Data = [], v3Data = [], v4Data = [];

function setStatus(msg, cls = 'ok') {
  const el = $('statusMsg');
  el.className = `status ${cls}`;
  el.innerHTML = `<i class="fa-solid fa-${cls === 'ok' ? 'circle-check' : cls === 'warn' ? 'triangle-exclamation' : 'circle-xmark'}"></i> ${msg}`;
}

function requireAuth() {
  if (!canEdit('simulacoes')) {
    setStatus('Sem permissão — insira a senha de edição no Início.', 'warn');
    return false;
  }
  return true;
}

/* ─── Auth: disable/enable all editable fields ───────────────── */
function applyAuth() {
  const enabled = canEdit('simulacoes');
  const fieldIds = [
    'simNome','simDescricao','simRB','simPct','simCC','simOD','simSegVal',
    'simPV1','simPV2','simPV3','simPV4',
    'sv1Grad','sv1Pos',
    'sv2Docs','sv2Taes','sv2h20','sv2h40','sv2DE','sv2FP','sv2FI',
    'sv3Grad','sv3Esp','sv3Mest','sv3Dout',
  ];
  fieldIds.forEach(id => { const el = $(id); if (el) el.disabled = !enabled; });
  document.querySelectorAll('input[name="simSegMode"]').forEach(r => r.disabled = !enabled);
}

/* ─── KPI update ─────────────────────────────────────────────── */
function updateKpis() {
  const rb = toNumber($('simRB').value);
  const cc = toNumber($('simCC').value);
  const od = toNumber($('simOD').value);
  const modo = document.querySelector('input[name="simSegMode"]:checked').value;
  const sv = toNumber($('simSegVal').value);
  const segVal = modo === 'PERCENTUAL' ? rb * sv / 100 : sv;
  const rl = Math.max(0, rb - cc - od - segVal);
  const pct = toNumber($('simPct').value);
  const vb = rl * pct / 100;
  $('kpiRB').textContent = brMoney(rb);
  $('kpiCO').textContent = brMoney(cc + od);
  $('kpiSeg').textContent = brMoney(segVal);
  $('kpiRL').textContent = brMoney(rl);
  $('kpiVB').textContent = brMoney(vb);
}

function updatePesoStatus() {
  const soma = ['simPV1','simPV2','simPV3','simPV4'].reduce((s,id) => s + toNumber($(id).value), 0);
  const el = $('pesoStatus');
  $('pesoSoma').textContent = brPercent(soma);
  const ok = Math.abs(soma - 100) < 0.01;
  el.className = `status ${ok ? 'ok' : 'warn'}`;
  el.querySelector('i').className = `fa-solid fa-${ok ? 'circle-check' : 'triangle-exclamation'}`;
}

function updateSegHint() {
  const modo = document.querySelector('input[name="simSegMode"]:checked').value;
  $('simSegHint').textContent = modo === 'PERCENTUAL' ? '% do recurso bruto' : 'Valor fixo em R$';
}

/* ─── Compute simulation result in JS ───────────────────────── */
function computeResult() {
  const s = getFormData();
  const vb = s.recurso_liquido * s.pct_total / 100;
  const unidadeScores = {};

  v1Data.forEach(r => {
    const sc = (r.carga_horaria_graduacao * r.alunos_graduacao * s.v1_peso_graduacao / 100
              + r.carga_horaria_pos * r.alunos_pos * s.v1_peso_pos_graduacao / 100) * r.peso_unidade;
    unidadeScores[r.unidade_id] = unidadeScores[r.unidade_id] || {};
    unidadeScores[r.unidade_id].v1 = sc;
  });

  v2Data.forEach(r => {
    const sc = (r.docentes_20h * s.v2_peso_20h + r.docentes_40h * s.v2_peso_40h + r.docentes_de * s.v2_peso_de) * s.v2_peso_docentes / 100
             + (r.taes_parcial * s.v2_peso_funcao_parcial + r.taes_integral * s.v2_peso_funcao_integral) * s.v2_peso_taes / 100
             + (r.docentes_funcao_parcial * s.v2_peso_funcao_parcial + r.docentes_funcao_integral * s.v2_peso_funcao_integral) * s.v2_peso_docentes / 100;
    unidadeScores[r.unidade_id] = unidadeScores[r.unidade_id] || {};
    unidadeScores[r.unidade_id].v2 = sc;
  });

  v3Data.forEach(r => {
    const sc = r.docentes_graduacao * s.v3_peso_graduacao + r.docentes_especializacao * s.v3_peso_especializacao
             + r.docentes_mestrado * s.v3_peso_mestrado + r.docentes_doutorado * s.v3_peso_doutorado;
    unidadeScores[r.unidade_id] = unidadeScores[r.unidade_id] || {};
    unidadeScores[r.unidade_id].v3 = sc;
  });

  v4Data.forEach(r => {
    unidadeScores[r.unidade_id] = unidadeScores[r.unidade_id] || {};
    unidadeScores[r.unidade_id].v4 = toNumber(r.score_v4);
    unidadeScores[r.unidade_id].sigla = r.sigla;
    unidadeScores[r.unidade_id].nome = r.nome;
    unidadeScores[r.unidade_id].tipo = r.tipo;
  });

  const rows = Object.entries(unidadeScores).map(([uid, d]) => ({
    unidade_id: Number(uid), sigla: d.sigla || uid, nome: d.nome || '', tipo: d.tipo || '',
    v1: d.v1 || 0, v2: d.v2 || 0, v3: d.v3 || 0, v4: d.v4 || 0,
  }));

  const totV1 = rows.reduce((s, r) => s + r.v1, 0);
  const totV2 = rows.reduce((s, r) => s + r.v2, 0);
  const totV3 = rows.reduce((s, r) => s + r.v3, 0);
  const totV4 = rows.reduce((s, r) => s + r.v4, 0);
  const activeW = (totV1>0?s.peso_v1:0) + (totV2>0?s.peso_v2:0) + (totV3>0?s.peso_v3:0) + (totV4>0?s.peso_v4:0);

  return rows.map(r => {
    const idx = activeW > 0
      ? ((totV1>0?r.v1/totV1*s.peso_v1:0) + (totV2>0?r.v2/totV2*s.peso_v2:0)
       + (totV3>0?r.v3/totV3*s.peso_v3:0) + (totV4>0?r.v4/totV4*s.peso_v4:0)) / activeW
      : 0;
    return { ...r, indice: idx, valor: idx * vb };
  }).sort((a, b) => a.sigla.localeCompare(b.sigla));
}

function renderPreview() {
  const rows = computeResult();
  if (!rows.length) return;
  const total = rows.reduce((s, r) => s + r.valor, 0);
  $('previewPanel').style.display = '';
  $('previewBody').innerHTML = rows.map(r => `<tr>
    <td><strong>${r.sigla}</strong> <span style="font-size:0.78rem;color:var(--muted)">${r.nome}</span></td>
    <td class="text-right">${r.indice.toLocaleString('pt-BR',{minimumFractionDigits:4,maximumFractionDigits:4})}</td>
    <td class="text-right">${total>0?brPercent(r.valor/total*100):'—'}</td>
    <td class="text-right"><strong>${brMoney(r.valor)}</strong></td>
  </tr>`).join('');
  $('previewTotal').textContent = brMoney(total);
}

/* ─── Get/Set form data ──────────────────────────────────────── */
function getFormData() {
  const rb = toNumber($('simRB').value);
  const cc = toNumber($('simCC').value);
  const od = toNumber($('simOD').value);
  const modo = document.querySelector('input[name="simSegMode"]:checked').value;
  const sv = toNumber($('simSegVal').value);
  const segVal = modo === 'PERCENTUAL' ? rb * sv / 100 : sv;
  const rl = Math.max(0, rb - cc - od - segVal);
  return {
    nome: $('simNome').value.trim(),
    descricao: $('simDescricao').value.trim() || null,
    recurso_bruto: rb, recurso_liquido: rl,
    pct_total: toNumber($('simPct').value),
    contratos_continuados: cc, outras_despesas_campus: od,
    seguranca_modo: modo, seguranca_valor: sv,
    peso_v1: toNumber($('simPV1').value), peso_v2: toNumber($('simPV2').value),
    peso_v3: toNumber($('simPV3').value), peso_v4: toNumber($('simPV4').value),
    v1_peso_graduacao: toNumber($('sv1Grad').value), v1_peso_pos_graduacao: toNumber($('sv1Pos').value),
    v2_peso_docentes: toNumber($('sv2Docs').value), v2_peso_taes: toNumber($('sv2Taes').value),
    v2_peso_20h: toNumber($('sv2h20').value), v2_peso_40h: toNumber($('sv2h40').value), v2_peso_de: toNumber($('sv2DE').value),
    v2_peso_funcao_parcial: toNumber($('sv2FP').value), v2_peso_funcao_integral: toNumber($('sv2FI').value),
    v3_peso_graduacao: toNumber($('sv3Grad').value), v3_peso_especializacao: toNumber($('sv3Esp').value),
    v3_peso_mestrado: toNumber($('sv3Mest').value), v3_peso_doutorado: toNumber($('sv3Dout').value),
  };
}

function fillForm(sim) {
  currentId = sim.id || null;
  $('simNome').value = sim.nome || ''; $('simDescricao').value = sim.descricao || '';
  $('simRB').value = sim.recurso_bruto ?? 0; $('simPct').value = sim.pct_total ?? 100;
  $('simCC').value = sim.contratos_continuados ?? 0; $('simOD').value = sim.outras_despesas_campus ?? 0;
  const segModo = sim.seguranca_modo || 'PERCENTUAL';
  const segModoEl = document.querySelector(`input[name="simSegMode"][value="${segModo}"]`);
  if (segModoEl) segModoEl.checked = true;
  $('simSegVal').value = sim.seguranca_valor ?? 0;
  $('simPV1').value = sim.peso_v1 ?? 20; $('simPV2').value = sim.peso_v2 ?? 30;
  $('simPV3').value = sim.peso_v3 ?? 25; $('simPV4').value = sim.peso_v4 ?? 25;
  $('sv1Grad').value = sim.v1_peso_graduacao ?? 50; $('sv1Pos').value = sim.v1_peso_pos_graduacao ?? 50;
  $('sv2Docs').value = sim.v2_peso_docentes ?? 60; $('sv2Taes').value = sim.v2_peso_taes ?? 40;
  $('sv2h20').value = sim.v2_peso_20h ?? 1; $('sv2h40').value = sim.v2_peso_40h ?? 2; $('sv2DE').value = sim.v2_peso_de ?? 3;
  $('sv2FP').value = sim.v2_peso_funcao_parcial ?? 1; $('sv2FI').value = sim.v2_peso_funcao_integral ?? 2;
  $('sv3Grad').value = sim.v3_peso_graduacao ?? 1; $('sv3Esp').value = sim.v3_peso_especializacao ?? 2;
  $('sv3Mest').value = sim.v3_peso_mestrado ?? 3; $('sv3Dout').value = sim.v3_peso_doutorado ?? 4;
  updateKpis(); updatePesoStatus(); updateSegHint(); renderPreview();
}

function clearForm() {
  currentId = null; $('simSelect').value = '';
  ['simNome','simDescricao'].forEach(id => $(id).value = '');
  $('simRB').value = 0; $('simPct').value = 100; $('simCC').value = 0; $('simOD').value = 0; $('simSegVal').value = 0;
  $('simPV1').value=20; $('simPV2').value=30; $('simPV3').value=25; $('simPV4').value=25;
  updateKpis(); updatePesoStatus();
}

/* ─── CRUD ───────────────────────────────────────────────────── */
async function loadSims() {
  const { data } = await supabase.schema('utfprct').from('matriz_orc_simulacoes').select('id,nome,descricao').order('id', { ascending: false });
  const sel = $('simSelect');
  sel.innerHTML = '<option value="">— Selecione uma simulação —</option>';
  (data || []).forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id; opt.textContent = s.nome + (s.descricao ? ` — ${s.descricao}` : '');
    sel.appendChild(opt);
  });
}

async function loadSim(id) {
  if (!id) { clearForm(); return; }
  const { data } = await supabase.schema('utfprct').from('matriz_orc_simulacoes').select('*').eq('id', id).single();
  if (data) fillForm(data);
}

/* ─── Salvar: creates new if no currentId, updates if has currentId ── */
async function save() {
  if (!requireAuth()) return;
  const d = getFormData();
  if (!d.nome) { setStatus('Informe o nome da simulação.', 'warn'); return; }
  const soma = d.peso_v1 + d.peso_v2 + d.peso_v3 + d.peso_v4;
  if (Math.abs(soma - 100) > 0.01) { setStatus(`Soma dos pesos = ${brPercent(soma)}. Deve ser 100%.`, 'warn'); return; }

  if (currentId) {
    const { error } = await supabase.schema('utfprct').from('matriz_orc_simulacoes').update(d).eq('id', currentId);
    if (error) { setStatus('Erro: ' + error.message, 'err'); return; }
    setStatus('Simulação atualizada.');
  } else {
    const { data: ins, error } = await supabase.schema('utfprct').from('matriz_orc_simulacoes').insert(d).select('id').single();
    if (error) { setStatus('Erro: ' + error.message, 'err'); return; }
    currentId = ins.id;
    setStatus('Simulação salva.');
  }
  await loadSims();
  $('simSelect').value = String(currentId);
}

/* ─── Nova: clear form for new entry ─────────────────────────── */
function novaSim() {
  if (!requireAuth()) return;
  clearForm();
  $('simNome').focus();
  setStatus('Nova simulação: preencha o nome e clique em Salvar.', 'ok');
}

/* ─── Copiar Config: modal with all real configs + sims ─────── */
async function showCopyModal() {
  if (!requireAuth()) return;
  const [{ data: cfgs }, { data: sims }] = await Promise.all([
    supabase.schema('utfprct').from('matriz_orc_configuracao_base').select('*').order('ano', { ascending: false }),
    supabase.schema('utfprct').from('matriz_orc_simulacoes').select('*').order('id', { ascending: false }),
  ]);

  const list = $('copyList');
  list.innerHTML = '';

  const addSection = (iconCls, label) => {
    const hdr = document.createElement('div');
    hdr.style.cssText = 'font-size:.75rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;padding:10px 12px 4px';
    hdr.innerHTML = `<i class="${iconCls}"></i> ${label}`;
    list.appendChild(hdr);
  };

  const addItem = (text, onClick) => {
    const btn = document.createElement('button');
    btn.style.cssText = 'display:block;width:100%;text-align:left;padding:9px 14px;border:none;background:none;cursor:pointer;border-radius:8px;font-size:.9rem;color:#1e293b';
    btn.textContent = text;
    btn.addEventListener('mouseover', () => btn.style.background = '#f1f5f9');
    btn.addEventListener('mouseout', () => btn.style.background = 'none');
    btn.addEventListener('click', onClick);
    list.appendChild(btn);
  };

  if (cfgs && cfgs.length) {
    addSection('fa-solid fa-star', 'Configurações Reais');
    cfgs.forEach(c => {
      const label = `Real ${c.ano}${c.descricao ? ' — ' + c.descricao : ''}${c.ativo ? ' ✓ ativa' : ''}`;
      addItem(label, () => {
        fillForm({ ...c, id: null, nome: `Cópia Real ${c.ano}${c.descricao ? ' — ' + c.descricao : ''}`, descricao: null, recurso_bruto: c.recurso_bruto ?? c.recurso_liquido });
        currentId = null; $('simSelect').value = '';
        $('copyModal').style.display = 'none';
        setStatus('Campos preenchidos. Edite o nome e salve como nova simulação.', 'ok');
      });
    });
  }

  if (sims && sims.length) {
    addSection('fa-solid fa-vials', 'Simulações');
    sims.forEach(s => {
      addItem(s.nome + (s.descricao ? ` — ${s.descricao}` : ''), () => {
        fillForm({ ...s, id: null, nome: `Cópia de ${s.nome}`, descricao: null });
        currentId = null; $('simSelect').value = '';
        $('copyModal').style.display = 'none';
        setStatus('Campos preenchidos. Edite o nome e salve como nova simulação.', 'ok');
      });
    });
  }

  $('copyModal').style.display = 'flex';
}

/* ─── Excluir: requires password re-entry ────────────────────── */
async function remove() {
  if (!requireAuth()) return;
  if (!currentId) { setStatus('Selecione uma simulação para excluir.', 'warn'); return; }

  const senha = prompt('Para confirmar a exclusão, insira novamente sua senha de acesso:');
  if (!senha) return;
  const entry = SENHAS[senha];
  if (!entry || (!entry.perms.includes('*') && !entry.perms.includes('simulacoes'))) {
    setStatus('Senha incorreta. Exclusão cancelada.', 'err');
    return;
  }

  const { error } = await supabase.schema('utfprct').from('matriz_orc_simulacoes').delete().eq('id', currentId);
  if (error) { setStatus('Erro: ' + error.message, 'err'); return; }
  setStatus('Simulação excluída.'); clearForm(); await loadSims();
}

/* ─── Load unit data for preview ────────────────────────────── */
async function loadUnitData() {
  const { data: cfg } = await supabase.schema('utfprct').from('matriz_orc_configuracao_base').select('id,v1_modo').eq('ativo', true).order('id', { ascending: false }).limit(1).maybeSingle();
  if (!cfg) return;
  const cfgId = cfg.id;
  const v1Table = cfg.v1_modo === 'IMPORTADO' ? 'vw_matriz_orc_v1_importado' : 'matriz_orc_v1_unidade';
  const [r1, r2, r3, r4] = await Promise.all([
    supabase.schema('utfprct').from(v1Table).select('*').eq('configuracao_id', cfgId),
    supabase.schema('utfprct').from('matriz_orc_v2_unidade').select('*').eq('configuracao_id', cfgId),
    supabase.schema('utfprct').from('matriz_orc_v3_unidade').select('*').eq('configuracao_id', cfgId),
    supabase.schema('utfprct').from('vw_matriz_orc_resultado').select('unidade_id,sigla,nome,tipo,score_v4'),
  ]);
  v1Data = r1.data || []; v2Data = r2.data || []; v3Data = r3.data || []; v4Data = r4.data || [];
}

/* ─── Init ───────────────────────────────────────────────────── */
async function init() {
  await Promise.all([loadSims(), loadUnitData()]);

  $('simSelect').addEventListener('change', e => loadSim(e.target.value));
  $('btnSalvar').addEventListener('click', save);
  $('btnExcluir').addEventListener('click', remove);
  $('btnNova').addEventListener('click', novaSim);
  $('btnCopiarCfg').addEventListener('click', showCopyModal);
  $('btnCopyModalClose').addEventListener('click', () => $('copyModal').style.display = 'none');
  $('copyModal').addEventListener('click', e => { if (e.target === $('copyModal')) $('copyModal').style.display = 'none'; });

  ['simRB','simPct','simCC','simOD','simSegVal'].forEach(id => $(id).addEventListener('input', () => { updateKpis(); renderPreview(); }));
  ['simPV1','simPV2','simPV3','simPV4'].forEach(id => $(id).addEventListener('input', () => { updatePesoStatus(); renderPreview(); }));
  document.querySelectorAll('input[name="simSegMode"]').forEach(r => r.addEventListener('change', () => { updateSegHint(); updateKpis(); renderPreview(); }));
  ['sv1Grad','sv1Pos','sv2Docs','sv2Taes','sv2h20','sv2h40','sv2DE','sv2FP','sv2FI','sv3Grad','sv3Esp','sv3Mest','sv3Dout']
    .forEach(id => $(id).addEventListener('input', renderPreview));

  applyAuth();
  updateKpis(); updatePesoStatus(); updateSegHint();
}

init().catch(console.error);
