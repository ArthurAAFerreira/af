interface NavPage {
  href:  string;
  icon:  string;
  label: string;
  step:  string;
}

const PAGES: NavPage[] = [
  { href: 'index.html',      icon: 'fa-calendar-days', label: 'Calendário', step: '1' },
  { href: 'assistente.html', icon: 'fa-robot',          label: 'Assistente', step: '2' },
  { href: 'relatorios.html', icon: 'fa-chart-bar',      label: 'Relatórios', step: '3' },
  { href: 'cadastros.html',  icon: 'fa-database',       label: 'Cadastros',  step: '4' },
];

export function renderNav(activePage: string): void {
  const nav = document.createElement('nav');
  nav.className = 'workflow-nav';
  nav.setAttribute('aria-label', 'Navegação');

  nav.innerHTML = PAGES.map(p => {
    const isActive = p.href === activePage;
    return `<a href="${p.href}" class="${isActive ? 'active' : ''}" aria-current="${isActive ? 'page' : 'false'}">
      <span class="nav-step">${p.step}</span>
      <i class="fa-solid ${p.icon}"></i>
      <span class="nav-label">${p.label}</span>
    </a>`;
  }).join('');

  const header = document.querySelector('header');
  if (header) header.after(nav);
}
