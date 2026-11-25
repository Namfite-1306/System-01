// Preserve the application's native controls and handlers; add visual classes only.
const buttons = '.btn, .card-action, .bookmark, .theme-toggle, .close, #translation-popover button';
const pills = '.sidebar [data-page], .tab, .mode-tabs button';
let active = null,
  frame = 0,
  point;
export function enhanceInteractions(root) {
  root.querySelectorAll(buttons).forEach((button) => button.classList.add('cursor-glow'));
  root.querySelectorAll(pills).forEach((button) => button.classList.add('rising-pill'));
  if (active && !active.isConnected) clear();
}
function clear() {
  cancelAnimationFrame(frame);
  frame = 0;
  active?.classList.remove('glow-tracking');
  active = null;
}
function position() {
  frame = 0;
  if (!active?.isConnected) {
    clear();
    return;
  }
  const rect = active.getBoundingClientRect();
  active.style.setProperty('--glow-x', `${point.x - rect.left}px`);
  active.style.setProperty('--glow-y', `${point.y - rect.top}px`);
}
document.addEventListener(
  'pointermove',
  (event) => {
    if (event.pointerType !== 'mouse') return;
    const button = event.target.closest('.cursor-glow');
    if (!button || button.matches(':disabled, [aria-disabled="true"]')) {
      clear();
      return;
    }
    if (button !== active) {
      clear();
      active = button;
      button.classList.add('glow-tracking');
    }
    point = { x: event.clientX, y: event.clientY };
    if (!frame) frame = requestAnimationFrame(position);
  },
  { passive: true },
);
document.addEventListener(
  'pointerout',
  (event) => {
    if (active && !active.contains(event.relatedTarget)) clear();
  },
  { passive: true },
);
document.addEventListener('scroll', clear, { passive: true, capture: true });
window.addEventListener('blur', clear);
window.addEventListener('hashchange', clear);
enhanceInteractions(document);
