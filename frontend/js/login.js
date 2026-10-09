import { fetchAPI } from './api.js';
const $ = id => document.getElementById(id);
let pendingId;
let resendTimer;
let verifiedRole = 'student';

function showAlert(message = '', type = 'error') {
  $('auth-alert').className = 'auth-alert ' + type;
  $('auth-alert').textContent = message;
  $('auth-alert').style.display = message ? 'block' : 'none';
}

function setMode(mode) {
  document.querySelectorAll('.auth-section').forEach(section => section.classList.toggle('active', section.id === `${mode}-section`));
  for (const name of ['login', 'register']) {
    $(`tab-${name}`).classList.toggle('active', mode === name);
    $(`tab-${name}`).setAttribute('aria-selected', String(mode === name));
  }
  document.querySelector('.auth-tabs').hidden = mode === 'otp';
  document.title = `${mode === 'otp' ? 'Verify Email' : mode === 'register' ? 'Create Account' : 'Login'} - Campuswap`;
  history.replaceState(null, '', '#' + mode);
  showAlert();
}

function redirect(role) {
  if (role === 'admin') return location.replace('/admin.html');
  const query = new URLSearchParams(location.search);
  const requested = query.get('redirect') || query.get('next') || '/index.html';
  const target = new URL(requested, location.origin + '/');
  const allowed = target.origin === location.origin && /^\/(index|sell|product|favorites|my-listings|profile)\.html$/.test(target.pathname);
  location.replace(allowed ? target.href : '/index.html');
}

async function request(path, body) {
  const response = await fetchAPI(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, false);
  const data = await response.json();
  if (!response.ok && data.code !== 'EMAIL_VERIFICATION_REQUIRED') throw new Error(data.message || 'Request failed. Please try again.');
  return data;
}

function resendCooldown() {
  clearTimeout(resendTimer);
  $('resend-otp').disabled = true;
  $('resend-otp').textContent = 'Resend code (wait 60 seconds)';
  resendTimer = setTimeout(() => {
    $('resend-otp').disabled = false;
    $('resend-otp').textContent = 'Resend code';
  }, 60000);
}

function showOtp(data) {
  setMode('otp');
  $('otp-email').textContent = data.maskedEmail;
  $('email-otp').value = '';
  $('email-otp').focus();
  if (data.otpSent) resendCooldown();
  showAlert(data.message || 'Enter your verification code or request a new one.', data.otpSent ? 'success' : 'error');
}

function onSubmit(formId, handler) {
  $(formId).addEventListener('submit', async event => {
    event.preventDefault();
    const button = $(formId).querySelector('[type="submit"]');
    if (button.disabled) return;
    button.disabled = true;
    showAlert();
    try { await handler(); }
    catch (error) { showAlert(error.message); }
    finally { button.disabled = false; }
  });
}

onSubmit('login-form', async () => {
  const data = await request('/api/auth/login', { email: $('login-email').value.trim(), password: $('login-password').value });
  $('login-password').value = '';
  if (data.code === 'EMAIL_VERIFICATION_REQUIRED') showOtp(data);
  else redirect(data.user.role);
});

onSubmit('register-form', async () => {
  if ($('register-password').value !== $('register-cpassword').value) throw new Error('Passwords do not match');
  if (!$('register-college').value) throw new Error('Select your college');
  const data = await request('/api/auth/register', {
    name: $('register-name').value.trim(), email: $('register-email').value.trim(), password: $('register-password').value,
    phone: $('register-phone').value.trim(), campusCode: $('register-college').value,
    department: $('register-dept').value.trim(), year: $('register-year').value ? Number($('register-year').value) : undefined
  });
  pendingId = $('register-id-card').files[0];
  $('register-password').value = '';
  $('register-cpassword').value = '';
  showOtp(data);
});

onSubmit('otp-form', async () => {
  const data = await request('/api/auth/verify-email', { code: $('email-otp').value.trim() });
  verifiedRole = data.role;
  clearTimeout(resendTimer);
  if (pendingId) {
    showAlert('Email verified. Uploading your college ID…', 'success');
    try {
      const form = new FormData();
      form.append('collegeId', pendingId);
      const response = await fetchAPI('/api/users/me/verification', { method: 'PUT', body: form });
      if (!response.ok) throw new Error((await response.json()).message || 'College ID upload failed');
    } catch (error) {
      $('otp-title').textContent = 'Email verified';
      $('otp-form').hidden = $('resend-otp').hidden = $('otp-back').hidden = true;
      $('continue-button').hidden = false;
      showAlert(`${error.message}. Email verification is complete; you can continue and submit your college ID later.`);
      return;
    }
    pendingId = null;
  }
  redirect(verifiedRole);
});

$('resend-otp').addEventListener('click', async () => {
  if ($('resend-otp').disabled) return;
  resendCooldown();
  try { showAlert((await request('/api/auth/resend-otp', {})).message, 'success'); }
  catch (error) { showAlert(error.message); }
});
$('otp-back').addEventListener('click', async () => {
  try { await request('/api/auth/logout', {}); } catch {}
  pendingId = null;
  setMode('login');
});
$('continue-button').addEventListener('click', () => redirect(verifiedRole));
for (const mode of ['login', 'register']) $(`tab-${mode}`).addEventListener('click', () => setMode(mode));
document.querySelectorAll('.toggle-link').forEach(link => link.addEventListener('click', event => {
  event.preventDefault();
  setMode(link.dataset.target);
}));
setMode(location.hash.startsWith('#register') ? 'register' : 'login');

fetchAPI('/api/campuses', {}, false)
  .then(response => { if (!response.ok) throw new Error('College list could not load. Reload the page.'); return response.json(); })
  .then(campuses => {
    campuses.forEach(campus => $('register-college').add(new Option(`${campus.name} (${campus.officialCode})`, campus.code)));
    $('register-college').disabled = false;
  }).catch(error => showAlert(error.message));

fetchAPI('/api/auth/me', {}, false)
  .then(response => response.json())
  .then(data => {
    if (data.code === 'EMAIL_VERIFICATION_REQUIRED') showOtp(data);
    else if (data.success && data.user) redirect(data.user.role);
  }).catch(() => {});
