import { requireUser } from './auth.js';
import { fetchAPI } from './api.js';
await requireUser();
(function () {
      const sellForm = document.getElementById('sell-form');
      const postBtn = document.getElementById('post-btn');
      const alertBox = document.getElementById('sell-alert');
      const collegeInput = document.getElementById('college');
      const sellerNameInput = document.getElementById('seller-name');
      const contactInput = document.getElementById('contact-number');
      const campusSubtitle = document.getElementById('sell-campus-subtitle');

      function showAlert(msg, type = 'error') {
        alertBox.className = 'sell-alert ' + type;
        alertBox.textContent = msg;
        alertBox.style.display = 'block';
      }

      function populateUserData(user) {
        if (!user) return;
        collegeInput.value = user.college || '';
        document.getElementById('college-code').textContent = user.officialCode ? 'Code: ' + user.officialCode : 'Campus not recognized. Contact an admin.';
        postBtn.disabled = !user.campusCode;
        sellerNameInput.value = user.name || '';
        contactInput.value = user.phone || '';
        if (user.college) {
          campusSubtitle.textContent = 'Post items for students inside ' + user.college;
        }
      }

      if (window.__currentUser) {
        populateUserData(window.__currentUser);
      } else {
        document.addEventListener('campuswap:user-ready', (e) => populateUserData(e.detail));
      }

      sellForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!window.__currentUser?.campusCode) { showAlert('Your account has no recognized campus. Contact an admin.'); return; }
        alertBox.style.display = 'none';

        const img1 = document.getElementById('image1').files[0];
        const img2 = document.getElementById('image2').files[0];

        // 2-image limit validation
        const selectedFiles = [img1, img2].filter(Boolean);
        if (selectedFiles.length < 1 || selectedFiles.length > 2) {
          showAlert('Please select 1 or 2 product images.');
          return;
        }

        const formData = new FormData();
        formData.append('title', document.getElementById('item-name').value.trim());
        formData.append('category', document.getElementById('category').value);
        formData.append('price', document.getElementById('price').value);
        formData.append('condition', document.getElementById('condition').value);
        formData.append('handoverLocation', document.getElementById('handover-location').value.trim());
        formData.append('description', document.getElementById('description').value.trim());

        // Append images under 'images' field name
        selectedFiles.forEach(file => formData.append('images', file));

        postBtn.disabled = true;
        postBtn.textContent = 'Uploading & Posting...';

        try {
          const res = await fetchAPI('/api/listings', {
            method: 'POST',
            body: formData
          });
          const data = await res.json();

          if (res.ok && data.success) {
            showAlert('Listing posted successfully! Redirecting to marketplace...', 'success');
            setTimeout(() => {
              window.location.replace('index.html');
            }, 1200);
          } else {
            showAlert(data.message || 'Failed to post item.');
            postBtn.disabled = false;
            postBtn.textContent = 'Post Item';
          }
        } catch {
          showAlert('Network error while posting item.');
          postBtn.disabled = false;
          postBtn.textContent = 'Post Item';
        }
      });
    })();
