import { supabase } from '../services/supabase.js';
import { brMoney, brPercent, toNumber } from './formatters.js';
import { renderNav } from './nav.js';
import { canEdit } from './auth.js';

renderNav('configuracao.html');

let currentId = null;

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
    ano: toNumber($('cfgAno').value),
    descricao: $('cfgDescricao').value.trim() || null,
    recurso_bruto: rb,
    recurso_liquido: rl,
    pct_total: toNumber($('pctTotal').value),
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
    ativo: true,
  };
}

function fillForm(cfg) {
  currentId = cfg.id;
  $('cfgAno').value = cfg.ano;
  $('cfgDescricao').value = cfg.descricao || '';
  $('recursoBruto').value = cfg.recurso_bruto ?? cfg.recurso_liquido;
  $('pctTotal').value = cfg.pct_total;
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
  updateKpis();
  updatePesoStatus();
  updateSegHint();
}

function clearForm() {
  currentId = null;
  $('cfgSelect').value = '';
  $('cfgAno').value = new Date().getFullYear();
  $('cfgDescricao').value = '';
  $('recursoBruto').value = 0;
  $('pctTotal').value = 100;
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
  updateKpis(); updatePesoStatus(); updateSegHint();
}

function updateKpis() {
  const rb = toNumber($('recursoBruto').value);
  const pct = toNumber($('pctTotal').value);
  const cc = toNumber($('contratosContinuados').value);
  const od = toNumber($('outrasDespesas').value);
  const modo = document.querySelector('input[name="segMode"]:checked').value;
  const sv = toNumber($('segurancaValor').value);
  const segVal = modo === 'PERCENTUAL' ? rb * sv / 100 : sv;
  const rl = Math.max(0, rb - cc - od - segVal);
  const vb = rl * pct / 100;
  $('kpiRB').textContent = brMoney(rb);
  $('kpiCO').textContent = brMoney(cc + od);
  $('kpiSeg').textContent = brMoney(segVal);
  $('kpiRL').textContent = brMoney(rl);
  $('kpiVB').textContent = brMoney(vb);
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
  $('segHint').textContent = modo === 'PERCENTUAL' ? '% do recurso líquido' : 'Valor fixo em R$';
}

async function loadConfigs() {
  const sel = $('cfgSelect');
  sel.innerHTML = '<option value="">Nova configuração</option>';
  const { data } = await supabase.schema('utfprct').from('matriz_orc_configuracao_base').select('id,ano,descricao,ativo').order('id', { ascending: false });
  (data || []).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.ano}${c.descricao ? ' — ' + c.descricao : ''}${c.ativo ? ' ✓' : ''}`;
    sel.appendChild(opt);
  });
}

async function loadConfig(id) {
  if (!id) { clearForm(); return; }
  const { data } = await supabase.schema('utfprct').from('matriz_orc_configuracao_base').select('*').eq('id', id).single();
  if (data) fillForm(data);
}

async function save(isUpdate) {
  if (!canEdit('configuracao')) { setStatus('Sem permissão. Desbloqueie no Início.', 'warn'); return; }
  const payload = getFormData();
  if (!payload.descricao && !payload.ano) { setStatus('Preencha ao menos o ano.', 'warn'); return; }
  const soma = payload.peso_v1 + payload.peso_v2 + payload.peso_v3 + payload.peso_v4;
  if (Math.abs(soma - 100) > 0.01) { setStatus(`Soma dos pesos é ${brPercent(soma)}. Deve ser 100%.`, 'warn'); return; }

  if (isUpdate) {
    if (!currentId) { setStatus('Selecione uma configuração para atualizar.', 'warn'); return; }
    const { error } = await supabase.schema('utfprct').from('matriz_orc_configuracao_base').update(payload).eq('id', currentId);
    if (error) { setStatus('Erro ao atualizar: ' + error.message, 'err'); return; }
    setStatus('Configuração atualizada com sucesso.');
  } else {
    const { data, error } = await supabase.schema('utfprct').from('matriz_orc_configuracao_base').insert(payload).select('id').single();
    if (error || !data) { setStatus('Erro ao salvar: ' + (error?.message || 'sem retorno'), 'err'); return; }
    currentId = data.id;
    setStatus('Configuração salva com sucesso.');
  }
  await loadConfigs();
  $('cfgSelect').value = String(currentId);
}

async function remove() {
  if (!canEdit('configuracao')) { setStatus('Sem permissão. Desbloqueie no Início.', 'warn'); return; }
  if (!currentId) { setStatus('Selecione uma configuração para excluir.', 'warn'); return; }
  if (!confirm('Excluir esta configuração? Todos os dados vinculados serão removidos.')) return;
  const { error } = await supabase.schema('utfprct').from('matriz_orc_configuracao_base').delete().eq('id', currentId);
  if (error) { setStatus('Erro ao excluir: ' + error.message, 'err'); return; }
  setStatus('Configuração excluída.');
  clearForm();
  await loadConfigs();
}

function applyAuth() {
  const ok = canEdit('configuracao');
  ['btnSalvar', 'btnAtualizar', 'btnExcluir'].forEach(id => {
    const el = $(id); if (!el) return;
    el.disabled = !ok;
    if (!ok) el.title = 'Sem permissão — desbloqueie no Início';
  });
}

async function init() {
  await loadConfigs();
  const { data: active } = await supabase.schema('utfprct').from('matriz_orc_configuracao_base').select('*').eq('ativo', true).order('id', { ascending: false }).limit(1).maybeSingle();
  if (active) { $('cfgSelect').value = String(active.id); fillForm(active); }

  $('cfgSelect').addEventListener('change', e => loadConfig(e.target.value));
  $('btnSalvar').addEventListener('click', () => save(false));
  $('btnAtualizar').addEventListener('click', () => save(true));
  $('btnExcluir').addEventListener('click', remove);
  $('btnNova').addEventListener('click', clearForm);
  applyAuth();

  ['recursoBruto','pctTotal','contratosContinuados','outrasDespesas','segurancaValor'].forEach(id => $(id)?.addEventListener('input', updateKpis));
  ['pesoV1','pesoV2','pesoV3','pesoV4'].forEach(id => $(id).addEventListener('input', updatePesoStatus));
  document.querySelectorAll('input[name="segMode"]').forEach(r => r.addEventListener('change', () => { updateSegHint(); updateKpis(); }));

  updateKpis(); updatePesoStatus(); updateSegHint();
}

init().catch(console.error);
