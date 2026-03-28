import { supabase } from '../services/supabase.js';
import { brMoney, brPercent, toNumber } from './formatters.js';
import { renderNav } from './nav.js';

renderNav('comparativo.html');

const $ = id => document.getElementById(id);
const TIPOS = { GRADUACAO:'Graduação', POS_GRADUACAO:'Pós-Graduação', ADMINISTRATIVO:'Administrativo', GESTAO_DIRETORIA:'Gestão/Diretoria' };
const TIPO_COLORS = { GRADUACAO:'#1565c0', POS_GRADUACAO:'#6a1b9a', ADMINISTRATIVO:'#2e7d32', GESTAO_DIRETORIA:'#e65100' };
let allRows = [];
let activeSims = [];

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
  return rows.map(r => {
    const idx = (totV1>0?r.v1/totV1:0)*sim.peso_v1/100 + (totV2>0?r.v2/totV2:0)*sim.peso_v2/100
              + (totV3>0?r.v3/totV3:0)*sim.peso_v3/100 + (totV4>0?r.v4/totV4:0)*sim.peso_v4/100;
    return { ...r, indice: idx, valor: idx * vb };
  });
}

async function comparar() {
  const selEls = document.querySelectorAll('.sim-sel');
  const simIds = [...selEls].map(s => s.value).filter(Boolean);
  if (!simIds.length) { setStatus('Selecione ao menos uma simulação.', 'warn'); return; }

  const { data: cfg } = await supabase.schema('utfprct').from('matriz_orc_configuracao_base')
    .select('*').eq('ativo', true).order('id', { ascending: false }).limit(1).maybeSingle();
  if (!cfg) { setStatus('Nenhuma configuração ativa.', 'warn'); return; }

  const simFetches = simIds.map(id => supabase.schema('utfprct').from('matriz_orc_simulacoes').select('*').eq('id', id).single());
  const [r1, r2, r3, r4, { data: realRows }, ...simResults] = await Promise.all([
    supabase.schema('utfprct').from('matriz_orc_v1_unidade').select('*').eq('configuracao_id', cfg.id),
    supabase.schema('utfprct').from('matriz_orc_v2_unidade').select('*').eq('configuracao_id', cfg.id),
    supabase.schema('utfprct').from('matriz_orc_v3_unidade').select('*').eq('configuracao_id', cfg.id),
    supabase.schema('utfprct').from('vw_matriz_orc_resultado').select('unidade_id,sigla,nome,tipo,score_v4'),
    supabase.schema('utfprct').from('vw_matriz_orc_resultado').select('*').order('sigla'),
    ...simFetches,
  ]);

  activeSims = simResults.map(r => r.data).filter(Boolean);
  const v1 = r1.data||[], v2 = r2.data||[], v3 = r3.data||[], v4 = r4.data||[];

  const simValMaps = activeSims.map(sim => {
    const res = computeSimResult(sim, v1, v2, v3, v4);
    return new Map(res.map(r => [r.unidade_id, r.valor]));
  });

  allRows = (realRows || []).map(r => ({
    ...r,
    valorReal: toNumber(r.valor_estimado),
    simValores: simValMaps.map(m => m.get(r.unidade_id) || 0),
  })).sort((a, b) => a.sigla.localeCompare(b.sigla));

  renderHeader(cfg, activeSims);
  renderTable(allRows);
  $('headerPanel').style.display = '';
  $('compPanel').style.display = '';
}

function paramFmt(label, val) {
  return (label.startsWith('Peso') || label.startsWith('%')) ? brPercent(val) : brMoney(val);
}

