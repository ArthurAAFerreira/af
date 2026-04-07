import { supabase } from '../services/supabase.js';
import { brMoney, brPercent, toNumber } from './formatters.js';
import { renderNav } from './nav.js';
import { getAuth } from './auth.js';

renderNav('repasse.html');

const $ = id => document.getElementById(id);
const TRIS = ['Jan–Mar','Abr–Jun','Jul–Set','Out–Dez'];

let cfg     = null;
let unidades = [];   // { id, sigla, nome, valor_estimado }
let gastosBim = {};  // { `${uid}_${bim}`: valor } — cronograma de gastos
let dispBim = {};    // { bimestre: valor_disponivel } — repasse bimestral
let itensBim = {};   // { `${uid}_${bim}`: { id?, valor_calculado, valor_enviado, fixado, enviado } }
let remanejamentos = []; // array do banco
let remItens = {};   // { remId: [{ id?, unidade_id, valor, percentual, fixado, enviado }] }

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

// ─── UTILIDADES DE CÁLCULO ───────────────────────────────────────────────────

function distribuirProporcionalmente(disponivel, bases, itensMap) {
  // bases: { uid: valor_base }; itensMap: { uid: { valor, fixado } }
  const fixados     = Object.entries(itensMap).filter(([, v]) => v.fixado);
  const naoFixados  = Object.entries(itensMap).filter(([, v]) => !v.fixado);

  const somaFixados = fixados.reduce((s, [, v]) => s + toNumber(v.valor), 0);
  const restante    = Math.max(0, disponivel - somaFixados);
  const totalBase   = naoFixados.reduce((s, [uid]) => s + toNumber(bases[uid] ?? 0), 0);

  const result = { ...Object.fromEntries(Object.entries(itensMap).map(([uid, v]) => [uid, { ...v }])) };

  if (totalBase <= 0 || naoFixados.length === 0) {
    naoFixados.forEach(([uid]) => { result[uid].valor = 0; });
    return result;
  }

  let somaDistribuida = 0;
  naoFixados.forEach(([uid], idx) => {
    const base = toNumber(bases[uid] ?? 0);
    const prop = base / totalBase * restante;
    if (idx === naoFixados.length - 1) {
      result[uid].valor = Math.max(0, restante - somaDistribuida);
    } else {
      const v = Math.round(prop * 100) / 100;
      result[uid].valor = v;
      somaDistribuida += v;
    }
  });

  return result;
}

// ─── ABA 1: BIMESTRAL ────────────────────────────────────────────────────────

function bimBase(bim) {
  // Base proporcional por unidade naquele bimestre = gastos planejados
  const out = {};
  unidades.forEach(u => { out[u.id] = toNumber(gastosBim[`${u.id}_${bim}`] ?? 0); });
  return out;
}

function recalcBim(bim) {
  const disp  = toNumber(dispBim[bim] ?? 0);
  const bases = bimBase(bim);
  const total = Object.values(bases).reduce((s, v) => s + v, 0);

  const current = {};
  unidades.forEach(u => {
    const key = `${u.id}_${bim}`;
    current[u.id] = itensBim[key] ?? { valor_calculado: 0, valor_enviado: null, fixado: false, enviado: false };
  });

  if (total <= 0) {
    // Sem gastos planejados: dividir igualmente entre não-fixados
    const nfList = unidades.filter(u => !current[u.id].fixado);
    const share  = nfList.length > 0 ? disp / nfList.length : 0;
    nfList.forEach((u, i) => {
      current[u.id].valor_calculado = i === nfList.length - 1
        ? Math.max(0, disp - share * (nfList.length - 1))
        : Math.round(share * 100) / 100;
    });
  } else {
    const itMap = Object.fromEntries(unidades.map(u => [u.id, { valor: current[u.id].valor_calculado, fixado: current[u.id].fixado }]));
    const dist  = distribuirProporcionalmente(disp, bases, itMap);
    unidades.forEach(u => { if (!current[u.id].fixado) current[u.id].valor_calculado = dist[u.id].valor; });
  }

  unidades.forEach(u => { itensBim[`${u.id}_${bim}`] = current[u.id]; });
}

