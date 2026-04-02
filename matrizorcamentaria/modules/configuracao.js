import { supabase } from '../services/supabase.js';
import { brMoney, brPercent, toNumber } from './formatters.js';
import { renderNav } from './nav.js';
import { canEdit } from './auth.js';

renderNav('configuracao.html');

let currentId = null;
let currentAtivo = false;

const $ = id => document.getElementById(id);

function setStatus(msg, cls = 'ok') {
  const el = $('statusMsg');
  el.className = `status ${cls}`;
  el.innerHTML = `<i class="fa-solid fa-${cls === 'ok' ? 'circle-check' : cls === 'warn' ? 'triangle-exclamation' : 'circle-xmark'}"></i> ${msg}`;
}

function calcLiquido() {
  const rb = toNumber($('recursoBruto').value);
  const cc = toNumber($('contratosContinuados').value);
  const od = toNumber($('outrasDespesas').value);
  const modo = document.querySelector('input[name="segMode"]:checked').value;
  const sv = toNumber($('segurancaValor').value);
  const segVal = modo === 'PERCENTUAL' ? rb * sv / 100 : sv;
  return Math.max(0, rb - cc - od - segVal);
}

function getFormData() {
  const rb = toNumber($('recursoBruto').value);
  const rl = calcLiquido();
  return {
    recurso_bruto: rb,
    recurso_liquido: rl,
    pct_total: 100,
    contratos_continuados: toNumber($('contratosContinuados').value),
    outras_despesas_campus: toNumber($('outrasDespesas').value),
    seguranca_modo: document.querySelector('input[name="segMode"]:checked').value,
    seguranca_valor: toNumber($('segurancaValor').value),
    peso_v1: toNumber($('pesoV1').value),
    peso_v2: toNumber($('pesoV2').value),
    peso_v3: toNumber($('pesoV3').value),
    peso_v4: toNumber($('pesoV4').value),
    v1_peso_graduacao: toNumber($('v1PesoGrad').value),
    v1_peso_pos_graduacao: toNumber($('v1PesoPos').value),
    v2_peso_docentes: toNumber($('v2PesoDocentes').value),
    v2_peso_taes: toNumber($('v2PesoTaes').value),
    v2_peso_20h: toNumber($('v2Peso20h').value),
    v2_peso_40h: toNumber($('v2Peso40h').value),
    v2_peso_de: toNumber($('v2PesoDE').value),
    v2_peso_funcao_parcial: toNumber($('v2PesoFuncaoParcial').value),
    v2_peso_funcao_integral: toNumber($('v2PesoFuncaoIntegral').value),
    v3_peso_graduacao: toNumber($('v3PesoGrad').value),
    v3_peso_especializacao: toNumber($('v3PesoEsp').value),
    v3_peso_mestrado: toNumber($('v3PesoMest').value),
    v3_peso_doutorado: toNumber($('v3PesoDoutor').value),
    v1_modo: document.querySelector('input[name="v1Modo"]:checked')?.value || 'MANUAL',
  };
}

function fillForm(cfg) {
  currentId = cfg.id;
  currentAtivo = cfg.ativo;
  $('recursoBruto').value = cfg.recurso_bruto ?? cfg.recurso_liquido;
  $('contratosContinuados').value = cfg.contratos_continuados;
  $('outrasDespesas').value = cfg.outras_despesas_campus;
  document.querySelector(`input[name="segMode"][value="${cfg.seguranca_modo}"]`).checked = true;
  $('segurancaValor').value = cfg.seguranca_valor;
  $('pesoV1').value = cfg.peso_v1;
  $('pesoV2').value = cfg.peso_v2;
  $('pesoV3').value = cfg.peso_v3;
  $('pesoV4').value = cfg.peso_v4;
  $('v1PesoGrad').value = cfg.v1_peso_graduacao;
  $('v1PesoPos').value = cfg.v1_peso_pos_graduacao;
  $('v2PesoDocentes').value = cfg.v2_peso_docentes;
  $('v2PesoTaes').value = cfg.v2_peso_taes;
  $('v2Peso20h').value = cfg.v2_peso_20h;
  $('v2Peso40h').value = cfg.v2_peso_40h;
  $('v2PesoDE').value = cfg.v2_peso_de;
  $('v2PesoFuncaoParcial').value = cfg.v2_peso_funcao_parcial;
  $('v2PesoFuncaoIntegral').value = cfg.v2_peso_funcao_integral;
  $('v3PesoGrad').value = cfg.v3_peso_graduacao;
  $('v3PesoEsp').value = cfg.v3_peso_especializacao;
  $('v3PesoMest').value = cfg.v3_peso_mestrado;
  $('v3PesoDoutor').value = cfg.v3_peso_doutorado;
  const modoEl = document.querySelector(`input[name="v1Modo"][value="${cfg.v1_modo || 'MANUAL'}"]`);
  if (modoEl) modoEl.checked = true;
  updateKpis();
  updatePesoStatus();
  updateSegHint();
  updateAtivoBadge();
}

