import { supabase } from '../services/supabase.js';
import { brPercent, toNumber } from './formatters.js';
import { renderNav } from './nav.js';
import { canEdit } from './auth.js';

renderNav('v1.html');

const $ = id => document.getElementById(id);
const TIPOS = { GRADUACAO:'Graduação', POS_GRADUACAO:'Pós-Graduação', ADMINISTRATIVO:'Administrativo', GESTAO_DIRETORIA:'Gestão/Diretoria' };
const TIPO_COLORS = { GRADUACAO:'#1565c0', POS_GRADUACAO:'#6a1b9a', ADMINISTRATIVO:'#2e7d32', GESTAO_DIRETORIA:'#e65100' };
let currentCfg = null;
let rows = [];
let viewMode = 'MANUAL'; // current display mode (not necessarily the active config mode)

function setStatus(msg, cls = 'ok') {
  const el = $('statusMsg');
  el.className = `status ${cls}`;
  el.innerHTML = `<i class="fa-solid fa-${cls === 'ok' ? 'circle-check' : cls === 'warn' ? 'triangle-exclamation' : 'circle-xmark'}"></i> ${msg}`;
}

function setImportStatus(msg, cls = 'ok') {
  const el = $('importStatus');
  el.style.display = '';
  el.className = `status ${cls}`;
  el.innerHTML = `<i class="fa-solid fa-${cls === 'ok' ? 'circle-check' : cls === 'warn' ? 'triangle-exclamation' : 'circle-xmark'}"></i> ${msg}`;
}

// ── Mode badge & toggle ────────────────────────────────────────────────────────
window.setViewMode = function(mode) {
  viewMode = mode;
  const isImportado = mode === 'IMPORTADO';
  $('btnViewManual').style.cssText    = `padding:4px 12px;border:none;cursor:pointer;font-weight:${isImportado?500:600};background:${isImportado?'#f5f5f5':'#1565c0'};color:${isImportado?'#666':'#fff'}`;
  $('btnViewImportado').style.cssText = `padding:4px 12px;border:none;cursor:pointer;font-weight:${isImportado?600:500};background:${isImportado?'#2e7d32':'#f5f5f5'};color:${isImportado?'#fff':'#666'}`;
  $('hintManual').style.display    = isImportado ? 'none' : '';
  $('hintImportado').style.display = isImportado ? '' : 'none';
  $('btnSalvarTudo').style.display = isImportado ? 'none' : '';
  if (currentCfg) loadRows(currentCfg.id, mode);
};

function updateModeBadge() {
  const badge = $('v1ModoBadge');
  if (!currentCfg) { badge.style.display = 'none'; return; }
  const modo = currentCfg.v1_modo || 'MANUAL';
  badge.style.display = '';
  if (modo === 'IMPORTADO') {
    badge.innerHTML = '<i class="fa-solid fa-file-csv"></i> Fonte ativa: Importado';
    badge.style.cssText = 'display:;background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7;font-size:0.8rem;padding:4px 12px;border-radius:99px;font-weight:600';
  } else {
    badge.innerHTML = '<i class="fa-solid fa-pencil"></i> Fonte ativa: Sistema';
    badge.style.cssText = 'display:;background:#e3f0fb;color:#1565c0;border:1px solid #90caf9;font-size:0.8rem;padding:4px 12px;border-radius:99px;font-weight:600';
  }
}

