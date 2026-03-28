import { supabase } from '../services/supabase.js';
import { brMoney, brPercent } from './formatters.js';
import { renderNav } from './nav.js';

renderNav('index.html');

const TIPOS = { GRADUACAO:'Graduação', POS_GRADUACAO:'Pós-Graduação', ADMINISTRATIVO:'Administrativo', GESTAO_DIRETORIA:'Gestão/Diretoria' };

async function init() {
  const { data: cfg } = await supabase.schema('utfprct').from('matriz_orc_configuracao_base').select('*').eq('ativo', true).order('id', { ascending: false }).limit(1).maybeSingle();

  if (!cfg) return;

  document.getElementById('cfgBadge').className = 'step-badge badge-ok';
  document.getElementById('cfgBadge').innerHTML = `<i class="fa-solid fa-circle-check"></i> ${cfg.ano} — ${cfg.descricao || 'Configuração ativa'}`;

  const { count: cntUnidades } = await supabase.schema('utfprct').from('matriz_orc_unidades').select('*', { count: 'exact', head: true }).eq('ativo', true);
  const { count: cntV1 } = await supabase.schema('utfprct').from('matriz_orc_v1_unidade').select('*', { count: 'exact', head: true }).eq('configuracao_id', cfg.id);
  const { count: cntV2 } = await supabase.schema('utfprct').from('matriz_orc_v2_unidade').select('*', { count: 'exact', head: true }).eq('configuracao_id', cfg.id);
  const { count: cntV3 } = await supabase.schema('utfprct').from('matriz_orc_v3_unidade').select('*', { count: 'exact', head: true }).eq('configuracao_id', cfg.id);
  const { count: cntV4 } = await supabase.schema('utfprct').from('matriz_orc_estruturas').select('*', { count: 'exact', head: true }).eq('configuracao_id', cfg.id).eq('ativo', true);

  setBadge('badgeConfig', true, 'Configurado');
  setBadge('badgeUnidades', cntUnidades > 0, `${cntUnidades || 0} unidades`);
  setBadge('badgeV1', cntV1 > 0, `${cntV1 || 0} registros`);
  setBadge('badgeV2', cntV2 > 0, `${cntV2 || 0} registros`);
  setBadge('badgeV3', cntV3 > 0, `${cntV3 || 0} registros`);
  setBadge('badgeV4', cntV4 > 0, `${cntV4 || 0} estruturas`);

  const { data: resultado } = await supabase.schema('utfprct').from('vw_matriz_orc_resultado').select('*').order('sigla');
  if (resultado && resultado.length) renderResult(resultado, cfg);
}

function setBadge(id, ok, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `step-badge ${ok ? 'badge-ok' : 'badge-warn'}`;
  el.innerHTML = `<i class="fa-solid ${ok ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i> ${text}`;
}

function renderResult(rows, cfg) {
  document.getElementById('resultPanel').style.display = '';
  const totalValor = rows.reduce((s, r) => s + Number(r.valor_estimado || 0), 0);
  document.getElementById('kpiRow').innerHTML = `
    <div class="kpi"><div class="kpi-label">Recurso Líquido</div><div class="kpi-value">${brMoney(cfg.recurso_liquido)}</div></div>
    <div class="kpi"><div class="kpi-label">% Aplicado</div><div class="kpi-value">${brPercent(cfg.pct_total)}</div></div>
    <div class="kpi"><div class="kpi-label">Valor Base</div><div class="kpi-value">${brMoney(cfg.recurso_liquido * cfg.pct_total / 100)}</div></div>
    <div class="kpi"><div class="kpi-label">Unidades Ativas</div><div class="kpi-value">${rows.length}</div></div>
    <div class="kpi"><div class="kpi-label">Total Distribuído</div><div class="kpi-value">${brMoney(totalValor)}</div></div>
  `;
  const body = document.getElementById('resultBody');
  body.innerHTML = rows.map(r => `<tr>
    <td><strong>${r.sigla}</strong><br><span style="font-size:0.8rem;color:var(--muted)">${r.nome}</span></td>
    <td><span style="font-size:0.78rem;padding:2px 8px;border-radius:99px;background:#eef5ff;color:var(--accent)">${TIPOS[r.tipo] || r.tipo}</span></td>
    <td class="text-right">${Number(r.score_v1||0).toLocaleString('pt-BR',{maximumFractionDigits:2})}</td>
    <td class="text-right">${Number(r.score_v2||0).toLocaleString('pt-BR',{maximumFractionDigits:2})}</td>
    <td class="text-right">${Number(r.score_v3||0).toLocaleString('pt-BR',{maximumFractionDigits:2})}</td>
    <td class="text-right">${Number(r.score_v4||0).toLocaleString('pt-BR',{maximumFractionDigits:2})}</td>
    <td class="text-right">${Number(r.indice_composto||0).toLocaleString('pt-BR',{minimumFractionDigits:4,maximumFractionDigits:4})}</td>
    <td class="text-right"><strong>${brMoney(r.valor_estimado)}</strong></td>
  </tr>`).join('');
}

init().catch(console.error);
