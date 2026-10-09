import { $, api, element, button } from './adminApi.js';

function field(form, label, name, value = '', type = 'text') {
  const wrapper = element('label', label), input = element('input');
  input.name = name; input.type = type;
  if (type === 'checkbox') input.checked = Boolean(value);
  else if (type !== 'file') input.value = value;
  wrapper.append(input); form.append(wrapper);
  return input;
}
function saveForm(form, save) {
  const submit = element('button', 'Save'); submit.type = 'submit'; submit.className = 'primary'; form.append(submit);
  form.onsubmit = async event => {
    event.preventDefault(); if (submit.disabled) return; submit.disabled = true;
    try { await save(new FormData(form)); $('message').textContent = 'Saved.'; }
    catch (error) { $('message').textContent = error.message; }
    finally { submit.disabled = false; }
  };
}

export function renderCampuses(container, campuses, refresh) {
  container.append(element('h2', 'Campuses'), element('p', 'Campus codes are permanent. Disabling a campus stops new registrations; existing accounts keep their campus.'));
  for (const campus of [{}, ...campuses]) {
    const form = element('form', undefined, 'editor panel');
    form.append(element('h3', campus.campusCode || 'Add campus'));
    field(form, 'Campus name', 'name', campus.name).required = true;
    const code = field(form, 'Campus code', 'campusCode', campus.campusCode);
    code.required = true; code.readOnly = Boolean(campus.campusCode); code.pattern = '[A-Z0-9]+(-[A-Z0-9]+)+'; code.maxLength = 40;
    const official = field(form, 'Official code', 'officialCode', campus.officialCode); official.required = true; official.pattern = '[0-9]{4,10}';
    const label = element('label', 'Status'), status = element('select'); status.name = 'status';
    for (const value of ['active', 'disabled']) status.add(new Option(value, value)); status.value = campus.status || 'active'; label.append(status); form.append(label);
    saveForm(form, async data => { await api('/api/admin/campuses' + (campus.campusCode ? '/' + encodeURIComponent(campus.campusCode) : ''), { method: campus.campusCode ? 'PATCH' : 'POST', body: Object.fromEntries(data) }); await refresh(); });
    container.append(form);
  }
}

export async function renderHomepage(container, refresh) {
  const { content } = await api('/api/admin/homepage');
  container.append(element('h2', 'Homepage content'), element('p', 'Shared across all campuses. Up to three banners and one highlight. Images: JPG, PNG or WebP, maximum 5 MB.'));
  for (const slot of ['banner-1', 'banner-2', 'banner-3', 'highlight']) {
    const item = content.find(item => item.slot === slot) || {};
    const form = element('form', undefined, 'editor panel'); form.append(element('h3', slot === 'highlight' ? 'Highlighted content' : 'Banner ' + slot.slice(-1)));
    if (item.image) { const img = element('img'); img.src = item.image.url; img.alt = item.title || slot; img.className = 'preview-image' + (slot === 'highlight' ? ' highlight-preview' : ''); form.append(img); }
    if (slot === 'highlight') { const helper = element('small', 'Recommended ratio: 3.5:1 (example 1050 × 300)'); helper.style.cssText = 'color:#64748b; font-size:12px; margin-top:-6px;'; form.append(helper); }
    const image = field(form, item.image ? 'Replace image' : 'Image', 'images', '', 'file'); image.accept = 'image/jpeg,image/png,image/webp'; image.required = !item.image;
    field(form, 'Title (optional)', 'title', item.title).maxLength = 150;
    if (slot === 'highlight') field(form, 'Subtitle', 'subtitle', item.subtitle).maxLength = 300;
    field(form, 'Link (optional)', 'link', item.link).maxLength = 2000;
    field(form, 'Active', 'active', item.active, 'checkbox');
    saveForm(form, async data => {
      data.set('active', String(form.elements.active.checked));
      if (!image.files.length) data.delete('images');
      await api('/api/admin/homepage/' + slot, { method: 'PATCH', body: data }); await refresh();
    });
    if (item.image) form.append(button('Remove content', async () => { if (confirm('Remove this homepage content?')) { await api('/api/admin/homepage/' + slot, { method: 'DELETE' }); await refresh(); } }));
    container.append(form);
  }
}
