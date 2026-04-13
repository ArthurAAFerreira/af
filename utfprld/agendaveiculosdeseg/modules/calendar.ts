import { Calendar } from '@fullcalendar/core';
import dayGridPlugin  from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import ptBrLocale     from '@fullcalendar/core/locales/pt-br';
import { loadEventos, loadAgendaTipos, loadAgendaSituacoes, loadMotoristas } from './db.ts';
import type { Evento, AgendaTipo, AgendaSituacao, Motorista } from './types.ts';

const DRIVER_REPORT_PASSWORDS = ['federer', 'dirpladsandy', '150148deseg'];
const STORAGE_KEY_SEEN = 'agenda_cancelados_seen_ld';

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const FALLBACK_SITUACOES: AgendaSituacao[] = [
  { chave: 'finalizada',               nome_display: 'Finalizada',                  descricao: 'Saídas com situação "Solicitação atendida e documentos preenchidos"',                cor_fundo: '#7e3aa9', cor_borda: '#5d2a7f', cor_texto: '#fff', icone: 'fa-flag-checkered',     ordem: 1 },
  { chave: 'aguardando_finalizacao',   nome_display: 'Aguardando Finalização',       descricao: 'Saídas com situação "Liberada pelo Disau" cuja saída já passou do dia e hora atual', cor_fundo: '#59647a', cor_borda: '#414a5d', cor_texto: '#fff', icone: 'fa-circle-xmark',       ordem: 2 },
  { chave: 'liberada',                 nome_display: 'Liberada',                    descricao: 'Saídas com situação "Liberada pelo Disau"',                                          cor_fundo: '#12853b', cor_borda: '#0b6028', cor_texto: '#fff', icone: 'fa-circle-check',       ordem: 3 },
  { chave: 'aguardando_aprovador',     nome_display: 'Aguardando Aprovador',         descricao: 'Saídas com situação "Aguardando autorização do aprovador"',                         cor_fundo: '#2f5fc4', cor_borda: '#234b9a', cor_texto: '#fff', icone: 'fa-clock',              ordem: 4 },
  { chave: 'aguardando_liberacao_deseg', nome_display: 'Aguardando Liberação DESEG', descricao: 'Saídas com situação "Autorizada pelo aprovador"',                                   cor_fundo: '#d08b00', cor_borda: '#945f00', cor_texto: '#fff', icone: 'fa-circle-half-stroke', ordem: 5 },
  { chave: 'em_andamento',             nome_display: 'Solicitação em andamento',     descricao: 'Saídas com situação "Solicitação em andamento"',                                    cor_fundo: '#246f85', cor_borda: '#1b5161', cor_texto: '#fff', icone: 'fa-circle',             ordem: 6 },
];

