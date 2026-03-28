export function renderNav(activePage) {
  const pages = [
    { href: 'index.html',        icon: 'fa-house',         label: 'Início',       step: null },
    { href: 'configuracao.html', icon: 'fa-sliders',       label: 'Configuração', step: '1' },
    { href: 'unidades.html',     icon: 'fa-building',      label: 'Unidades',     step: '2' },
    { href: 'v1.html',           icon: 'fa-user-graduate', label: 'Discentes',    step: '3' },
    { href: 'v2.html',           icon: 'fa-chalkboard-teacher', label: 'Docentes/TAEs', step: '4' },
    { href: 'v3.html',           icon: 'fa-graduation-cap','label': 'Titulação',  step: '5' },
    { href: 'v4.html',           icon: 'fa-flask',         label: 'Estrutural',   step: '6' },
  ];

  const nav = document.createElement('nav');
  nav.className = 'workflow-nav';
  nav.setAttribute('aria-label', 'Navegação do fluxo de trabalho');

  nav.innerHTML = pages.map(p => {
    const isActive = p.href === activePage;
    const stepBadge = p.step ? `<span class="nav-step">${p.step}</span>` : '';
    return `<a href="${p.href}" class="${isActive ? 'active' : ''}" aria-current="${isActive ? 'page' : 'false'}">
      ${stepBadge}
      <i class="fa-solid ${p.icon}"></i>
      <span class="nav-label">${p.label}</span>
    </a>`;
  }).join('');

  const header = document.querySelector('header');
  if (header) header.after(nav);
}
