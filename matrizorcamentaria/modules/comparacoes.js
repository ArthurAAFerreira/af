import { supabase } from '../services/supabase.js';
import { brMoney, brPercent, toNumber } from './formatters.js';
import { renderNav } from './nav.js';

renderNav('comparacoes.html');

const $ = id => document.getElementById(id);
const TIPOS = { GRADUACAO:'Graduação', POS_GRADUACAO:'Pós-Graduação', ADMINISTRATIVO:'Administrativo', GESTAO_DIRETORIA:'Gestão/Diretoria' };
const TIPO_COLORS = { GRADUACAO:'#1565c0', POS_GRADUACAO:'#6a1b9a', ADMINISTRATIVO:'#2e7d32', GESTAO_DIRETORIA:'#e65100' };
let allRows = [];
let simAData = null, simBData = null;
let activeCfgId = null;

function setStatus(msg, cls = 'ok') {
  const el = $('statusMsg');
  el.className = `status ${cls}`;
  el.innerHTML = `<i class="fa-solid fa-${cls === 'ok' ? 'circle-check' : cls === 'warn' ? 'triangle-exclamation' : 'circle-xmark'}"></i> ${msg}`;
}

function computeSimResult(sim, v1Data, v2Data, v3Data, v4Data) {
  const vb = sim.recurso_liquido * sim.pct_total / 100;
  const uMap = {};
  v4Data.forEach(r => { uMap[r.unidade_id] = { sigla: r.sigla, nome: r.nome, tipo: r.tipo, v1:0, v2:0, v3:0, v4: toNumber(r.score_v4) }; });
  v1Data.forEach(r => {
    if (!uMap[r.unidade_id]) return;
    uMap[r.unidade_id].v1 = (r.carga_horaria_graduacao * r.alunos_graduacao * sim.v1_peso_graduacao / 100
      + r.carga_horaria_pos * r.alunos_pos * sim.v1_peso_pos_graduacao / 100) * r.peso_unidade;
  });
  v2Data.forEach(r => {
    if (!uMap[r.unidade_id]) return;
    uMap[r.unidade_id].v2 = (r.docentes_20h * sim.v2_peso_20h + r.docentes_40h * sim.v2_peso_40h + r.docentes_de * sim.v2_peso_de) * sim.v2_peso_docentes / 100
      + (r.taes_parcial * sim.v2_peso_funcao_parcial + r.taes_integral * sim.v2_peso_funcao_integral) * sim.v2_peso_taes / 100
      + (r.docentes_funcao_parcial * sim.v2_peso_funcao_parcial + r.docentes_funcao_integral * sim.v2_peso_funcao_integral) * sim.v2_peso_docentes / 100;
  });
  v3Data.forEach(r => {
    if (!uMap[r.unidade_id]) return;
    uMap[r.unidade_id].v3 = r.docentes_graduacao * sim.v3_peso_graduacao + r.docentes_especializacao * sim.v3_peso_especializacao
      + r.docentes_mestrado * sim.v3_peso_mestrado + r.docentes_doutorado * sim.v3_peso_doutorado;
  });
  const rows = Object.entries(uMap).map(([uid, d]) => ({ ...d, unidade_id: Number(uid) }));
  const totV1 = rows.reduce((s, r) => s + r.v1, 0), totV2 = rows.reduce((s, r) => s + r.v2, 0);
  const totV3 = rows.reduce((s, r) => s + r.v3, 0), totV4 = rows.reduce((s, r) => s + r.v4, 0);
  const activeW = (totV1>0?sim.peso_v1:0) + (totV2>0?sim.peso_v2:0) + (totV3>0?sim.peso_v3:0) + (totV4>0?sim.peso_v4:0);
  return rows.map(r => {
    const idx = activeW > 0
      ? ((totV1>0?r.v1/totV1*sim.peso_v1:0) + (totV2>0?r.v2/totV2*sim.peso_v2:0)
       + (totV3>0?r.v3/totV3*sim.peso_v3:0) + (totV4>0?r.v4/totV4*sim.peso_v4:0)) / activeW
      : 0;
    return { ...r, indice: idx, valor: idx * vb };
  });
}

async function loadSimData(id) {
  if (id === 'REAL') {
    const { data } = await supabase.schema('utfprct').from('matriz_orc_configuracao_base')
      .select('*').eq('ativo', true).order('id', { ascending: false }).limit(1).maybeSingle();
    return data ? { ...data, nome: `⭐ Real ${data.ano}`, _isReal: true } : null;
  }
  const { data } = await supabase.schema('utfprct').from('matriz_orc_simulacoes').select('*').eq('id', id).single();
  return data || null;
}

