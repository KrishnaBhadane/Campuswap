import { api } from './api.js';
export function openSupportDialog() {
  let dialog = document.getElementById('support-dialog');
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = 'support-dialog';
    dialog.setAttribute('aria-labelledby', 'support-dialog-title');
    dialog.style.cssText = 'margin: auto; padding: 22px; width: min(480px, 92vw); max-height: 90vh; border: 1px solid #dce1e6; border-radius: 6px;';
    dialog.innerHTML = `
      <form id="support-dialog-form" style="display: grid; gap: 14px;">
        <h2 id="support-dialog-title" style="font-size: 18px; font-weight: 700; color: #17202c;">Contact Admin / Support</h2>
        <label for="support-topic" style="font-size: 13px; font-weight: 600;">Topic</label>
        <select id="support-topic" required style="padding: 9px 12px; border: 1px solid #dce1e6; border-radius: 6px; font: inherit;">
          <option value="" disabled selected>Select a topic</option>
          <option value="General inquiry">General inquiry</option>
          <option value="Campus verification">Campus verification</option>
          <option value="Listing issue">Listing issue</option>
          <option value="Account help">Account help</option>
          <option value="Bug report / Feedback">Bug report / Feedback</option>
        </select>
        <label for="support-msg" style="font-size: 13px; font-weight: 600;">Message</label>
        <textarea id="support-msg" rows="4" minlength="5" maxlength="1000" required placeholder="Describe your question or issue for the campus admin..." style="padding: 10px; border: 1px solid #dce1e6; border-radius: 6px; font: inherit; resize: vertical;"></textarea>
        <p id="support-error" role="alert" style="color: #a92121; font-size: 13px;"></p>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button type="button" id="support-dialog-close">Cancel</button>
          <button type="submit" class="primary" id="support-dialog-submit">Send Message</button>
        </div>
      </form>
    `;
    document.body.append(dialog);
    dialog.querySelector('#support-dialog-close').onclick = () => dialog.close();
    dialog.querySelector('#support-dialog-form').onsubmit = async event => {
      event.preventDefault();
      const submit = dialog.querySelector('#support-dialog-submit');
      if (submit.disabled) return;
      const topic = dialog.querySelector('#support-topic').value;
      const msg = dialog.querySelector('#support-msg').value.trim();
      const reason = topic;
      const errEl = dialog.querySelector('#support-error');
      submit.disabled = true; errEl.textContent = '';
      try {
        const res = await api('/api/reports', { method: 'POST', body: { targetType: 'support', reason, details: msg } });
        dialog.close();
        alert(res.message || 'Support message sent to admin.');
      } catch (err) {
        errEl.textContent = err.message;
      } finally {
        submit.disabled = false;
      }
    };
  }
  dialog.querySelector('#support-error').textContent = '';
  dialog.querySelector('#support-dialog-form').reset();
  dialog.showModal();
}