async function salvarBim(bim) {
  if (!canEdit()) return;
  // Salvar valor disponível
  const { error: e1 } = await supabase.schema('utfprct')
    .from('matriz_orc_repasse_bimestral')
    .upsert({ configuracao_id: cfg.id, bimestre: bim, valor_disponivel: toNumber(dispBim[bim] ?? 0) },
      { onConflict: 'configuracao_id,bimestre' });
  if (e1) { setStatus('Erro ao salvar bimestre: ' + e1.message, 'err'); return; }

  // Salvar itens
  const rows = unidades.map(u => {
    const it = itensBim[`${u.id}_${bim}`] ?? {};
    return {
      configuracao_id: cfg.id, unidade_id: u.id, bimestre: bim,
      valor_calculado: toNumber(it.valor_calculado ?? 0),
      valor_enviado:   it.valor_enviado != null ? toNumber(it.valor_enviado) : null,
      fixado: it.fixado ?? false,
      enviado: it.enviado ?? false,
    };
  });
  const { error: e2 } = await supabase.schema('utfprct')
    .from('matriz_orc_repasse_item')
    .upsert(rows, { onConflict: 'configuracao_id,unidade_id,bimestre' });
  if (e2) { setStatus('Erro ao salvar itens: ' + e2.message, 'err'); return; }
  setStatus(`Trimestre ${bim} salvo.`);
  updateGlobalKpis();
}

