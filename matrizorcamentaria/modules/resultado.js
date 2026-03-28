import { supabase } from '../services/supabase.js';
import { brMoney, brPercent, toNumber } from './formatters.js';
import { renderNav } from './nav.js';

renderNav('resultado.html');

const $ = id => document.getElementById(id);
const TIPOS = { GRADUACAO:'Graduação', POS_GRADUACAO:'Pós-Graduação', ADMINISTRATIVO:'Administrativo', GESTAO_DIRETORIA:'Gestão/Diretoria' };
const TIPO_COLORS = { GRADUACAO:'#1565c0', POS_GRADUACAO:'#6a1b9a', ADMINISTRATIVO:'#2e7d32', GESTAO_DIRETORIA:'#e65100' };
let allRows = [];

function setStatus(msg, cls = 'ok') {
  const el = $('statusMsg');
  el.className = `status ${cls}`;
  el.innerHTML = `<i class="fa-solid fa-${cls === 'ok' ? 'circle-check' : cls === 'warn' ? 'triangle-exclamation' : 'circle-xmark'}"></i> ${msg}`;
}

async function init() {
  const { data: cfg } = await supabase.schema('utfprct').from('matriz_orc_configuracao_base')
    .select('*').eq('ativo', true).order('id', { ascending: false }).limit(1).maybeSingle();

  if (!cfg) {
    setStatus('Nenhuma configuração ativa encontrada. Acesse a página de Configuração para criar uma.', 'warn');
    return;
  }

  const segVal = cfg.seguranca_modo === 'PERCENTUAL'
    ? (cfg.recurso_bruto || cfg.recurso_liquido) * cfg.seguranca_valor / 100
    : cfg.seguranca_valor;
  const rb = cfg.recurso_bruto || cfg.recurso_liquido;
  const rl = cfg.recurso_liquido;
  const vb = rl * cfg.pct_total / 100;

  $('kpiRB').textContent = brMoney(rb);
  $('kpiCC').textContent = brMoney(cfg.contratos_continuados);
  $('kpiOD').textContent = brMoney(cfg.outras_despesas_campus);
  $('kpiSeg').textContent = brMoney(segVal);
  $('kpiRL').textContent = brMoney(rl);
  $('kpiPct').textContent = brPercent(cfg.pct_total);
  $('kpiVB').textContent = brMoney(vb);

  $('cfgInfo').innerHTML = `<i class="fa-solid fa-circle-info"></i> Configuração: <strong>${cfg.ano}${cfg.descricao ? ' — ' + cfg.descricao : ''}</strong>`;

  const { data: rows, error } = await supabase.schema('utfprct').from('vw_matriz_orc_resultado').select('*').order('sigla');
  if (error || !rows || !rows.length) {
    setStatus('Sem dados de resultado. Verifique se os dados V1–V4 foram preenchidos.', 'warn');
    return;
  }

  allRows = rows;
  const totalValor = rows.reduce((s, r) => s + toNumber(r.valor_estimado), 0);
  $('kpiTD').textContent = brMoney(totalValor);
  renderTable(rows);
}

function renderTable(rows) {
  const body = $('resultBody');
  const totalValor = rows.reduce((s, r) => s + toNumber(r.valor_estimado), 0);
  const grandIndice = rows.reduce((s, r) => s + toNumber(r.indice_composto), 0);

  body.innerHTML = rows.map(r => {
    const pct = totalValor > 0 ? toNumber(r.valor_estimado) / totalValor * 100 : 0;
    return `<tr>
      <td><strong>${r.sigla}</strong><br><span style="font-size:0.78rem;color:var(--muted)">${r.nome}</span></td>
      <td><span style="font-size:0.75rem;padding:2px 8px;border-radius:99px;background:${TIPO_COLORS[r.tipo]}18;color:${TIPO_COLORS[r.tipo]};font-weight:600">${TIPOS[r.tipo]||r.tipo}</span></td>
      <td class="text-right">${toNumber(r.score_v1).toLocaleString('pt-BR',{maximumFractionDigits:2})}</td>
      <td class="text-right">${toNumber(r.score_v2).toLocaleString('pt-BR',{maximumFractionDigits:2})}</td>
      <td class="text-right">${toNumber(r.score_v3).toLocaleString('pt-BR',{maximumFractionDigits:2})}</td>
      <td class="text-right">${toNumber(r.score_v4).toLocaleString('pt-BR',{maximumFractionDigits:2})}</td>
      <td class="text-right">${toNumber(r.indice_composto).toLocaleString('pt-BR',{minimumFractionDigits:4,maximumFractionDigits:4})}</td>
      <td class="text-right">${brPercent(pct)}</td>
      <td class="text-right"><strong>${brMoney(r.valor_estimado)}</strong></td>
    </tr>`;
  }).join('');

  $('totIndice').textContent = grandIndice.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  $('totValor').textContent = brMoney(totalValor);
}

async function applyFilter() {
  const tipo = $('filtroTipo').value;
  renderTable(tipo ? allRows.filter(r => r.tipo === tipo) : allRows);
}

$('filtroTipo').addEventListener('change', applyFilter);
init().catch(console.error);
