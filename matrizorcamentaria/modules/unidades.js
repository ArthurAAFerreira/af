import { supabase } from '../services/supabase.js';
import { renderNav } from './nav.js';
import { canEdit } from './auth.js';

renderNav('unidades.html');

const $ = id => document.getElementById(id);
let currentId = null;
let allUnidades = [];
const TIPOS = { GRADUACAO:'Graduação', POS_GRADUACAO:'Pós-Graduação', ADMINISTRATIVO:'Administrativo', GESTAO_DIRETORIA:'Gestão/Diretoria' };
const TIPO_COLORS = { GRADUACAO:'#1565c0', POS_GRADUACAO:'#6a1b9a', ADMINISTRATIVO:'#2e7d32', GESTAO_DIRETORIA:'#e65100' };

function setStatus(msg, cls = 'ok') {
  const el = $('statusMsg');
  el.className = `status ${cls}`;
  el.innerHTML = `<i class="fa-solid fa-${cls === 'ok' ? 'circle-check' : cls === 'warn' ? 'triangle-exclamation' : 'circle-xmark'}"></i> ${msg}`;
}

async function loadUnidades() {
  const { data } = await supabase.schema('utfprct').from('matriz_orc_unidades').select('*').order('sigla');
  allUnidades = data || [];
  renderTable(allUnidades);
}

function renderTable(list) {
  $('totalUnidades').textContent = list.length;
  const body = $('unidadesBody');
  if (!list.length) {
    body.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px">Nenhuma unidade encontrada.</td></tr>';
    return;
  }
  body.innerHTML = list.map(u => `<tr>
    <td><strong>${u.sigla}</strong></td>
    <td>${u.nome}</td>
    <td><span style="font-size:0.78rem;padding:2px 10px;border-radius:99px;background:${TIPO_COLORS[u.tipo]}18;color:${TIPO_COLORS[u.tipo]};font-weight:600">${TIPOS[u.tipo] || u.tipo}</span></td>
    <td>${u.campus || '—'}</td>
    <td>${u.ativo ? '<span style="color:var(--ok);font-weight:700"><i class="fa-solid fa-circle-check"></i> Ativa</span>' : '<span style="color:var(--muted)"><i class="fa-solid fa-circle-xmark"></i> Inativa</span>'}</td>
    <td class="text-center">
      <button onclick="editUnidade(${u.id})" class="btn btn-secondary" style="padding:4px 10px;font-size:0.78rem"><i class="fa-solid fa-pen"></i></button>
    </td>
  </tr>`).join('');
}

window.editUnidade = function(id) {
  const u = allUnidades.find(x => x.id === id);
  if (!u) return;
  currentId = u.id;
  $('uCampus').value = u.campus || 'CT';
  $('uSigla').value = u.sigla;
  $('uNome').value = u.nome;
  $('uTipo').value = u.tipo;
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

function clearForm() {
  currentId = null;
  $('uCampus').value = 'CT';
  $('uSigla').value = '';
  $('uNome').value = '';
  $('uTipo').value = 'GRADUACAO';
}

async function save(isUpdate) {
  if (!canEdit('unidades')) { setStatus('Sem permissão. Desbloqueie no Início.', 'warn'); return; }
  const campus = $('uCampus').value;
  const sigla = $('uSigla').value.trim().toUpperCase();
  const nome = $('uNome').value.trim();
  const tipo = $('uTipo').value;

  if (!sigla || !nome) { setStatus('Preencha sigla e nome.', 'warn'); return; }

  const payload = { campus, sigla, nome, tipo, ativo: true };

  if (isUpdate) {
    if (!currentId) { setStatus('Selecione uma unidade para atualizar.', 'warn'); return; }
    const { error } = await supabase.schema('utfprct').from('matriz_orc_unidades').update(payload).eq('id', currentId);
    if (error) { setStatus('Erro: ' + error.message, 'err'); return; }
    setStatus('Unidade atualizada.');
  } else {
    const { error } = await supabase.schema('utfprct').from('matriz_orc_unidades').insert(payload);
    if (error) { setStatus('Erro: ' + error.message, 'err'); return; }
    setStatus('Unidade cadastrada.');
  }
  clearForm();
  await loadUnidades();
}

async function deactivate() {
  if (!canEdit('unidades')) { setStatus('Sem permissão. Desbloqueie no Início.', 'warn'); return; }
  if (!currentId) { setStatus('Selecione uma unidade para desativar.', 'warn'); return; }
  if (!confirm('Desativar esta unidade?')) return;
  const { error } = await supabase.schema('utfprct').from('matriz_orc_unidades').update({ ativo: false }).eq('id', currentId);
  if (error) { setStatus('Erro: ' + error.message, 'err'); return; }
  setStatus('Unidade desativada.');
  clearForm();
  await loadUnidades();
}

function toInt(v) { const n = parseInt(v); return isNaN(n) ? null : n; }

function applyAuth() {
  const ok = canEdit('unidades');
  ['btnSalvar', 'btnAtualizar', 'btnExcluir'].forEach(id => {
    const el = $(id); if (!el) return;
    el.disabled = !ok;
    if (!ok) el.title = 'Sem permissão — desbloqueie no Início';
  });
}

async function init() {
  await loadUnidades();

  $('btnSalvar').addEventListener('click', () => save(false));
  $('btnAtualizar').addEventListener('click', () => save(true));
  $('btnExcluir').addEventListener('click', deactivate);
  $('btnNova').addEventListener('click', clearForm);
  applyAuth();
  $('filtroTipo').addEventListener('change', e => {
    const tipo = e.target.value;
    renderTable(tipo ? allUnidades.filter(u => u.tipo === tipo) : allUnidades);
  });
  $('uSigla').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase(); });
}

init().catch(console.error);
