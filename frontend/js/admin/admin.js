import { getUser, logout } from '../auth.js';
import { renderReports } from './adminReports.js';
import { $, api, element, button, table } from './adminApi.js';
import { renderCampuses, renderHomepage } from './adminContent.js';

let campuses = [], section = 'dashboard', page = 1, generation = 0, imageUrl, reportStatus = 'open';
const money = paise => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100);
const campusName = item => campuses.find(campus => campus.campusCode === item.campusCode)?.name || item.college || 'Unassigned';
const actions = (...buttons) => { const node = element('div', undefined, 'actions'); node.append(...buttons); return node; };
const scope = () => { const query = new URLSearchParams({ page }); if ($('campus').value) query.set('campusCode', $('campus').value); return '?' + query; };

function showDetail(title, nodes) {
  $('detail-title').textContent = title; $('detail-body').replaceChildren(...nodes); $('detail').showModal();
}
function closeDetail() {
  if (imageUrl) URL.revokeObjectURL(imageUrl);
  imageUrl = null; $('detail-body').replaceChildren();
}
$('close-detail').onclick = () => $('detail').close();
$('detail').addEventListener('close', closeDetail);

async function refreshCampuses() {
  campuses = (await api('/api/admin/campuses')).campuses;
  const selected = $('campus').value;
  $('campus').replaceChildren(new Option('All Campuses', ''));
  campuses.forEach(campus => $('campus').add(new Option(`${campus.campusCode} · ${campus.officialCode}${campus.status === 'disabled' ? ' (disabled)' : ''}`, campus.campusCode)));
  $('campus').value = selected;
}
async function change(path, body) { await api(path, { method: 'PATCH', body }); await load(); }

function studentRows(users, query) {
  return users.map(user => {
    const review = status => {
      const reason = status === 'rejected' ? prompt('Short reason for rejection:')?.trim() : undefined;
      if (status === 'rejected' && !reason) return;
      return change(`/api/admin/users/${user._id}/verification${query}`, { status, reason });
    };
    const view = button('View', () => {
      const nodes = [element('p', `${user.name} · ${user.email}`), element('p', `${campusName(user)} · ${user.campusCode || 'Unassigned'}`)];
      if (user.hasCollegeId) nodes.push(button('View college ID', async () => {
        const blob = await api(`/api/admin/users/${user._id}/verification${query}`, {}, true);
        if (!$('detail').open) return;
        if (imageUrl) URL.revokeObjectURL(imageUrl);
        imageUrl = URL.createObjectURL(blob); const img = element('img'); img.src = imageUrl; img.alt = 'Private college ID'; img.className = 'private-id';
        $('detail-body').querySelector('img')?.remove(); $('detail-body').append(img);
      }));
      else nodes.push(element('p', 'No college ID submitted.'));
      showDetail('Student', nodes);
    });
    const controls = [view];
    if (user.hasCollegeId && user.verificationStatus === 'pending') controls.push(button('Approve', () => review('verified')), button('Reject', () => review('rejected')));
    controls.push(button(user.status === 'blocked' ? 'Unblock' : 'Block', () => change(`/api/admin/users/${user._id}/status${query}`, { status: user.status === 'blocked' ? 'active' : 'blocked' })));
    controls.push(button('Delete', async () => {
      if (confirm(`Permanently remove student "${user.name}" (${user.email})?`)) {
        await api(`/api/admin/users/${user._id}${query}`, { method: 'DELETE' });
        await load();
      }
    }));
    return [user.name, user.email, campusName(user), user.campusCode, user.department, user.year, user.emailVerified ? 'Verified' : 'Pending', user.verificationStatus, user.status, actions(...controls)];
  });
}