function clearFields() {
  currentId = null;
  currentAtivo = false;
  $('recursoBruto').value = 0;
  $('contratosContinuados').value = 0;
  $('outrasDespesas').value = 0;
  document.querySelector('input[name="segMode"][value="PERCENTUAL"]').checked = true;
  $('segurancaValor').value = 0;
  $('pesoV1').value = 20; $('pesoV2').value = 30;
  $('pesoV3').value = 25; $('pesoV4').value = 25;
  $('v1PesoGrad').value = 50; $('v1PesoPos').value = 50;
  $('v2PesoDocentes').value = 60; $('v2PesoTaes').value = 40;
  $('v2Peso20h').value = 1; $('v2Peso40h').value = 2; $('v2PesoDE').value = 3;
  $('v2PesoFuncaoParcial').value = 1; $('v2PesoFuncaoIntegral').value = 2;
  $('v3PesoGrad').value = 1; $('v3PesoEsp').value = 2;
  $('v3PesoMest').value = 3; $('v3PesoDoutor').value = 4;
  const manualEl = document.querySelector('input[name="v1Modo"][value="MANUAL"]');
  if (manualEl) manualEl.checked = true;
  updateKpis(); updatePesoStatus(); updateSegHint(); updateAtivoBadge();
}

function updateAtivoBadge() {
  const badge = $('cfgAtivoBadge');
  const btnAtivar = $('btnAtivar');
  badge.style.display = currentAtivo ? '' : 'none';
  if (btnAtivar) btnAtivar.style.display = (currentId && !currentAtivo) ? '' : 'none';
}

function updateKpis() {
  const rb = toNumber($('recursoBruto').value);
  const cc = toNumber($('contratosContinuados').value);
  const od = toNumber($('outrasDespesas').value);
  const modo = document.querySelector('input[name="segMode"]:checked').value;
  const sv = toNumber($('segurancaValor').value);
  const segVal = modo === 'PERCENTUAL' ? rb * sv / 100 : sv;
  const rl = Math.max(0, rb - cc - od - segVal);
  $('kpiRB').textContent = brMoney(rb);
  $('kpiCO').textContent = brMoney(cc + od);
  $('kpiSeg').textContent = brMoney(segVal);
  $('kpiRL').textContent = brMoney(rl);
}

function updatePesoStatus() {
  const soma = toNumber($('pesoV1').value) + toNumber($('pesoV2').value)
             + toNumber($('pesoV3').value) + toNumber($('pesoV4').value);
  const el = $('pesoStatus'); const soma_el = $('pesoSoma');
  soma_el.textContent = brPercent(soma);
  el.className = `status ${Math.abs(soma - 100) < 0.01 ? 'ok' : 'warn'}`;
  el.querySelector('i').className = `fa-solid fa-${Math.abs(soma - 100) < 0.01 ? 'circle-check' : 'triangle-exclamation'}`;
}

function updateSegHint() {
  const modo = document.querySelector('input[name="segMode"]:checked').value;
  $('segHint').textContent = modo === 'PERCENTUAL' ? '% do recurso bruto' : 'Valor fixo em R$';
}

