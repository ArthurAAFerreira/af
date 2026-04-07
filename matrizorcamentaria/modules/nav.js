import { getAuth } from './auth.js';

const PAGE_PERM = {
  'configuracao.html': 'configuracao',
  'unidades.html':     'unidades',
  'v1.html':           'v1',
  'v2.html':           'v2',
  'v3.html':           'v3',
  'v4.html':           'estruturas',
  'fixo.html':         'configuracao',
  'simulacoes.html':   'simulacoes',
  'cronograma.html':   'cronograma',
  'repasse.html':      'cronograma',
};

export function renderNav(activePage) {
  const { perms } = getAuth();
  const canEditPage = p => perms.includes('*') || perms.includes(p);
  const pages = [
    { href: 'index.html',        icon: 'fa-house',         label: 'Início',       step: null },
    { href: 'configuracao.html', icon: 'fa-sliders',       label: 'Configuração', step: '1' },
    { href: 'unidades.html',     icon: 'fa-building',      label: 'Unidades',     step: '2' },
    { href: 'v1.html',           icon: 'fa-user-graduate', label: 'Discentes',    step: '3' },
    { href: 'v2.html',           icon: 'fa-chalkboard-teacher', label: 'Docentes/TAEs', step: '4' },
    { href: 'v3.html',           icon: 'fa-graduation-cap','label': 'Titulação',  step: '5' },
    { href: 'v4.html',           icon: 'fa-flask',         label: 'Estrutural',   step: '6' },
    { href: 'fixo.html',         icon: 'fa-lock',          label: 'Fixo',         step: '7' },
    { href: 'resultado.html',    icon: 'fa-chart-pie',     label: 'Resultado',    step: '8' },
    { href: 'simulacoes.html',   icon: 'fa-vials',         label: 'Simulações',   step: '9' },
    { href: 'comparativo.html',  icon: 'fa-code-compare',  label: 'Comparativo',  step: '10' },
    { href: 'comparacoes.html',  icon: 'fa-chart-bar',     label: 'Comparações',  step: '11' },
    { href: 'cronograma.html',   icon: 'fa-calendar-check', label: 'Cron. Gastos', step: '12' },
    { href: 'repasse.html',      icon: 'fa-paper-plane',   label: 'Repasse',      step: '13' },
  ];

  const nav = document.createElement('nav');
  nav.className = 'workflow-nav';
  nav.setAttribute('aria-label', 'Navegação do fluxo de trabalho');

  nav.innerHTML = pages.map(p => {
    const isActive = p.href === activePage;
    const perm = PAGE_PERM[p.href];
    const editable = perm && canEditPage(perm);
    const stepBadge = p.step ? `<span class="nav-step">${p.step}</span>` : '';
    const editDot = editable ? '<span class="nav-edit-dot" title="Editável"></span>' : '';
    const classes = [isActive ? 'active' : '', editable ? 'nav-editable' : ''].filter(Boolean).join(' ');
    return `<a href="${p.href}" class="${classes}" aria-current="${isActive ? 'page' : 'false'}">
      ${stepBadge}
      <i class="fa-solid ${p.icon}"></i>
      <span class="nav-label">${p.label}</span>
      ${editDot}
    </a>`;
  }).join('');

  const header = document.querySelector('header');
  if (header) header.after(nav);

  setTimeout(setupStickyTableHeaders, 0);
}

function setupStickyTableHeaders() {
  document.querySelectorAll('.table-wrap').forEach(wrap => {
    const table = wrap.querySelector('table');
    if (!table) return;
    const thead = table.querySelector('thead');
    if (!thead) return;

    const clone = document.createElement('div');
    clone.className = 'sticky-thead-clone';
    clone.style.display = 'none';

    const cloneTable = document.createElement('table');
    cloneTable.className = table.className;
    cloneTable.style.borderCollapse = 'collapse';
    cloneTable.style.minWidth = '0';

    const cloneThead = thead.cloneNode(true);
    cloneTable.appendChild(cloneThead);
    clone.appendChild(cloneTable);
    document.body.appendChild(clone);

    let widthsSynced = false;

    function syncLayout() {
      const wrapRect = wrap.getBoundingClientRect();
      clone.style.width = wrapRect.width + 'px';
      clone.style.left  = wrapRect.left + 'px';

      const origThs  = Array.from(thead.querySelectorAll('th'));
      const cloneThs = Array.from(cloneThead.querySelectorAll('th'));
      origThs.forEach((th, i) => {
        if (!cloneThs[i]) return;
        const w = th.getBoundingClientRect().width;
        cloneThs[i].style.width    = w + 'px';
        cloneThs[i].style.minWidth = w + 'px';
        cloneThs[i].style.maxWidth = w + 'px';
      });

      cloneTable.style.width      = table.getBoundingClientRect().width + 'px';
      cloneTable.style.marginLeft = -wrap.scrollLeft + 'px';
      widthsSynced = true;
    }

    function update() {
      const navEl = document.querySelector('.workflow-nav');
      const navH  = navEl ? navEl.offsetHeight : 0;
      const wrapRect = wrap.getBoundingClientRect();
      const theadH   = thead.offsetHeight;

      if (wrapRect.top < navH && wrapRect.bottom > navH + theadH) {
        if (!widthsSynced || clone.style.display === 'none') syncLayout();
        clone.style.top     = navH + 'px';
        clone.style.left    = wrap.getBoundingClientRect().left + 'px';
        clone.style.display = 'block';
        cloneTable.style.marginLeft = -wrap.scrollLeft + 'px';
      } else {
        clone.style.display = 'none';
      }
    }

    window.addEventListener('scroll', update, { passive: true });
    wrap.addEventListener('scroll', () => {
      if (clone.style.display !== 'none') {
        cloneTable.style.marginLeft = -wrap.scrollLeft + 'px';
      }
    }, { passive: true });
    window.addEventListener('resize', () => {
      widthsSynced = false;
      if (clone.style.display !== 'none') syncLayout();
    });
  });
}
