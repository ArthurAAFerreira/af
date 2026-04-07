import { supabase } from '../services/supabase.js';
import { brMoney, toNumber } from './formatters.js';
import { renderNav } from './nav.js';
import { getAuth } from './auth.js';

renderNav('cronograma.html');

const $ = id => document.getElementById(id);
const BIMS = ['Jan–Fev','Mar–Abr','Mai–Jun','Jul–Ago','Set–Out','Nov–Dez'];

let cfg = null;
let unidades = [];       // { id, sigla, nome, valor_estimado }
let gastos = {};         // { `${unidade_id}_${bimestre}`: valor }
let dirty = new Set();

function canEdit() {
  const { perms } = getAuth();
  return perms.includes('*') || perms.includes('cronograma');
}

function setStatus(msg, cls = 'ok') {
  const el = $('statusMsg');
  el.className = `status ${cls}`;
  const icon = cls === 'ok' ? 'circle-check' : cls === 'warn' ? 'triangle-exclamation' : 'circle-xmark';
  el.innerHTML = `<i class="fa-solid fa-${icon}"></i> ${msg}`;
}

function cellKey(uid, bim) { return `${uid}_${bim}`; }

function sumForUnit(uid) {
  return [1,2,3,4,5,6].reduce((s, b) => s + toNumber(gastos[cellKey(uid, b)] ?? 0), 0);
}

function totalPlanejado() {
  return unidades.reduce((s, u) => s + sumForUnit(u.id), 0);
}

function updateKpis() {
  const vb = unidades.reduce((s, u) => s + toNumber(u.valor_estimado), 0);
  const pl = totalPlanejado();
  $('kpiPlaneado').textContent = brMoney(pl);
  $('kpiDisp').textContent     = brMoney(Math.max(0, vb - pl));
}

function updateTotaisRow() {
  const totais = [1,2,3,4,5,6].map(b =>
    unidades.reduce((s, u) => s + toNumber(gastos[cellKey(u.id, b)] ?? 0), 0)
  );
  const grand = totais.reduce((s, v) => s + v, 0);
  const vb    = unidades.reduce((s, u) => s + toNumber(u.valor_estimado), 0);
  $('cronogramaTotais').innerHTML = `
    <tr class="row-total">
      <td>TOTAL</td>
      <td class="text-right">${brMoney(vb)}</td>
      ${totais.map(v => `<td class="text-right">${brMoney(v)}</td>`).join('')}
      <td class="text-right">${brMoney(grand)}</td>
      <td></td>
    </tr>`;
}

function updateRow(uid) {
  const u      = unidades.find(x => x.id === uid);
  const soma   = sumForUnit(uid);
  const limite = toNumber(u.valor_estimado);
  const saldo  = limite - soma;
  const over   = saldo < -0.005;

  const somaCell  = document.getElementById(`soma_${uid}`);
  const saldoCell = document.getElementById(`saldo_${uid}`);
  if (somaCell)  somaCell.textContent  = brMoney(soma);
  if (saldoCell) {
    saldoCell.textContent  = brMoney(saldo);
    saldoCell.style.color  = over ? 'var(--err)' : saldo < 0.005 ? 'var(--ok)' : '';
    saldoCell.style.fontWeight = over ? '700' : '';
  }

  [1,2,3,4,5,6].forEach(b => {
    const inp = document.getElementById(`inp_${uid}_${b}`);
    if (inp) inp.style.borderColor = over ? 'var(--err)' : '';
  });

  updateKpis();
  updateTotaisRow();
}