async function loadAnoSelect(selectAno = null) {
  const { data } = await supabase.schema('utfprct').from('matriz_orc_configuracao_base')
    .select('id,ano,ativo').order('ano', { ascending: false });
  const sel = $('anoSelect');
  sel.innerHTML = '<option value="">Selecionar...</option>';
  (data || []).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.ano;
    opt.textContent = `${c.ano}${c.ativo ? ' ✓' : ''}`;
    opt.dataset.id = c.id;
    opt.dataset.ativo = c.ativo;
    sel.appendChild(opt);
  });
  const newOpt = document.createElement('option');
  newOpt.value = '__novo__';
  newOpt.textContent = '+ Novo ano...';
  sel.appendChild(newOpt);

  if (selectAno) {
    sel.value = String(selectAno);
  } else {
    const active = (data || []).find(c => c.ativo);
    if (active) sel.value = String(active.ano);
  }
  onAnoSelectChange(sel.value);
}

async function onAnoSelectChange(val) {
  $('novoAnoWrap').style.display = val === '__novo__' ? '' : 'none';
  if (val && val !== '__novo__') {
    const { data } = await supabase.schema('utfprct').from('matriz_orc_configuracao_base')
      .select('*').eq('ano', val).order('id', { ascending: false }).limit(1).maybeSingle();
    if (data) fillForm(data);
    else clearFields();
  } else if (!val) {
    clearFields();
  }
}

async function save() {
  if (!canEdit('configuracao')) { setStatus('Sem permissão. Desbloqueie no Início.', 'warn'); return; }
  const sel = $('anoSelect');
  const ano = sel.value === '__novo__' ? toNumber($('anoNovo').value) : toNumber(sel.value);
  if (!ano) { setStatus('Selecione ou informe um ano válido.', 'warn'); return; }

  const payload = getFormData();
  const soma = payload.peso_v1 + payload.peso_v2 + payload.peso_v3 + payload.peso_v4;
  if (Math.abs(soma - 100) > 0.01) { setStatus(`Soma dos pesos é ${brPercent(soma)}. Deve ser 100%.`, 'warn'); return; }

  if (currentId && sel.value !== '__novo__') {
    const { error } = await supabase.schema('utfprct').from('matriz_orc_configuracao_base')
      .update(payload).eq('id', currentId);
    if (error) { setStatus('Erro ao salvar: ' + error.message, 'err'); return; }
    setStatus(`Configuração ${ano} salva.`);
  } else {
    const { data: existing } = await supabase.schema('utfprct').from('matriz_orc_configuracao_base')
      .select('id').eq('ano', ano).maybeSingle();
    if (existing) { setStatus(`Já existe uma configuração para ${ano}. Selecione o ano na lista.`, 'warn'); return; }
    payload.ano = ano;
    payload.ativo = false;
    const { data: ins, error } = await supabase.schema('utfprct').from('matriz_orc_configuracao_base')
      .insert(payload).select('id').single();
    if (error || !ins) { setStatus('Erro ao salvar: ' + (error?.message || 'sem retorno'), 'err'); return; }
    currentId = ins.id;
    currentAtivo = false;
    setStatus(`Configuração ${ano} criada. Clique em "Ativar" para torná-la a configuração oficial.`);
  }
  await loadAnoSelect(ano);
}

async function remove() {
  if (!canEdit('configuracao')) { setStatus('Sem permissão. Desbloqueie no Início.', 'warn'); return; }
  if (!currentId) { setStatus('Nenhuma configuração carregada.', 'warn'); return; }
  const ano = $('anoSelect').value;
  if (!confirm(`Excluir a configuração de ${ano}?\n\nTodos os dados de V1, V2, V3 e V4 vinculados a este ano serão removidos.`)) return;
  const { error } = await supabase.schema('utfprct').from('matriz_orc_configuracao_base').delete().eq('id', currentId);
  if (error) { setStatus('Erro ao excluir: ' + error.message, 'err'); return; }
  setStatus(`Configuração ${ano} excluída.`);
  clearFields();
  await loadAnoSelect();
}

