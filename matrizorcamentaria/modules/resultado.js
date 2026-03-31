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
  const rb  = cfg.recurso_bruto || cfg.recurso_liquido;
  const rl  = cfg.recurso_liquido;

  $('cfgInfo').innerHTML = `<i class="fa-solid fa-circle-info"></i> Configuração: <strong>${cfg.ano}${cfg.descricao ? ' — ' + cfg.descricao : ''}</strong>`;

  // Load scores, units (for tipo_valor) and fixed values in parallel
  const [{ data: scoreRows, error }, { data: units }, { data: valoresFixos }] = await Promise.all([
    supabase.schema('utfprct').from('vw_matriz_orc_resultado').select('*').order('sigla'),
    supabase.schema('utfprct').from('matriz_orc_unidades').select('id,sigla,nome,tipo,tipo_valor').eq('ativo', true),
    supabase.schema('utfprct').from('matriz_orc_valores_fixos').select('unidade_id,valor_fixo').eq('configuracao_id', cfg.id),
  ]);

  if (error || !scoreRows || !scoreRows.length) {
    setStatus('Sem dados de resultado. Verifique se os dados V1–V4 foram preenchidos.', 'warn');
    $('kpiRB').textContent  = brMoney(rb);
    $('kpiSeg').textContent = brMoney(segVal);
    $('kpiCC').textContent  = brMoney(cfg.contratos_continuados);
    $('kpiOD').textContent  = brMoney(cfg.outras_despesas_campus);
    $('kpiRL').textContent  = brMoney(rl);
    $('kpiVB').textContent  = brMoney(rl);
    $('kpiPct').textContent = brPercent(0);
    $('kpiFixo').textContent  = brMoney(0);
    $('kpiCalc').textContent  = brMoney(0);
    $('kpiTD').textContent    = brMoney(0);
    return;
  }

  // Build unit lookup map (id → unit data with tipo_valor)
  const unitMap = new Map((units || []).map(u => [u.id, u]));
  const fixoMap = new Map((valoresFixos || []).map(v => [v.unidade_id, toNumber(v.valor_fixo)]));

  // Filter score rows to only valid units and enrich with tipo_valor
  const enriched = scoreRows
    .filter(r => unitMap.has(r.unidade_id))
    .map(r => {
      const u = unitMap.get(r.unidade_id);
      return {
        ...r,
        sigla:      u.sigla,
        nome:       u.nome,
        tipo:       u.tipo,
        tipoValor:  u.tipo_valor || 'CALCULADO',
        valor_fixo: fixoMap.get(r.unidade_id) ?? 0,
      };
    });

  // Compute fixed vs. calculated distribution
  const totalFixo = enriched
    .filter(r => r.tipoValor === 'FIXO')
    .reduce((s, r) => s + r.valor_fixo, 0);

  const baseCalculada = Math.max(0, rl - totalFixo);
  const calcRows = enriched.filter(r => r.tipoValor === 'CALCULADO');
  const totIndiceCalc = calcRows.reduce((s, r) => s + toNumber(r.indice_composto), 0);

  allRows = enriched.map(r => {
    let valorEstimado;
    if (r.tipoValor === 'FIXO') {
      valorEstimado = r.valor_fixo;
    } else {
      valorEstimado = totIndiceCalc > 0
        ? toNumber(r.indice_composto) / totIndiceCalc * baseCalculada
        : 0;
    }
    return { ...r, valorEstimado };
  });

  const totalCalc = allRows.filter(r => r.tipoValor === 'CALCULADO').reduce((s, r) => s + r.valorEstimado, 0);
  const totalDist = totalFixo + totalCalc;
  const pctDist   = rb > 0 ? totalDist / rb * 100 : 0;

  $('kpiRB').textContent    = brMoney(rb);
  $('kpiSeg').textContent   = brMoney(segVal);
  $('kpiCC').textContent    = brMoney(cfg.contratos_continuados);
  $('kpiOD').textContent    = brMoney(cfg.outras_despesas_campus);
  $('kpiRL').textContent    = brMoney(rl);
  $('kpiVB').textContent    = brMoney(rl);
  $('kpiPct').textContent   = brPercent(pctDist);
  $('kpiFixo').textContent  = brMoney(totalFixo);
  $('kpiCalc').textContent  = brMoney(totalCalc);
  $('kpiTD').textContent    = brMoney(totalDist);

  renderTable(allRows);
}

function renderTable(rows) {
  const body = $('resultBody');
  const totalValor = rows.reduce((s, r) => s + r.valorEstimado, 0);
  const grandIndice = rows.filter(r => r.tipoValor === 'CALCULADO').reduce((s, r) => s + toNumber(r.indice_composto), 0);

  body.innerHTML = rows.map(r => {
    const pct = totalValor > 0 ? r.valorEstimado / totalValor * 100 : 0;
    const naturezaBadge = r.tipoValor === 'FIXO'
      ? '<span style="font-size:0.73rem;padding:2px 8px;border-radius:99px;background:#fff3e0;color:#e65100;font-weight:600"><i class="fa-solid fa-lock"></i> Fixo</span>'
      : '<span style="font-size:0.73rem;padding:2px 8px;border-radius:99px;background:#e3f0fb;color:#1565c0;font-weight:600"><i class="fa-solid fa-calculator"></i> Calc.</span>';
    return `<tr${r.tipoValor === 'FIXO' ? ' style="background:#fffde7"' : ''}>
      <td><strong>${r.sigla}</strong><br><span style="font-size:0.78rem;color:var(--muted)">${r.nome}</span></td>
      <td><span style="font-size:0.75rem;padding:2px 8px;border-radius:99px;background:${TIPO_COLORS[r.tipo]}18;color:${TIPO_COLORS[r.tipo]};font-weight:600">${TIPOS[r.tipo]||r.tipo}</span></td>
      <td>${naturezaBadge}</td>
      <td class="text-right">${toNumber(r.score_v1).toLocaleString('pt-BR',{maximumFractionDigits:2})}</td>
      <td class="text-right">${toNumber(r.score_v2).toLocaleString('pt-BR',{maximumFractionDigits:2})}</td>
      <td class="text-right">${toNumber(r.score_v3).toLocaleString('pt-BR',{maximumFractionDigits:2})}</td>
      <td class="text-right">${toNumber(r.score_v4).toLocaleString('pt-BR',{maximumFractionDigits:2})}</td>
      <td class="text-right">${r.tipoValor === 'FIXO' ? '—' : toNumber(r.indice_composto).toLocaleString('pt-BR',{minimumFractionDigits:4,maximumFractionDigits:4})}</td>
      <td class="text-right">${brPercent(pct)}</td>
      <td class="text-right"><strong>${brMoney(r.valorEstimado)}</strong></td>
    </tr>`;
  }).join('');

  $('totIndice').textContent = grandIndice.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  $('totValor').textContent  = brMoney(totalValor);
}

async function applyFilter() {
  const tipo = $('filtroTipo').value;
  renderTable(tipo ? allRows.filter(r => r.tipo === tipo) : allRows);
}

$('filtroTipo').addEventListener('change', applyFilter);
init().catch(console.error);