function renderHeader(cfg, sims) {
  const cfgSeg = cfg.seguranca_modo === 'PERCENTUAL' ? (cfg.recurso_bruto||cfg.recurso_liquido)*cfg.seguranca_valor/100 : cfg.seguranca_valor;
  const simSeg = sim => sim.seguranca_modo === 'PERCENTUAL' ? sim.recurso_bruto*sim.seguranca_valor/100 : sim.seguranca_valor;
  const params = [
    ['Recurso Bruto', cfg.recurso_bruto||cfg.recurso_liquido, s => s.recurso_bruto],
    ['Contratos Continuados', cfg.contratos_continuados, s => s.contratos_continuados],
    ['Outras Despesas', cfg.outras_despesas_campus, s => s.outras_despesas_campus],
    ['Segurança', cfgSeg, s => simSeg(s)],
    ['Recurso Líquido', cfg.recurso_liquido, s => s.recurso_liquido],
    ['% Distribuição', cfg.pct_total, s => s.pct_total],
    ['Base de Distribuição', cfg.recurso_liquido*cfg.pct_total/100, s => s.recurso_liquido*s.pct_total/100],
    ['Peso V1 (%)', cfg.peso_v1, s => s.peso_v1],
    ['Peso V2 (%)', cfg.peso_v2, s => s.peso_v2],
    ['Peso V3 (%)', cfg.peso_v3, s => s.peso_v3],
    ['Peso V4 (%)', cfg.peso_v4, s => s.peso_v4],
  ];

  const thead = `<thead><tr><th>Parâmetro</th><th class="text-right">Real</th>${sims.map(s=>`<th class="text-right">${s.nome}</th>`).join('')}</tr></thead>`;
  const tbody = '<tbody>' + params.map(([label, realVal, fn]) =>
    `<tr><td>${label}</td><td class="text-right">${paramFmt(label, realVal)}</td>${sims.map(s=>`<td class="text-right">${paramFmt(label, fn(s))}</td>`).join('')}</tr>`
  ).join('') + '</tbody>';
  $('headerTable').innerHTML = thead + tbody;
}

function renderTable(rows) {
  const tipo = $('filtroTipo').value;
  const filtered = tipo ? rows.filter(r => r.tipo === tipo) : rows;

  const simCols = activeSims.map(s => `<th class="text-right">${s.nome}</th>`).join('');
  const thead = `<thead><tr><th>Unidade</th><th>Tipo</th><th class="text-right">Real (R$)</th>${simCols}</tr></thead>`;

  const totReal = filtered.reduce((s, r) => s + r.valorReal, 0);
  const totSims = activeSims.map((_, i) => filtered.reduce((s, r) => s + r.simValores[i], 0));

  const tbody = '<tbody>' + filtered.map(r => {
    const simTds = r.simValores.map(v => `<td class="text-right">${brMoney(v)}</td>`).join('');
    return `<tr>
      <td><strong>${r.sigla}</strong><br><span style="font-size:0.78rem;color:var(--muted)">${r.nome}</span></td>
      <td><span style="font-size:0.75rem;padding:2px 8px;border-radius:99px;background:${TIPO_COLORS[r.tipo]}18;color:${TIPO_COLORS[r.tipo]};font-weight:600">${TIPOS[r.tipo]||r.tipo}</span></td>
      <td class="text-right"><strong>${brMoney(r.valorReal)}</strong></td>
      ${simTds}
    </tr>`;
  }).join('') + '</tbody>';

  const tfootCols = totSims.map(t => `<td class="text-right">${brMoney(t)}</td>`).join('');
  const tfoot = `<tfoot><tr class="row-total"><td colspan="2">TOTAL</td><td class="text-right">${brMoney(totReal)}</td>${tfootCols}</tr></tfoot>`;

  $('compTable').innerHTML = thead + tbody + tfoot;
}

async function init() {
  const { data } = await supabase.schema('utfprct').from('matriz_orc_simulacoes').select('id,nome,descricao').order('id', { ascending: false });
  document.querySelectorAll('.sim-sel').forEach(sel => {
    sel.innerHTML = '<option value="">Não usar</option>';
    (data || []).forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.nome + (s.descricao ? ` — ${s.descricao}` : '');
      sel.appendChild(opt);
    });
  });

  $('btnComparar').addEventListener('click', comparar);
  $('filtroTipo').addEventListener('change', () => { if (allRows.length) renderTable(allRows); });
}

init().catch(console.error);
