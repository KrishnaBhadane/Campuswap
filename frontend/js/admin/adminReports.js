import { $, api, element, button, table } from './adminApi.js';

export async function renderReports(container, { query, status, onFilter, reload, showDetail }) {
  const { reports, pagination } = await api('/api/admin/reports' + query + '&status=' + status);
  const label = element('label', 'Status '), filter = element('select');
  filter.setAttribute('aria-label', 'Report status');
  for (const value of ['open', 'resolved', 'dismissed', 'all']) filter.add(new Option(value, value));
  filter.value = status; filter.onchange = () => onFilter(filter.value); label.append(filter);
  container.append(element('h2', 'Reports'), label);
  const rows = reports.map(report => {
    const isSupport = report.targetType === 'support';
    const isAutoBlocked = report.targetType === 'user' && report.targetId?.status === 'blocked' && report.targetId?.autoBlocked;
    const typeLabel = isSupport ? 'SUPPORT' : isAutoBlocked ? 'REPORT (USER) [AUTO-BLOCKED]' : 'REPORT (' + report.targetType.toUpperCase() + ')';
    const targetLabel = isSupport ? 'Campus Support' : (report.targetId?.title || report.targetId?.name || 'Unavailable') + (isAutoBlocked ? ' [AUTO-BLOCKED]' : '');
    const scope = '?campusCode=' + encodeURIComponent(report.campusCode);
    async function review(status) {
      const resolutionNote = prompt(status === 'resolved' ? 'Resolution note (optional):' : 'Dismissal note (optional):', '');
      if (resolutionNote === null) return;
      await api(`/api/admin/reports/${report._id}${scope}`, { method: 'PATCH', body: { status, resolutionNote } });
      if ($('detail').open) $('detail').close();
      await reload(); $('message').textContent = (isSupport ? 'Support request ' : 'Report ') + status + '.';
    }
    const view = button('View', () => {
      const target = report.targetId;
      const nodes = [
        element('p', `Type: ${typeLabel}`),
        element('p', isSupport ? 'Subject: Support Inquiry' : `${report.targetType}: ${target?.title || target?.name || 'Target no longer available'}`),
        element('p', `Reporter: ${report.reporterId?.name || 'Unavailable'} (${report.reporterId?.email || 'Unavailable'})`),
        element('p', `Campus: ${report.campusCode}`),
        element('p', `Reason: ${report.reason}`),
        element('p', `Status: ${report.status}`)
      ];
      if (isAutoBlocked) {
        const badge = element('p', '⚠️ AUTO-BLOCKED: Seller reached the 5 distinct open user reports threshold and was automatically blocked.');
        badge.style.cssText = 'color:#991b1b; font-weight:700; background:#fee2e2; padding:8px 12px; border-radius:6px; margin:8px 0;';
        nodes.push(badge);
      }
      if (report.details) nodes.push(element('p', 'Details: ' + report.details));
      nodes.push(element('p', 'Date: ' + new Date(report.createdAt).toLocaleString()));
      if (report.resolutionNote) nodes.push(element('p', 'Review note: ' + report.resolutionNote));
      if (report.reviewedBy) nodes.push(element('p', 'Reviewed by: ' + report.reviewedBy.name));
      if (!isSupport && target && !target.deletedAt && target.campusCode === report.campusCode) {
        if (target.description) nodes.push(element('p', target.description));
        for (const image of target.images || []) { const img = element('img'); img.src = image.url; img.alt = target.title || 'Reported listing'; img.className = 'preview-image'; nodes.push(img); }
        const listing = report.targetType === 'listing';
        const restricted = listing ? target.moderationStatus === 'hidden' : target.status === 'blocked';
        nodes.push(button(listing ? restricted ? 'Restore listing' : 'Hide listing' : restricted ? 'Unblock user' : 'Block user', async () => {
          await api(`/api/admin/${listing ? 'listings' : 'users'}/${target._id}${listing ? '' : '/status'}${scope}`, {
            method: 'PATCH', body: listing ? { moderationStatus: restricted ? 'visible' : 'hidden' } : { status: restricted ? 'active' : 'blocked' }
          });
          $('detail').close(); await reload(); $('message').textContent = 'Moderation updated. Resolve or dismiss the report after reviewing it.';
        }));
      }
      showDetail(isSupport ? 'Support request details' : 'Report details', nodes);
    });
    const actions = element('div', undefined, 'actions'); actions.append(view);
    if (report.status === 'open') actions.append(button('Resolve', () => review('resolved')), button('Dismiss', () => review('dismissed')));
    return [typeLabel, targetLabel, report.reporterId?.name || 'Unavailable', report.campusCode, report.reason.length > 160 ? report.reason.slice(0, 160) + '…' : report.reason, (report.details || '').slice(0, 120), report.status, new Date(report.createdAt).toLocaleDateString(), actions];
  });
  container.append(table(['Type', 'Target', 'Reporter', 'Campus', 'Reason', 'Details', 'Status', 'Date', 'Actions'], rows));
  return pagination;
}
