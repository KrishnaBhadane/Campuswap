import { api } from './api.js';
export function element(tag, text = '', className = '') {
  const node = document.createElement(tag); node.textContent = text; node.className = className; return node;
}
function optimizeImg(url, width = 450) {
  if (typeof url === 'string' && url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    return url.replace('/upload/', `/upload/c_limit,w_${width},q_auto,f_auto/`);
  }
  return url;
}
export function listingCard(item, saved = false, onRemove) {
  const card = element('article', '', 'product-card'), link = element('a'); link.href = '/product.html?id=' + item._id; link.style.cssText = 'color:inherit;text-decoration:none';
  if (item.images?.[0]?.url) { const image = element('img', '', 'card-img'); image.src = optimizeImg(item.images[0].url); image.alt = item.title; image.loading = 'lazy'; link.append(image); }
  else { const placeholder = element('div', 'No image', 'card-img card-placeholder'); link.append(placeholder); }
  link.append(element('h3', item.title, 'product-name'), element('p', '₹' + (item.pricePaise / 100).toLocaleString('en-IN'), 'product-price'), element('span', item.condition, 'product-condition'));
  const save = element('button', saved ? 'Saved' : 'Save', 'card-fav-btn'); save.type = 'button'; save.dataset.listingId = item._id; save.classList.toggle('active', saved); save.setAttribute('aria-label', (saved ? 'Unsave ' : 'Save ') + item.title);
  save.onclick = async () => {
    const buttons = document.querySelectorAll(`[data-listing-id="${item._id}"]`), wasSaved = save.classList.contains('active');
    buttons.forEach(button => { button.disabled = true; });
    try {
      await api('/api/favorites/' + item._id, { method: wasSaved ? 'DELETE' : 'PUT' });
      buttons.forEach(button => { button.textContent = wasSaved ? 'Save' : 'Saved'; button.classList.toggle('active', !wasSaved); button.setAttribute('aria-label', (wasSaved ? 'Save ' : 'Unsave ') + item.title); });
      if (wasSaved) onRemove?.(card);
    } catch (error) { alert(error.message); } finally { buttons.forEach(button => { button.disabled = false; }); }
  };
  card.append(link, save); return card;
}
