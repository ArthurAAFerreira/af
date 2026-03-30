import { getAuth } from './auth.js';

const PAGE_PERM = {
  'configuracao.html': 'configuracao',
  'unidades.html':     'unidades',
  'v1.html':           'v1',
  'v2.html':           'v2',
  'v3.html':           'v3',
  'v4.html':           'estruturas',
  'simulacoes.html':   'simulacoes',
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
    { href: 'resultado.html',    icon: 'fa-chart-pie',     label: 'Resultado',    step: '7' },
    { href: 'simulacoes.html',   icon: 'fa-vials',         label: 'Simulações',   step: '8' },
    { href: 'comparativo.html',  icon: 'fa-code-compare',  label: 'Comparativo',  step: '9' },
    { href: 'comparacoes.html',  icon: 'fa-chart-bar',     label: 'Comparações',  step: '10' },
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
}
