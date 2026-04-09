interface NavPage {
  href:   string;
  icon:   string;
  label:  string;
  step:   string;
  locked?: boolean;
}

const PAGES: NavPage[] = [
  { href: 'index.html',      icon: 'fa-calendar-days', label: 'Calendário', step: '1' },
  { href: 'assistente.html', icon: 'fa-robot',          label: 'Assistente', step: '2' },
  { href: 'relatorios.html', icon: 'fa-chart-bar',      label: 'Relatórios', step: '3' },
  { href: 'cadastros.html',  icon: 'fa-database',       label: 'Cadastros',  step: '4', locked: true },
];

const PASSWORDS = ['desegld', 'federer'];

function buildLockModal(): HTMLElement {
  const bd = document.createElement('div');
  bd.id = 'navLockBd';
  bd.style.cssText = 'position:fixed;inset:0;background:rgba(5,15,35,.65);display:none;align-items:center;justify-content:center;z-index:9999;padding:16px;';
  bd.innerHTML = `
    <div style="background:#fff;border-radius:14px;width:min(400px,96vw);box-shadow:0 28px 60px rgba(4,15,40,.48);">
      <div style="background:linear-gradient(135deg,#0f2f5d,#1a5ca8);color:#fff;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;border-radius:14px 14px 0 0;">
        <h3 style="margin:0;font-size:1rem;font-weight:700;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-lock"></i> Acesso Restrito — Cadastros</h3>
        <button id="navLockX" style="background:transparent;border:1px solid rgba(255,255,255,.35);color:#fff;border-radius:7px;width:30px;height:30px;cursor:pointer;font-size:1rem;">✕</button>
      </div>
      <div style="padding:18px;">
        <p style="font-size:.88rem;color:#546e8a;margin:0 0 12px;">Digite a senha para acessar a área de Cadastros.</p>
        <input id="navLockPw" type="password" placeholder="Senha" autocomplete="current-password"
          style="width:100%;padding:8px 10px;border:1px solid #c5d4ed;border-radius:7px;font-size:.88rem;box-sizing:border-box;" />
        <div id="navLockMsg" style="font-size:.82rem;color:#c62828;min-height:18px;margin-top:6px;"></div>
      </div>
      <div style="padding:12px 18px;border-top:1px solid #dce6f8;display:flex;gap:8px;justify-content:flex-end;">
        <button id="navLockCancel" style="padding:7px 14px;border:1px solid #dce6f8;border-radius:7px;font-size:.85rem;font-weight:600;cursor:pointer;background:#e8eef7;color:#1a2a3a;">Cancelar</button>
        <button id="navLockOk"     style="padding:7px 14px;border:none;border-radius:7px;font-size:.85rem;font-weight:600;cursor:pointer;background:#1565c0;color:#fff;"><i class="fa-solid fa-unlock"></i> Entrar</button>
      </div>
    </div>`;
  return bd;
}

export function renderNav(activePage: string): void {
  const nav = document.createElement('nav');
  nav.className = 'workflow-nav';
  nav.setAttribute('aria-label', 'Navegação');

  nav.innerHTML = PAGES.map(p => {
    const isActive = p.href === activePage;
    const lockBadge = p.locked ? ' <i class="fa-solid fa-lock" style="font-size:.6rem;opacity:.7;"></i>' : '';
    return `<a href="${p.locked ? '#' : p.href}" ${p.locked ? `data-locked="${p.href}"` : ''} class="${isActive ? 'active' : ''}" aria-current="${isActive ? 'page' : 'false'}">
      <span class="nav-step">${p.step}</span>
      <i class="fa-solid ${p.icon}"></i>
      <span class="nav-label">${p.label}${lockBadge}</span>
    </a>`;
  }).join('');

  const header = document.querySelector('header');
  if (header) header.after(nav);

  const modal = buildLockModal();
  document.body.appendChild(modal);
  let _dest = '';

  const pw  = () => (document.getElementById('navLockPw')  as HTMLInputElement);
  const msg = () =>  document.getElementById('navLockMsg');

  const open  = (href: string) => { _dest = href; modal.style.display = 'flex'; pw().value = ''; if (msg()) msg()!.textContent = ''; setTimeout(() => pw().focus(), 50); };
  const close = () => { modal.style.display = 'none'; };
  const tryOk = () => {
    if (PASSWORDS.includes(pw().value.trim())) {
      sessionStorage.setItem('cadastros_auth', '1');
      close();
      window.location.href = _dest;
    } else if (msg()) msg()!.textContent = 'Senha incorreta.';
  };

  nav.querySelectorAll<HTMLAnchorElement>('a[data-locked]').forEach(a =>
    a.addEventListener('click', e => { e.preventDefault(); open(a.dataset.locked!); }));

  document.getElementById('navLockX')?.addEventListener('click', close);
  document.getElementById('navLockCancel')?.addEventListener('click', close);
  document.getElementById('navLockOk')?.addEventListener('click', tryOk);
  pw().addEventListener('keydown', e => { if (e.key === 'Enter') tryOk(); if (e.key === 'Escape') close(); });
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
}
