import '../styles.css';
import { renderNav } from '../modules/nav.ts';
import { sb } from '../modules/db.ts';
import type { Evento } from '../modules/types.ts';
import Chart from 'chart.js/auto';

renderNav('relatorios.html');

// ── helpers ───────────────────────────────────────────────────────────────────
function norm(v: unknown): string {
  return String(v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}
function extractPlate(v: unknown): string {
  const m = String(v ?? '').toUpperCase().match(/[A-Z]{3}[0-9][A-Z0-9][0-9]{2}/);
  return m ? m[0] : String(v ?? '').trim();
}
function getVehicle(e: Evento): string {
  return extractPlate(e.veiculo_principal) || extractPlate(e.veiculos) || '—';
}
function getStatus(e: Evento): string {
  const s = norm(e.situacao_normalizada ?? e.situacao);
  const CHAVES = ['finalizada','aguardando_finalizacao','liberada','aguardando_aprovador','aguardando_liberacao_deseg','em_andamento'];
  if (CHAVES.includes(s)) return s;
  if (s.includes('liberad') && s.includes('disau')) return 'liberada';
  if (s.includes('solicitacao') && s.includes('atendida')) return 'finalizada';
  if (s.includes('autorizada') && s.includes('aprovador')) return 'aguardando_liberacao_deseg';
  if (s.includes('aguard') && s.includes('aprovador')) return 'aguardando_aprovador';
  if (s.includes('andamento')) return 'em_andamento';
  return 'em_andamento';
}
function fmtDate(v: string | undefined): string {
  if (!v) return '—';
  return new Date(v).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function isCancelled(e: Evento): boolean {
  return norm(e.situacao_normalizada ?? e.situacao).includes('cancelad');
}
function isPassedEnd(e: Evento): boolean {
  if (!e.fim_previsto) return false;
  return new Date(String(e.fim_previsto)).getTime() < Date.now();
}

function kpi(icon: string, label: string, value: string | number, color = '#15386c', id = ''): string {
  const idAttr = id ? ` id="${id}"` : '';
  const cursor = id ? 'cursor:pointer;' : '';
  return `<div class="card"${idAttr} style="flex:1;min-width:130px;padding:14px 18px;${cursor}">
    <div style="font-size:.75rem;color:#6b7a99;font-weight:600;text-transform:uppercase;letter-spacing:.4px">${label}</div>
    <div style="font-size:1.8rem;font-weight:800;color:${color};margin:4px 0 2px">${value}</div>
    <i class="fa-solid ${icon}" style="color:${color};opacity:.35;font-size:1.1rem"></i>
  </div>`;
}
function dataTable(head: string[], rows: string[][]): string {
  const ths = head.map(h => `<th>${h}</th>`).join('');
  const trs = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
  return `<div style="overflow-x:auto"><table class="data-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`;
}

// ── tab switching ─────────────────────────────────────────────────────────────
document.querySelectorAll<HTMLElement>('.sub-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll<HTMLElement>('.tab-panel').forEach(p => { p.style.display = 'none'; });
    btn.classList.add('active');
    const panel = document.getElementById(`panel-${btn.dataset.tab}`);
    if (panel) panel.style.display = '';
  });
});

// ── password unlock ───────────────────────────────────────────────────────────
const PASSWORDS = ['federer', 'dirpladsandy', '150148deseg'];
let motoristasBuilt = false;
let cachedEvents: Evento[] = [];

document.getElementById('unlockDriverReportBtn')?.addEventListener('click', () => {
  const pw  = (document.getElementById('driverReportPassword') as HTMLInputElement)?.value ?? '';
  const msg = document.getElementById('driverReportLockMsg');
  if (PASSWORDS.includes(pw)) {
    document.getElementById('driverReportLock')!.style.display = 'none';
    document.getElementById('motoristasContent')!.style.display = '';
    if (msg) msg.textContent = '';
    if (!motoristasBuilt) { motoristasBuilt = true; buildMotoristasTab(cachedEvents); }
  } else {
    if (msg) msg.textContent = 'Senha incorreta.';
  }
});

