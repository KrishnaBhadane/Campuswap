import { api, pageData } from './api.js';

const $ = id => document.getElementById(id);
let currentTargetType, currentTargetId;

try {
  const [user, listing] = await Promise.all([
    pageData('__currentUser', 'campuswap:user-ready'),
    pageData('__currentListing', 'campuswap:listing-ready')
  ]);

  const sellerId = listing.sellerId?._id || listing.sellerId;
  const isOwner = String(sellerId) === String(user.id || user._id);

  const listingReportBtn = $('report-listing');
  const userReportBtn = $('report-user');
  const listingWrap = $('listing-report-actions');
  const sellerWrap = $('seller-report-actions');

  if (user.role === 'student' && !isOwner) {
    if (listingWrap) listingWrap.style.display = 'block';
    if (sellerWrap) sellerWrap.style.display = 'block';
    if (listingReportBtn) listingReportBtn.style.display = 'inline-flex';
    if (userReportBtn) userReportBtn.style.display = 'inline-flex';

    const listingReasons = [
      'Scam / suspicious',
      'Wrong information',
      'Prohibited item',
      'Already sold',
      'Inappropriate content',
      'Other'
    ];

    const sellerReasons = [
      'Scam / suspicious behavior',
      'Misleading information',
      'Harassment / inappropriate behavior',
      'Prohibited selling activity',
      'Other'
    ];

    function openDialog(type) {
      currentTargetType = type;
      currentTargetId = type === 'listing' ? listing._id : sellerId;
      $('report-title').textContent = type === 'listing' ? 'Report Listing' : 'Report Seller';

      const reasons = type === 'listing' ? listingReasons : sellerReasons;
      const placeholder = new Option('Select a reason', '');
      placeholder.disabled = true;

      $('report-category').replaceChildren(placeholder, ...reasons.map(r => new Option(r, r)));
      $('report-category').value = '';
      $('report-reason').value = '';
      $('report-error').textContent = '';
      $('report-dialog').showModal();
      $('report-category').focus();
    }

    if (listingReportBtn) listingReportBtn.onclick = () => openDialog('listing');
    if (userReportBtn) userReportBtn.onclick = () => openDialog('user');
  } else {
    if (listingWrap) listingWrap.style.display = 'none';
    if (sellerWrap) sellerWrap.style.display = 'none';
  }
} catch (error) {
  const msg = $('report-message');
  if (msg) msg.textContent = error.message;
}

const reportClose = $('report-close');
if (reportClose) reportClose.onclick = () => $('report-dialog').close();

const reportForm = $('report-form');
if (reportForm) {
  reportForm.onsubmit = async event => {
    event.preventDefault();
    const submit = $('report-submit');
    if (submit.disabled) return;

    const category = $('report-category').value;
    const details = $('report-reason').value.trim();
    if (!category) {
      $('report-error').textContent = 'Please select a reason.';
      return;
    }

    submit.disabled = true;
    $('report-error').textContent = '';

    try {
      const result = await api('/api/reports', {
        method: 'POST',
        body: {
          targetType: currentTargetType,
          targetId: currentTargetId,
          reason: category,
          details
        }
      });
      $('report-dialog').close();
      const statusMsg = $('report-message');
      if (statusMsg) {
        statusMsg.textContent = result.message || 'Report submitted successfully';
        statusMsg.className = 'report-status-msg success';
      }
    } catch (error) {
      $('report-error').textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  };
}
