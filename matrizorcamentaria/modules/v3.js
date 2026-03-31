import { supabase } from '../services/supabase.js';
import { toNumber } from './formatters.js';
import { renderNav } from './nav.js';
import { canEdit } from './auth.js';

renderNav('v3.html');

const $ = id => document.getElementById(id);
const TIPOS = { GRADUACAO:'Graduação', POS_GRADUACAO:'Pós-Graduação', ADMINISTRATIVO:'Administrativo', GESTAO_DIRETORIA:'Gestão/Diretoria' };
const TIPO_COLORS = { GRADUACAO:'#1565c0', POS_GRADUACAO:'#6a1b9a', ADMINISTRATIVO:'#2e7d32', GESTAO_DIRETORIA:'#e65100' };
let currentCfg = null;
let rows = [];

function setStatus(msg, cls = 'ok') {
  const el = $('statusMsg');
  el.className = `status ${cls}`;
  el.innerHTML = `<i class="fa-solid fa-${cls === 'ok' ? 'circle-check' : cls === 'warn' ? 'triangle-exclamation' : 'circle-xmark'}"></i> ${msg}`;
}

async function loadConfigs() {
  const { data } = await supabase.schema('utfprct').from('matriz_orc_configuracao_base').select('*').order('id', { ascending: false });
  const sel = $('cfgSelect');
  sel.innerHTML = '<option value="">Selecionar...</option>';
  (data || []).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.ano}${c.descricao ? ' — ' + c.descricao : ''}${c.ativo ? ' ✓' : ''}`;
    sel.appendChild(opt);
  });
  const active = (data || []).find(c => c.ativo);
  if (active) { sel.value = String(active.id); await loadData(active.id); }
}

async function loadData(cfgId) {
  if (!cfgId) { rows = []; $('v3Body').innerHTML = ''; return; }
  const { data: cfg } = await supabase.schema('utfprct').from('matriz_orc_configuracao_base').select('*').eq('id', cfgId).single();
  currentCfg = cfg;

  $('kpiGrad').textContent = cfg.v3_peso_graduacao;
  $('kpiEsp').textContent = cfg.v3_peso_especializacao;
  $('kpiMest').textContent = cfg.v3_peso_mestrado;
  $('kpiDout').textContent = cfg.v3_peso_doutorado;

  const { data: unidades } = await supabase.schema('utfprct').from('matriz_orc_unidades').select('id,sigla,nome,tipo').eq('ativo', true).order('sigla');
  const { data: existentes } = await supabase.schema('utfprct').from('matriz_orc_v3_unidade').select('*').eq('configuracao_id', cfgId);
  const mapEx = new Map((existentes || []).map(e => [e.unidade_id, e]));

  rows = (unidades || []).map(u => {
    const ex = mapEx.get(u.id) || {};
    return {
      unidade_id: u.id, sigla: u.sigla, nome: u.nome, tipo: u.tipo,
      docentes_graduacao: toNumber(ex.docentes_graduacao),
      docentes_especializacao: toNumber(ex.docentes_especializacao),
      docentes_mestrado: toNumber(ex.docentes_mestrado),
      docentes_doutorado: toNumber(ex.docentes_doutorado),
    };
  });

  $('kpiUnidades').textContent = rows.length;
  renderTable();
}

function calcScore(r) {
  if (!currentCfg) return 0;
  const c = currentCfg;
  return r.docentes_graduacao * c.v3_peso_graduacao
       + r.docentes_especializacao * c.v3_peso_especializacao
       + r.docentes_mestrado * c.v3_peso_mestrado
       + r.docentes_doutorado * c.v3_peso_doutorado;
}

const FIELDS = ['docentes_graduacao','docentes_especializacao','docentes_mestrado','docentes_doutorado'];

function renderTable() {
  const editable = canEdit('v3');
  const body = $('v3Body');
  body.innerHTML = rows.map((r, i) => {
    const total = r.docentes_graduacao + r.docentes_especializacao + r.docentes_mestrado + r.docentes_doutorado;
    return `<tr>
      <td><strong>${r.sigla}</strong><br><span style="font-size:0.75rem;padding:2px 8px;border-radius:99px;background:${TIPO_COLORS[r.tipo]}18;color:${TIPO_COLORS[r.tipo]};font-weight:600">${TIPOS[r.tipo]||r.tipo}</span></td>
      ${FIELDS.map(f => editable
        ? `<td class="text-right"><input type="number" min="0" step="1" value="${r[f]}" data-i="${i}" data-f="${f}" style="width:80px" /></td>`
        : `<td class="text-right">${r[f].toLocaleString('pt-BR')}</td>`
      ).join('')}
      <td class="text-right" data-total="${i}">${total}</td>
      <td class="text-right" data-score="${i}" style="font-variant-numeric:tabular-nums">${calcScore(r).toLocaleString('pt-BR',{maximumFractionDigits:2})}</td>
    </tr>`;
  }).join('');

  if (editable) {
    body.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('input', () => {
        const i = Number(inp.dataset.i);
        rows[i][inp.dataset.f] = toNumber(inp.value);
        const total = FIELDS.reduce((s, f) => s + rows[i][f], 0);
        body.querySelector(`[data-total="${i}"]`).textContent = total;
        body.querySelector(`[data-score="${i}"]`).textContent = calcScore(rows[i]).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
        updateTotals();
      });
    });
  }
  updateTotals();
}

function updateTotals() {
  const ids = ['totGrad','totEsp','totMest','totDout'];
  const sums = [0, 0, 0, 0];
  let total = 0, sc = 0;
  rows.forEach(r => {
    FIELDS.forEach((f, fi) => { sums[fi] += r[f]; });
    total += FIELDS.reduce((s, f) => s + r[f], 0);
    sc += calcScore(r);
  });
  ids.forEach((id, fi) => $(id).textContent = sums[fi].toLocaleString('pt-BR'));
  $('totTotal').textContent = total.toLocaleString('pt-BR');
  $('totScore').textContent = sc.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

async function saveAll() {
  if (!canEdit('v3')) { setStatus('Sem permissão. Desbloqueie no Início.', 'warn'); return; }
  const cfgId = toNumber($('cfgSelect').value);
  if (!cfgId) { setStatus('Selecione uma configuração.', 'warn'); return; }
  const payload = rows.map(r => ({
    configuracao_id: cfgId,
    unidade_id: r.unidade_id,
    docentes_graduacao: r.docentes_graduacao,
    docentes_especializacao: r.docentes_especializacao,
    docentes_mestrado: r.docentes_mestrado,
    docentes_doutorado: r.docentes_doutorado,
  }));
  const { error } = await supabase.schema('utfprct').from('matriz_orc_v3_unidade').upsert(payload, { onConflict: 'configuracao_id,unidade_id' });
  if (error) { setStatus('Erro ao salvar: ' + error.message, 'err'); return; }
  setStatus(`${payload.length} registros salvos.`);
}

function applyAuth() {
  const ok = canEdit('v3');
  const el = $('btnSalvarTudo'); if (!el) return;
  el.disabled = !ok;
  if (!ok) el.title = 'Sem permissão — desbloqueie no Início';
}

async function init() {
  await loadConfigs();
  $('cfgSelect').addEventListener('change', e => loadData(e.target.value));
  $('btnSalvarTudo').addEventListener('click', saveAll);
  applyAuth();
}

init().catch(console.error);
