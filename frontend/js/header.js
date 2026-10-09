import { openSupportDialog } from './support.js';
import { logout as logoutUser } from './auth.js';
import { textRoll } from './textRoll.js';

export function renderHeader(user) {
  const header = document.querySelector('.header');
  if (!header) return;
  header.classList.add('market-header');
  const identity = JSON.stringify([user.id, user.name, user.college, user.role]);
  if (header.dataset.user === identity) return;
  header.dataset.user = identity;
  const brand = document.createElement('a'); brand.className = 'brand';
  brand.innerHTML = '<img src="/assets/logo.png" alt="" class="logo"><span class="logo-name">Campu<span class="highlight-s">s</span>wap</span>';
  const badgeId = 'header-campus';
  function link(label, path, className = '') {
    const anchor = document.createElement('a'); anchor.href = path; anchor.className = className;
    if (location.pathname === path || (path === '/index.html' && location.pathname === '/')) anchor.setAttribute('aria-current', 'page');
    textRoll(anchor, label); return anchor;
  }
  const search = document.createElement('form'); search.className = 'header-search'; search.role = 'search'; search.action = '/index.html';
  const input = document.createElement('input'); input.type = 'search'; input.name = 'q'; input.className = 'search-input'; input.maxLength = 100;
  input.placeholder = 'Search your campus'; input.setAttribute('aria-label', 'Search campus listings'); input.value = new URLSearchParams(location.search).get('q') || '';
  const submit = document.createElement('button'); submit.type = 'submit'; submit.className = 'search-submit'; submit.setAttribute('aria-label', 'Search');
  submit.innerHTML = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>';
  search.append(input, submit); search.onsubmit = () => { input.value = input.value.trim(); };
  const nav = document.createElement('nav'); nav.id = 'account-navigation'; nav.className = 'nav-links'; nav.setAttribute('aria-label', 'Main navigation');
  for (const [label, path] of [['Home', '/index.html'], ['Saved', '/favorites.html'], ['My Listings', '/my-listings.html']]) nav.append(link(label, path, 'nav-item'));
  nav.append(link('Sell', '/sell.html', 'nav-item sell-btn'));

  const account = document.createElement('div'); account.className = 'header-account';
  const accountButton = document.createElement('button'); accountButton.type = 'button'; accountButton.className = 'account-toggle';
  accountButton.textContent = Array.from(user.name || 'Student')[0].toUpperCase();
  accountButton.setAttribute('aria-label', 'Account for ' + (user.name || 'Student')); accountButton.setAttribute('aria-expanded', 'false'); accountButton.setAttribute('aria-controls', 'account-panel');
  const panel = document.createElement('div'); panel.id = 'account-panel'; panel.className = 'account-panel';
  const name = document.createElement('strong'); name.textContent = user.name || 'Student';
  const campus = document.createElement('span'); campus.id = badgeId; campus.className = 'campus-badge'; campus.textContent = user.college || 'CampusSwap';
  panel.append(name, campus, link(user.role === 'guest' ? 'Sign in' : 'Profile', user.role === 'guest' ? '/auth.html' : '/profile.html'));
  if (user.role === 'admin') panel.append(link('Admin', '/admin.html'));
  else if (user.role === 'student') {
    const support = document.createElement('button'); support.type = 'button'; support.className = 'contact-support-link'; textRoll(support, 'Contact Admin'); panel.append(support);
  }
  const logout = document.createElement('button'); logout.type = 'button'; logout.className = 'logout-btn'; textRoll(logout, 'Logout');
  logout.onclick = async () => { logout.disabled = true; try { await logoutUser(); } catch (error) { logout.disabled = false; alert(error.message); } };
  if (user.role !== 'guest') panel.append(logout); account.append(accountButton, panel); nav.append(account);
  const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'menu-toggle'; toggle.textContent = 'Menu';
  toggle.setAttribute('aria-controls', nav.id); toggle.setAttribute('aria-expanded', 'false');
  const closeAccount = () => { account.classList.remove('is-open'); accountButton.setAttribute('aria-expanded', 'false'); };
  const closeMenu = () => { nav.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); closeAccount(); };
  toggle.onclick = () => { const open = nav.classList.toggle('is-open'); toggle.setAttribute('aria-expanded', String(open)); closeAccount(); };
  accountButton.onclick = () => { const open = account.classList.toggle('is-open'); accountButton.setAttribute('aria-expanded', String(open)); };
  header.onkeydown = event => {
    if (event.key !== 'Escape') return;
    if (account.classList.contains('is-open')) { closeAccount(); accountButton.focus(); }
    else if (nav.classList.contains('is-open')) { closeMenu(); toggle.focus(); }
  };
  header.onfocusout = event => { if (!header.contains(event.relatedTarget)) { closeMenu(); } else if (!account.contains(event.relatedTarget)) closeAccount(); };
  nav.onclick = event => { if (event.target.closest('a')) closeMenu(); };
  if (brand) brand.href = '/index.html';
  header.replaceChildren(...(brand ? [brand] : []), search, link('Sell', '/sell.html', 'mobile-sell-btn'), toggle, nav);
  document.addEventListener('click', event => { if (!header.contains(event.target)) closeMenu(); }, { signal: resetHeaderEvents(header) });
  if (user.role === 'student' && new URLSearchParams(location.search).get('contact') === 'admin') openSupportDialog();
  if (user.role === 'student' && !window.__supportListenerAttached) {
    window.__supportListenerAttached = true;
    document.addEventListener('click', event => { if (event.target.closest('.contact-support-link')) { event.preventDefault(); openSupportDialog(); } });
  }
}

function resetHeaderEvents(header) {
  header.events?.abort(); header.events = new AbortController(); return header.events.signal;
}