async function comparar() {
  const idA = $('simA').value, idB = $('simB').value;
  if (!idA || !idB) { setStatus('Selecione as duas opções.', 'warn'); return; }
  if (idA === idB) { setStatus('Selecione opções diferentes.', 'warn'); return; }

  const cfgId = toNumber($('cfgAno').value);
  if (!cfgId) { setStatus('Selecione o ano da configuração.', 'warn'); return; }

  const [sA, sB] = await Promise.all([loadSimData(idA), loadSimData(idB)]);
  if (!sA || !sB) { setStatus('Erro ao carregar dados.', 'err'); return; }
  simAData = sA; simBData = sB;

  const [r1, r2, r3, r4] = await Promise.all([
    supabase.schema('utfprct').from('matriz_orc_v1_unidade').select('*').eq('configuracao_id', cfgId),
    supabase.schema('utfprct').from('matriz_orc_v2_unidade').select('*').eq('configuracao_id', cfgId),
    supabase.schema('utfprct').from('matriz_orc_v3_unidade').select('*').eq('configuracao_id', cfgId),
    supabase.schema('utfprct').from('vw_matriz_orc_resultado').select('unidade_id,sigla,nome,tipo,score_v4'),
  ]);

  const resA = computeSimResult(sA, r1.data||[], r2.data||[], r3.data||[], r4.data||[]);
  const resB = computeSimResult(sB, r1.data||[], r2.data||[], r3.data||[], r4.data||[]);
  const mapB = new Map(resB.map(r => [r.unidade_id, r.valor]));

  allRows = resA.map(r => ({
    ...r, valorA: r.valor, valorB: mapB.get(r.unidade_id) ?? 0,
  })).sort((a, b) => a.sigla.localeCompare(b.sigla));

  renderParams(sA, sB);
  renderTable(allRows);
  $('thA').textContent = sA.nome;
  $('thB').textContent = sB.nome;
  $('paramPanel').style.display = '';
  $('compPanel').style.display = '';
}

function paramFmt(label, val) {
  return (label.startsWith('Peso') || label.startsWith('%')) ? brPercent(val) : brMoney(val);
}

function renderParams(a, b) {
  const segA = a.seguranca_modo === 'PERCENTUAL' ? a.recurso_bruto * a.seguranca_valor / 100 : a.seguranca_valor;
  const segB = b.seguranca_modo === 'PERCENTUAL' ? b.recurso_bruto * b.seguranca_valor / 100 : b.seguranca_valor;
  const rows = [
    ['Recurso Bruto', a.recurso_bruto, b.recurso_bruto],
    ['Contratos Continuados', a.contratos_continuados, b.contratos_continuados],
    ['Outras Despesas', a.outras_despesas_campus, b.outras_despesas_campus],
    ['Segurança', segA, segB],
    ['Recurso Líquido', a.recurso_liquido, b.recurso_liquido],
    ['% Distribuição', a.pct_total, b.pct_total],
    ['Base de Distribuição', a.recurso_liquido * a.pct_total / 100, b.recurso_liquido * b.pct_total / 100],
    ['Peso V1 (%)', a.peso_v1, b.peso_v1],
    ['Peso V2 (%)', a.peso_v2, b.peso_v2],
    ['Peso V3 (%)', a.peso_v3, b.peso_v3],
    ['Peso V4 (%)', a.peso_v4, b.peso_v4],
  ];
  $('paramBody').innerHTML = rows.map(([label, va, vb]) => {
    const diff = vb - va;
    const color = diff > 0 ? 'var(--ok)' : diff < 0 ? 'var(--danger)' : 'var(--muted)';
    const fmt = s => paramFmt(label, s);
    return `<tr><td>${label}</td><td class="text-right">${fmt(va)}</td><td class="text-right">${fmt(vb)}</td>
      <td class="text-right" style="color:${color};font-weight:600">${diff>=0?'+':''}${fmt(diff)}</td></tr>`;
  }).join('');
}

