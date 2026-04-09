import {
  loadMotoristas, upsertMotorista, deleteMotorista,
  loadGruposMotoristas, upsertGrupoMotoristas, deleteGrupoMotoristas, loadGrupoMotoristasItens,
  loadVeiculos, upsertVeiculo, deleteVeiculo,
  loadGruposVeiculos, upsertGrupoVeiculos, deleteGrupoVeiculos, loadGrupoVeiculosItens,
  loadAgendaTiposAll, upsertAgendaTipo, deleteAgendaTipo,
} from './db.ts';
import type { Motorista, GrupoMotoristas, Veiculo, GrupoVeiculos, AgendaTipo } from './types.ts';

const TIPO_MOT_LABEL: Record<string, string> = { oficial: 'Oficial', habilitado: 'Habilitado', externo: 'Externo' };
const TIPO_VEI_LABEL: Record<string, string> = { passeio: 'Passeio', especial: 'Especial', onibus: 'Ônibus', van: 'Van', outro: 'Outro' };
const CORES = ['#1565c0','#2e7d32','#c62828','#e65100','#6a1b9a','#00838f','#37474f','#558b2f','#ad1457','#f9a825'];

let _motoristas:  Motorista[]       = [];
let _grupos_mot:  GrupoMotoristas[] = [];
let _veiculos:    Veiculo[]         = [];
let _grupos_vei:  GrupoVeiculos[]   = [];
let _tipos:       AgendaTipo[]      = [];
let _editingId:   string | null     = null;
let _selectedCor: string            = CORES[0];

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg: string, ok = true): void {
  const el = document.createElement('div');
  el.className = `alert ${ok ? 'alert-success' : 'alert-error'}`;
  el.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;min-width:260px;box-shadow:0 4px 14px rgba(0,0,0,0.2)';
  el.innerHTML = `<i class="fa-solid ${ok ? 'fa-check-circle' : 'fa-triangle-exclamation'}"></i> ${msg}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── DOM helpers ───────────────────────────────────────────────────────────────
const val   = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value?.trim() ?? '';
const setVal = (id: string, v: string | null | undefined) => { const el = document.getElementById(id) as HTMLInputElement | null; if (el) el.value = v ?? ''; };
const checked = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.checked ?? false;
const setChecked = (id: string, v: boolean) => { const el = document.getElementById(id) as HTMLInputElement | null; if (el) el.checked = v; };
const openModal  = (id: string) => document.getElementById(id)?.classList.add('open');
const closeModal = (id: string) => { document.getElementById(id)?.classList.remove('open'); _editingId = null; };

// ── Sub-tabs ──────────────────────────────────────────────────────────────────
function setActiveTab(tab: string): void {
  document.querySelectorAll('.sub-tab').forEach(el => el.classList.toggle('active', (el as HTMLElement).dataset.tab === tab));
  document.querySelectorAll<HTMLElement>('.tab-panel').forEach(el => { el.style.display = el.id === `panel-${tab}` ? '' : 'none'; });
}

// ── Check-list ────────────────────────────────────────────────────────────────
function renderCheckList<T>(containerId: string, items: T[], selectedIds: string[], labelFn: (i: T) => string, valueFn: (i: T) => string): void {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  if (!items.length) { wrap.innerHTML = '<p class="check-list-empty">Nenhum item disponível</p>'; return; }
  wrap.innerHTML = items.map(item => `
    <label>
      <input type="checkbox" value="${valueFn(item)}" ${selectedIds.includes(valueFn(item)) ? 'checked' : ''}>
      ${labelFn(item)}
    </label>`).join('');
}

function getCheckedValues(containerId: string): string[] {
  return [...document.querySelectorAll<HTMLInputElement>(`#${containerId} input[type="checkbox"]:checked`)].map(c => c.value);
}

