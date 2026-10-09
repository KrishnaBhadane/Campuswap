import { requireUser } from './auth.js';
import { api } from './api.js';
const $ = id => document.getElementById(id), form = $('profile-form');
function render(user) {
  for (const key of ['name', 'email', 'college', 'phone', 'department', 'year']) form.elements[key].value = user[key] ?? '';
  $('campus-code').textContent = `${user.campusCode || 'Campus not assigned'}${user.officialCode ? ' · ' + user.officialCode : ''}`;
  $('email-status').textContent = 'Email: ' + (user.emailVerified ? 'Verified' : 'Pending');
  $('college-status').textContent = 'College ID: ' + (user.hasCollegeId ? user.verificationStatus : 'Not submitted');
  $('verification-reason').textContent = user.verificationReason || '';
  $('verification-form').hidden = user.verificationStatus === 'verified' || (user.hasCollegeId && user.verificationStatus === 'pending');
}
function submit(id, action) {
  $(id).onsubmit = async event => {
    event.preventDefault(); const button = $(id).querySelector('button'); if (button.disabled) return; button.disabled = true; $('message').textContent = '';
    try { await action(); } catch (error) { $('message').textContent = error.message; } finally { button.disabled = false; }
  };
}
submit('profile-form', async () => {
  const body = Object.fromEntries(['name', 'phone', 'department'].map(key => [key, form.elements[key].value.trim()]));
  body.year = form.elements.year.value ? Number(form.elements.year.value) : null;
  render((await api('/api/users/me', { method: 'PATCH', body })).user); $('message').textContent = 'Profile saved.';
});
submit('verification-form', async () => {
  const image = $('college-id').files[0]; if (!image || image.size > 5 * 1024 * 1024) throw new Error('Choose an image up to 5 MB.');
  const body = new FormData(); body.append('collegeId', image); await api('/api/users/me/verification', { method: 'PUT', body });
  $('verification-form').reset(); render((await api('/api/users/me')).user); $('message').textContent = 'College ID submitted for admin review.';
});
try {
  const user = await requireUser(); if (user.role !== 'student') throw new Error('Student profiles are available here. Use the admin panel to manage students.');
  render((await api('/api/users/me')).user); $('profile-content').hidden = false; $('message').textContent = '';
} catch (error) { $('message').textContent = error.message; }
