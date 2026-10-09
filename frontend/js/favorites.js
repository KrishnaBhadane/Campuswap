import { requireUser } from './auth.js';
import { api } from './api.js';
import { element, listingCard } from './cards.js';
const user = await requireUser(), grid = document.getElementById('favorites-grid');
document.getElementById('campus-subtitle').textContent = 'Items you saved inside ' + user.college;
try {
  const { favorites } = await api('/api/favorites'); grid.replaceChildren();
  const empty = () => { if (!grid.children.length) grid.append(element('p', 'No saved items yet.')); };
  favorites.forEach(({ listing }) => grid.append(listingCard(listing, true, card => { card.remove(); empty(); }))); empty();
} catch (error) { grid.textContent = error.message; }
