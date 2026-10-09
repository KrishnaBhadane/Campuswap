import { requireUser } from './auth.js';
import { fetchAPI } from './api.js';
await requireUser();
(function () {
      const listContainer = document.getElementById('listings-list');
      const actionAlert = document.getElementById('action-alert');
      const modal = document.getElementById('edit-modal');
      const modalAlert = document.getElementById('modal-alert');
      const editForm = document.getElementById('edit-form');
      const btnCloseModal = document.getElementById('btn-close-modal');
      const btnSaveEdit = document.getElementById('btn-save-edit');
      let loadedListings = [];

      function showAlert(msg, type = 'error') {
        actionAlert.className = 'sell-alert ' + type;
        actionAlert.textContent = msg;
        actionAlert.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      function showCampusSubtitle(user) {
        if (user && user.college) {

          document.getElementById('campus-subtitle').textContent = 'Items you posted for students at ' + user.college;
        }
      }
      

      if (window.__currentUser) {
        showCampusSubtitle(window.__currentUser);
        loadMyListings();
      } else {
        document.addEventListener('campuswap:ready', (e) => {
          showCampusSubtitle(e.detail);
          loadMyListings();
        });
      }

      async function loadMyListings() {
        try {
          const res = await fetchAPI('/api/listings?mine=true');
          const data = await res.json();
          if (!res.ok || !data.success) throw new Error(data.message || 'Could not fetch listings');

          loadedListings = data.listings || [];
          renderListings(loadedListings);
        } catch (err) {
          listContainer.textContent = err.message;
        }
      }

      function renderListings(items) {
        if (!items || items.length === 0) {
          listContainer.innerHTML = `
            <div class="empty-state">
              <p>You have not posted any listings yet.</p>
              <a href="/sell.html" class="sell-btn" style="text-decoration:none; display:inline-block;">Post Your First Item</a>
            </div>
          `;
          return;
        }

        listContainer.replaceChildren();
        const element = (tag, text, className) => {
          const node = document.createElement(tag); node.textContent = text;
          if (className) node.className = className;
          return node;
        };
        for (const [status, label] of [['available', 'Active Listings'], ['sold', 'Sold Listings']]) {
          const section = element('section', '', 'listing-section');
          section.append(element('h2', label));
          const group = items.filter(item => item.status === status);
          if (!group.length) section.append(element('p', 'No ' + label.toLowerCase() + '.'));
          listContainer.append(section);
          for (const item of group) {
            const card = element('div', '', 'listing-card'); card.id = 'card-' + item._id;
            if (item.images?.[0]) { const image = element('img', '', 'listing-thumb'); image.src = item.images[0].url; image.loading = 'lazy'; image.alt = item.title; card.append(image); }
            const details = element('div', '', 'listing-details');
            const badgeText = item.status === 'sold' ? 'SOLD' : item.status.toUpperCase();
            details.append(element('h3', item.title, 'listing-title'), element('p', `₹${(item.pricePaise / 100).toLocaleString('en-IN')} · ${item.condition} · ${item.handoverLocation}`, 'listing-meta'), element('span', badgeText, 'status-badge status-' + item.status));
            const actions = element('div', '', 'listing-actions');
            const edit = element('button', 'Edit', 'btn-action btn-edit'); edit.type = 'button'; edit.disabled = item.status !== 'available'; edit.onclick = () => openEditModal(item._id);
            const markSold = element('button', 'Mark Sold', 'btn-action btn-sold'); markSold.type = 'button'; markSold.disabled = item.status !== 'available'; markSold.onclick = () => markItemSold(item._id);
            const remove = element('button', 'Delete', 'btn-action btn-delete'); remove.type = 'button'; remove.disabled = item.status !== 'available'; remove.onclick = () => deleteItem(item._id);
            actions.append(edit, markSold, remove); card.append(details, actions); section.append(card);
          }
        }
      }

      async function markItemSold(id) {
        if (!confirm('Mark this item as sold?')) return;
        actionAlert.style.display = 'none';

        try {
          const res = await fetchAPI('/api/listings/' + id, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'sold' })
          });
          const data = await res.json();
          if (!res.ok || !data.success) throw new Error(data.message || 'Could not mark listing as sold');

          showAlert('Listing marked as sold', 'success');
          loadMyListings();
        } catch (err) {
          showAlert(err.message);
        }
      }

      async function deleteItem(id) {
        if (!confirm('Are you sure you want to delete this listing?')) return;
        actionAlert.style.display = 'none';

        try {
          const res = await fetchAPI('/api/listings/' + id, { method: 'DELETE' });
          const data = await res.json();
          if (!res.ok || !data.success) throw new Error(data.message || 'Delete failed');

          showAlert('Listing deleted successfully', 'success');
          loadMyListings();
        } catch (err) {
          showAlert(err.message);
        }
      }

      function openEditModal(id) {
        const item = loadedListings.find(l => l._id === id);
        if (!item) return;

        modalAlert.style.display = 'none';
        document.getElementById('edit-id').value = item._id;
        document.getElementById('edit-title').value = item.title;
        document.getElementById('edit-price').value = item.pricePaise / 100;
        document.getElementById('edit-category').value = item.category;
        document.getElementById('edit-condition').value = item.condition;
        document.getElementById('edit-location').value = item.handoverLocation;
        document.getElementById('edit-description').value = item.description || '';
        document.getElementById('edit-image1').value = '';
        document.getElementById('edit-image2').value = '';

        modal.style.display = 'flex';
      }

      btnCloseModal.addEventListener('click', () => {
        modal.style.display = 'none';
      });

      editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        modalAlert.style.display = 'none';

        const id = document.getElementById('edit-id').value;
        const img1 = document.getElementById('edit-image1').files[0];
        const img2 = document.getElementById('edit-image2').files[0];
        const newFiles = [img1, img2].filter(Boolean);

        btnSaveEdit.disabled = true;
        btnSaveEdit.textContent = 'Saving...';

        try {
          let res;
          if (newFiles.length > 0) {
            // Multipart upload when images are replaced
            const formData = new FormData();
            formData.append('title', document.getElementById('edit-title').value.trim());
            formData.append('price', document.getElementById('edit-price').value);
            formData.append('category', document.getElementById('edit-category').value);
            formData.append('condition', document.getElementById('edit-condition').value);
            formData.append('handoverLocation', document.getElementById('edit-location').value.trim());
            formData.append('description', document.getElementById('edit-description').value.trim());
            newFiles.forEach(f => formData.append('images', f));

            res = await fetchAPI('/api/listings/' + id, {
              method: 'PATCH',
              body: formData
            });
          } else {
            // JSON update when metadata only
            res = await fetchAPI('/api/listings/' + id, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: document.getElementById('edit-title').value.trim(),
                price: Number(document.getElementById('edit-price').value),
                category: document.getElementById('edit-category').value,
                condition: document.getElementById('edit-condition').value,
                handoverLocation: document.getElementById('edit-location').value.trim(),
                description: document.getElementById('edit-description').value.trim()
              })
            });
          }

          const data = await res.json();
          if (!res.ok || !data.success) throw new Error(data.message || 'Update failed');

          modal.style.display = 'none';
          showAlert('Listing updated successfully', 'success');
          loadMyListings();
        } catch (err) {
          modalAlert.className = 'sell-alert error';
          modalAlert.textContent = err.message;
          modalAlert.style.display = 'block';
        } finally {
          btnSaveEdit.disabled = false;
          btnSaveEdit.textContent = 'Save Changes';
        }
      });
    })();
