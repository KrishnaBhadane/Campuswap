import { api } from './api.js';

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

try {
  const { content } = await api('/api/homepage');
  const banners = (content || []).filter(item => item.slot && item.slot.startsWith('banner-'));
  const track = document.getElementById('homepage-banners');
  const heroSection = document.getElementById('homepage-hero');

  if (heroSection) heroSection.hidden = !banners.length;

  if (banners.length && track) {
    banners.forEach((item, index) => {
      const slide = node(item.link ? 'a' : 'div', 'slide');
      if (item.link) slide.href = item.link;
      const image = node('img');
      image.src = item.image.url;
      image.alt = item.title || 'Campus announcement';
      if (index > 0) image.loading = 'lazy';
      slide.append(image);
      if (item.title) {
        const caption = node('div', 'slide-content');
        caption.append(node('h2', '', item.title));
        slide.append(caption);
      }
      track.append(slide);
    });

    // Clean out any controls container if it exists
    const controls = document.getElementById('homepage-controls');
    if (controls) controls.replaceChildren();

    // Behavior depends on active hero banner count:
    // 1 banner: show it, NO auto movement, NO arrows, NO Prev/Next
    // 2 banners: NO auto cycling, NO arrows, NO Prev/Next, clean static display
    // Exactly 3 banners: auto-advance every 5 seconds, loop 1 -> 2 -> 3 -> 1, NO Prev/Next
    if (banners.length === 3) {
      let activeIndex = 0;
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReduced) {
        setInterval(() => {
          activeIndex = (activeIndex + 1) % 3;
          const slides = track.children;
          if (slides[activeIndex]) {
            track.scrollTo({
              left: slides[activeIndex].offsetLeft,
              behavior: 'smooth'
            });
          }
        }, 5000);
      }
    }
  }

  const highlight = (content || []).find(item => item.slot === 'highlight');
  if (highlight && highlight.image?.url) {
    const image = node('img', 'highlight-img');
    image.src = highlight.image.url;
    image.alt = highlight.title || 'Featured on CampusSwap';
    image.loading = 'lazy';
    const card = document.getElementById('homepage-highlight-card');
    if (card) {
      card.replaceChildren();
      if (highlight.link && !highlight.title && !highlight.subtitle) {
        const link = node('a', 'highlight-link');
        link.href = highlight.link;
        link.append(image);
        card.append(link);
      } else {
        card.append(image);
      }
      if (highlight.title || highlight.subtitle) {
        const copy = node('div', 'highlight-content');
        if (highlight.title) copy.append(node('h2', 'highlight-title', highlight.title));
        if (highlight.subtitle) copy.append(node('p', 'highlight-subtitle', highlight.subtitle));
        if (highlight.link) {
          const link = node('a', 'btn-explore', 'Explore');
          link.href = highlight.link;
          copy.append(link);
        }
        card.append(copy);
      }
      document.getElementById('homepage-highlight').hidden = false;
    }
  }
} catch {
  // Optional promotional content must not prevent the marketplace from loading.
}
