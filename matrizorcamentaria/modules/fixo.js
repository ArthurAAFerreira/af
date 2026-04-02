import { supabase } from '../services/supabase.js';
import { brMoney, toNumber } from './formatters.js';
import { renderNav } from './nav.js';
import { canEdit } from './auth.js';

renderNav('fixo.html');

const $ = id => document.getElementById(id);
const TIPOS = { GRADUACAO:'Graduação', POS_GRADUACAO:'Pós-Graduação', ADMINISTRATIVO:'Administrativo', GESTAO_DIRETORIA:'Gestão/Diretoria' };
const TIPO_COLORS = { GRADUACAO:'#1565c0', POS_GRADUACAO:'#6a1b9a', ADMINISTRATIVO:'#2e7d32', GESTAO_DIRETORIA:'#e65100' };

let fixoRows = [];

function setStatus(msg, cls = 'ok') {
  const el = $('statusMsg');
  el.style.display = '';
  el.className = `status ${cls}`;
  el.innerHTML = `<i class="fa-solid fa-${cls === 'ok' ? 'circle-check' : cls === 'warn' ? 'triangle-exclamation' : 'circle-xmark'}"></i> ${msg}`;
}

// ── Auth ────────────────────────────────────────────────────────────────────
function applyAuth() {
  const ok = canEdit('configuracao');
  $('btnSalvar').disabled = !ok;
  $('btnSalvar').title = ok ? '' : 'Sem permissão — desbloqueie no Início';

  if (ok) {
    $('authBadge').innerHTML = '<i class="fa-solid fa-lock-open"></i> Editável';
    $('authBadge').style.cssText = 'font-size:0.8rem;padding:4px 12px;border-radius:99px;font-weight:600;background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7';
  }

  document.querySelectorAll('.fixo-input').forEach(inp => inp.disabled = !ok);
}

// ── Config select ────────────────────────────────────────────────────────────
async function loadConfigs() {
  const { data } = await supabase.schema('utfprct')
    .from('matriz_orc_configuracao_base')
    .select('id,ano,descricao,ativo')
    .order('ano', { ascending: false });

  const sel = $('cfgSelect');
  sel.innerHTML = '<option value="">Selecionar...</option>';
  (data || []).forEach(c => {
    sel.innerHTML += `<option value="${c.id}">${c.ano}${c.descricao ? ' — ' + c.descricao : ''}${c.ativo ? ' ★' : ''}</option>`;
    if (c.ativo) sel.value = c.id;
  });

  if (sel.value) await loadFixo(sel.value);
}

// ── Load fixo values ─────────────────────────────────────────────────────────
async function loadFixo(cfgId) {
  if (!cfgId) { $('fixoPanel').style.display = 'none'; return; }

  const [{ data: units }, { data: valores }] = await Promise.all([
    supabase.schema('utfprct').from('matriz_orc_unidades')
      .select('id,sigla,nome,tipo,tipo_valor').eq('ativo', true).eq('tipo_valor', 'FIXO').order('sigla'),
    supabase.schema('utfprct').from('matriz_orc_valores_fixos')
      .select('unidade_id,valor_fixo').eq('configuracao_id', cfgId),
  ]);

  const mapValor = new Map((valores || []).map(v => [v.unidade_id, v.valor_fixo]));

  fixoRows = (units || []).map(u => ({
    unidade_id: u.id,
    sigla:      u.sigla,
    nome:       u.nome,
    tipo:       u.tipo,
    valor_fixo: toNumber(mapValor.get(u.id) ?? 0),
  }));

  $('fixoPanel').style.display = '';
  renderTable();
  applyAuth();
}

function renderTable() {
  const body = $('fixoBody');
  const empty = $('emptyMsg');

  if (!fixoRows.length) {
    body.innerHTML = '';
    empty.style.display = '';
    $('totalFixo').textContent = 'R$ 0,00';
    return;
  }
  empty.style.display = 'none';

  body.innerHTML = fixoRows.map((r, i) => `<tr>
    <td><strong>${r.sigla}</strong></td>
    <td><span style="font-size:0.78rem;color:var(--muted)">${r.nome}</span></td>
    <td><span style="font-size:0.75rem;padding:2px 8px;border-radius:99px;background:${TIPO_COLORS[r.tipo]}18;color:${TIPO_COLORS[r.tipo]};font-weight:600">${TIPOS[r.tipo]||r.tipo}</span></td>
    <td class="text-right">
      <input class="fixo-input" type="number" min="0" step="0.01" value="${r.valor_fixo}"
        data-i="${i}" style="width:160px;text-align:right" ${!canEdit('configuracao') ? 'disabled' : ''} />
    </td>
  </tr>`).join('');

  body.querySelectorAll('.fixo-input').forEach(inp => {
    inp.addEventListener('input', () => {
      fixoRows[Number(inp.dataset.i)].valor_fixo = toNumber(inp.value);
      updateTotal();
    });
  });

  updateTotal();
}

function updateTotal() {
  const total = fixoRows.reduce((s, r) => s + r.valor_fixo, 0);
  $('totalFixo').textContent = brMoney(total);
}

// ── Save ─────────────────────────────────────────────────────────────────────
async function save() {
  if (!canEdit('configuracao')) { setStatus('Sem permissão — desbloqueie no Início.', 'warn'); return; }
  const cfgId = toNumber($('cfgSelect').value);
  if (!cfgId) { setStatus('Selecione uma configuração.', 'warn'); return; }

  const payload = fixoRows.map(r => ({
    configuracao_id: cfgId,
    unidade_id:      r.unidade_id,
    valor_fixo:      r.valor_fixo,
  }));

  const { error } = await supabase.schema('utfprct')
    .from('matriz_orc_valores_fixos')
    .upsert(payload, { onConflict: 'configuracao_id,unidade_id' });

  if (error) { setStatus('Erro ao salvar: ' + error.message, 'err'); return; }
  setStatus('Valores fixos salvos com sucesso!');
}

// ── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  await loadConfigs();
  $('cfgSelect').addEventListener('change', e => loadFixo(e.target.value));
  $('btnSalvar').addEventListener('click', save);
  applyAuth();
}

init().catch(console.error);
