import { api as request, fetchAPI } from '../api.js';
export const $ = id => document.getElementById(id);
export function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
export async function api(path, options = {}, image = false) {
  if (!image) return request(path, options);
  const response = await fetchAPI(path, options);
  if (!response.ok) throw new Error((await response.json()).message || 'Image could not load');
  return response.blob();
}
export function button(text, action) {
  const node = element('button', text);
  if (/^(Reject|Delete|Block|Hide|Disable)\b/.test(text)) node.className = 'danger';
  else if (/^(Approve|Accept|Save|Submit)\b/.test(text)) node.className = 'primary';
  node.type = 'button';
  node.onclick = async () => {
    node.disabled = true;
    try { await action(); } catch (error) { $('message').textContent = error.message; }
    finally { node.disabled = false; }
  };
  return node;
}
export function table(headers, rows) {
  const wrap = element('div', undefined, 'table-wrap'), table = element('table');
  const head = element('thead'), header = element('tr'), body = element('tbody');
  headers.forEach(text => { const cell = element('th', text); cell.scope = 'col'; header.append(cell); });
  head.append(header);
  for (const values of rows) {
    const row = element('tr');
    values.forEach((value, index) => { const cell = element('td'); cell.dataset.label = headers[index]; cell.append(value instanceof Node ? value : document.createTextNode(value ?? '—')); row.append(cell); });
    body.append(row);
  }
  table.append(head, body); wrap.append(table);
  if (!rows.length) wrap.append(element('p', 'No records for this campus.'));
  return wrap;
}