// ════════════════════════════════════════════════════════════════
//  MOTORISTAS
// ════════════════════════════════════════════════════════════════
function renderMotoristas(): void {
  const tbody = document.getElementById('tbody-motoristas');
  if (!tbody) return;
  if (!_motoristas.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fa-solid fa-id-badge"></i><p>Nenhum motorista cadastrado</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = _motoristas.map(m => `
    <tr>
      <td>${m.nome}</td>
      <td>${m.matricula ?? '—'}</td>
      <td><span class="badge badge-info">${TIPO_MOT_LABEL[m.tipo] ?? m.tipo}</span></td>
      <td class="text-center">${m.ativo ? '<span class="badge badge-ok">Ativo</span>' : '<span class="badge badge-gray">Inativo</span>'}</td>
      <td>${m.observacoes ?? '—'}</td>
      <td class="text-center" style="white-space:nowrap">
        <button class="btn-icon" data-action="edit-mot" data-id="${m.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
        <button class="btn-icon" style="color:#c62828" data-action="del-mot" data-id="${m.id}" data-nome="${m.nome.replace(/"/g,'')}" title="Excluir"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`).join('');
}

async function editMotorista(id: string): Promise<void> {
  const m = _motoristas.find(x => x.id === id);
  if (!m) return;
  _editingId = id;
  setVal('mot-nome', m.nome); setVal('mot-matricula', m.matricula); setVal('mot-tipo', m.tipo); setVal('mot-obs', m.observacoes);
  setChecked('mot-ativo', m.ativo);
  const el = document.getElementById('mot-modal-title'); if (el) el.textContent = 'Editar Motorista';
  openModal('mot-modal');
}

function bindMotoristaForm(): void {
  document.getElementById('btn-add-motorista')?.addEventListener('click', () => {
    _editingId = null;
    ['mot-nome','mot-matricula','mot-obs'].forEach(id => setVal(id,''));
    setVal('mot-tipo','habilitado'); setChecked('mot-ativo', true);
    const el = document.getElementById('mot-modal-title'); if (el) el.textContent = 'Novo Motorista';
    openModal('mot-modal');
  });
  document.getElementById('mot-modal-close')?.addEventListener('click', () => closeModal('mot-modal'));
  document.getElementById('mot-cancel')?.addEventListener('click', () => closeModal('mot-modal'));
  document.getElementById('mot-save')?.addEventListener('click', async () => {
    const nome = val('mot-nome');
    if (!nome) { toast('Nome é obrigatório.', false); return; }
    try {
      await upsertMotorista({ id: _editingId ?? undefined, nome, matricula: val('mot-matricula') || null, tipo: val('mot-tipo') as Motorista['tipo'], observacoes: val('mot-obs') || null, ativo: checked('mot-ativo') });
      _motoristas = await loadMotoristas();
      renderMotoristas();
      closeModal('mot-modal');
      toast('Motorista salvo.');
    } catch(e) { toast((e as Error).message, false); }
  });
}

