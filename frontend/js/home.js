import { requireUser } from './auth.js';
import { api } from './api.js';
import { element, listingCard } from './cards.js';
const user = await requireUser(), track = document.querySelector('.cards-track');
const params = new URLSearchParams(location.search); let page = 1, hasMore = false, saved = new Set();
document.querySelector('.recent-subtitle').textContent = user.college ? 'Listings inside ' + user.college : 'Your campus listings';
const category = document.getElementById('category-filter');
if ([...category.options].some(option => option.value === params.get('category'))) category.value = params.get('category');
async function load() {
  category.disabled = true;
  const query = new URLSearchParams({ page });
  if (category.value) query.set('category', category.value);
  if (params.get('q')) query.set('q', params.get('q'));
  track.replaceChildren(element('p', 'Loading listings…')); document.getElementById('previous-listings').disabled = document.getElementById('next-listings').disabled = true;
  try {
    const data = await api('/api/listings?' + query); track.replaceChildren();
    data.listings.forEach(item => track.append(listingCard(item, saved.has(item._id))));
    if (!data.listings.length) track.append(element('p', 'No listings match your campus and filters.'));
    hasMore = page < data.pagination.pages;
  } catch (error) { track.replaceChildren(element('p', error.message)); hasMore = false; }
  category.disabled = false;
  document.getElementById('listing-page').textContent = 'Page ' + page;
  document.getElementById('previous-listings').disabled = page === 1; document.getElementById('next-listings').disabled = !hasMore;
}
try { saved = new Set((await api('/api/favorites')).favoriteIds); } catch {}
category.onchange = () => { page = 1; load(); };
document.getElementById('previous-listings').onclick = () => { page--; load(); };
document.getElementById('next-listings').onclick = () => { page++; load(); };
await load();
try {
  const books = await api('/api/listings?category=books&limit=4');
  const container = document.querySelector('.material-track'); container.replaceChildren();
  books.listings.forEach(item => container.append(listingCard(item, saved.has(item._id))));
  if (!books.listings.length) container.append(element('p', 'No books listed in your campus yet.'));
} catch (error) { document.querySelector('.material-track').textContent = error.message; }