const state: {
  allEvents:     Evento[];
  agendaTipos:   AgendaTipo[];
  situacoes:     AgendaSituacao[];
  motoristas:    Motorista[];
  currentTipoId: string;
  calendar:      Calendar | null;
} = {
  allEvents:     [],
  agendaTipos:   [],
  situacoes:     FALLBACK_SITUACOES,
  motoristas:    [],
  currentTipoId: 'todas',
  calendar:      null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function norm(v: unknown): string {
  return String(v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}
function cap(v: string): string {
  const t = v.trim();
  return t ? t[0].toUpperCase() + t.slice(1) : '';
}
function extractPlate(v: unknown): string {
  const m = String(v ?? '').toUpperCase().match(/[A-Z]{3}[0-9][A-Z0-9][0-9]{2}/);
  return m ? m[0] : '';
}
function getPlate(evt: Evento): string {
  return extractPlate(evt.veiculo_principal) || extractPlate(evt.veiculos);
}
function isPassedEnd(evt: Evento): boolean {
  if (!evt.fim_previsto) return false;
  return new Date(String(evt.fim_previsto)).getTime() < Date.now();
}

function isCancelled(evt: Evento): boolean {
  const s = norm(evt.situacao_normalizada ?? evt.situacao);
  return s.includes('cancelad');
}

const KNOWN_CHAVES = ['finalizada', 'aguardando_finalizacao', 'liberada', 'aguardando_aprovador', 'aguardando_liberacao_deseg', 'em_andamento'] as const;

function visualStatus(evt: Evento): string {
  const s = norm(evt.situacao_normalizada ?? evt.situacao);
  // situacao_normalizada already IS the chave value
  if ((KNOWN_CHAVES as readonly string[]).includes(s)) {
    if (s === 'aguardando_finalizacao') return 'liberada';
    return s;
  }
  // situacao contains descriptive Portuguese text
  if (s.includes('liberad') && s.includes('disau'))
    return 'liberada';
  if (s.includes('solicitacao') && s.includes('atendida')) return 'finalizada';
  if (s.includes('autorizada') && s.includes('aprovador')) return 'aguardando_liberacao_deseg';
  if (s.includes('aguard') && s.includes('aprovador'))     return 'aguardando_aprovador';
  if (s.includes('andamento'))                              return 'em_andamento';
  return 'em_andamento';
}

function getSituacao(chave: string): AgendaSituacao {
  return state.situacoes.find(s => s.chave === chave) ??
         FALLBACK_SITUACOES.find(s => s.chave === chave) ??
         FALLBACK_SITUACOES[FALLBACK_SITUACOES.length - 1];
}

// ── Filtro por agenda tipo ────────────────────────────────────────────────────
function matchesTipo(evt: Evento, tipo: AgendaTipo | undefined): boolean {
  if (!tipo) return true;

  const gv = tipo.grupo_veiculos;
  const gm = tipo.grupo_motoristas;

  let veiculoOk = true;
  if (gv && !gv.is_todos) {
    const placas = new Set((gv.itens ?? []).map(i => i.veiculo.placa.toUpperCase()));
    veiculoOk = placas.has(getPlate(evt));
  }

  let motoristaOk = true;
  if (gm && !gm.is_todos) {
    const nomes = (gm.itens ?? []).map(i => norm(i.motorista.nome));
    const mats  = (gm.itens ?? []).map(i => norm(i.motorista.matricula ?? ''));
    const evtM  = norm(evt.motorista_nome);
    motoristaOk = nomes.some(n => evtM.includes(n) || n.includes(evtM)) ||
                  mats.some(m => m && evtM.includes(m));
  }
  return veiculoOk && motoristaOk;
}

function getFiltered(): Evento[] {
  const tipo = state.agendaTipos.find(t => t.id === state.currentTipoId);
  return state.allEvents.filter(e => matchesTipo(e, tipo));
}

// ── Disponibilidade de motoristas por dia ────────────────────────────────────
function buildAvailabilityMap(events: Evento[]): Map<string, boolean> {
  const oficiais = state.motoristas.filter(m => m.oficial && m.ativo);
  if (!oficiais.length) return new Map();

  const hoursPerDriver = new Map<string, Map<string, number>>();
  for (const m of oficiais) hoursPerDriver.set(norm(m.nome), new Map());

  for (const evt of events) {
    if (isCancelled(evt)) continue;
    if (!evt.inicio_previsto || !evt.fim_previsto) continue;
    const start = new Date(String(evt.inicio_previsto));
    const end   = new Date(String(evt.fim_previsto));
    if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;
    const hours = (end.getTime() - start.getTime()) / 3_600_000;
    if (hours <= 0) continue;

    const dayKey = start.toISOString().slice(0, 10);
    const mNorm  = norm(evt.motorista_nome);
    for (const [oNorm, dayMap] of hoursPerDriver) {
      if (mNorm.includes(oNorm) || oNorm.includes(mNorm)) {
        dayMap.set(dayKey, (dayMap.get(dayKey) ?? 0) + hours);
      }
    }
  }

  const busyDays = new Map<string, boolean>();
  const allDays  = new Set<string>();
  for (const dayMap of hoursPerDriver.values()) for (const d of dayMap.keys()) allDays.add(d);

  for (const day of allDays) {
    const allBusy = [...hoursPerDriver.values()].every(dm => (dm.get(day) ?? 0) >= 6);
    if (allBusy) busyDays.set(day, true);
  }
  return busyDays;
}

let _availabilityMap: Map<string, boolean> = new Map();

function updateAvailabilityIcons(): void {
  const root = document.getElementById('calendarRoot');
  if (!root) return;
  root.querySelectorAll('.fc-availability-icon').forEach(el => el.remove());
  root.querySelectorAll<HTMLElement>('[data-date]').forEach(el => {
    const dayKey = el.getAttribute('data-date');
    if (dayKey && _availabilityMap.get(dayKey)) {
      const span = document.createElement('span');
      span.className = 'fc-availability-icon';
      span.title = 'Nenhum motorista oficial disponível neste dia';
      span.style.cssText = 'position:absolute;top:3px;right:22px;font-size:1.1rem;cursor:default;z-index:2;pointer-events:none';
      span.innerHTML = '<i class="fa-solid fa-user-slash" style="color:#c0392b"></i>';
      el.style.position = 'relative';
      el.appendChild(span);
    }
  });
}

// ── Legenda dinâmica ─────────────────────────────────────────────────────────
function renderLegend(): void {
  const el = document.getElementById('legendRoot');
  if (!el) return;
  const sits = state.situacoes.length ? state.situacoes : FALLBACK_SITUACOES;
  el.innerHTML = sits.map(s =>
    `<span title="${s.descricao}"><i class="legend-dot" style="background:${s.cor_fundo}"></i> <strong>${s.nome_display}</strong></span>`
  ).join('');
}

// ── Painel de cancelamentos ─────────────────────────────────────────────────
function getCancelledEvents(): Evento[] {
  return state.allEvents.filter(e => isCancelled(e));
}

function getSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SEEN);
    return new Set(raw ? JSON.parse(raw) as string[] : []);
  } catch { return new Set(); }
}