// ════════════════════════════════════════════════════════════════
//  GRUPOS DE MOTORISTAS
// ════════════════════════════════════════════════════════════════
function renderGruposMot(): void {
  const tbody = document.getElementById('tbody-grupos-mot');
  if (!tbody) return;
  if (!_grupos_mot.length) { tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><i class="fa-solid fa-users"></i><p>Nenhum grupo cadastrado</p></div></td></tr>`; return; }
  tbody.innerHTML = _grupos_mot.map(g => `
    <tr>
      <td>${g.nome}${g.is_todos ? ' <span class="badge badge-info">Padrão</span>' : ''}</td>
      <td>${g.descricao ?? '—'}</td>
      <td class="text-center">${(g.itens ?? []).length}</td>
      <td class="text-center" style="white-space:nowrap">
        ${g.is_todos ? '<span class="badge badge-gray">Fixo</span>' : `
          <button class="btn-icon" data-action="edit-gmot" data-id="${g.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-icon" style="color:#c62828" data-action="del-gmot" data-id="${g.id}" data-nome="${g.nome.replace(/"/g,'')}" title="Excluir"><i class="fa-solid fa-trash"></i></button>
        `}
      </td>
    </tr>`).join('');
}

function bindGrupoMotForm(): void {
  document.getElementById('btn-add-grupo-mot')?.addEventListener('click', () => {
    _editingId = null; setVal('gmot-nome',''); setVal('gmot-desc','');
    renderCheckList('gmot-check', _motoristas, [], m => m.nome, m => m.id);
    const el = document.getElementById('gmot-modal-title'); if (el) el.textContent = 'Novo Grupo de Motoristas';
    openModal('gmot-modal');
  });
  document.getElementById('gmot-modal-close')?.addEventListener('click', () => closeModal('gmot-modal'));
  document.getElementById('gmot-cancel')?.addEventListener('click', () => closeModal('gmot-modal'));
  document.getElementById('gmot-save')?.addEventListener('click', async () => {
    const nome = val('gmot-nome');
    if (!nome) { toast('Nome é obrigatório.', false); return; }
    try {
      await upsertGrupoMotoristas({ id: _editingId ?? undefined, nome, descricao: val('gmot-desc') || null }, getCheckedValues('gmot-check'));
      _grupos_mot = await loadGruposMotoristas();
      renderGruposMot();
      closeModal('gmot-modal');
      toast('Grupo salvo.');
    } catch(e) { toast((e as Error).message, false); }
  });
}

// ════════════════════════════════════════════════════════════════
//  VEÍCULOS
// ════════════════════════════════════════════════════════════════
function renderVeiculos(): void {
  const tbody = document.getElementById('tbody-veiculos');
  if (!tbody) return;
  if (!_veiculos.length) { tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fa-solid fa-car"></i><p>Nenhum veículo cadastrado</p></div></td></tr>`; return; }
  tbody.innerHTML = _veiculos.map(v => `
    <tr>
      <td><strong>${v.placa}</strong></td>
      <td>${v.descricao ?? '—'}</td>
      <td><span class="badge badge-info">${TIPO_VEI_LABEL[v.tipo] ?? v.tipo}</span></td>
      <td class="text-center">${v.capacidade ?? '—'}</td>
      <td class="text-center">${v.ativo ? '<span class="badge badge-ok">Ativo</span>' : '<span class="badge badge-gray">Inativo</span>'}</td>
      <td class="text-center" style="white-space:nowrap">
        <button class="btn-icon" data-action="edit-vei" data-id="${v.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
        <button class="btn-icon" style="color:#c62828" data-action="del-vei" data-id="${v.id}" data-placa="${v.placa}" title="Excluir"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`).join('');
}

function bindVeiculoForm(): void {
  document.getElementById('btn-add-veiculo')?.addEventListener('click', () => {
    _editingId = null; ['vei-placa','vei-desc','vei-cap'].forEach(id => setVal(id,''));
    setVal('vei-tipo','passeio'); setChecked('vei-ativo', true);
    const el = document.getElementById('vei-modal-title'); if (el) el.textContent = 'Novo Veículo';
    openModal('vei-modal');
  });
  document.getElementById('vei-modal-close')?.addEventListener('click', () => closeModal('vei-modal'));
  document.getElementById('vei-cancel')?.addEventListener('click', () => closeModal('vei-modal'));
  document.getElementById('vei-save')?.addEventListener('click', async () => {
    const placa = val('vei-placa').toUpperCase();
    if (!placa) { toast('Placa é obrigatória.', false); return; }
    try {
      await upsertVeiculo({ id: _editingId ?? undefined, placa, descricao: val('vei-desc') || null, tipo: val('vei-tipo') as Veiculo['tipo'], capacidade: Number(val('vei-cap')) || null, ativo: checked('vei-ativo') });
      _veiculos = await loadVeiculos();
      renderVeiculos();
      closeModal('vei-modal');
      toast('Veículo salvo.');
    } catch(e) { toast((e as Error).message, false); }
  });
}