// ── Config loading ─────────────────────────────────────────────────────────────
async function loadConfigs() {
  const { data } = await supabase.schema('utfprct').from('matriz_orc_configuracao_base')
    .select('id,ano,descricao,ativo,v1_peso_graduacao,v1_peso_pos_graduacao,v1_modo').order('id', { ascending: false });
  const sel = $('cfgSelect');
  sel.innerHTML = '<option value="">Selecionar...</option>';
  (data || []).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.ano}${c.descricao ? ' — ' + c.descricao : ''}${c.ativo ? ' ✓' : ''}`;
    opt.dataset.pg   = c.v1_peso_graduacao;
    opt.dataset.pp   = c.v1_peso_pos_graduacao;
    opt.dataset.modo = c.v1_modo || 'MANUAL';
    sel.appendChild(opt);
  });
  const active = (data || []).find(c => c.ativo);
  if (active) { sel.value = String(active.id); await loadData(active.id); }
}

async function loadData(cfgId) {
  if (!cfgId) { rows = []; $('v1Body').innerHTML = ''; return; }
  const opt = $('cfgSelect').querySelector(`option[value="${cfgId}"]`);
  const pg = toNumber(opt?.dataset.pg ?? 50);
  const pp = toNumber(opt?.dataset.pp ?? 50);
  $('kpiPesoGrad').textContent = brPercent(pg);
  $('kpiPesoPos').textContent  = brPercent(pp);

  const { data: cfg } = await supabase.schema('utfprct').from('matriz_orc_configuracao_base').select('*').eq('id', cfgId).single();
  currentCfg = cfg;
  updateModeBadge();

  viewMode = cfg.v1_modo || 'MANUAL';
  window.setViewMode(viewMode);

  await loadImportedRaw(cfgId);
}

async function loadRows(cfgId, mode) {
  if (mode === 'IMPORTADO') {
    await loadRowsImportado(cfgId);
  } else {
    await loadRowsManual(cfgId);
  }
}

async function loadRowsManual(cfgId) {
  const { data: unidades } = await supabase.schema('utfprct').from('matriz_orc_unidades').select('id,sigla,nome,tipo').eq('ativo', true).order('sigla');
  const { data: existentes } = await supabase.schema('utfprct').from('matriz_orc_v1_unidade').select('*').eq('configuracao_id', cfgId);
  const mapEx = new Map((existentes || []).map(e => [e.unidade_id, e]));
  rows = (unidades || []).map(u => {
    const ex = mapEx.get(u.id) || {};
    return {
      unidade_id: u.id, sigla: u.sigla, nome: u.nome, tipo: u.tipo,
      carga_horaria_graduacao: toNumber(ex.carga_horaria_graduacao),
      carga_horaria_pos:       toNumber(ex.carga_horaria_pos),
      alunos_graduacao:        toNumber(ex.alunos_graduacao),
      alunos_pos:              toNumber(ex.alunos_pos),
      peso_unidade:            ex.peso_unidade !== undefined ? toNumber(ex.peso_unidade) : 1,
    };
  });
  $('kpiUnidades').textContent = rows.length;
  renderTable(false);
}

async function loadRowsImportado(cfgId) {
  const { data } = await supabase.schema('utfprct').from('vw_matriz_orc_v1_importado').select('*').eq('configuracao_id', cfgId);
  rows = (data || []).map(r => ({
    unidade_id: r.unidade_id, sigla: r.sigla, nome: r.nome, tipo: r.tipo,
    carga_horaria_graduacao: toNumber(r.carga_horaria_graduacao),
    carga_horaria_pos:       toNumber(r.carga_horaria_pos),
    alunos_graduacao:        toNumber(r.alunos_graduacao),
    alunos_pos:              toNumber(r.alunos_pos),
    peso_unidade:            toNumber(r.peso_unidade) || 1,
  }));
  $('kpiUnidades').textContent = rows.length;
  renderTable(true);
}

// ── Table render ───────────────────────────────────────────────────────────────
function calcScore(r) {
  if (!currentCfg) return 0;
  const pg = currentCfg.v1_peso_graduacao / 100;
  const pp = currentCfg.v1_peso_pos_graduacao / 100;
  return (r.carga_horaria_graduacao * r.alunos_graduacao * pg + r.carga_horaria_pos * r.alunos_pos * pp) * r.peso_unidade;
}

function fmtNum(n) { return toNumber(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 }); }

function renderTable(readOnly) {
  const body = $('v1Body');
  body.innerHTML = rows.map((r, i) => {
    const score = calcScore(r).toLocaleString('pt-BR', { maximumFractionDigits: 4 });
    const cell = f => readOnly
      ? `<td class="text-right">${fmtNum(r[f])}</td>`
      : `<td class="text-right"><input type="number" min="0" step="0.5" value="${r[f]}" data-i="${i}" data-f="${f}" style="width:90px" /></td>`;
    const cellPu = readOnly
      ? `<td class="text-right">${fmtNum(r.peso_unidade)}</td>`
      : `<td class="text-right"><input type="number" min="0" step="0.01" value="${r.peso_unidade}" data-i="${i}" data-f="peso_unidade" style="width:70px" /></td>`;
    return `<tr>
      <td><strong>${r.sigla}</strong><br><span style="font-size:0.78rem;color:var(--muted)">${r.nome}</span></td>
      <td><span style="font-size:0.75rem;padding:2px 8px;border-radius:99px;background:${TIPO_COLORS[r.tipo]}18;color:${TIPO_COLORS[r.tipo]};font-weight:600">${TIPOS[r.tipo]||r.tipo}</span></td>
      ${cell('carga_horaria_graduacao')}${cell('carga_horaria_pos')}${cell('alunos_graduacao')}${cell('alunos_pos')}
      ${cellPu}
      <td class="text-right" data-score="${i}" style="font-variant-numeric:tabular-nums">${score}</td>
    </tr>`;
  }).join('');
  if (!readOnly) {
    body.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('input', () => {
        const i = Number(inp.dataset.i), f = inp.dataset.f;
        rows[i][f] = toNumber(inp.value);
        body.querySelector(`[data-score="${i}"]`).textContent = calcScore(rows[i]).toLocaleString('pt-BR', { maximumFractionDigits: 4 });
        updateTotals();
      });
    });
  }
  updateTotals();
}

function updateTotals() {
  let chG = 0, chP = 0, alG = 0, alP = 0, sc = 0;
  rows.forEach(r => { chG += r.carga_horaria_graduacao; chP += r.carga_horaria_pos; alG += r.alunos_graduacao; alP += r.alunos_pos; sc += calcScore(r); });
  $('totCHGrad').textContent = chG.toLocaleString('pt-BR');
  $('totCHPos').textContent  = chP.toLocaleString('pt-BR');
  $('totAlGrad').textContent = alG.toLocaleString('pt-BR');
  $('totAlPos').textContent  = alP.toLocaleString('pt-BR');
  $('totScore').textContent  = sc.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
}

// ── Save manual ────────────────────────────────────────────────────────────────
async function saveAll() {
  if (!canEdit('v1')) { setStatus('Sem permissão. Desbloqueie no Início.', 'warn'); return; }
  const cfgId = toNumber($('cfgSelect').value);
  if (!cfgId) { setStatus('Selecione uma configuração.', 'warn'); return; }
  const payload = rows.map(r => ({
    configuracao_id: cfgId,
    unidade_id:             r.unidade_id,
    carga_horaria_graduacao: r.carga_horaria_graduacao,
    carga_horaria_pos:       r.carga_horaria_pos,
    alunos_graduacao:        r.alunos_graduacao,
    alunos_pos:              r.alunos_pos,
    peso_unidade:            r.peso_unidade,
  }));
  const { error } = await supabase.schema('utfprct').from('matriz_orc_v1_unidade').upsert(payload, { onConflict: 'configuracao_id,unidade_id' });
  if (error) { setStatus('Erro ao salvar: ' + error.message, 'err'); return; }
  setStatus(`${payload.length} registros salvos com sucesso.`);
}

// ── CSV import ─────────────────────────────────────────────────────────────────
const COL_MAP = {
  departamento:      ['departamento','depto','dept','dep'],
  professor:         ['professor','docente','prof'],
  disciplina:        ['disciplina','disc','codigo','cod_disc'],
  turma:             ['turma','cod_turma','codturma'],
  nome_disc:         ['nome_disc','nome_disciplina','nome disc','nomedisciplina'],
  cht:               ['cht','ch','carga_horaria','carga horaria','ch_total','ch total'],
  nivel_ensino:      ['nivel_ensino','nivel','nível','nivel de ensino','nível de ensino'],
  quantidade_alunos: ['quantidade_alunos','qtd_alunos','qtd alunos','alunos','quant_alunos','quantidadedealunos'],
  situacao_turma:    ['situacao_turma','situacao','situação','status','situacao turma','situação turma'],
};

function matchHeader(h) {
  const norm = h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/[\s.]+/g,'_').replace(/_+$/,'');
  // 1st pass: exact field name or exact alias match
  for (const [field, aliases] of Object.entries(COL_MAP)) {
    if (norm === field) return field;
    const normAliases = aliases.map(a => a.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\s.]+/g,'_'));
    if (normAliases.includes(norm)) return field;
  }
  // 2nd pass: substring, only if norm starts with the field name (avoids 'situacao_turma' matching 'turma')
  for (const [field] of Object.entries(COL_MAP)) {
    if (norm.startsWith(field) || field.startsWith(norm)) return field;
  }
  return null;
}

function parseCSV(text) {
  const sep = ';';
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g,''));
  const fieldMap = headers.map(h => matchHeader(h));
  const rows = lines.slice(1).map(line => {
    const vals = line.split(sep).map(v => v.trim().replace(/^"|"$/g,''));
    const row = {};
    fieldMap.forEach((field, i) => { if (field) row[field] = vals[i] ?? ''; });
    return row;
  }).filter(r => r.departamento); // skip empty rows
  return { headers, fieldMap, rows };
}

async function importCSV() {
  if (!canEdit('v1')) { setImportStatus('Sem permissão. Desbloqueie no Início.', 'warn'); return; }
  const cfgId = toNumber($('cfgSelect').value);
  if (!cfgId) { setImportStatus('Selecione uma configuração primeiro.', 'warn'); return; }
  const file = $('csvFile').files[0];
  if (!file) { setImportStatus('Selecione um arquivo CSV.', 'warn'); return; }

  const text = await file.text();
  const { fieldMap, rows: parsed } = parseCSV(text);

  const missingFields = Object.keys(COL_MAP).filter(f => !fieldMap.includes(f));
  if (missingFields.length > 0) {
    setImportStatus(`Colunas não encontradas: ${missingFields.join(', ')}. Verifique o cabeçalho do CSV.`, 'warn');
    return;
  }

  const payload = parsed.map(r => ({
    configuracao_id:  cfgId,
    departamento:     r.departamento || null,
    professor:        r.professor    || null,
    disciplina:       r.disciplina   || null,
    turma:            r.turma        || null,
    nome_disc:        r.nome_disc    || null,
    cht:              parseFloat(String(r.cht).replace(',','.')) || 0,
    nivel_ensino:     r.nivel_ensino || null,
    quantidade_alunos: parseInt(r.quantidade_alunos) || 0,
    situacao_turma:   r.situacao_turma || null,
  }));

  setImportStatus(`Importando ${payload.length} linhas…`, 'warn');

  // Clear existing and insert in batches of 500
  const { error: delErr } = await supabase.schema('utfprct').from('matriz_orc_v1_importacao').delete().eq('configuracao_id', cfgId);
  if (delErr) { setImportStatus('Erro ao limpar dados anteriores: ' + delErr.message, 'err'); return; }

  const BATCH = 500;
  for (let i = 0; i < payload.length; i += BATCH) {
    const { error } = await supabase.schema('utfprct').from('matriz_orc_v1_importacao').insert(payload.slice(i, i + BATCH));
    if (error) { setImportStatus('Erro ao inserir: ' + error.message, 'err'); return; }
  }

  setImportStatus(`${payload.length} linhas importadas com sucesso.`);
  $('csvFile').value = '';
  await loadImportedRaw(cfgId);
  if (viewMode === 'IMPORTADO') await loadRowsImportado(cfgId);
}

async function clearImport() {
  if (!canEdit('v1')) { setImportStatus('Sem permissão. Desbloqueie no Início.', 'warn'); return; }
  const cfgId = toNumber($('cfgSelect').value);
  if (!cfgId) { setImportStatus('Selecione uma configuração primeiro.', 'warn'); return; }
  if (!confirm('Limpar todos os dados importados desta configuração?')) return;
  const { error } = await supabase.schema('utfprct').from('matriz_orc_v1_importacao').delete().eq('configuracao_id', cfgId);
  if (error) { setImportStatus('Erro: ' + error.message, 'err'); return; }
  setImportStatus('Importação removida.');
  await loadImportedRaw(cfgId);
  if (viewMode === 'IMPORTADO') renderTable(true);
}

async function loadImportedRaw(cfgId) {
  const { data } = await supabase.schema('utfprct').from('matriz_orc_v1_importacao')
    .select('*').eq('configuracao_id', cfgId).order('departamento').order('disciplina');
  const body = $('importBody');
  $('importCount').textContent = `${(data||[]).length} linhas importadas`;
  if (!data || data.length === 0) { body.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:16px">Nenhum dado importado</td></tr>'; return; }
  body.innerHTML = data.map(r => `<tr>
    <td>${r.departamento||''}</td>
    <td>${r.professor||''}</td>
    <td>${r.disciplina||''}</td>
    <td>${r.turma||''}</td>
    <td>${r.nome_disc||''}</td>
    <td class="text-right">${toNumber(r.cht).toLocaleString('pt-BR')}</td>
    <td>${r.nivel_ensino||''}</td>
    <td class="text-right">${r.quantidade_alunos||0}</td>
    <td>${r.situacao_turma||''}</td>
  </tr>`).join('');
}

// ── Auth ───────────────────────────────────────────────────────────────────────
function applyAuth() {
  const ok = canEdit('v1');
  ['btnSalvarTudo','btnImportar','btnLimparImport'].forEach(id => {
    const el = $(id); if (!el) return;
    el.disabled = !ok;
    if (!ok) el.title = 'Sem permissão — desbloqueie no Início';
  });
}

// ── Init ───────────────────────────────────────────────────────────────────────
async function init() {
  await loadConfigs();
  $('cfgSelect').addEventListener('change', e => loadData(e.target.value));
  $('btnSalvarTudo').addEventListener('click', saveAll);
  $('btnImportar').addEventListener('click', importCSV);
  $('btnLimparImport').addEventListener('click', clearImport);
  $('importSection').addEventListener('toggle', function() {
    $('importChevron').style.transform = this.open ? 'rotate(180deg)' : '';
  });
  applyAuth();
}

init().catch(console.error);
