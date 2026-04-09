import '../styles.css';
import { renderNav } from '../modules/nav.ts';

renderNav('relatorios.html');

const PASSWORDS = ['federer', 'dirpladsandy', '150148deseg'];

document.querySelectorAll<HTMLElement>('.sub-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll<HTMLElement>('.tab-panel').forEach(p => { p.style.display = 'none'; });
    btn.classList.add('active');
    const panel = document.getElementById(`panel-${btn.dataset.tab}`);
    if (panel) panel.style.display = '';
  });
});

document.getElementById('unlockDriverReportBtn')?.addEventListener('click', () => {
  const pw  = (document.getElementById('driverReportPassword') as HTMLInputElement)?.value ?? '';
  const msg = document.getElementById('driverReportLockMsg');
  if (PASSWORDS.includes(pw)) {
    const lock  = document.getElementById('driverReportLock');
    const frame = document.getElementById('motoristasFrame');
    if (lock)  lock.style.display  = 'none';
    if (frame) frame.style.display = '';
    if (msg)   msg.textContent     = '';
  } else {
    if (msg) msg.textContent = 'Senha incorreta.';
  }
});