// ════════════════════════════════════════════════════════════════
//  GRUPOS DE VEÍCULOS
// ════════════════════════════════════════════════════════════════
function renderGruposVei(): void {
  const tbody = document.getElementById('tbody-grupos-vei');
  if (!tbody) return;
  if (!_grupos_vei.length) { tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><i class="fa-solid fa-layer-group"></i><p>Nenhum grupo cadastrado</p></div></td></tr>`; return; }
  tbody.innerHTML = _grupos_vei.map(g => `
    <tr>
      <td>${g.nome}${g.is_todos ? ' <span class="badge badge-info">Padrão</span>' : ''}</td>
      <td>${g.descricao ?? '—'}</td>
      <td class="text-center">${(g.itens ?? []).length}</td>
      <td class="text-center" style="white-space:nowrap">
        ${g.is_todos ? '<span class="badge badge-gray">Fixo</span>' : `
          <button class="btn-icon" data-action="edit-gvei" data-id="${g.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-icon" style="color:#c62828" data-action="del-gvei" data-id="${g.id}" data-nome="${g.nome.replace(/"/g,'')}" title="Excluir"><i class="fa-solid fa-trash"></i></button>
        `}
      </td>
    </tr>`).join('');
}

function bindGrupoVeiForm(): void {
  document.getElementById('btn-add-grupo-vei')?.addEventListener('click', () => {
    _editingId = null; setVal('gvei-nome',''); setVal('gvei-desc','');
    renderCheckList('gvei-check', _veiculos, [], v => `${v.placa}${v.descricao ? ' — '+v.descricao:''}`, v => v.id);
    const el = document.getElementById('gvei-modal-title'); if (el) el.textContent = 'Novo Grupo de Veículos';
    openModal('gvei-modal');
  });
  document.getElementById('gvei-modal-close')?.addEventListener('click', () => closeModal('gvei-modal'));
  document.getElementById('gvei-cancel')?.addEventListener('click', () => closeModal('gvei-modal'));
  document.getElementById('gvei-save')?.addEventListener('click', async () => {
    const nome = val('gvei-nome');
    if (!nome) { toast('Nome é obrigatório.', false); return; }
    try {
      await upsertGrupoVeiculos({ id: _editingId ?? undefined, nome, descricao: val('gvei-desc') || null }, getCheckedValues('gvei-check'));
      _grupos_vei = await loadGruposVeiculos();
      renderGruposVei();
      closeModal('gvei-modal');
      toast('Grupo salvo.');
    } catch(e) { toast((e as Error).message, false); }
  });
}

// ════════════════════════════════════════════════════════════════
//  AGENDAS (TIPOS)
// ════════════════════════════════════════════════════════════════
function renderSwatches(current?: string): void {
  _selectedCor = current ?? CORES[0];
  const wrap = document.getElementById('tipo-swatches');
  if (!wrap) return;
  wrap.innerHTML = CORES.map(c => `<span class="color-swatch${c === _selectedCor ? ' selected' : ''}" style="background:${c}" data-cor="${c}" title="${c}"></span>`).join('');
  wrap.querySelectorAll<HTMLElement>('.color-swatch').forEach(el => {
    el.addEventListener('click', () => {
      _selectedCor = el.dataset.cor ?? CORES[0];
      wrap.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      el.classList.add('selected');
    });
  });
}

function buildGrupoSelect(selectId: string, grupos: (GrupoMotoristas | GrupoVeiculos)[], selectedId: string | null): void {
  const sel = document.getElementById(selectId) as HTMLSelectElement | null;
  if (!sel) return;
  sel.innerHTML = '<option value="">— selecione —</option>' +
    grupos.map(g => `<option value="${g.id}"${g.id === selectedId ? ' selected' : ''}>${g.nome}</option>`).join('');
}

function renderTipos(): void {
  const tbody = document.getElementById('tbody-tipos');
  if (!tbody) return;
  if (!_tipos.length) { tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fa-solid fa-calendar-plus"></i><p>Nenhuma agenda cadastrada</p></div></td></tr>`; return; }
  tbody.innerHTML = _tipos.map(t => {
    const gm = _grupos_mot.find(g => g.id === t.grupo_motoristas_id);
    const gv = _grupos_vei.find(g => g.id === t.grupo_veiculos_id);
    return `
    <tr>
      <td><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${t.cor};margin-right:6px;vertical-align:middle"></span>${t.nome}</td>
      <td>${t.descricao ?? '—'}</td>
      <td>${gm?.nome ?? '—'}</td>
      <td>${gv?.nome ?? '—'}</td>
      <td class="text-center">${t.ativo ? '<span class="badge badge-ok">Ativa</span>' : '<span class="badge badge-gray">Inativa</span>'}</td>
      <td class="text-center" style="white-space:nowrap">
        <button class="btn-icon" data-action="edit-tipo" data-id="${t.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
        <button class="btn-icon" style="color:#c62828" data-action="del-tipo" data-id="${t.id}" data-nome="${t.nome.replace(/"/g,'')}" title="Excluir"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`;
  }).join('');
}

