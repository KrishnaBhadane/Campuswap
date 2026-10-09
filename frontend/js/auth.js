import { api } from './api.js';
import { renderHeader } from './header.js';
let account;
export function getUser(redirect = true) {
  account ||= api('/api/auth/me', {}, redirect).then(data => data.user);
  return account;
}
export async function requireUser() {
  try {
    const user = await getUser();
    window.__currentUser = user;
    renderHeader(user);
    document.documentElement.classList.remove('auth-checking');
    for (const event of ['campuswap:ready', 'campuswap:user-ready']) document.dispatchEvent(new CustomEvent(event, { detail: user }));
    return user;
  } catch (error) {
    document.documentElement.classList.remove('auth-checking');
    const message = document.createElement('p'); message.textContent = error.message; message.setAttribute('role', 'alert');
    (document.querySelector('main') || document.body).prepend(message);
    throw error;
  }
}

export async function logout() {
  await api('/api/auth/logout', { method: 'POST' });
  account = undefined;
  location.replace('/auth.html');
}
