import { requireUser } from './auth.js';
import { fetchAPI } from './api.js';

const currentUser = await requireUser();

(function () {
    const urlParams = new URLSearchParams(window.location.search);
    const listingId = urlParams.get('id');
    const mainImg = document.getElementById('main-product-img');
    const thumbsContainer = document.getElementById('thumbnails-container');
    const thumb0 = document.getElementById('thumb-0');
    const thumb1 = document.getElementById('thumb-1');
    const thumbImg0 = document.getElementById('thumb-img-0');
    const thumbImg1 = document.getElementById('thumb-img-1');
    const campusError = document.getElementById('campus-error');
    const productContent = document.getElementById('product-content');
    const descSection = document.getElementById('description-section');
    const whatsappBtn = document.getElementById('whatsapp-btn');
    const soldNotice = document.getElementById('sold-notice');

    if (!listingId) {
        productContent.hidden = true;
        descSection.hidden = true;
        campusError.style.display = 'block';
        campusError.textContent = 'Choose a listing from the marketplace.';
        return;
    }

    fetchAPI('/api/listings/' + listingId)
        .then(async (res) => {
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || 'Could not load listing');
            }
            return data;
        })
        .then(data => {
            const item = data.listing;
            if (!item) return;

            productContent.hidden = false;
            descSection.hidden = false;
            campusError.style.display = 'none';
            window.__currentListing = item;
            document.dispatchEvent(new CustomEvent('campuswap:listing-ready', { detail: item }));

            document.title = item.title + ' - CampusSwap';
            document.getElementById('product-title').textContent = item.title;
            document.getElementById('product-category').textContent = item.category ? item.category.toUpperCase() : '';
            document.getElementById('product-price').textContent = '₹' + (item.pricePaise / 100).toLocaleString('en-IN');
            document.getElementById('product-condition').textContent = item.condition + (item.status === 'sold' ? ' (SOLD)' : '');
            document.getElementById('product-location').textContent = item.handoverLocation || item.college;
            document.getElementById('product-description').textContent = item.description || 'No description provided.';
            document.getElementById('seller-handover').textContent = item.handoverLocation || item.college;

            const isOwner = String(item.sellerId?._id || item.sellerId) === String(currentUser.id || currentUser._id);

            // Handle WhatsApp CTA and Sold states
            if (item.status === 'sold') {
                if (whatsappBtn) whatsappBtn.style.display = 'none';
                if (soldNotice) soldNotice.style.display = 'inline-block';
            } else if (isOwner) {
                // Owner cannot contact themselves as buyer
                if (whatsappBtn) whatsappBtn.style.display = 'none';
                if (soldNotice) soldNotice.style.display = 'none';
            } else if (item.sellerId && item.sellerId.phone) {
                const cleanPhone = item.sellerId.phone.replace(/[^0-9]/g, '');
                const message = encodeURIComponent('Hi, I found your "' + item.title + '" listing on CampusSwap. Is it still available?');
                if (whatsappBtn) {
                    whatsappBtn.href = 'https://wa.me/91' + cleanPhone + '?text=' + message;
                    whatsappBtn.style.display = 'inline-flex';
                }
                if (soldNotice) soldNotice.style.display = 'none';
            } else {
                if (whatsappBtn) whatsappBtn.style.display = 'none';
            }

            // Populate Seller Information
            if (item.sellerId) {
                const seller = item.sellerId;
                document.getElementById('seller-name').textContent = seller.name || 'Campus Student';
                document.getElementById('seller-college').textContent = item.college;
                document.getElementById('seller-avatar').textContent = (seller.name || 'S').charAt(0).toUpperCase();
                if (seller.department || seller.year) {
                    const parts = [];
                    if (seller.year) parts.push('Year ' + seller.year);
                    if (seller.department) parts.push(seller.department);
                    document.getElementById('seller-dept').textContent = parts.join(' • ');
                }
            }

            // Handle images: 1 image clean, 2 images with clickable thumbnails
            const images = item.images || [];
            mainImg.hidden = images.length === 0;
            if (images.length === 1) {
                mainImg.src = images[0].url;
                thumbsContainer.style.display = 'none';
            } else if (images.length === 2) {
                mainImg.src = images[0].url;
                thumbImg0.src = images[0].url;
                thumbImg1.src = images[1].url;
                thumbsContainer.style.display = 'flex';

                thumb0.addEventListener('click', () => {
                    mainImg.src = images[0].url;
                    thumb0.classList.add('active');
                    thumb1.classList.remove('active');
                    thumb0.setAttribute('aria-pressed', 'true');
                    thumb1.setAttribute('aria-pressed', 'false');
                });
                thumb1.addEventListener('click', () => {
                    mainImg.src = images[1].url;
                    thumb1.classList.add('active');
                    thumb0.classList.remove('active');
                    thumb0.setAttribute('aria-pressed', 'false');
                    thumb1.setAttribute('aria-pressed', 'true');
                });
            } else {
                thumbsContainer.style.display = 'none';
            }

            // Setup Favorite Toggle
            const favBtn = document.getElementById('fav-btn');
            const favLabel = document.getElementById('fav-btn-label');
            const favSvg = favBtn ? favBtn.querySelector('svg') : null;

            function setFavUI(saved) {
                if (!favBtn) return;
                if (saved) {
                    favBtn.classList.add('active');
                    if (favLabel) favLabel.textContent = 'Saved';
                    if (favSvg) favSvg.setAttribute('fill', 'currentColor');
                    favBtn.title = 'Remove from saved';
                } else {
                    favBtn.classList.remove('active');
                    if (favLabel) favLabel.textContent = 'Save';
                    if (favSvg) favSvg.setAttribute('fill', 'none');
                    favBtn.title = 'Save to favorites';
                }
            }

            fetchAPI('/api/favorites')
                .then(r => r.json())
                .then(favData => {
                    if (favData && favData.success && Array.isArray(favData.favoriteIds)) {
                        if (favData.favoriteIds.includes(listingId)) {
                            setFavUI(true);
                        }
                    }
                })
                .catch(() => {});

            if (favBtn) {
                favBtn.addEventListener('click', async () => {
                    const currentlySaved = favBtn.classList.contains('active');
                    setFavUI(!currentlySaved);

                    try {
                        const res = await fetchAPI('/api/favorites/' + listingId, {
                            method: currentlySaved ? 'DELETE' : 'PUT'
                        });
                        const favRes = await res.json();
                        if (!res.ok || !favRes.success) {
                            setFavUI(currentlySaved);
                            alert(favRes.message || 'Could not update saved status');
                        }
                    } catch {
                        setFavUI(currentlySaved);
                    }
                });
            }
        })
        .catch(err => {
            campusError.textContent = err.message;
            campusError.style.display = 'block';
            productContent.style.display = 'none';
            descSection.style.display = 'none';
        });
})();