function bindTipoForm(): void {
  document.getElementById('btn-add-tipo')?.addEventListener('click', () => {
    _editingId = null; setVal('tipo-nome',''); setVal('tipo-desc','');
    buildGrupoSelect('tipo-grupo-mot', _grupos_mot, null);
    buildGrupoSelect('tipo-grupo-vei', _grupos_vei, null);
    renderSwatches(); setChecked('tipo-ativo', true);
    const el = document.getElementById('tipo-modal-title'); if (el) el.textContent = 'Nova Agenda';
    openModal('tipo-modal');
  });
  document.getElementById('tipo-modal-close')?.addEventListener('click', () => closeModal('tipo-modal'));
  document.getElementById('tipo-cancel')?.addEventListener('click', () => closeModal('tipo-modal'));
  document.getElementById('tipo-save')?.addEventListener('click', async () => {
    const nome = val('tipo-nome');
    if (!nome) { toast('Nome é obrigatório.', false); return; }
    try {
      await upsertAgendaTipo({ id: _editingId ?? undefined, nome, descricao: val('tipo-desc') || null, grupo_motoristas_id: val('tipo-grupo-mot') || null, grupo_veiculos_id: val('tipo-grupo-vei') || null, cor: _selectedCor, ativo: checked('tipo-ativo') });
      _tipos = await loadAgendaTiposAll();
      renderTipos();
      closeModal('tipo-modal');
      toast('Agenda salva.');
    } catch(e) { toast((e as Error).message, false); }
  });
}

