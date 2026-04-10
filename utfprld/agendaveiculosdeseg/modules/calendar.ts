import { Calendar } from '@fullcalendar/core';
import dayGridPlugin  from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import ptBrLocale     from '@fullcalendar/core/locales/pt-br';
import { loadEventos, loadAgendaTipos, loadAgendaSituacoes } from './db.ts';
import type { Evento, AgendaTipo, AgendaSituacao } from './types.ts';

const DRIVER_REPORT_PASSWORDS = ['federer', 'dirpladsandy', '150148deseg'];

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const FALLBACK_SITUACOES: AgendaSituacao[] = [
  { chave: 'liberada',   nome_display: 'Liberada (DISAU)',           cor_fundo: '#12853b', cor_borda: '#0b6028', cor_texto: '#fff', icone: 'fa-circle-check',       ordem: 1 },
  { chave: 'realizada',  nome_display: 'Realizada (sem finalizar)',  cor_fundo: '#59647a', cor_borda: '#414a5d', cor_texto: '#fff', icone: 'fa-circle-xmark',       ordem: 2 },
  { chave: 'finalizada', nome_display: 'Finalizada',                 cor_fundo: '#7e3aa9', cor_borda: '#5d2a7f', cor_texto: '#fff', icone: 'fa-flag-checkered',     ordem: 3 },
  { chave: 'autorizada', nome_display: 'Autorizada pelo aprovador',  cor_fundo: '#d08b00', cor_borda: '#945f00', cor_texto: '#fff', icone: 'fa-circle-half-stroke', ordem: 4 },
  { chave: 'aguardando', nome_display: 'Aguardando aprovador',       cor_fundo: '#2f5fc4', cor_borda: '#234b9a', cor_texto: '#fff', icone: 'fa-clock',              ordem: 5 },
  { chave: 'outros',     nome_display: 'Outros',                     cor_fundo: '#246f85', cor_borda: '#1b5161', cor_texto: '#fff', icone: 'fa-circle',             ordem: 6 },
];

const state: {
  allEvents:     Evento[];
  agendaTipos:   AgendaTipo[];
  situacoes:     AgendaSituacao[];
  currentTipoId: string;
  calendar:      Calendar | null;
} = {
  allEvents:     [],
  agendaTipos:   [],
  situacoes:     FALLBACK_SITUACOES,
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

function visualStatus(evt: Evento): string {
  const s = norm(evt.situacao_normalizada ?? evt.situacao);
  if (s.includes('liberad') && s.includes('disau'))
    return isPassedEnd(evt) ? 'realizada' : 'liberada';
  if (s.includes('solicitacao') && s.includes('atendida')) return 'finalizada';
  if (s.includes('autorizada') && s.includes('aprovador')) return 'autorizada';
  if (s.includes('aguard') && s.includes('aprovador'))  return 'aguardando';
  return 'outros';
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

// ── Legenda dinâmica ─────────────────────────────────────────────────────────
function renderLegend(): void {
  const el = document.getElementById('legendRoot');
  if (!el) return;
  const sits = state.situacoes.length ? state.situacoes : FALLBACK_SITUACOES;
  el.innerHTML = sits
    .filter(s => s.chave !== 'outros')
    .map(s => `<span><i class="legend-dot" style="background:${s.cor_fundo}"></i> ${s.nome_display}</span>`)
    .join('');
}

// ── KPIs ──────────────────────────────────────────────────────────────────────
function updateKpis(): void {
  const evts = getFiltered();
  const vs   = evts.map(e => visualStatus(e));
  const set  = (id: string, v: number) => { const el = document.getElementById(id); if (el) el.textContent = String(v); };
  set('kpiTotal',    evts.length);
  set('kpiLiberadas', vs.filter(s => s === 'liberada').length);
  set('kpiPendentes', vs.filter(s => s === 'aguardando' || s === 'autorizada').length);
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
  return getFiltered().map(item => {
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
    [state.allEvents, state.agendaTipos] = await Promise.all([loadEventos(), loadAgendaTipos()]);
    state.situacoes = await loadAgendaSituacoes().catch(() => []);
    if (!state.situacoes.length) state.situacoes = FALLBACK_SITUACOES;
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
    dayHeaderContent: (arg) => ({ html: DAY_NAMES[arg.date.getDay()] }),
    eventClassNames: () => ['fc-event-modern'],
    eventContent: arg => {
      const vs   = arg.event.extendedProps.visualStatus as string;
      const icon = getSituacao(vs).icone;
      return { html: `<div class="fc-event-inner"><i class="fa-solid ${icon}"></i>${arg.event.title}</div>` };
    },
    eventClick: ({ event }) => openModal(event.extendedProps),
    datesSet:   fixTitle,
  });
  state.calendar.render();
  fixTitle();
  updateKpis();

  document.getElementById('refreshCalendarBtn')?.addEventListener('click', async () => {
    try {
      [state.allEvents, state.agendaTipos] = await Promise.all([loadEventos(), loadAgendaTipos()]);
      state.situacoes = await loadAgendaSituacoes().catch(() => []);
      if (!state.situacoes.length) state.situacoes = FALLBACK_SITUACOES;
      buildAgendaSelect();
      renderLegend();
      refreshCalendar();
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
