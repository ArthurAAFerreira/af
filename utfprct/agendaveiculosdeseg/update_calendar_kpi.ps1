# Read the original file
$content = Get-Content modules/calendar.ts -Raw

# 1. Add KPI variables before updateKpis function
$pattern1 = '(// KPIs)'
$replacement1 = 'let _kpiRealizadas: Evento[] = [];
let _kpiLiberadas:  Evento[] = [];
let _kpiPendentes:  Evento[] = [];
let _kpiCanceladas: Evento[] = [];

// KPIs'
$content = $content -replace $pattern1, $replacement1

# 2. Replace updateKpis function
$pattern2 = '(?s)function updateKpis\(\): void \{.*?^\}'
$replacement2 = 'function updateKpis(): void {
  const all  = getFiltered();
  const notC = all.filter(e => !isCancelled(e));
  _kpiCanceladas = all.filter(e => isCancelled(e));

  _kpiRealizadas = notC.filter(e => {
    const vs = visualStatus(e);
    return vs === "finalizada" || vs === "aguardando_finalizacao";
  });
  _kpiLiberadas = notC.filter(e => visualStatus(e) === "liberada");
  _kpiPendentes = notC.filter(e => {
    const vs = visualStatus(e);
    return vs === "aguardando_aprovador" || vs === "aguardando_liberacao_deseg" || vs === "em_andamento";
  });

  const set = (id: string, v: number) => { const el = document.getElementById(id); if (el) el.textContent = String(v); };
  set("kpiTotal",      notC.length);
  set("kpiRealizadas", _kpiRealizadas.length);
  set("kpiLiberadas",  _kpiLiberadas.length);
  set("kpiPendentes",  _kpiPendentes.length);
  set("kpiCanceladas", _kpiCanceladas.length);
}'
$content = $content -replace $pattern2, $replacement2

# 3. Add modal and click handlers after backdrop event listeners
$pattern3 = '(backdrop\?\.addEventListener\(''click'', e => \{ if \(e\.target === backdrop\) backdrop\.classList\.remove\(''open''\); \}\);)'
$replacement3 = '$0

  // Generic modal for KPI lists
  function showEventsModal(heading: string, list: Evento[]): void {
    const titleEl = document.getElementById(''eventModalTitle'');
    const bodyEl  = document.getElementById(''eventModalBody'');
    if (titleEl) titleEl.textContent = `${heading} (${list.length})`;
    if (bodyEl) {
      if (!list.length) {
        bodyEl.innerHTML = ''<p class="status-note">Nenhuma solicitação encontrada.</p>'';
      } else {
        const fmt = (v: unknown) => {
          if (!v) return ''---'';
          const d = new Date(String(v));
          return isNaN(d.getTime()) ? String(v) : d.toLocaleString(''pt-BR'');
        };
        const rows = list.map(e => {
          const vs = visualStatus(e);
          const sit = getSituacao(vs);
          const badge = `<span style="background:${sit.cor_fundo};color:${sit.cor_texto};padding:2px 8px;border-radius:10px;font-size:.75rem">${sit.nome_display}</span>`;
          return `<div class="event-info-item">
            <strong>#</strong>${e.numero_solicitacao ?? ''---''}<br>
            <strong>Veículo</strong>${e.veiculo_principal ?? e.veiculos ?? ''---''}<br>
            <strong>Solicitante</strong>${e.solicitante_nome ?? ''---''}<br>
            <strong>Motorista</strong>${e.motorista_nome ?? ''---''}<br>
            <strong>Início</strong>${fmt(e.inicio_previsto)}<br>
            <strong>Fim</strong>${fmt(e.fim_previsto)}<br>
            <strong>Situação</strong>${badge}
          </div>`;
        }).join('''');
        bodyEl.innerHTML = rows;
      }
    }
    backdrop?.classList.add(''open'');
  }

  // KPI click handlers
  document.getElementById(''kpiRealizadasCard'')?.addEventListener(''click'', () => showEventsModal(''Realizadas'', _kpiRealizadas));
  document.getElementById(''kpiLiberadasCard'')?.addEventListener(''click'', () => showEventsModal(''Liberadas'', _kpiLiberadas));
  document.getElementById(''kpiPendentesCard'')?.addEventListener(''click'', () => showEventsModal(''Pendentes/Autorizadas'', _kpiPendentes));
  document.getElementById(''kpiCanceladasCard'')?.addEventListener(''click'', () => showEventsModal(''Canceladas'', _kpiCanceladas));'
$content = $content -replace $pattern3, $replacement3

# Write back
Set-Content -Path modules/calendar.ts -Value $content -Encoding UTF8
