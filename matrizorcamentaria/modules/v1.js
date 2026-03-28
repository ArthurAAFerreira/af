import { supabase } from '../services/supabase.js';
import { brPercent, toNumber } from './formatters.js';
import { renderNav } from './nav.js';

renderNav('v1.html');

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
  const { data } = await supabase.schema('utfprct').from('matriz_orc_configuracao_base').select('id,ano,descricao,ativo,v1_peso_graduacao,v1_peso_pos_graduacao').order('id', { ascending: false });
  const sel = $('cfgSelect');
  sel.innerHTML = '<option value="">Selecionar...</option>';
  (data || []).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.ano}${c.descricao ? ' — ' + c.descricao : ''}${c.ativo ? ' ✓' : ''}`;
    opt.dataset.pg = c.v1_peso_graduacao;
    opt.dataset.pp = c.v1_peso_pos_graduacao;
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
  $('kpiPesoPos').textContent = brPercent(pp);

  const { data: cfg } = await supabase.schema('utfprct').from('matriz_orc_configuracao_base').select('*').eq('id', cfgId).single();
  currentCfg = cfg;

  const { data: unidades } = await supabase.schema('utfprct').from('matriz_orc_unidades').select('id,sigla,nome,tipo').eq('ativo', true).order('sigla');
  const { data: existentes } = await supabase.schema('utfprct').from('matriz_orc_v1_unidade').select('*').eq('configuracao_id', cfgId);

  const mapEx = new Map((existentes || []).map(e => [e.unidade_id, e]));
  rows = (unidades || []).map(u => {
    const ex = mapEx.get(u.id) || {};
    return {
      unidade_id: u.id, sigla: u.sigla, nome: u.nome, tipo: u.tipo,
      carga_horaria_graduacao: toNumber(ex.carga_horaria_graduacao),
      carga_horaria_pos: toNumber(ex.carga_horaria_pos),
      alunos_graduacao: toNumber(ex.alunos_graduacao),
      alunos_pos: toNumber(ex.alunos_pos),
      peso_unidade: ex.peso_unidade !== undefined ? toNumber(ex.peso_unidade) : 1,
    };
  });

  $('kpiUnidades').textContent = rows.length;
  renderTable();
}

function calcScore(r) {
  if (!currentCfg) return 0;
  const pg = currentCfg.v1_peso_graduacao / 100;
  const pp = currentCfg.v1_peso_pos_graduacao / 100;
  return (r.carga_horaria_graduacao * r.alunos_graduacao * pg + r.carga_horaria_pos * r.alunos_pos * pp) * r.peso_unidade;
}

function renderTable() {
  const body = $('v1Body');
  body.innerHTML = rows.map((r, i) => `<tr>
    <td><strong>${r.sigla}</strong><br><span style="font-size:0.78rem;color:var(--muted)">${r.nome}</span></td>
    <td><span style="font-size:0.75rem;padding:2px 8px;border-radius:99px;background:${TIPO_COLORS[r.tipo]}18;color:${TIPO_COLORS[r.tipo]};font-weight:600">${TIPOS[r.tipo]||r.tipo}</span></td>
    <td class="text-right"><input type="number" min="0" step="0.5" value="${r.carga_horaria_graduacao}" data-i="${i}" data-f="carga_horaria_graduacao" style="width:90px" /></td>
    <td class="text-right"><input type="number" min="0" step="0.5" value="${r.carga_horaria_pos}" data-i="${i}" data-f="carga_horaria_pos" style="width:90px" /></td>
    <td class="text-right"><input type="number" min="0" step="1" value="${r.alunos_graduacao}" data-i="${i}" data-f="alunos_graduacao" style="width:90px" /></td>
    <td class="text-right"><input type="number" min="0" step="1" value="${r.alunos_pos}" data-i="${i}" data-f="alunos_pos" style="width:90px" /></td>
    <td class="text-right"><input type="number" min="0" step="0.01" value="${r.peso_unidade}" data-i="${i}" data-f="peso_unidade" style="width:70px" /></td>
    <td class="text-right" data-score="${i}" style="font-variant-numeric:tabular-nums">${calcScore(r).toLocaleString('pt-BR',{maximumFractionDigits:4})}</td>
  </tr>`).join('');

  body.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', () => {
      const i = Number(inp.dataset.i);
      const f = inp.dataset.f;
      rows[i][f] = toNumber(inp.value);
      body.querySelector(`[data-score="${i}"]`).textContent = calcScore(rows[i]).toLocaleString('pt-BR', { maximumFractionDigits: 4 });
      updateTotals();
    });
  });
  updateTotals();
}

function updateTotals() {
  let chG = 0, chP = 0, alG = 0, alP = 0, sc = 0;
  rows.forEach(r => { chG += r.carga_horaria_graduacao; chP += r.carga_horaria_pos; alG += r.alunos_graduacao; alP += r.alunos_pos; sc += calcScore(r); });
  $('totCHGrad').textContent = chG.toLocaleString('pt-BR');
  $('totCHPos').textContent = chP.toLocaleString('pt-BR');
  $('totAlGrad').textContent = alG.toLocaleString('pt-BR');
  $('totAlPos').textContent = alP.toLocaleString('pt-BR');
  $('totScore').textContent = sc.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
}

async function saveAll() {
  const cfgId = toNumber($('cfgSelect').value);
  if (!cfgId) { setStatus('Selecione uma configuração.', 'warn'); return; }
  const payload = rows.map(r => ({
    configuracao_id: cfgId,
    unidade_id: r.unidade_id,
    carga_horaria_graduacao: r.carga_horaria_graduacao,
    carga_horaria_pos: r.carga_horaria_pos,
    alunos_graduacao: r.alunos_graduacao,
    alunos_pos: r.alunos_pos,
    peso_unidade: r.peso_unidade,
  }));
  const { error } = await supabase.schema('utfprct').from('matriz_orc_v1_unidade').upsert(payload, { onConflict: 'configuracao_id,unidade_id' });
  if (error) { setStatus('Erro ao salvar: ' + error.message, 'err'); return; }
  setStatus(`${payload.length} registros salvos com sucesso.`);
}

async function init() {
  await loadConfigs();
  $('cfgSelect').addEventListener('change', e => loadData(e.target.value));
  $('btnSalvarTudo').addEventListener('click', saveAll);
}

init().catch(console.error);
