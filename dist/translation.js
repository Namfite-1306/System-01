import { LANGUAGES } from './languages.js';
export function initTranslation(api) {
  const box = document.createElement('aside');
  box.id = 'translation-popover';
  box.hidden = true;
  box.setAttribute('aria-label', 'Dịch sang tiếng Anh');
  box.innerHTML =
    '<div class="translation-head"><strong>Dịch sang tiếng Anh</strong><button type="button" aria-label="Đóng bản dịch">×</button></div><p class="selected-text"></p><label>Ngôn ngữ gốc <select aria-label="Ngôn ngữ gốc"><option value="">Chọn ngôn ngữ</option>' +
    Object.entries(LANGUAGES)
      .map(([v, l]) => `<option value="${v}">${l}</option>`)
      .join('') +
    '</select></label><p class="translation-result" role="status" aria-live="polite"></p><small>Đoạn chọn được gửi đến MyMemory để dịch. Hạn mức miễn phí có thể áp dụng.</small>';
  document.body.append(box);
  let sequence = 0,
    text = '',
    timer;
  const select = box.querySelector('select'),
    result = box.querySelector('.translation-result');
  const close = () => {
    box.hidden = true;
    sequence++;
  };
  function fit() {
    if (box.hidden) return;
    const rect = box.getBoundingClientRect();
    if (rect.bottom > innerHeight - 12)
      box.style.top = `${Math.max(12, innerHeight - rect.height - 12)}px`;
  }
  async function translate() {
    const current = ++sequence;
    if (!select.value) {
      result.textContent = 'Chọn ngôn ngữ gốc để dịch đoạn này.';
      return;
    }
    if (new TextEncoder().encode(text).length > 500) {
      result.textContent = 'Đoạn chọn quá dài. Hãy chọn một từ hoặc đoạn ngắn dưới 500 byte.';
      return;
    }
    result.textContent = 'Đang dịch…';
    try {
      const data = await api('/translate', 'POST', { text, source: select.value });
      if (current === sequence)
        result.textContent =
          data.source === 'en' ? `Đoạn này đã là tiếng Anh: ${data.translation}` : data.translation;
      fit();
    } catch (error) {
      if (current === sequence) result.textContent = error.message;
      fit();
    }
  }
  box.querySelector('button').onclick = close;
  select.onchange = translate;
  function inspect() {
    const selection = window.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) return;
    const element = selection.anchorNode?.parentElement;
    if (
      !element ||
      box.contains(element) ||
      element.closest('input, textarea, [contenteditable="true"]')
    )
      return;
    const scope = element.closest('.news-card, .evidence, [data-translation-scope]');
    if (!scope || !scope.contains(selection.focusNode)) return;
    const selected = selection.toString().trim();
    if (!selected) return;
    text = selected;
    select.value = scope.dataset.language || '';
    box.querySelector('.selected-text').textContent = text.slice(0, 400);
    // A dialog is in the browser top layer; keep the popover inside it while it is open.
    const host = scope.closest('dialog') || document.body;
    if (box.parentElement !== host) host.append(box);
    box.hidden = false;
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    const width = Math.min(370, innerWidth - 24);
    box.style.width = `${width}px`;
    box.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - width - 12))}px`;
    box.style.top = `${Math.max(12, Math.min(rect.bottom + 10, innerHeight - Math.min(box.offsetHeight, innerHeight - 24) - 12))}px`;
    translate();
  }
  document.addEventListener('pointerup', (e) => {
    if (!box.contains(e.target)) {
      clearTimeout(timer);
      timer = setTimeout(inspect, 200);
    }
  });
  document.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') close();
    else if (e.shiftKey) {
      clearTimeout(timer);
      timer = setTimeout(inspect, 200);
    }
  });
  document.addEventListener('pointerdown', (e) => {
    if (!box.contains(e.target)) close();
  });
  window.addEventListener('hashchange', close);
  window.addEventListener('resize', close);
}
