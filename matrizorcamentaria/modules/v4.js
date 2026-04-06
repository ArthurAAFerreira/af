import { supabase } from '../services/supabase.js';
import { toNumber } from './formatters.js';
import { renderNav } from './nav.js';
import { canEdit } from './auth.js';

renderNav('v4.html');

const $ = id => document.getElementById(id);
let currentCfgId = null;
let tiposCache = [];
let classesCache = [];
let atributosCache = [];
let unidadesCache = [];
let sedesCache = [];
let estruturasCache = [];
let editingEstruturaId = null;
let selectedAttrsByClasse = {};

function setStatus(msg, cls = 'ok') {
  const el = $('statusMsg');
  el.className = `status ${cls}`;
  el.innerHTML = `<i class="fa-solid fa-${cls === 'ok' ? 'circle-check' : cls === 'warn' ? 'triangle-exclamation' : 'circle-xmark'}"></i> ${msg}`;
}

/* ─── CONFIGS ─────────────────────────────────────────────── */
async function loadConfigs() {
  const { data } = await supabase.schema('utfprct').from('matriz_orc_configuracao_base').select('id,ano,descricao,ativo').order('id', { ascending: false });
  const sel = $('cfgSelect');
  sel.innerHTML = '<option value="">Selecionar...</option>';
  (data || []).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.ano}${c.descricao ? ' — ' + c.descricao : ''}${c.ativo ? ' ✓' : ''}`;
    sel.appendChild(opt);
  });
  const active = (data || []).find(c => c.ativo);
  if (active) { sel.value = String(active.id); await onCfgChange(active.id); }
}

async function onCfgChange(cfgId) {
  currentCfgId = toNumber(cfgId) || null;
  await Promise.all([loadTipos(), loadUnidades(), loadSedes()]);
  await loadEstruturas();
  renderResumo();
}

/* ─── TIPOS ────────────────────────────────────────────────── */
async function loadTipos() {
  const { data } = await supabase.schema('utfprct').from('matriz_orc_estrutura_tipos').select('*').eq('ativo', true).order('nome');
  tiposCache = data || [];
  $('kpiTipos').textContent = tiposCache.length;
  renderTiposLista();
  populateTipoSelects();
}

function renderTiposLista() {
  $('tiposLista').innerHTML = tiposCache.map(t =>
    `<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:99px;border:1.5px solid var(--line);background:#f8fbff;font-size:0.82rem">
      <i class="fa-solid fa-flask" style="color:var(--v4)"></i> ${t.nome} <span style="font-size:0.7rem;color:var(--muted)">× ${t.peso}</span>
    </span>`
  ).join('');
}

function populateTipoSelects() {
  ['classTipo','eTipo'].forEach(id => {
    const sel = $(id);
    const prev = sel.value;
    sel.innerHTML = '<option value="">Selecionar tipo...</option>';
    tiposCache.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id; opt.textContent = t.nome;
      sel.appendChild(opt);
    });
    if (prev) sel.value = prev;
  });
}

async function addTipo() {
  if (!canEdit('estruturas')) { setStatus('Sem permissão. Desbloqueie no Início.', 'warn'); return; }
  const nome = $('tipoNome').value.trim();
  const peso = toNumber($('tipoPeso').value);
  if (!nome) { setStatus('Informe o nome do tipo.', 'warn'); return; }
  const { error } = await supabase.schema('utfprct').from('matriz_orc_estrutura_tipos').insert({ nome, peso });
  if (error) { setStatus('Erro: ' + error.message, 'err'); return; }
  $('tipoNome').value = ''; $('tipoPeso').value = 1;
  setStatus(`Tipo "${nome}" adicionado.`);
  await loadTipos();
}

/* ─── CLASSES ──────────────────────────────────────────────── */
async function loadClasses(tipoId) {
  if (!tipoId) { classesCache = []; populateClasseSelect(); renderClassesLista(); return; }
  const { data } = await supabase.schema('utfprct').from('matriz_orc_estrutura_classes').select('*').eq('tipo_id', tipoId).order('nome');
  classesCache = data || [];
  populateClasseSelect();
  renderClassesLista();
}

function renderClassesLista() {
  const el = $('classesLista');
  if (!classesCache.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div style="display:flex;flex-direction:column;gap:6px">${classesCache.map(c => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid var(--line);border-radius:var(--radius-sm);background:#f8fbff">
      <input type="text" value="${c.nome.replace(/"/g, '&quot;')}" id="classeNomeEdit_${c.id}"
        style="flex:1;border:1.5px solid #c0d4f0;border-radius:6px;padding:5px 8px;font-size:0.85rem;font-family:inherit" />
      <button onclick="updateClasseNome(${c.id})" class="btn btn-update" style="padding:4px 10px;font-size:0.78rem" title="Salvar nome"><i class="fa-solid fa-check"></i></button>
      <button onclick="deleteClasse(${c.id})" class="btn btn-delete" style="padding:4px 10px;font-size:0.78rem" title="Excluir classe"><i class="fa-solid fa-trash"></i></button>
    </div>
  `).join('')}</div>`;
}

window.updateClasseNome = async function(id) {
  if (!canEdit('estruturas')) { setStatus('Sem permissão.', 'warn'); return; }
  const input = $(`classeNomeEdit_${id}`);
  const nome = input ? input.value.trim() : '';
  if (!nome) { setStatus('O nome da classe não pode ser vazio.', 'warn'); return; }
  const { error } = await supabase.schema('utfprct').from('matriz_orc_estrutura_classes').update({ nome }).eq('id', id);
  if (error) { setStatus('Erro: ' + error.message, 'err'); return; }
  setStatus(`Classe renomeada para "${nome}".`);
  const tipoId = toNumber($('classTipo').value);
  await loadClasses(tipoId);
};

window.deleteClasse = async function(id) {
  if (!canEdit('estruturas')) { setStatus('Sem permissão.', 'warn'); return; }
  const classe = classesCache.find(c => c.id === id);
  if (!confirm(`Excluir a classe "${classe?.nome}" e todos os seus atributos?`)) return;
  const { error } = await supabase.schema('utfprct').from('matriz_orc_estrutura_classes').delete().eq('id', id);
  if (error) { setStatus('Erro: ' + error.message, 'err'); return; }
  setStatus('Classe excluída.');
  const tipoId = toNumber($('classTipo').value);
  await loadClasses(tipoId);
  if (toNumber($('attrClasse').value) === id) { atributosCache = []; renderAttrLista(); }
};

function populateClasseSelect() {
  const sel = $('attrClasse');
  sel.innerHTML = '<option value="">Selecionar classe...</option>';
  classesCache.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id; opt.textContent = c.nome;
    sel.appendChild(opt);
  });
}

async function addClasse() {
  if (!canEdit('estruturas')) { setStatus('Sem permissão. Desbloqueie no Início.', 'warn'); return; }
  const tipoId = toNumber($('classTipo').value);
  const nome = $('classeNome').value.trim();
  if (!tipoId || !nome) { setStatus('Selecione o tipo e informe o nome da classe.', 'warn'); return; }
  const { error } = await supabase.schema('utfprct').from('matriz_orc_estrutura_classes').insert({ tipo_id: tipoId, nome });
  if (error) { setStatus('Erro: ' + error.message, 'err'); return; }
  $('classeNome').value = '';
  setStatus(`Classe "${nome}" adicionada.`);
  await loadClasses(tipoId);
}

/* ─── ATRIBUTOS ────────────────────────────────────────────── */
async function loadAtributos(classeId) {
  if (!classeId) { atributosCache = []; renderAttrLista(); return; }
  const { data } = await supabase.schema('utfprct').from('matriz_orc_estrutura_atributos').select('*').eq('classe_id', classeId).order('descricao');
  atributosCache = data || [];
  renderAttrLista();
}

function renderAttrLista() {
  const el = $('attrLista');
  if (!atributosCache.length) {
    el.innerHTML = '<p style="color:var(--muted);font-size:0.85rem">Nenhum atributo nesta classe.</p>';
    return;
  }
  el.innerHTML = `<div style="display:flex;flex-direction:column;gap:6px">${atributosCache.map(a => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid var(--line);border-radius:var(--radius-sm);background:#f8fbff">
      <span style="flex:1;font-size:0.85rem;font-weight:600">${a.descricao}</span>
      <label style="font-size:0.78rem;color:var(--muted);white-space:nowrap">Peso:</label>
      <input type="number" min="0" step="0.01" value="${a.peso}" id="attrPesoEdit_${a.id}"
        style="width:72px;border:1.5px solid #c0d4f0;border-radius:6px;padding:5px 7px;font-size:0.85rem;font-family:inherit" />
      <button onclick="updateAtributoPeso(${a.id})" class="btn btn-update" style="padding:4px 10px;font-size:0.78rem" title="Salvar peso"><i class="fa-solid fa-check"></i></button>
      <button onclick="deleteAtributo(${a.id})" class="btn btn-delete" style="padding:4px 10px;font-size:0.78rem" title="Excluir atributo"><i class="fa-solid fa-trash"></i></button>
    </div>
  `).join('')}</div>`;
}

window.updateAtributoPeso = async function(id) {
  if (!canEdit('estruturas')) { setStatus('Sem permissão.', 'warn'); return; }
  const input = $(`attrPesoEdit_${id}`);
  const peso = toNumber(input ? input.value : 0);
  const { error } = await supabase.schema('utfprct').from('matriz_orc_estrutura_atributos').update({ peso }).eq('id', id);
  if (error) { setStatus('Erro: ' + error.message, 'err'); return; }
  const attr = atributosCache.find(a => a.id === id);
  if (attr) attr.peso = peso;
  setStatus(`Peso de "${attr?.descricao}" atualizado para ${peso}.`);
};

window.deleteAtributo = async function(id) {
  if (!canEdit('estruturas')) { setStatus('Sem permissão.', 'warn'); return; }
  const attr = atributosCache.find(a => a.id === id);
  if (!confirm(`Excluir o atributo "${attr?.descricao}"?`)) return;
  const { error } = await supabase.schema('utfprct').from('matriz_orc_estrutura_atributos').delete().eq('id', id);
  if (error) { setStatus('Erro: ' + error.message, 'err'); return; }
  setStatus('Atributo excluído.');
  await loadAtributos(toNumber($('attrClasse').value));
};

async function addAtributo() {
  if (!canEdit('estruturas')) { setStatus('Sem permissão. Desbloqueie no Início.', 'warn'); return; }
  const classeId = toNumber($('attrClasse').value);
  const descricao = $('attrDesc').value.trim();
  const peso = toNumber($('attrPeso').value);
  if (!classeId || !descricao) { setStatus('Selecione a classe e informe a descrição.', 'warn'); return; }
  const { error } = await supabase.schema('utfprct').from('matriz_orc_estrutura_atributos').insert({ classe_id: classeId, descricao, peso });
  if (error) { setStatus('Erro: ' + error.message, 'err'); return; }
  $('attrDesc').value = ''; $('attrPeso').value = 1;
  setStatus(`Atributo "${descricao}" adicionado.`);
  await loadAtributos(classeId);
}

/* ─── UNIDADES E SEDES ─────────────────────────────────────── */
async function loadUnidades() {
  const { data } = await supabase.schema('utfprct').from('matriz_orc_unidades').select('id,sigla,nome,tipo').eq('ativo', true).order('sigla');
  unidadesCache = data || [];
  const sel = $('eUnidade');
  const fil = $('filtroUnidade');
  const prevE = sel.value; const prevF = fil.value;
  sel.innerHTML = '<option value="">Selecionar unidade...</option>';
  fil.innerHTML = '<option value="">Todas as unidades</option>';
  unidadesCache.forEach(u => {
    [sel, fil].forEach(s => {
      const opt = document.createElement('option');
      opt.value = u.id; opt.textContent = `${u.sigla} — ${u.nome}`;
      s.appendChild(opt);
    });
  });
  if (prevE) sel.value = prevE;
  if (prevF) fil.value = prevF;
}

async function loadSedes() {
  const { data } = await supabase.schema('utfprct').from('matriz_orc_sedes').select('id,nome,campus_id').order('nome');
  sedesCache = data || [];
  const sel = $('eSede');
  sel.innerHTML = '<option value="">Selecionar sede...</option>';
  sedesCache.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id; opt.textContent = s.nome;
    sel.appendChild(opt);
  });
}