// ── Event delegation para ações de tabela ─────────────────────────────────────
function bindTableActions(): void {
  document.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!btn) return;
    const { action, id, nome, placa } = btn.dataset as Record<string, string>;

    if (action === 'edit-mot' && id) { await editMotorista(id); }
    else if (action === 'del-mot' && id) {
      if (!confirm(`Excluir motorista "${nome}"?`)) return;
      try { await deleteMotorista(id); _motoristas = await loadMotoristas(); renderMotoristas(); toast('Motorista excluído.'); } catch(er) { toast((er as Error).message, false); }
    }
    else if (action === 'edit-gmot' && id) {
      const g = _grupos_mot.find(x => x.id === id);
      if (!g) return;
      _editingId = id; setVal('gmot-nome', g.nome); setVal('gmot-desc', g.descricao);
      const membros = await loadGrupoMotoristasItens(id);
      renderCheckList('gmot-check', _motoristas, membros, m => m.nome, m => m.id);
      const el = document.getElementById('gmot-modal-title'); if (el) el.textContent = 'Editar Grupo de Motoristas';
      openModal('gmot-modal');
    }
    else if (action === 'del-gmot' && id) {
      if (!confirm(`Excluir grupo "${nome}"?`)) return;
      try { await deleteGrupoMotoristas(id); _grupos_mot = await loadGruposMotoristas(); renderGruposMot(); toast('Grupo excluído.'); } catch(er) { toast((er as Error).message, false); }
    }
    else if (action === 'edit-vei' && id) {
      const v = _veiculos.find(x => x.id === id);
      if (!v) return;
      _editingId = id; setVal('vei-placa', v.placa); setVal('vei-desc', v.descricao); setVal('vei-tipo', v.tipo); setVal('vei-cap', String(v.capacidade ?? '')); setChecked('vei-ativo', v.ativo);
      const el = document.getElementById('vei-modal-title'); if (el) el.textContent = 'Editar Veículo';
      openModal('vei-modal');
    }
    else if (action === 'del-vei' && id) {
      if (!confirm(`Excluir veículo "${placa}"?`)) return;
      try { await deleteVeiculo(id); _veiculos = await loadVeiculos(); renderVeiculos(); toast('Veículo excluído.'); } catch(er) { toast((er as Error).message, false); }
    }
    else if (action === 'edit-gvei' && id) {
      const g = _grupos_vei.find(x => x.id === id);
      if (!g) return;
      _editingId = id; setVal('gvei-nome', g.nome); setVal('gvei-desc', g.descricao);
      const membros = await loadGrupoVeiculosItens(id);
      renderCheckList('gvei-check', _veiculos, membros, v => `${v.placa}${v.descricao ? ' — '+v.descricao:''}`, v => v.id);
      const el = document.getElementById('gvei-modal-title'); if (el) el.textContent = 'Editar Grupo de Veículos';
      openModal('gvei-modal');
    }
    else if (action === 'del-gvei' && id) {
      if (!confirm(`Excluir grupo "${nome}"?`)) return;
      try { await deleteGrupoVeiculos(id); _grupos_vei = await loadGruposVeiculos(); renderGruposVei(); toast('Grupo excluído.'); } catch(er) { toast((er as Error).message, false); }
    }
    else if (action === 'edit-tipo' && id) {
      const t = _tipos.find(x => x.id === id);
      if (!t) return;
      _editingId = id; setVal('tipo-nome', t.nome); setVal('tipo-desc', t.descricao);
      buildGrupoSelect('tipo-grupo-mot', _grupos_mot, t.grupo_motoristas_id);
      buildGrupoSelect('tipo-grupo-vei', _grupos_vei, t.grupo_veiculos_id);
      renderSwatches(t.cor); setChecked('tipo-ativo', t.ativo);
      const el = document.getElementById('tipo-modal-title'); if (el) el.textContent = 'Editar Agenda';
      openModal('tipo-modal');
    }
    else if (action === 'del-tipo' && id) {
      if (!confirm(`Excluir agenda "${nome}"?`)) return;
      try { await deleteAgendaTipo(id); _tipos = await loadAgendaTiposAll(); renderTipos(); toast('Agenda excluída.'); } catch(er) { toast((er as Error).message, false); }
    }
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
export async function initCadastros(): Promise<void> {
  try {
    [_motoristas, _grupos_mot, _veiculos, _grupos_vei, _tipos] = await Promise.all([
      loadMotoristas(), loadGruposMotoristas(), loadVeiculos(), loadGruposVeiculos(), loadAgendaTiposAll(),
    ]);
  } catch(e) { toast('Erro ao carregar dados: ' + (e as Error).message, false); }

  document.querySelectorAll<HTMLElement>('.sub-tab').forEach(el => {
    el.addEventListener('click', () => setActiveTab(el.dataset.tab ?? ''));
  });
  setActiveTab('motoristas');

  renderMotoristas(); renderGruposMot(); renderVeiculos(); renderGruposVei(); renderTipos();
  bindMotoristaForm(); bindGrupoMotForm(); bindVeiculoForm(); bindGrupoVeiForm(); bindTipoForm();
  bindTableActions();

  document.querySelectorAll('.modal-backdrop').forEach(bd => {
    bd.addEventListener('click', e => { if (e.target === bd) (bd as HTMLElement).classList.remove('open'); });
  });
}
