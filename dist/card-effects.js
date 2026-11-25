// MagicBento-inspired decoration adapted to the existing DOM; no content wrappers or framework.
const selector = '.news-card, .case-card, .portfolio-card, .stat, .focus-panel, .work-mode, .panel';
const controls =
  'a, button, input, textarea, select, summary, [contenteditable="true"], .graph-svg';
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(any-hover: hover) and (any-pointer: fine)');
let active = null,
  frame = 0,
  point = null,
  selecting = false;
export function enhanceCards(root) {
  if (active && !active.isConnected) reset();
  root.querySelectorAll(selector).forEach((card) => {
    // Decorate the outer card only, preserving nested forms and their stacking order.
    if (!card.parentElement.closest(selector)) card.classList.add('magic-card');
  });
}
function layer(card) {
  let element = card.querySelector(':scope > .magic-effects');
  if (!element) {
    element = document.createElement('span');
    element.className = 'magic-effects';
    element.setAttribute('aria-hidden', 'true');
    card.append(element);
  }
  return element;
}
function reset() {
  cancelAnimationFrame(frame);
  frame = 0;
  if (!active) return;
  active.classList.remove('magic-hover', 'magic-tilting');
  for (const key of ['--magic-rx', '--magic-ry', '--magic-tx', '--magic-ty'])
    active.style.removeProperty(key);
  active.querySelectorAll('.magic-star').forEach((star) => star.remove());
  active = null;
}
function stars(card) {
  const surface = layer(card);
  for (let i = 0; i < 12; i++) {
    const star = document.createElement('span');
    star.className = 'magic-star';
    star.style.left = `${8 + Math.random() * 84}%`;
    star.style.top = `${8 + Math.random() * 84}%`;
    star.style.setProperty('--star-delay', `${i * 90}ms`);
    star.style.setProperty('--star-drift', `${(Math.random() - 0.5) * 26}px`);
    surface.append(star);
  }
}
function move() {
  frame = 0;
  if (!active?.isConnected || !point || selecting) {
    reset();
    return;
  }
  const card = active,
    rect = card.getBoundingClientRect();
  const x = Math.max(0, Math.min(rect.width, point.x - rect.left));
  const y = Math.max(0, Math.min(rect.height, point.y - rect.top));
  card.style.setProperty('--magic-x', `${x}px`);
  card.style.setProperty('--magic-y', `${y}px`);
  const stationary =
    point.control ||
    card.querySelector('input, textarea, select, .graph-svg, [contenteditable="true"]');
  card.classList.toggle('magic-tilting', !stationary);
  if (!stationary) {
    const dx = x / Math.max(1, rect.width) - 0.5,
      dy = y / Math.max(1, rect.height) - 0.5;
    card.style.setProperty('--magic-rx', `${-dy * 2}deg`);
    card.style.setProperty('--magic-ry', `${dx * 2}deg`);
    card.style.setProperty('--magic-tx', `${dx * 3}px`);
    card.style.setProperty('--magic-ty', `${dy * 3}px`);
  }
}
function hover(event) {
  if (reduced.matches || !finePointer.matches || event.pointerType !== 'mouse' || selecting) return;
  const card = event.target.closest('.magic-card');
  if (!card || window.getSelection()?.toString()) {
    reset();
    return;
  }
  if (active !== card) {
    reset();
    active = card;
    layer(card);
    card.classList.add('magic-hover');
    stars(card);
  }
  point = {
    x: event.clientX,
    y: event.clientY,
    control: Boolean(event.target.closest(controls)),
  };
  if (!frame) frame = requestAnimationFrame(move);
}
document.addEventListener('pointermove', hover, { passive: true });
document.addEventListener(
  'pointerout',
  (event) => {
    if (active && !active.contains(event.relatedTarget)) reset();
  },
  { passive: true },
);
document.addEventListener(
  'pointerdown',
  () => {
    selecting = true;
    reset();
  },
  { passive: true },
);
document.addEventListener(
  'pointerup',
  (event) => {
    selecting = false;
    hover(event);
  },
  { passive: true },
);
document.addEventListener(
  'pointercancel',
  () => {
    selecting = false;
    reset();
  },
  { passive: true },
);
document.addEventListener(
  'click',
  (event) => {
    if (reduced.matches || event.detail === 0 || window.getSelection()?.toString()) return;
    const card = event.target.closest('.magic-card');
    if (!card || event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    const rect = card.getBoundingClientRect(),
      ripple = document.createElement('span');
    ripple.className = 'magic-ripple';
    const size = Math.min(Math.max(rect.width, rect.height), 600);
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - rect.left}px`;
    ripple.style.top = `${event.clientY - rect.top}px`;
    layer(card).append(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    // At most two ripples per card, even during rapid clicks.
    const ripples = card.querySelectorAll('.magic-ripple');
    [...ripples].slice(0, -2).forEach((item) => item.remove());
  },
  { passive: true, capture: true },
);
document.addEventListener('scroll', reset, { passive: true, capture: true });
window.addEventListener('blur', () => {
  selecting = false;
  reset();
});
window.addEventListener('hashchange', reset);
reduced.addEventListener('change', reset);
finePointer.addEventListener('change', reset);