// ── Vehicle detail modal ─────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  liberada: 'Liberada', finalizada: 'Finalizada', aguardando_finalizacao: 'Ag. Finalização',
  aguardando_aprovador: 'Ag. Aprovador', aguardando_liberacao_deseg: 'Ag. DESEG', em_andamento: 'Em Andamento',
};
const STATUS_BADGE_COLORS: Record<string, string> = {
  liberada: '#12853b', finalizada: '#7e3aa9', aguardando_finalizacao: '#59647a',
  aguardando_aprovador: '#2f5fc4', aguardando_liberacao_deseg: '#d08b00', em_andamento: '#246f85',
};

function showVehicleModal(plate: string, events: Evento[]): void {
  showEventsModal(`${plate}`, events.filter(e => getVehicle(e) === plate));
}

function showEventsModal(heading: string, list: Evento[]): void {
  const title = document.getElementById('vehicleModalTitle');
  const body  = document.getElementById('vehicleModalBody');
  if (title) title.textContent = `${heading} — ${list.length} solicitação(ões)`;
  if (body) {
    if (!list.length) {
      body.innerHTML = '<p class="status-note">Nenhuma solicitação encontrada.</p>';
    } else {
      const rows = list.map(e => {
        const st = getStatus(e);
        const badge = `<span style="background:${STATUS_BADGE_COLORS[st] ?? '#59647a'};color:#fff;padding:2px 8px;border-radius:10px;font-size:.75rem">${STATUS_LABELS[st] ?? st}</span>`;
        return `<tr>
          <td>${e.numero_solicitacao ?? '—'}</td>
          <td>${getVehicle(e)}</td>
          <td>${e.solicitante_nome ?? '—'}</td>
          <td>${e.motorista_nome ?? '—'}</td>
          <td>${fmtDate(e.inicio_previsto)}</td>
          <td>${fmtDate(e.fim_previsto)}</td>
          <td>${badge}</td>
        </tr>`;
      }).join('');
      body.innerHTML = `<div style="overflow-x:auto"><table class="data-table">
        <thead><tr><th>#</th><th>Veículo</th><th>Solicitante</th><th>Motorista</th><th>Início</th><th>Fim</th><th>Situação</th></tr></thead>
        <tbody>${rows}</tbody></table></div>`;
    }
  }
  document.getElementById('vehicleModalBackdrop')?.classList.add('open');
}

document.getElementById('vehicleModalCloseBtn')?.addEventListener('click', () => {
  document.getElementById('vehicleModalBackdrop')?.classList.remove('open');
});
document.getElementById('vehicleModalBackdrop')?.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).id === 'vehicleModalBackdrop')
    document.getElementById('vehicleModalBackdrop')?.classList.remove('open');
});