/* ─── ATRIBUTOS DO FORMULÁRIO (dinâmico por tipo) ──────────── */
async function loadAtributosFormulario(tipoId) {
  const container = $('atributosContainer');
  if (!tipoId) {
    container.innerHTML = '<p style="color:var(--muted);font-size:0.88rem"><i class="fa-solid fa-circle-info"></i> Selecione um tipo de estrutura para configurar os atributos.</p>';
    selectedAttrsByClasse = {};
    return;
  }

  const { data: classes } = await supabase.schema('utfprct').from('matriz_orc_estrutura_classes').select('id,nome').eq('tipo_id', tipoId).order('nome');
  if (!classes || !classes.length) {
    container.innerHTML = '<p style="color:var(--muted);font-size:0.88rem">Nenhuma classe de atributos cadastrada para este tipo.</p>';
    return;
  }

  const attrsByClasse = await Promise.all(classes.map(async cl => {
    const { data: attrs } = await supabase.schema('utfprct').from('matriz_orc_estrutura_atributos').select('id,descricao,peso').eq('classe_id', cl.id).order('descricao');
    return { classe: cl, attrs: attrs || [] };
  }));

  if (!selectedAttrsByClasse) selectedAttrsByClasse = {};

  container.innerHTML = `
    <div class="section-divider">Atributos da Estrutura</div>
    <p style="font-size:0.83rem;color:var(--muted);margin-bottom:12px"><i class="fa-solid fa-hand-pointer"></i> Selecione <strong>um atributo por classe</strong> que caracteriza esta estrutura.</p>
    ${attrsByClasse.map(({ classe, attrs }) => `
      <div class="attr-group">
        <div class="attr-group-title"><i class="fa-solid fa-tag" style="color:var(--accent)"></i> ${classe.nome}</div>
        <div class="attr-options">
          ${attrs.map(a => `
            <label class="attr-option ${selectedAttrsByClasse[classe.id] === a.id ? 'selected' : ''}" data-classe="${classe.id}" data-attr="${a.id}">
              ${a.descricao}
              <span class="attr-peso">× ${a.peso}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `).join('')}
  `;

  container.querySelectorAll('.attr-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const classeId = toNumber(opt.dataset.classe);
      const attrId = toNumber(opt.dataset.attr);
      selectedAttrsByClasse[classeId] = attrId;
      container.querySelectorAll(`.attr-option[data-classe="${classeId}"]`).forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });
}

/* ─── ESTRUTURAS ───────────────────────────────────────────── */
async function loadEstruturas() {
  if (!currentCfgId) { estruturasCache = []; renderEstruturas([]); return; }
  const { data } = await supabase.schema('utfprct').from('matriz_orc_estruturas')
    .select('*,unidade:unidade_id(sigla,nome),tipo:tipo_id(nome,peso),sede:sede_id(nome)')
    .eq('configuracao_id', currentCfgId).eq('ativo', true).order('nome');
  estruturasCache = data || [];
  $('kpiEstruturas').textContent = estruturasCache.length;
  renderEstruturas(estruturasCache);
  renderResumo();
}

function renderEstruturas(list) {
  const container = $('estruturasLista');
  const filtro = toNumber($('filtroUnidade').value) || null;
  const filtered = filtro ? list.filter(e => e.unidade_id === filtro) : list;
  if (!filtered.length) {
    container.innerHTML = '<p style="color:var(--muted);text-align:center;padding:24px"><i class="fa-solid fa-box-open"></i> Nenhuma estrutura cadastrada.</p>';
    return;
  }
  container.innerHTML = `<div style="display:grid;gap:12px">${filtered.map(e => `
    <div class="structure-card">
      <div class="structure-card-header">
        <div>
          <strong style="font-size:1rem">${e.nome}</strong>
          <span style="font-size:0.78rem;color:var(--muted);margin-left:8px">${e.tipo?.nome || '—'} (× ${e.tipo?.peso || 1})</span>
        </div>
        <div style="display:flex;gap:6px">
          <button onclick="editEstrutura(${e.id})" class="btn btn-secondary" style="padding:4px 10px;font-size:0.78rem"><i class="fa-solid fa-pen"></i></button>
          <button onclick="removeEstrutura(${e.id})" class="btn btn-delete" style="padding:4px 10px;font-size:0.78rem"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      <div class="structure-card-body" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;font-size:0.85rem">
        <div><span style="color:var(--muted)">Unidade:</span> <strong>${e.unidade?.sigla || '—'}</strong></div>
        <div><span style="color:var(--muted)">Sede:</span> ${e.sede?.nome || '—'}</div>
        <div><span style="color:var(--muted)">Sala:</span> ${e.sala || '—'}</div>
        <div><span style="color:var(--muted)">Responsável:</span> ${e.responsavel_nome || '—'} ${e.responsavel_email ? `<a href="mailto:${e.responsavel_email}" style="color:var(--accent);font-size:0.8rem"><i class="fa-solid fa-envelope"></i></a>` : ''}</div>
      </div>
    </div>
  `).join('')}</div>`;
}

window.editEstrutura = async function(id) {
  const e = estruturasCache.find(x => x.id === id);
  if (!e) return;
  editingEstruturaId = id;
  $('eNome').value = e.nome;
  $('eTipo').value = e.tipo_id;
  $('eUnidade').value = e.unidade_id;
  $('eSede').value = e.sede_id || '';
  $('eSala').value = e.sala || '';
  $('eRespNome').value = e.responsavel_nome || '';
  $('eRespEmail').value = e.responsavel_email || '';

  const { data: selecoes } = await supabase.schema('utfprct').from('matriz_orc_estrutura_selecao')
    .select('atributo_id,atributo:atributo_id(classe_id)').eq('estrutura_id', id);
  selectedAttrsByClasse = {};
  (selecoes || []).forEach(s => { selectedAttrsByClasse[s.atributo.classe_id] = s.atributo_id; });

  await loadAtributosFormulario(e.tipo_id);
  window.scrollTo({ top: document.querySelector('#eNome').closest('.panel').offsetTop - 80, behavior: 'smooth' });
};

window.removeEstrutura = async function(id) {
  if (!canEdit('estruturas')) { setStatus('Sem permissão — desbloqueie no Início.', 'warn'); return; }
  if (!confirm('Desativar esta estrutura?')) return;
  const { error } = await supabase.schema('utfprct').from('matriz_orc_estruturas').update({ ativo: false }).eq('id', id);
  if (error) { setStatus('Erro: ' + error.message, 'err'); return; }
  setStatus('Estrutura removida.');
  await loadEstruturas();
};

async function saveEstrutura() {
  if (!canEdit('estruturas')) { setStatus('Sem permissão. Desbloqueie no Início.', 'warn'); return; }
  if (!currentCfgId) { setStatus('Selecione uma configuração.', 'warn'); return; }
  const nome = $('eNome').value.trim();
  const tipoId = toNumber($('eTipo').value);
  const unidadeId = toNumber($('eUnidade').value);
  if (!nome || !tipoId || !unidadeId) { setStatus('Informe nome, tipo e unidade.', 'warn'); return; }

  const payload = {
    configuracao_id: currentCfgId,
    nome, tipo_id: tipoId, unidade_id: unidadeId,
    sede_id: toNumber($('eSede').value) || null,
    sala: $('eSala').value.trim() || null,
    responsavel_nome: $('eRespNome').value.trim() || null,
    responsavel_email: $('eRespEmail').value.trim() || null,
    ativo: true,
  };

  let estruturaId = editingEstruturaId;
  if (estruturaId) {
    const { error } = await supabase.schema('utfprct').from('matriz_orc_estruturas').update(payload).eq('id', estruturaId);
    if (error) { setStatus('Erro: ' + error.message, 'err'); return; }
    await supabase.schema('utfprct').from('matriz_orc_estrutura_selecao').delete().eq('estrutura_id', estruturaId);
  } else {
    const { data, error } = await supabase.schema('utfprct').from('matriz_orc_estruturas').insert(payload).select('id').single();
    if (error || !data) { setStatus('Erro: ' + error?.message, 'err'); return; }
    estruturaId = data.id;
  }

  const selecoes = Object.values(selectedAttrsByClasse).filter(Boolean).map(attrId => ({ estrutura_id: estruturaId, atributo_id: attrId }));
  if (selecoes.length) {
    const { error: selErr } = await supabase.schema('utfprct').from('matriz_orc_estrutura_selecao').insert(selecoes);
    if (selErr) { setStatus('Estrutura salva, mas erro nos atributos: ' + selErr.message, 'warn'); return; }
  }

  setStatus(`Estrutura "${nome}" salva com sucesso.`);
  limparFormEstr();
  await loadEstruturas();
}

function limparFormEstr() {
  editingEstruturaId = null;
  selectedAttrsByClasse = {};
  ['eNome','eSala','eRespNome','eRespEmail'].forEach(id => $(id).value = '');
  ['eTipo','eUnidade','eSede'].forEach(id => $(id).value = '');
  $('atributosContainer').innerHTML = '<p style="color:var(--muted);font-size:0.88rem"><i class="fa-solid fa-circle-info"></i> Selecione um tipo de estrutura para configurar os atributos.</p>';
}

/* ─── RESUMO POR UNIDADE ───────────────────────────────────── */
async function renderResumo() {
  const body = $('resumoBody');
  if (!currentCfgId || !estruturasCache.length) {
    body.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--muted);padding:16px">Sem dados.</td></tr>';
    return;
  }

  const { data: selAll } = await supabase.schema('utfprct').from('matriz_orc_estrutura_selecao')
    .select('estrutura_id,atributo:atributo_id(peso,classe:classe_id(tipo:tipo_id(peso)))');

  const scoreByUnidade = new Map();
  const countByUnidade = new Map();
  estruturasCache.forEach(e => {
    if (!scoreByUnidade.has(e.unidade_id)) { scoreByUnidade.set(e.unidade_id, 0); countByUnidade.set(e.unidade_id, 0); }
    countByUnidade.set(e.unidade_id, countByUnidade.get(e.unidade_id) + 1);
    const tipoPeso = e.tipo?.peso || 1;
    const selecoes = (selAll || []).filter(s => s.estrutura_id === e.id);
    const scoreE = selecoes.reduce((acc, s) => acc + toNumber(s.atributo?.peso) * tipoPeso, 0);
    scoreByUnidade.set(e.unidade_id, scoreByUnidade.get(e.unidade_id) + scoreE);
  });

  const rows = [...scoreByUnidade.entries()].map(([uid, score]) => {
    const u = unidadesCache.find(x => x.id === uid);
    return { sigla: u?.sigla || uid, nome: u?.nome || '', count: countByUnidade.get(uid) || 0, score };
  }).sort((a, b) => a.sigla.localeCompare(b.sigla));

  body.innerHTML = rows.map(r => `<tr>
    <td><strong>${r.sigla}</strong><span style="font-size:0.78rem;color:var(--muted);margin-left:6px">${r.nome}</span></td>
    <td class="text-right">${r.count}</td>
    <td class="text-right"><strong>${r.score.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}</strong></td>
  </tr>`).join('');
}

/* ─── INIT ─────────────────────────────────────────────────── */
async function init() {
  await loadConfigs();
  await loadTipos();

  $('cfgSelect').addEventListener('change', e => onCfgChange(e.target.value));
  $('btnAddTipo').addEventListener('click', addTipo);
  $('classTipo').addEventListener('change', e => loadClasses(e.target.value));
  $('btnAddClasse').addEventListener('click', addClasse);
  $('attrClasse').addEventListener('change', e => loadAtributos(e.target.value));
  $('btnAddAttr').addEventListener('click', addAtributo);
  $('eTipo').addEventListener('change', e => loadAtributosFormulario(e.target.value));
  $('btnSalvarEstr').addEventListener('click', saveEstrutura);
  $('btnLimparEstr').addEventListener('click', limparFormEstr);
  $('filtroUnidade').addEventListener('change', () => renderEstruturas(estruturasCache));
  applyAuth();
}

function applyAuth() {
  const ok = canEdit('estruturas');
  ['btnAddTipo', 'btnAddClasse', 'btnAddAttr', 'btnSalvarEstr'].forEach(id => {
    const el = $(id); if (!el) return;
    el.disabled = !ok;
    if (!ok) el.title = 'Sem permissão — desbloqueie no Início';
  });
  [
    'tipoNome','tipoPeso','classeNome','attrDesc','attrPeso',
    'eNome','eSala','eRespNome','eRespEmail',
  ].forEach(id => { const el = $(id); if (el) el.disabled = !ok; });
  ['classTipo','attrClasse','eTipo','eUnidade','eSede'].forEach(id => {
    const el = $(id); if (el) el.disabled = !ok;
  });
}

init().catch(console.error);