function listingRows(listings, query) {
  return listings.map(listing => {
    const img = element('img'); img.src = listing.images[0]?.url || ''; img.alt = listing.title; img.className = 'listing-image'; img.loading = 'lazy';
    const view = button('View', () => {
      const nodes = [element('p', listing.description || 'No description'), element('p', `${money(listing.pricePaise)} · ${listing.status}`)];
      for (const image of listing.images) { const photo = element('img'); photo.src = image.url; photo.alt = listing.title; photo.className = 'preview-image'; nodes.push(photo); }
      showDetail(listing.title, nodes);
    });
    const hidden = listing.moderationStatus === 'hidden';
    return [img, listing.title, listing.sellerId?.name || 'Unavailable', campusName(listing), listing.campusCode, money(listing.pricePaise), `${listing.status} / ${listing.moderationStatus}`,
      actions(view, button(hidden ? 'Restore' : 'Hide', () => change(`/api/admin/listings/${listing._id}${query}`, { moderationStatus: hidden ? 'visible' : 'hidden' })))];
  });
}

async function renderDashboard(container, query) {
  const data = await api('/api/admin/dashboard' + query), cards = element('div', undefined, 'overview');
  for (const [label, value] of [['Students', data.counts.students], ['Pending Verification', data.counts.pending], ['Active Listings', data.counts.activeListings], ['Open Reports', data.counts.openReports]]) {
    const card = element('article'); card.append(element('h3', label), element('strong', value)); cards.append(card);
  }
  container.append(cards);
  for (const [label, target, records] of [['Recent Students', 'students', data.recentStudents], ['Recent Listings', 'listings', data.recentListings], ['Recent Reports', 'reports', data.recentReports]]) {
    const panel = element('section', undefined, 'panel'), heading = element('div', undefined, 'section-heading'); heading.append(element('h2', label), button('View All', () => navigate(target))); panel.append(heading);
    panel.append(table(['Name / Reason', 'Campus', 'Date'], records.map(item => [item.name || item.title || item.reason, campusName(item), new Date(item.createdAt).toLocaleDateString()])));
    container.append(panel);
  }
}

async function load() {
  const current = ++generation, query = scope(), target = section, content = element('div');
  $('content').replaceChildren(element('p', 'Loading…')); $('pagination').hidden = true; $('message').textContent = '';
  $('campus').disabled = ['homepage', 'campuses'].includes(target);
  let pagination;
  try {
    if (target === 'dashboard') await renderDashboard(content, query);
    if (target === 'students') {
      const data = await api('/api/admin/users' + query); pagination = data.pagination;
      content.append(element('h2', 'Students'), table(['Name', 'Email', 'Campus', 'Campus Code', 'Department', 'Year', 'Email', 'College ID', 'Status', 'Actions'], studentRows(data.users, query)));
    }
    if (target === 'listings') {
      const data = await api('/api/admin/listings' + query); pagination = data.pagination;
      content.append(element('h2', 'Listings'), table(['Image', 'Product', 'Seller', 'Campus', 'Campus Code', 'Price', 'Status', 'Actions'], listingRows(data.listings, query)));
    }
    if (target === 'reports') {
      pagination = await renderReports(content, { query, status: reportStatus, onFilter: value => { reportStatus = value; page = 1; load(); }, reload: load, showDetail });
    }
    if (target === 'campuses') renderCampuses(content, campuses, async () => { await refreshCampuses(); await load(); });
    if (target === 'homepage') await renderHomepage(content, load);
    if (current !== generation) return;
    $('content').replaceChildren(content);
    if (pagination) { $('pagination').hidden = false; $('page-label').textContent = `Page ${page}`; $('previous').disabled = page === 1; $('next').disabled = !pagination.hasMore; }
  } catch (error) { if (current === generation) $('content').replaceChildren(element('p', error.message)); }
}
function navigate(target) {
  section = target; page = 1;
  document.querySelectorAll('[data-section]').forEach(node => { if (node.dataset.section === target) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current'); });
  return load();
}
$('admin-nav').addEventListener('click', event => { if (event.target.dataset.section) navigate(event.target.dataset.section); });
$('campus').onchange = () => { page = 1; load(); };
$('previous').onclick = () => { page--; load(); };
$('next').onclick = () => { page++; load(); };
$('logout').onclick = async () => { try { await logout(); } catch (error) { $('message').textContent = error.message; } };
try {
  const user = await getUser();
  if (user.role !== 'admin') throw new Error('Access denied. An admin account is required.');
  await refreshCampuses(); $('dashboard').hidden = false; await load();
} catch (error) { $('message').textContent = error.message; }