// ── Tab 1 · Por Veículo ───────────────────────────────────────────────────────
function buildVeiculosTab(events: Evento[]): void {
  const byVei = new Map<string, number>();
  const STATUS_COLORS: Record<string, string> = {
    liberada: '#12853b', finalizada: '#7e3aa9', aguardando_finalizacao: '#59647a',
    aguardando_aprovador: '#2f5fc4', aguardando_liberacao_deseg: '#d08b00', em_andamento: '#246f85',
  };

  for (const e of events) {
    const v = getVehicle(e);
    byVei.set(v, (byVei.get(v) ?? 0) + 1);
  }
  const sorted = [...byVei.entries()].sort((a, b) => b[1] - a[1]);
  const top10  = sorted.slice(0, 10);

  const statusCounts = new Map<string, number>();
  for (const e of events) { const s = getStatus(e); statusCounts.set(s, (statusCounts.get(s) ?? 0) + 1); }
  const liberadas = (statusCounts.get('liberada') ?? 0) + (statusCounts.get('aguardando_finalizacao') ?? 0);

  const kpiEl = document.getElementById('kpi-veiculos');
  if (kpiEl) kpiEl.innerHTML =
    kpi('fa-car-side', 'Total de Saídas', events.length) +
    kpi('fa-car', 'Veículos Únicos', byVei.size, '#246f85') +
    kpi('fa-circle-check', 'Liberadas', liberadas, '#12853b') +
    kpi('fa-flag-checkered', 'Finalizadas', statusCounts.get('finalizada') ?? 0, '#7e3aa9');

  const ctx = document.getElementById('chart-veiculos') as HTMLCanvasElement | null;
  if (ctx && top10.length) {
    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: top10.map(([k]) => k),
        datasets: [{ label: 'Saídas', data: top10.map(([, v]) => v),
          backgroundColor: '#246f8580', borderColor: '#246f85', borderWidth: 1.5 }],
      },
      options: { responsive: true, plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
    });
    ctx.style.cursor = 'pointer';
    ctx.addEventListener('click', (evt) => {
      const pts = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, false);
      if (pts.length) {
        const plate = top10[pts[0].index][0];
        showVehicleModal(plate, events);
      }
    });
  }

  const pieCtx = document.getElementById('chart-veiculos-status') as HTMLCanvasElement | null;
  if (pieCtx && statusCounts.size) {
    const labels = [...statusCounts.keys()];
    new Chart(pieCtx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data: labels.map(l => statusCounts.get(l) ?? 0),
          backgroundColor: labels.map(l => STATUS_COLORS[l] ?? '#59647a'),
          borderColor: '#fff', borderWidth: 2 }],
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
    });
  }

  const tbl = document.getElementById('table-veiculos');
  if (tbl) {
    if (!sorted.length) { tbl.innerHTML = '<p class="status-note">Sem dados.</p>'; return; }
    tbl.innerHTML = dataTable(
      ['Veículo', 'Total Saídas'],
      sorted.map(([veiculo, total]) => [veiculo, String(total)]),
    );
    tbl.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach(tr => {
      tr.style.cursor = 'pointer';
      tr.addEventListener('click', () => {
        const plate = tr.cells[0]?.textContent?.trim() ?? '';
        if (plate) showVehicleModal(plate, events);
      });
    });
  }
}

// ── Tab 2 · Por Motorista ────────────────────────────────────────────────────
function buildMotoristasTab(events: Evento[]): void {
  const byMot  = new Map<string, number>();
  const byPass = new Map<string, number>();

  for (const e of events) {
    const d = e.motorista_nome?.trim() || '—';
    byMot.set(d, (byMot.get(d) ?? 0) + 1);
    byPass.set(d, (byPass.get(d) ?? 0) + (Number(e.quantidade_passageiros) || 0));
  }
  const sorted = [...byMot.entries()].sort((a, b) => b[1] - a[1]);
  const top10  = sorted.slice(0, 10);

  const kpiEl = document.getElementById('kpi-motoristas');
  if (kpiEl) kpiEl.innerHTML =
    kpi('fa-id-badge', 'Total de Saídas', events.length) +
    kpi('fa-users', 'Motoristas Ativos', byMot.size, '#12853b') +
    kpi('fa-star', 'Mais Ativo', top10[0]?.[0] ?? '—', '#d08b00');

  const ctx = document.getElementById('chart-motoristas') as HTMLCanvasElement | null;
  if (ctx && top10.length) {
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: top10.map(([k]) => k),
        datasets: [{ label: 'Saídas', data: top10.map(([, v]) => v),
          backgroundColor: '#12853b80', borderColor: '#12853b', borderWidth: 1.5 }],
      },
      options: { indexAxis: 'y', responsive: true,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } } },
    });
  }

  const tbl = document.getElementById('table-motoristas');
  if (tbl) {
    if (!sorted.length) { tbl.innerHTML = '<p class="status-note">Sem dados.</p>'; return; }
    tbl.innerHTML = dataTable(
      ['Motorista', 'Total Saídas', 'Passageiros'],
      sorted.map(([mot, total]) => [mot, String(total), String(byPass.get(mot) ?? 0)]),
    );
  }
}