async function activate() {
  if (!canEdit('configuracao')) { setStatus('Sem permissão. Desbloqueie no Início.', 'warn'); return; }
  if (!currentId) { setStatus('Nenhuma configuração carregada.', 'warn'); return; }
  await supabase.schema('utfprct').from('matriz_orc_configuracao_base').update({ ativo: false }).neq('id', 0);
  const { error } = await supabase.schema('utfprct').from('matriz_orc_configuracao_base').update({ ativo: true }).eq('id', currentId);
  if (error) { setStatus('Erro ao ativar: ' + error.message, 'err'); return; }
  currentAtivo = true;
  setStatus(`Configuração ${$('anoSelect').value} marcada como ativa.`);
  const ano = $('anoSelect').value;
  await loadAnoSelect(ano);
}

async function duplicar() {
  if (!canEdit('configuracao')) { setStatus('Sem permissão. Desbloqueie no Início.', 'warn'); return; }
  if (!currentId) { setStatus('Carregue uma configuração antes de duplicar.', 'warn'); return; }
  const anoDestino = toNumber($('duplicarPara').value);
  if (!anoDestino) { setStatus('Informe o ano de destino.', 'warn'); return; }
  const { data: existing } = await supabase.schema('utfprct').from('matriz_orc_configuracao_base')
    .select('id').eq('ano', anoDestino).maybeSingle();
  if (existing) { setStatus(`Já existe uma configuração para ${anoDestino}.`, 'warn'); return; }
  const payload = { ...getFormData(), ano: anoDestino, ativo: false };
  const { error } = await supabase.schema('utfprct').from('matriz_orc_configuracao_base').insert(payload);
  if (error) { setStatus('Erro ao duplicar: ' + error.message, 'err'); return; }
  setStatus(`Configuração duplicada para ${anoDestino}. Selecione o ano para editá-la.`);
  $('duplicarPara').value = '';
  await loadAnoSelect(anoDestino);
}

function applyAuth() {
  const ok = canEdit('configuracao');
  ['btnSalvar', 'btnAtivar', 'btnExcluir', 'btnDuplicar'].forEach(id => {
    const el = $(id); if (!el) return;
    el.disabled = !ok;
    if (!ok) el.title = 'Sem permissão — desbloqueie no Início';
  });
  [
    'recursoBruto','contratosContinuados','outrasDespesas','segurancaValor',
    'pesoV1','pesoV2','pesoV3','pesoV4',
    'v1PesoGrad','v1PesoPos',
    'v2PesoDocentes','v2PesoTaes','v2Peso20h','v2Peso40h','v2PesoDE','v2PesoFuncaoParcial','v2PesoFuncaoIntegral',
    'v3PesoGrad','v3PesoEsp','v3PesoMest','v3PesoDoutor',
    'anoNovo','duplicarPara',
  ].forEach(id => { const el = $(id); if (el) el.disabled = !ok; });
  document.querySelectorAll('input[name="segMode"]').forEach(r => r.disabled = !ok);
  document.querySelectorAll('input[name="v1Modo"]').forEach(r => r.disabled = !ok);
}

async function init() {
  await loadAnoSelect();

  $('anoSelect').addEventListener('change', e => onAnoSelectChange(e.target.value));
  $('btnSalvar').addEventListener('click', save);
  $('btnAtivar').addEventListener('click', activate);
  $('btnExcluir').addEventListener('click', remove);
  $('btnDuplicar').addEventListener('click', duplicar);
  applyAuth();

  ['recursoBruto','pctTotal','contratosContinuados','outrasDespesas','segurancaValor'].forEach(id => $(id)?.addEventListener('input', updateKpis));
  ['pesoV1','pesoV2','pesoV3','pesoV4'].forEach(id => $(id).addEventListener('input', updatePesoStatus));
  document.querySelectorAll('input[name="segMode"]').forEach(r => r.addEventListener('change', () => { updateSegHint(); updateKpis(); }));

  updateKpis(); updatePesoStatus(); updateSegHint();
}

init().catch(console.error);
