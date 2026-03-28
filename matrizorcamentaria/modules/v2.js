import { supabase } from '../services/supabase.js';
import { brPercent, toNumber } from './formatters.js';
import { renderNav } from './nav.js';

renderNav('v2.html');

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
  if (!cfgId) { rows = []; $('v2Body').innerHTML = ''; return; }
  const { data: cfg } = await supabase.schema('utfprct').from('matriz_orc_configuracao_base').select('*').eq('id', cfgId).single();
  currentCfg = cfg;

  $('kpiPesoDocs').textContent = brPercent(cfg.v2_peso_docentes);
  $('kpiPesoTaes').textContent = brPercent(cfg.v2_peso_taes);
  $('kpiRegimes').textContent = `${cfg.v2_peso_20h} / ${cfg.v2_peso_40h} / ${cfg.v2_peso_de}`;

  const { data: unidades } = await supabase.schema('utfprct').from('matriz_orc_unidades').select('id,sigla,nome,tipo').eq('ativo', true).order('sigla');
  const { data: existentes } = await supabase.schema('utfprct').from('matriz_orc_v2_unidade').select('*').eq('configuracao_id', cfgId);
  const mapEx = new Map((existentes || []).map(e => [e.unidade_id, e]));

  rows = (unidades || []).map(u => {
    const ex = mapEx.get(u.id) || {};
    return {
      unidade_id: u.id, sigla: u.sigla, nome: u.nome, tipo: u.tipo,
      docentes_20h: toNumber(ex.docentes_20h),
      docentes_40h: toNumber(ex.docentes_40h),
      docentes_de: toNumber(ex.docentes_de),
      taes_parcial: toNumber(ex.taes_parcial),
      taes_integral: toNumber(ex.taes_integral),
      docentes_funcao_parcial: toNumber(ex.docentes_funcao_parcial),
      docentes_funcao_integral: toNumber(ex.docentes_funcao_integral),
    };
  });

  $('kpiUnidades').textContent = rows.length;
  renderTable();
}

function calcScore(r) {
  if (!currentCfg) return 0;
  const c = currentCfg;
  const docsScore = (r.docentes_20h * c.v2_peso_20h + r.docentes_40h * c.v2_peso_40h + r.docentes_de * c.v2_peso_de) * c.v2_peso_docentes / 100;
  const taesScore = (r.taes_parcial * c.v2_peso_funcao_parcial + r.taes_integral * c.v2_peso_funcao_integral) * c.v2_peso_taes / 100;
  const funcScore = (r.docentes_funcao_parcial * c.v2_peso_funcao_parcial + r.docentes_funcao_integral * c.v2_peso_funcao_integral) * c.v2_peso_docentes / 100;
  return docsScore + taesScore + funcScore;
}

const FIELDS = ['docentes_20h','docentes_40h','docentes_de','taes_parcial','taes_integral','docentes_funcao_parcial','docentes_funcao_integral'];

function renderTable() {
  const body = $('v2Body');
  body.innerHTML = rows.map((r, i) => `<tr>
    <td><strong>${r.sigla}</strong><br><span style="font-size:0.75rem;padding:2px 8px;border-radius:99px;background:${TIPO_COLORS[r.tipo]}18;color:${TIPO_COLORS[r.tipo]};font-weight:600">${TIPOS[r.tipo]||r.tipo}</span></td>
    ${FIELDS.map(f => `<td class="text-right"><input type="number" min="0" step="1" value="${r[f]}" data-i="${i}" data-f="${f}" style="width:72px" /></td>`).join('')}
    <td class="text-right" data-score="${i}" style="font-variant-numeric:tabular-nums">${calcScore(r).toLocaleString('pt-BR',{maximumFractionDigits:4})}</td>
  </tr>`).join('');

  body.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', () => {
      const i = Number(inp.dataset.i);
      rows[i][inp.dataset.f] = toNumber(inp.value);
      body.querySelector(`[data-score="${i}"]`).textContent = calcScore(rows[i]).toLocaleString('pt-BR', { maximumFractionDigits: 4 });
      updateTotals();
    });
  });
  updateTotals();
}

function updateTotals() {
  const ids = ['tot20h','tot40h','totDE','totTaePar','totTaeInt','totFuncPar','totFuncInt'];
  const flds = FIELDS;
  const sums = flds.map(() => 0);
  let sc = 0;
  rows.forEach(r => { flds.forEach((f, fi) => { sums[fi] += r[f]; }); sc += calcScore(r); });
  ids.forEach((id, fi) => { $(id).textContent = sums[fi].toLocaleString('pt-BR'); });
  $('totScore').textContent = sc.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
}

async function saveAll() {
  const cfgId = toNumber($('cfgSelect').value);
  if (!cfgId) { setStatus('Selecione uma configuração.', 'warn'); return; }
  const payload = rows.map(r => ({
    configuracao_id: cfgId,
    unidade_id: r.unidade_id,
    docentes_20h: r.docentes_20h,
    docentes_40h: r.docentes_40h,
    docentes_de: r.docentes_de,
    taes_parcial: r.taes_parcial,
    taes_integral: r.taes_integral,
    docentes_funcao_parcial: r.docentes_funcao_parcial,
    docentes_funcao_integral: r.docentes_funcao_integral,
  }));
  const { error } = await supabase.schema('utfprct').from('matriz_orc_v2_unidade').upsert(payload, { onConflict: 'configuracao_id,unidade_id' });
  if (error) { setStatus('Erro ao salvar: ' + error.message, 'err'); return; }
  setStatus(`${payload.length} registros salvos.`);
}

async function init() {
  await loadConfigs();
  $('cfgSelect').addEventListener('change', e => loadData(e.target.value));
  $('btnSalvarTudo').addEventListener('click', saveAll);
}

init().catch(console.error);