// ── Tab 3 · Aguardando Liberação ─────────────────────────────────────────────
const PENDING_STATUSES = ['aguardando_aprovador', 'aguardando_liberacao_deseg', 'em_andamento'];
const STATUS_META: Record<string, { label: string; color: string }> = {
  aguardando_aprovador:       { label: 'Ag. Aprovador',        color: '#2f5fc4' },
  aguardando_liberacao_deseg: { label: 'Ag. Liberação DESEG',  color: '#d08b00' },
  em_andamento:               { label: 'Em Andamento',          color: '#246f85' },
};

function buildAguardandoTab(allEvents: Evento[]): void {
  const notCancelled = allEvents.filter(e => !isCancelled(e));
  const cancelled    = allEvents.filter(e => isCancelled(e));

  const realizadas = notCancelled.filter(e => {
    const st = getStatus(e);
    return st === 'finalizada' || (st === 'liberada' && isPassedEnd(e));
  });
  const liberadas = notCancelled.filter(e => getStatus(e) === 'liberada' && !isPassedEnd(e));
  const pending   = notCancelled.filter(e => PENDING_STATUSES.includes(getStatus(e)));

  const kpiEl = document.getElementById('kpi-aguardando');
  if (kpiEl) {
    kpiEl.innerHTML =
      kpi('fa-car-side', 'Reservas no Filtro', notCancelled.length) +
      kpi('fa-flag-checkered', 'Realizadas', realizadas.length, '#7e3aa9', 'kpi-realizadas') +
      kpi('fa-circle-check', 'Liberadas', liberadas.length, '#12853b', 'kpi-liberadas') +
      kpi('fa-hourglass-half', 'Pendentes/Autorizadas', pending.length, '#d08b00', 'kpi-pendentes') +
      kpi('fa-ban', 'Canceladas', cancelled.length, '#c62828', 'kpi-canceladas');

    document.getElementById('kpi-realizadas')?.addEventListener('click', () => showEventsModal('Realizadas', realizadas));
    document.getElementById('kpi-liberadas')?.addEventListener('click', () => showEventsModal('Liberadas', liberadas));
    document.getElementById('kpi-pendentes')?.addEventListener('click', () => showEventsModal('Pendentes/Autorizadas', pending));
    document.getElementById('kpi-canceladas')?.addEventListener('click', () => showEventsModal('Canceladas', cancelled));
  }

  const tbl = document.getElementById('table-aguardando');
  if (!tbl) return;
  if (!pending.length) { tbl.innerHTML = '<p class="status-note">Nenhuma solicitação pendente.</p>'; return; }

  const rows = pending.map(e => {
    const meta  = STATUS_META[getStatus(e)] ?? { label: getStatus(e), color: '#59647a' };
    const badge = `<span style="background:${meta.color};color:#fff;padding:2px 8px;border-radius:10px;font-size:.75rem">${meta.label}</span>`;
    return [String(e.numero_solicitacao ?? '—'), getVehicle(e),
            String(e.motorista_nome ?? '—'), fmtDate(e.inicio_previsto), fmtDate(e.fim_previsto), badge];
  });
  tbl.innerHTML = dataTable(['#', 'Veículo', 'Motorista', 'Início', 'Fim', 'Situação'], rows);
}

// ── init ──────────────────────────────────────────────────────────────────────
async function init(): Promise<void> {
  const loadEl = document.getElementById('relatorios-loading');
  try {
    const { data, error } = await sb.from('vw_agenda_eventos').select('*').order('inicio_previsto');
    if (error) throw error;
    cachedEvents = (data ?? []) as Evento[];
    if (loadEl) loadEl.remove();
    buildVeiculosTab(cachedEvents);
    buildAguardandoTab(cachedEvents);
  } catch (e) {
    if (loadEl) loadEl.innerHTML =
      `<p style="color:#c62828"><i class="fa-solid fa-circle-exclamation"></i> Erro ao carregar: ${(e as Error).message}</p>`;
  }
}

init();