function saveSeenIds(ids: Set<string>): void {
  try { localStorage.setItem(STORAGE_KEY_SEEN, JSON.stringify([...ids])); } catch { /* ignore */ }
}

function renderCancelledPanel(): void {
  const cancelled = getCancelledEvents();
  const seenIds   = getSeenIds();
  const fmt = (v: unknown) => {
    if (!v) return '—';
    const d = new Date(String(v));
    return isNaN(d.getTime()) ? String(v) : d.toLocaleString('pt-BR');
  };
  const newOnes = cancelled.filter(e => {
    const id = String(e.numero_solicitacao ?? '');
    return id && !seenIds.has(id);
  });
  const newBadge   = document.getElementById('canceladasNewBadge');
  const countBadge = document.getElementById('canceladasCountBadge');
  if (newBadge) {
    newBadge.style.display = newOnes.length ? '' : 'none';
    newBadge.textContent   = `${newOnes.length} novo${newOnes.length !== 1 ? 's' : ''}`;
  }
  if (countBadge) countBadge.textContent = String(cancelled.length);
  const tableDiv = document.getElementById('canceladasTable');
  if (!tableDiv) return;
  if (!cancelled.length) {
    tableDiv.innerHTML = '<p style="color:#888;font-size:.85rem;padding:8px 0">Nenhum cancelamento encontrado.</p>';
    return;
  }
  tableDiv.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:.8rem">
      <thead>
        <tr style="background:#f1f3f5">
          <th style="padding:6px 8px;text-align:left">Protocolo</th>
          <th style="padding:6px 8px;text-align:left">Solicitante</th>
          <th style="padding:6px 8px;text-align:left">Veículo</th>
          <th style="padding:6px 8px;text-align:left">Início</th>
          <th style="padding:6px 8px;text-align:left">Situação</th>
          <th style="padding:6px 8px;text-align:center">Novo</th>
        </tr>
      </thead>
      <tbody>
        ${cancelled.map(e => {
          const id    = String(e.numero_solicitacao ?? '');
          const isNew = Boolean(id && !seenIds.has(id));
          return `<tr style="${isNew ? 'background:#fff5f5' : ''}">
            <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0">${e.numero_solicitacao ?? '—'}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0">${e.solicitante_nome ?? '—'}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0">${String(e.veiculo_principal ?? e.veiculos ?? '—')}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0">${fmt(e.inicio_previsto)}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0">${e.situacao ?? '—'}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;text-align:center">${isNew ? '<i class="fa-solid fa-circle-exclamation" style="color:#c0392b" title="Novo cancelamento"></i>' : ''}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

// ── KPIs ──────────────────────────────────────────────────────────────────────
function updateKpis(): void {
  const evts = getFiltered();
  const vs   = evts.map(e => visualStatus(e));
  const set  = (id: string, v: number) => { const el = document.getElementById(id); if (el) el.textContent = String(v); };
  set('kpiTotal',    evts.length);
  set('kpiLiberadas', vs.filter(s => s === 'liberada' || s === 'aguardando_finalizacao').length);
  set('kpiPendentes', vs.filter(s => s === 'aguardando_aprovador' || s === 'aguardando_liberacao_deseg').length);
}

// ── Título do calendário ──────────────────────────────────────────────────────
function fixTitle(): void {
  const el = document.querySelector('#calendarRoot .fc-toolbar-title') as HTMLElement | null;
  if (!el || !state.calendar) return;
  const view = state.calendar.view;
  if (view?.type === 'dayGridMonth') {
    const d = view.currentStart;
    if (!isNaN(d.getTime())) {
      el.textContent = cap(d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));
      return;
    }
  }
  el.textContent = cap(el.textContent ?? '');
}

// ── Eventos para o FullCalendar ───────────────────────────────────────────────
function buildFCEvents() {
  return getFiltered().filter(item => !isCancelled(item)).map(item => {
    const vs  = visualStatus(item);
    const sit = getSituacao(vs);
    return {
      ...item,
      title: (String(item.veiculo_principal ?? item.veiculos ?? 'Sem veículo')) +
             (item.motorista_nome ? ' — ' + item.motorista_nome : ''),
      start: item.inicio_previsto,
      end:   item.fim_previsto,
      extendedProps: { ...item, visualStatus: vs },
      backgroundColor: sit.cor_fundo,
      borderColor:     sit.cor_borda,
      textColor:       sit.cor_texto,
    };
  });
}

function refreshCalendar(): void {
  if (!state.calendar) return;
  state.calendar.removeAllEvents();
  state.calendar.addEventSource(buildFCEvents());
  updateKpis();
}

// ── Dropdown de agendas ───────────────────────────────────────────────────────
function buildAgendaSelect(): void {
  const sel = document.getElementById('agendaFilter') as HTMLSelectElement | null;
  if (!sel) return;
  sel.innerHTML = '<option value="todas">Todas as Agendas</option>';
  state.agendaTipos.forEach(t => {
    const opt = document.createElement('option');
    opt.value       = t.id;
    opt.textContent = t.nome;
    sel.appendChild(opt);
  });
  sel.value = state.currentTipoId;
  sel.onchange = () => {
    state.currentTipoId = sel.value;
    refreshCalendar();
    updateCorDot();
  };
}

function updateCorDot(): void {
  const dot = document.getElementById('agendaCorDot') as HTMLElement | null;
  if (!dot) return;
  const tipo = state.agendaTipos.find(t => t.id === state.currentTipoId);
  dot.style.background = tipo?.cor ?? 'transparent';
  dot.style.display    = tipo ? 'inline-block' : 'none';
}

// ── Modal de detalhe ──────────────────────────────────────────────────────────
function openModal(extProps: Record<string, unknown>): void {
  const fmt = (v: unknown) => {
    if (!v) return '—';
    const d = new Date(String(v));
    return isNaN(d.getTime()) ? String(v) : d.toLocaleString('pt-BR');
  };
  const items: [string, unknown][] = [
    ['Protocolo',   extProps.numero_solicitacao],
    ['Solicitante', extProps.solicitante_nome],
    ['Motorista',   extProps.motorista_nome],
    ['Veículo',     extProps.veiculo_principal ?? extProps.veiculos],
    ['Roteiro',     extProps.roteiro],
    ['Início',      fmt(extProps.inicio_previsto)],
    ['Fim',         fmt(extProps.fim_previsto)],
    ['Status',      extProps.situacao],
    ['Passageiros', extProps.quantidade_passageiros],
  ];

  const titleEl = document.getElementById('eventModalTitle');
  const bodyEl  = document.getElementById('eventModalBody');
  if (titleEl) titleEl.textContent = String(extProps.veiculo_principal ?? extProps.veiculos ?? '—');
  if (bodyEl)  bodyEl.innerHTML = items.map(([k, v]) =>
    `<div class="event-info-item"><strong>${k}</strong>${v ?? '—'}</div>`
  ).join('');
  document.getElementById('eventModalBackdrop')?.classList.add('open');
}

// ── Init ──────────────────────────────────────────────────────────────────────
export async function initCalendar(): Promise<void> {
  try {
    [state.allEvents, state.agendaTipos, state.motoristas] = await Promise.all([loadEventos(), loadAgendaTipos(), loadMotoristas()]);
    state.situacoes = await loadAgendaSituacoes().catch(() => []);
    if (!state.situacoes.length) state.situacoes = FALLBACK_SITUACOES;
    _availabilityMap = buildAvailabilityMap(state.allEvents);
  } catch (e) {
    const root = document.getElementById('calendarRoot');
    if (root) root.innerHTML = `<p style="color:red;padding:16px">Erro ao carregar eventos: ${(e as Error).message}</p>`;
    return;
  }

  buildAgendaSelect();
  renderLegend();

  const root = document.getElementById('calendarRoot');
  if (!root) return;

  state.calendar = new Calendar(root, {
    plugins:    [dayGridPlugin, timeGridPlugin],
    locale:     ptBrLocale,
    initialView: 'dayGridMonth',
    height:     'auto',
    headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' },
    buttonText:    { today: 'Hoje', month: 'Mês', week: 'Semana' },
    events: buildFCEvents(),
    dayHeaderContent: (arg) => ({ html: `<strong>${DAY_NAMES[arg.date.getDay()]}</strong>` }),
    dayCellContent:   (arg) => ({ html: `<strong class="fc-daygrid-day-number-bold">${arg.date.getDate()}</strong>` }),
    eventClassNames: () => ['fc-event-modern'],
    eventContent: arg => {
      const vs   = arg.event.extendedProps.visualStatus as string;
      const icon = getSituacao(vs).icone;
      return { html: `<div class="fc-event-inner"><i class="fa-solid ${icon}"></i>${arg.event.title}</div>` };
    },
    eventClick: ({ event }) => openModal(event.extendedProps),
    datesSet: () => { fixTitle(); setTimeout(updateAvailabilityIcons, 50); },
  });
  state.calendar.render();
  fixTitle();
  updateKpis();
  setTimeout(updateAvailabilityIcons, 100);
  renderCancelledPanel();

  document.getElementById('canceladasToggle')?.addEventListener('click', () => {
    const body    = document.getElementById('canceladasBody');
    const chevron = document.getElementById('canceladasChevron');
    if (!body) return;
    const open = body.style.display === 'none' || body.style.display === '';
    body.style.display = open ? 'block' : 'none';
    if (chevron) chevron.innerHTML = open
      ? '<i class="fa-solid fa-chevron-up"></i>'
      : '<i class="fa-solid fa-chevron-down"></i>';
  });

  document.getElementById('canceladasMarkSeenBtn')?.addEventListener('click', () => {
    const cancelled = getCancelledEvents();
    const ids = new Set(cancelled.map(e => String(e.numero_solicitacao ?? '')).filter(Boolean));
    saveSeenIds(ids);
    renderCancelledPanel();
  });

  document.getElementById('refreshCalendarBtn')?.addEventListener('click', async () => {
    try {
      [state.allEvents, state.agendaTipos, state.motoristas] = await Promise.all([loadEventos(), loadAgendaTipos(), loadMotoristas()]);
      state.situacoes = await loadAgendaSituacoes().catch(() => []);
      if (!state.situacoes.length) state.situacoes = FALLBACK_SITUACOES;
      _availabilityMap = buildAvailabilityMap(state.allEvents);
      buildAgendaSelect();
      renderLegend();
      refreshCalendar();
      setTimeout(updateAvailabilityIcons, 100);
      renderCancelledPanel();
    } catch (e) { alert('Erro ao atualizar: ' + (e as Error).message); }
  });

  const backdrop = document.getElementById('eventModalBackdrop');
  document.getElementById('eventModalCloseBtn')?.addEventListener('click', () => backdrop?.classList.remove('open'));
  backdrop?.addEventListener('click', e => { if (e.target === backdrop) backdrop.classList.remove('open'); });

  document.getElementById('unlockDriverReportBtn')?.addEventListener('click', () => {
    const pw  = (document.getElementById('driverReportPassword') as HTMLInputElement)?.value ?? '';
    const msg = document.getElementById('driverReportLockMsg');
    if (DRIVER_REPORT_PASSWORDS.includes(pw)) {
      const lock  = document.getElementById('driverReportLock');
      const frame = document.getElementById('reportMotoristasFrame');
      if (lock)  lock.style.display  = 'none';
      if (frame) frame.style.display = 'block';
      if (msg)   msg.textContent     = '';
    } else {
      if (msg) msg.textContent = 'Senha incorreta.';
    }
  });
}
