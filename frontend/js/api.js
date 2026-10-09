export async function fetchAPI(path, options = {}, redirect = true) {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options });
  if (redirect && [401, 403].includes(response.status)) {
    const data = await response.clone().json().catch(() => ({}));
    if (response.status === 401 || data.code === 'EMAIL_VERIFICATION_REQUIRED') location.replace('/auth.html?next=' + encodeURIComponent(location.pathname + location.search));
  }
  return response;
}
export async function api(path, options = {}, redirect = true) {
  if (options.body && !(options.body instanceof FormData)) options = { ...options, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options.body) };
  const response = await fetchAPI(path, options, redirect), data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Request failed. Please try again.');
  return data;
}
export const pageData = (key, event) => window[key] ? Promise.resolve(window[key]) : new Promise(resolve => document.addEventListener(event, e => resolve(e.detail), { once: true }));