function buildTable() {
  const ok = canEdit();
  const vb = unidades.reduce((s, u) => s + toNumber(u.valor_estimado), 0);
  $('kpiVB').textContent = brMoney(vb);

  const tbody = $('cronogramaBody');
  tbody.innerHTML = unidades.map(u => {
    const limite = toNumber(u.valor_estimado);
    const bimCells = [1,2,3,4,5,6].map(b => {
      const val = toNumber(gastos[cellKey(u.id, b)] ?? 0);
      if (ok) {
        return `<td class="text-right col-bim">
          <input type="number" id="inp_${u.id}_${b}" value="${val.toFixed(2)}"
            min="0" step="100"
            style="width:100px;text-align:right;border:1.5px solid var(--line);border-radius:6px;padding:3px 6px;font-family:inherit;font-size:0.82rem"
            data-uid="${u.id}" data-bim="${b}" />
        </td>`;
      }
      return `<td class="text-right col-bim">${brMoney(val)}</td>`;
    }).join('');

    return `<tr>
      <td><strong>${u.sigla}</strong> <span style="color:var(--muted);font-size:0.8rem">${u.nome}</span></td>
      <td class="text-right">${brMoney(limite)}</td>
      ${bimCells}
      <td class="text-right" id="soma_${u.id}">${brMoney(sumForUnit(u.id))}</td>
      <td class="text-right" id="saldo_${u.id}">${brMoney(limite - sumForUnit(u.id))}</td>
    </tr>`;
  }).join('');

  if (ok) {
    tbody.querySelectorAll('input[data-uid]').forEach(inp => {
      inp.addEventListener('input', () => {
        const uid = Number(inp.dataset.uid);
        const bim = Number(inp.dataset.bim);
        gastos[cellKey(uid, bim)] = toNumber(inp.value);
        dirty.add(cellKey(uid, bim));
        updateRow(uid);
      });
    });
  }

  updateTotaisRow();
  updateKpis();
}

async function salvar() {
  if (!canEdit()) { setStatus('Sem permissão.', 'warn'); return; }
  if (!dirty.size) { setStatus('Nenhuma alteração a salvar.', 'warn'); return; }

  const rows = [...dirty].map(key => {
    const [uid, bim] = key.split('_').map(Number);
    return {
      configuracao_id: cfg.id,
      unidade_id: uid,
      bimestre: bim,
      valor: toNumber(gastos[key] ?? 0),
    };
  });

  const { error } = await supabase.schema('utfprct')
    .from('matriz_orc_cronograma_gastos')
    .upsert(rows, { onConflict: 'configuracao_id,unidade_id,bimestre' });

  if (error) { setStatus('Erro ao salvar: ' + error.message, 'err'); return; }
  dirty.clear();
  setStatus(`${rows.length} registro(s) salvos com sucesso.`);
}

async function init() {
  const { data: cfgData } = await supabase.schema('utfprct')
    .from('matriz_orc_configuracao_base')
    .select('*').eq('ativo', true).order('id', { ascending: false }).limit(1).maybeSingle();

  if (!cfgData) {
    setStatus('Nenhuma configuração ativa. Acesse Configuração para criar uma.', 'warn');
    return;
  }
  cfg = cfgData;
  const rl = toNumber(cfg.recurso_liquido);
  $('cfgInfo').innerHTML = `<i class="fa-solid fa-circle-info"></i> Configuração ativa: <strong>${cfg.ano}${cfg.descricao ? ' — ' + cfg.descricao : ''}</strong>`;
  $('kpiRL').textContent = brMoney(rl);

  const [{ data: scoreRows }, { data: units }, { data: valoresFixos }, { data: gastosData }] = await Promise.all([
    supabase.schema('utfprct').from('vw_matriz_orc_resultado').select('unidade_id,valor_estimado'),
    supabase.schema('utfprct').from('matriz_orc_unidades').select('id,sigla,nome').eq('ativo', true).order('sigla'),
    supabase.schema('utfprct').from('matriz_orc_valores_fixos').select('unidade_id,valor_fixo').eq('configuracao_id', cfg.id),
    supabase.schema('utfprct').from('matriz_orc_cronograma_gastos').select('*').eq('configuracao_id', cfg.id),
  ]);

  const scoreMap = new Map((scoreRows || []).map(r => [r.unidade_id, toNumber(r.valor_estimado)]));
  const fixoMap  = new Map((valoresFixos || []).map(r => [r.unidade_id, toNumber(r.valor_fixo)]));

  unidades = (units || []).map(u => ({
    ...u,
    valor_estimado: fixoMap.has(u.id) ? fixoMap.get(u.id) : (scoreMap.get(u.id) ?? 0),
  })).filter(u => u.valor_estimado > 0);

  gastos = {};
  (gastosData || []).forEach(g => {
    gastos[cellKey(g.unidade_id, g.bimestre)] = toNumber(g.valor);
  });

  buildTable();
  $('btnSalvar').addEventListener('click', salvar);
  if (!canEdit()) $('btnSalvar').disabled = true;
}

init().catch(console.error);