function renderBimestral() {
  $('bimDispPanel').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
      ${[1,2,3,4].map(t => {
        const val = toNumber(dispBim[t] ?? 0);
        return `<div style="border:1px solid var(--line);border-radius:var(--radius-sm);padding:10px;background:#f8fbff">
          <div style="font-size:0.78rem;font-weight:700;color:var(--accent);margin-bottom:6px">${t}º Trimestre — ${TRIS[t-1]}</div>
          <label style="font-size:0.75rem;color:var(--muted)">Valor disponível para repasse</label>
          <input type="number" id="disp_${t}" class="bim-disp-input" value="${val.toFixed(2)}" min="0" step="100"
            ${canEdit() ? '' : 'disabled'} style="display:block;margin-top:4px;width:100%" />
        </div>`;
      }).join('')}
    </div>
    <div style="margin-top:10px;display:flex;align-items:center;gap:8px">
      <span style="font-size:0.82rem;color:var(--muted)" id="bimDispSoma"></span>
    </div>`;

  updateBimDispSoma();

  [1,2,3,4].forEach(t => {
    const inp = $(`disp_${t}`);
    if (inp) inp.addEventListener('change', () => {
      dispBim[t] = toNumber(inp.value);
      updateBimDispSoma();
    });
  });

  renderBimTable();
}

function updateBimDispSoma() {
  const soma = [1,2,3,4].reduce((s,t) => s + toNumber(dispBim[t] ?? 0), 0);
  const rl   = toNumber(cfg?.recurso_liquido ?? 0);
  const diff = soma - rl;
  const el   = $('bimDispSoma');
  if (el) el.innerHTML = `Soma dos trimestres: <strong>${brMoney(soma)}</strong>
    ${Math.abs(diff) > 0.5 ? `<span style="color:${diff > 0 ? 'var(--err)' : 'var(--warn)'}">
      (${diff > 0 ? '+' : ''}${brMoney(diff)} em relação ao Recurso Líquido)</span>` : ''}`;
}

function renderBimTable() {
  const ok = canEdit();

  const theadR1 = `<tr>
    <th rowspan="2" style="min-width:90px">Unidade</th>
    ${[1,2,3,4].map(t => {
      const disp = toNumber(dispBim[t] ?? 0);
      return `<th colspan="2" class="text-center" style="background:var(--accent);color:#fff;border-left:3px solid #fff">
        ${t}º Tri — ${TRIS[t-1]}<br>
        <small style="font-weight:400;font-size:0.72rem">Disp: ${brMoney(disp)}</small>
      </th>`;
    }).join('')}
  </tr>`;

  const theadR2 = `<tr>
    ${[1,2,3,4].map(() => `
      <th class="text-right" style="border-left:3px solid var(--line);white-space:nowrap">Enviado (R$)</th>
      <th class="text-center">Ações</th>
    `).join('')}
  </tr>`;

  const bodyRows = unidades.map(u => {
    const cells = [1,2,3,4].map(t => {
      const key = `${u.id}_${t}`;
      const it  = itensBim[key] ?? { valor_calculado: 0, valor_enviado: null, fixado: false, enviado: false };
      const ve  = it.valor_enviado != null ? toNumber(it.valor_enviado) : toNumber(it.valor_calculado);
      const bls = 'border-left:3px solid var(--line)';
      return `
        <td class="text-right" style="${bls}">
          ${ok ? `<input type="number" class="val-input" id="ve_${u.id}_${t}"
            value="${ve.toFixed(2)}" min="0" step="100"
            data-uid="${u.id}" data-bim="${t}" />` : brMoney(ve)}
        </td>
        <td class="text-center" style="white-space:nowrap">
          <button onclick="toggleFixadoBim(${u.id},${t})" title="${it.fixado ? 'Des-fixar' : 'Fixar'}"
            style="font-size:0.78rem;padding:2px 6px;border-radius:5px;border:1px solid ${it.fixado ? '#e65100' : 'var(--line)'};background:${it.fixado ? '#fff3e0' : '#fff'}">
            <i class="fa-solid fa-${it.fixado ? 'lock' : 'lock-open'}"></i>
          </button>
          <button onclick="toggleEnviadoBim(${u.id},${t})" title="${it.enviado ? 'Desmarcar' : 'Confirmar envio'}"
            style="font-size:0.78rem;padding:2px 6px;border-radius:5px;border:1px solid ${it.enviado ? 'var(--ok)' : 'var(--line)'};background:${it.enviado ? 'var(--ok-bg)' : '#fff'}">
            <i class="fa-solid fa-${it.enviado ? 'check-circle' : 'circle'}"></i>
          </button>
        </td>`;
    }).join('');
    return `<tr><td><strong>${u.sigla}</strong></td>${cells}</tr>`;
  }).join('');

  const tfootRow = `<tr class="row-total"><td>TOTAL</td>${[1,2,3,4].map(t => {
    const tot = unidades.reduce((s, u) => {
      const it = itensBim[`${u.id}_${t}`];
      return s + toNumber(it?.valor_enviado ?? it?.valor_calculado ?? 0);
    }, 0);
    return `<td class="text-right" style="border-left:3px solid var(--line)">${brMoney(tot)}</td><td></td>`;
  }).join('')}</tr>`;

  $('bimRepassePanel').innerHTML = `
    ${ok ? `<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
      ${[1,2,3,4].map(t => `
        <button class="btn btn-update" style="font-size:0.78rem;padding:4px 11px" onclick="recalcularBim(${t})">
          <i class="fa-solid fa-rotate"></i> ${t}ºTri
        </button>`).join('')}
      <button class="btn btn-save" style="font-size:0.78rem;padding:4px 14px" onclick="salvarTodosBimestres()">
        <i class="fa-solid fa-floppy-disk"></i> Salvar Todos
      </button>
    </div>` : ''}
    <div class="table-wrap">
      <table>
        <thead>${theadR1}${theadR2}</thead>
        <tbody>${bodyRows}</tbody>
        <tfoot>${tfootRow}</tfoot>
      </table>
    </div>`;

  if (ok) {
    document.querySelectorAll('input[data-uid][data-bim]').forEach(inp => {
      inp.addEventListener('change', () => {
        const uid = Number(inp.dataset.uid);
        const bim = Number(inp.dataset.bim);
        const key = `${uid}_${bim}`;
        if (!itensBim[key]) itensBim[key] = { valor_calculado: 0, fixado: false, enviado: false };
        itensBim[key].valor_enviado = toNumber(inp.value);
      });
    });
  }
}

window.recalcularBim = function(t) {
  dispBim[t] = toNumber($(`disp_${t}`)?.value ?? 0);
  recalcBim(t);
  renderBimTable();
};

window.salvarTodosBimestres = async function() {
  [1,2,3,4].forEach(t => { dispBim[t] = toNumber($(`disp_${t}`)?.value ?? 0); });
  for (const t of [1,2,3,4]) await salvarBim(t);
};

window.toggleFixadoBim = function(uid, bim) {
  const key = `${uid}_${bim}`;
  if (!itensBim[key]) itensBim[key] = { valor_calculado: 0, fixado: false, enviado: false };
  const it = itensBim[key];
  it.fixado = !it.fixado;
  // Se fixando, pegar o valor do input de enviado se houver
  if (it.fixado) {
    const inp = $(`ve_${uid}_${bim}`);
    if (inp) it.valor_calculado = toNumber(inp.value);
  }
  renderBimTable();
};

window.toggleEnviadoBim = function(uid, bim) {
  const key = `${uid}_${bim}`;
  if (!itensBim[key]) itensBim[key] = { valor_calculado: 0, fixado: false, enviado: false };
  const it = itensBim[key];
  it.enviado = !it.enviado;
  if (it.enviado) {
    const inp = $(`ve_${uid}_${bim}`);
    if (inp) it.valor_enviado = toNumber(inp.value);
  }
  renderBimTable();
  updateGlobalKpis();
};

// ─── ABA 2: REMANEJAMENTO ────────────────────────────────────────────────────

function remSaldoBase(remId) {
  // Base proporcional por unidade = valor_estimado - soma já recebida em remanejamentos anteriores
  const remsBefore = remanejamentos.filter(r => r.id < remId);
  return Object.fromEntries(unidades.map(u => {
    const jaRecebido = remsBefore.reduce((s, r) => {
      const item = (remItens[r.id] || []).find(x => x.unidade_id === u.id);
      return s + toNumber(item?.valor ?? 0);
    }, 0);
    return [u.id, Math.max(0, toNumber(u.valor_estimado) - jaRecebido)];
  }));
}

function recalcRem(remId) {
  const rem    = remanejamentos.find(r => r.id === remId);
  if (!rem) return;
  const disp   = toNumber(rem.valor_total);
  const bases  = remSaldoBase(remId);
  const itens  = remItens[remId] || [];

  const itMap = Object.fromEntries(unidades.map(u => {
    const it = itens.find(x => x.unidade_id === u.id) || { valor: 0, fixado: false };
    return [u.id, { valor: toNumber(it.valor), fixado: it.fixado }];
  }));

  const dist = distribuirProporcionalmente(disp, bases, itMap);
  const totalDist = Object.values(dist).reduce((s, v) => s + toNumber(v.valor), 0);

  remItens[remId] = unidades.map(u => {
    const old = itens.find(x => x.unidade_id === u.id) || {};
    const v   = toNumber(dist[u.id].valor);
    return {
      ...old,
      unidade_id: u.id,
      valor: v,
      percentual: toNumber(u.valor_estimado) > 0 ? v / toNumber(u.valor_estimado) * 100 : 0,
      fixado: dist[u.id].fixado,
      enviado: old.enviado ?? false,
    };
  });
}

async function salvarRem(remId) {
  if (!canEdit()) return;
  const rem   = remanejamentos.find(r => r.id === remId);
  if (!rem) return;

  // Atualizar header
  const { error: e1 } = await supabase.schema('utfprct')
    .from('matriz_orc_remanejamento')
    .update({ descricao: rem.descricao, valor_total: rem.valor_total, data_referencia: rem.data_referencia })
    .eq('id', remId);
  if (e1) { setStatus('Erro: ' + e1.message, 'err'); return; }

  const rows = (remItens[remId] || []).map(it => ({
    remanejamento_id: remId,
    unidade_id: it.unidade_id,
    valor: toNumber(it.valor),
    percentual: toNumber(it.percentual),
    fixado: it.fixado ?? false,
    enviado: it.enviado ?? false,
  }));
  const { error: e2 } = await supabase.schema('utfprct')
    .from('matriz_orc_remanejamento_item')
    .upsert(rows, { onConflict: 'remanejamento_id,unidade_id' });
  if (e2) { setStatus('Erro ao salvar itens: ' + e2.message, 'err'); return; }
  setStatus('Remanejamento salvo.');
  updateRemKpis();
  updateGlobalKpis();
}

async function criarNovoRem() {
  if (!canEdit()) { setStatus('Sem permissão.', 'warn'); return; }
  const { data, error } = await supabase.schema('utfprct')
    .from('matriz_orc_remanejamento')
    .insert({ configuracao_id: cfg.id, descricao: '', valor_total: 0, data_referencia: new Date().toISOString().slice(0,10) })
    .select().single();
  if (error) { setStatus('Erro ao criar: ' + error.message, 'err'); return; }
  remanejamentos.push(data);
  remItens[data.id] = [];
  renderRemanejamentos();
  updateRemKpis();
}

async function deletarRem(remId) {
  if (!canEdit()) return;
  if (!confirm('Excluir este remanejamento?')) return;
  const { error } = await supabase.schema('utfprct')
    .from('matriz_orc_remanejamento').delete().eq('id', remId);
  if (error) { setStatus('Erro: ' + error.message, 'err'); return; }
  remanejamentos = remanejamentos.filter(r => r.id !== remId);
  delete remItens[remId];
  renderRemanejamentos();
  updateRemKpis();
  updateGlobalKpis();
}

function renderRemanejamentos() {
  const ok = canEdit();
  const lista = $('remanejamentosLista');
  if (!remanejamentos.length) {
    lista.innerHTML = '<p style="color:var(--muted);font-size:0.85rem">Nenhum remanejamento criado ainda.</p>';
    return;
  }

  lista.innerHTML = remanejamentos.map((rem, idx) => {
    const itens   = remItens[rem.id] || [];
    const bases   = remSaldoBase(rem.id);
    const totalDisp = toNumber(rem.valor_total);
    const totalAlocado = itens.reduce((s, it) => s + toNumber(it.valor), 0);

    const tableRows = unidades.map(u => {
      const it  = itens.find(x => x.unidade_id === u.id) || { valor: 0, percentual: 0, fixado: false, enviado: false };
      const val = toNumber(it.valor);
      const pct = toNumber(it.percentual);
      const base = toNumber(bases[u.id] ?? 0);
      return `<tr>
        <td><strong>${u.sigla}</strong></td>
        <td class="text-right" style="color:var(--muted);font-size:0.82rem">${brMoney(base)}</td>
        <td class="text-right">
          ${ok ? `<input type="number" class="val-input" id="rv_${rem.id}_${u.id}"
            value="${val.toFixed(2)}" min="0" step="100"
            data-remid="${rem.id}" data-uid="${u.id}" />` : brMoney(val)}
        </td>
        <td class="text-right" id="rpct_${rem.id}_${u.id}">${brPercent(pct / 100)}</td>
        <td class="text-center" style="white-space:nowrap">
          ${ok ? `
            <button title="${it.fixado ? 'Des-fixar' : 'Fixar'}" onclick="toggleFixadoRem(${rem.id},${u.id})"
              style="font-size:0.8rem;padding:3px 8px;border-radius:6px;border:1px solid ${it.fixado ? '#e65100' : 'var(--line)'};background:${it.fixado ? '#fff3e0' : '#fff'}">
              <i class="fa-solid fa-${it.fixado ? 'lock' : 'lock-open'}"></i>
            </button>
            <button title="${it.enviado ? 'Desmarcar envio' : 'Confirmar envio'}" onclick="toggleEnviadoRem(${rem.id},${u.id})"
              style="font-size:0.8rem;padding:3px 8px;border-radius:6px;border:1px solid ${it.enviado ? 'var(--ok)' : 'var(--line)'};background:${it.enviado ? 'var(--ok-bg)' : '#fff'}">
              <i class="fa-solid fa-${it.enviado ? 'check-circle' : 'circle'}"></i>
            </button>
          ` : (it.enviado ? '<span class="enviado-badge">Enviado</span>' : '') + (it.fixado ? '<span class="fixado-badge">Fixado</span>' : '')}
        </td>
      </tr>`;
    }).join('');

    return `<div class="rem-card">
      <div class="rem-card-header">
        <span style="font-weight:700;color:var(--accent)">${idx + 1}º Remanejamento</span>
        ${ok ? `
          <input type="text" id="rdesc_${rem.id}" value="${rem.descricao.replace(/"/g,'&quot;')}"
            placeholder="Descrição" style="flex:1;min-width:160px;border:1px solid var(--line);border-radius:6px;padding:4px 8px;font-size:0.83rem" />
          <input type="number" id="rvtotal_${rem.id}" value="${toNumber(rem.valor_total).toFixed(2)}"
            min="0" step="100" placeholder="Valor total (R$)"
            style="width:140px;border:1px solid var(--line);border-radius:6px;padding:4px 8px;font-size:0.83rem;text-align:right" />
          <input type="date" id="rdata_${rem.id}" value="${rem.data_referencia || ''}"
            style="border:1px solid var(--line);border-radius:6px;padding:4px 8px;font-size:0.83rem" />
          <div style="display:flex;gap:5px">
            <button class="btn btn-update" style="font-size:0.78rem;padding:4px 10px" onclick="recalcularRem(${rem.id})">
              <i class="fa-solid fa-rotate"></i> Recalcular
            </button>
            <button class="btn btn-save" style="font-size:0.78rem;padding:4px 10px" onclick="salvarRemById(${rem.id})">
              <i class="fa-solid fa-floppy-disk"></i> Salvar
            </button>
            <button class="btn btn-delete" style="font-size:0.78rem;padding:4px 10px" onclick="deletarRemById(${rem.id})">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        ` : `
          <span style="font-size:0.85rem">${rem.descricao || '—'}</span>
          <strong>${brMoney(rem.valor_total)}</strong>
          ${rem.data_referencia ? `<span style="font-size:0.8rem;color:var(--muted)">${rem.data_referencia}</span>` : ''}
        `}
      </div>
      <div class="rem-card-body">
        <div style="display:flex;gap:16px;margin-bottom:10px;font-size:0.82rem;flex-wrap:wrap">
          <span>Disponível: <strong>${brMoney(totalDisp)}</strong></span>
          <span>Alocado: <strong id="rem_alocado_${rem.id}">${brMoney(totalAlocado)}</strong></span>
          <span>Saldo: <strong id="rem_saldo_${rem.id}" style="color:${Math.abs(totalDisp - totalAlocado) > 0.5 ? 'var(--warn)' : 'var(--ok)'}">${brMoney(totalDisp - totalAlocado)}</strong></span>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th>Unidade</th>
              <th class="text-right">Saldo Restante</th>
              <th class="text-right">Valor (R$)</th>
              <th class="text-right">% do Total</th>
              <th class="text-center">Ações</th>
            </tr></thead>
            <tbody>${tableRows}</tbody>
            <tfoot><tr class="row-total">
              <td>TOTAL</td>
              <td></td>
              <td class="text-right" id="rem_total_val_${rem.id}">${brMoney(totalAlocado)}</td>
              <td class="text-right">—</td>
              <td></td>
            </tr></tfoot>
          </table>
        </div>
      </div>
    </div>`;
  }).join('');

  // Eventos em inputs de valor
  if (ok) {
    document.querySelectorAll('input[data-remid][data-uid]').forEach(inp => {
      inp.addEventListener('change', () => {
        const remId = Number(inp.dataset.remid);
        const uid   = Number(inp.dataset.uid);
        const itens = remItens[remId] || [];
        const it    = itens.find(x => x.unidade_id === uid);
        if (it) it.valor = toNumber(inp.value);
        else remItens[remId] = [...itens, { unidade_id: uid, valor: toNumber(inp.value), percentual: 0, fixado: false, enviado: false }];
      });
    });
  }
}

window.recalcularRem = function(remId) {
  const rem = remanejamentos.find(r => r.id === remId);
  if (!rem) return;
  rem.descricao      = $(`rdesc_${remId}`)?.value || '';
  rem.valor_total    = toNumber($(`rvtotal_${remId}`)?.value ?? 0);
  rem.data_referencia = $(`rdata_${remId}`)?.value || null;

  // Ler valores editados e marcas de fixado antes de recalcular
  unidades.forEach(u => {
    const inp = $(`rv_${remId}_${u.id}`);
    if (!inp) return;
    const itens = remItens[remId] || [];
    const it    = itens.find(x => x.unidade_id === u.id);
    if (it) it.valor = toNumber(inp.value);
  });

  recalcRem(remId);
  renderRemanejamentos();
  updateRemKpis();
};

window.salvarRemById   = remId => salvarRem(remId);
window.deletarRemById  = remId => deletarRem(remId);

window.toggleFixadoRem = function(remId, uid) {
  const itens = remItens[remId] || [];
  let it = itens.find(x => x.unidade_id === uid);
  if (!it) { it = { unidade_id: uid, valor: 0, percentual: 0, fixado: false, enviado: false }; remItens[remId] = [...itens, it]; }
  it.fixado = !it.fixado;
  if (it.fixado) {
    const inp = $(`rv_${remId}_${uid}`);
    if (inp) it.valor = toNumber(inp.value);
  }
  renderRemanejamentos();
};

window.toggleEnviadoRem = function(remId, uid) {
  const itens = remItens[remId] || [];
  let it = itens.find(x => x.unidade_id === uid);
  if (!it) { it = { unidade_id: uid, valor: 0, percentual: 0, fixado: false, enviado: false }; remItens[remId] = [...itens, it]; }
  it.enviado = !it.enviado;
  renderRemanejamentos();
  updateGlobalKpis();
};

// ─── KPIS GLOBAIS ────────────────────────────────────────────────────────────

function updateGlobalKpis() {
  const vb = unidades.reduce((s, u) => s + toNumber(u.valor_estimado), 0);
  $('kpiVB').textContent = brMoney(vb);

  // Soma do que foi efetivamente enviado (bimestral + remanejamento)
  let totalEnviado = 0;
  unidades.forEach(u => {
    [1,2,3,4].forEach(t => {
      const it = itensBim[`${u.id}_${t}`];
      if (it?.enviado) totalEnviado += toNumber(it.valor_enviado ?? it.valor_calculado);
    });
  });
  remanejamentos.forEach(rem => {
    (remItens[rem.id] || []).forEach(it => {
      if (it.enviado) totalEnviado += toNumber(it.valor);
    });
  });

  $('kpiEnviado').textContent  = brMoney(totalEnviado);
  $('kpiRestante').textContent = brMoney(Math.max(0, vb - totalEnviado));
}

function updateRemKpis() {
  const totalRem = remanejamentos.reduce((s, r) => s + toNumber(r.valor_total), 0);
  const vb       = unidades.reduce((s, u) => s + toNumber(u.valor_estimado), 0);
  $('kpiNRem').textContent     = remanejamentos.length;
  $('kpiTotalRem').textContent = brMoney(totalRem);
  $('kpiSaldoRem').textContent = brMoney(Math.max(0, vb - totalRem));
}

// ─── TABS ─────────────────────────────────────────────────────────────────────

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      $(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

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

  const [{ data: scoreRows }, { data: units }, { data: valoresFixos },
         { data: gastosData }, { data: dispData }, { data: itemsData },
         { data: remsData }, { data: remItemsData }] = await Promise.all([
    supabase.schema('utfprct').from('vw_matriz_orc_resultado').select('unidade_id,valor_estimado'),
    supabase.schema('utfprct').from('matriz_orc_unidades').select('id,sigla,nome').eq('ativo', true).order('sigla'),
    supabase.schema('utfprct').from('matriz_orc_valores_fixos').select('unidade_id,valor_fixo').eq('configuracao_id', cfg.id),
    supabase.schema('utfprct').from('matriz_orc_cronograma_gastos').select('*').eq('configuracao_id', cfg.id),
    supabase.schema('utfprct').from('matriz_orc_repasse_bimestral').select('*').eq('configuracao_id', cfg.id),
    supabase.schema('utfprct').from('matriz_orc_repasse_item').select('*').eq('configuracao_id', cfg.id),
    supabase.schema('utfprct').from('matriz_orc_remanejamento').select('*').eq('configuracao_id', cfg.id).order('id'),
    supabase.schema('utfprct').from('matriz_orc_remanejamento_item').select('*'),
  ]);

  const scoreMap = new Map((scoreRows || []).map(r => [r.unidade_id, toNumber(r.valor_estimado)]));
  const fixoMap  = new Map((valoresFixos || []).map(r => [r.unidade_id, toNumber(r.valor_fixo)]));

  unidades = (units || []).map(u => ({
    ...u,
    valor_estimado: fixoMap.has(u.id) ? fixoMap.get(u.id) : (scoreMap.get(u.id) ?? 0),
  })).filter(u => u.valor_estimado > 0);

  gastosBim = {};
  (gastosData || []).forEach(g => { gastosBim[`${g.unidade_id}_${g.bimestre}`] = toNumber(g.valor); });

  dispBim = {};
  (dispData || []).forEach(d => { dispBim[d.bimestre] = toNumber(d.valor_disponivel); });

  itensBim = {};
  (itemsData || []).forEach(it => {
    itensBim[`${it.unidade_id}_${it.bimestre}`] = {
      valor_calculado: toNumber(it.valor_calculado),
      valor_enviado:   it.valor_enviado != null ? toNumber(it.valor_enviado) : null,
      fixado:  it.fixado,
      enviado: it.enviado,
    };
  });

  remanejamentos = remsData || [];
  remItens = {};
  remanejamentos.forEach(rem => {
    remItens[rem.id] = (remItemsData || []).filter(x => x.remanejamento_id === rem.id).map(x => ({
      unidade_id: x.unidade_id,
      valor:      toNumber(x.valor),
      percentual: toNumber(x.percentual),
      fixado:     x.fixado,
      enviado:    x.enviado,
    }));
  });

  // Para trimestres sem dados: calcular inicial
  [1,2,3,4].forEach(t => {
    const hasItems = unidades.some(u => itensBim[`${u.id}_${t}`]);
    if (!hasItems && toNumber(dispBim[t] ?? 0) > 0) recalcBim(t);
  });

  setupTabs();
  renderBimestral();
  renderRemanejamentos();
  updateRemKpis();
  updateGlobalKpis();

  $('btnNovoRem').addEventListener('click', criarNovoRem);
  if (!canEdit()) $('btnNovoRem').disabled = true;
}

init().catch(console.error);