function renderTable(rows) {
  const tipo = $('filtroTipo').value;
  const filtered = tipo ? rows.filter(r => r.tipo === tipo) : rows;

  const totA = filtered.reduce((s, r) => s + r.valorA, 0);
  const totB = filtered.reduce((s, r) => s + r.valorB, 0);
  const totDiff = totB - totA;
  const totVarPct = totA > 0 ? totDiff / totA * 100 : 0;

  const nA = simAData?.nome || 'A', nB = simBData?.nome || 'B';

  const thead = `<thead><tr>
    <th>Unidade</th><th>Tipo</th>
    <th class="text-right">${nA} (R$)</th>
    <th class="text-right">% do Total A</th>
    <th class="text-right">${nB} (R$)</th>
    <th class="text-right">% do Total B</th>
    <th class="text-right">Var. R$ (B−A)</th>
    <th class="text-right">Var. %</th>
  </tr></thead>`;

  const tbody = '<tbody>' + filtered.map(r => {
    const diff = r.valorB - r.valorA;
    const varPct = r.valorA > 0 ? diff / r.valorA * 100 : 0;
    const pctA = totA > 0 ? r.valorA / totA * 100 : 0;
    const pctB = totB > 0 ? r.valorB / totB * 100 : 0;
    const rowBg = diff > 0.01 ? 'background:#e8f5e9' : diff < -0.01 ? 'background:#fdecea' : '';
    const diffColor = diff > 0.01 ? 'color:#2e7d32;font-weight:700' : diff < -0.01 ? 'color:#c0392b;font-weight:700' : 'color:var(--muted)';
    return `<tr style="${rowBg}">
      <td><strong>${r.sigla}</strong><br><span style="font-size:0.78rem;color:var(--muted)">${r.nome}</span></td>
      <td><span style="font-size:0.75rem;padding:2px 8px;border-radius:99px;background:${TIPO_COLORS[r.tipo]}18;color:${TIPO_COLORS[r.tipo]};font-weight:600">${TIPOS[r.tipo]||r.tipo}</span></td>
      <td class="text-right">${brMoney(r.valorA)}</td>
      <td class="text-right">${brPercent(pctA)}</td>
      <td class="text-right">${brMoney(r.valorB)}</td>
      <td class="text-right">${brPercent(pctB)}</td>
      <td class="text-right" style="${diffColor}">${diff>=0?'+':''}${brMoney(diff)}</td>
      <td class="text-right" style="${diffColor}">${diff>=0?'+':''}${brPercent(varPct)}</td>
    </tr>`;
  }).join('') + '</tbody>';

  const diffTotColor = totDiff > 0.01 ? 'color:#2e7d32;font-weight:700' : totDiff < -0.01 ? 'color:#c0392b;font-weight:700' : '';
  const tfoot = `<tfoot><tr class="row-total">
    <td colspan="2">TOTAL</td>
    <td class="text-right">${brMoney(totA)}</td>
    <td class="text-right">100%</td>
    <td class="text-right">${brMoney(totB)}</td>
    <td class="text-right">100%</td>
    <td class="text-right" style="${diffTotColor}">${totDiff>=0?'+':''}${brMoney(totDiff)}</td>
    <td class="text-right" style="${diffTotColor}">${totDiff>=0?'+':''}${brPercent(totVarPct)}</td>
  </tr></tfoot>`;

  $('compTable').innerHTML = thead + tbody + tfoot;
}

async function init() {
  const [{ data: cfgs }, { data: sims }] = await Promise.all([
    supabase.schema('utfprct').from('matriz_orc_configuracao_base')
      .select('id,ano,descricao,ativo').order('ano', { ascending: false }),
    supabase.schema('utfprct').from('matriz_orc_simulacoes')
      .select('id,nome,descricao').order('id', { ascending: false }),
  ]);

  // Year selector
  const cfgSel = $('cfgAno');
  cfgSel.innerHTML = '';
  (cfgs || []).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.ano}${c.descricao ? ' — ' + c.descricao : ''}${c.ativo ? ' ★ ativa' : ''}`;
    if (c.ativo) { opt.selected = true; activeCfgId = c.id; }
    cfgSel.appendChild(opt);
  });

  // Simulation selects — add Real first, then separator, then sims
  ['simA', 'simB'].forEach(selId => {
    const sel = $(selId);
    sel.innerHTML = '';
    const realOpt = document.createElement('option');
    realOpt.value = 'REAL';
    realOpt.textContent = '⭐ Real (configuração ativa)';
    realOpt.style.fontWeight = '700';
    sel.appendChild(realOpt);

    const sep = document.createElement('option');
    sep.disabled = true;
    sep.textContent = '──────────────';
    sel.appendChild(sep);

    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'Selecione uma simulação...';
    sel.appendChild(empty);

    (sims || []).forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.nome + (s.descricao ? ` — ${s.descricao}` : '');
      sel.appendChild(opt);
    });
  });

  // Default: A = Real
  $('simA').value = 'REAL';

  $('btnComparar').addEventListener('click', comparar);
  $('filtroTipo').addEventListener('change', () => { if (allRows.length) renderTable(allRows); });
}

init().catch(console.error);
