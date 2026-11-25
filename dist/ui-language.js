import { messages } from './ui-messages.js';
let language = 'vi';
try {
  if (localStorage.getItem('studio-ui-language') === 'en') language = 'en';
} catch {
  /* Session-only language. */
}
export const uiLocale = () => (language === 'en' ? 'en-GB' : 'vi-VN');
const originals = new WeakMap(),
  attributes = new WeakMap();
const protectedContent =
  'script,style,textarea,[contenteditable="true"],[data-no-translate],.news-card h3,.news-card>p,.evidence a,.evidence p,.eco-links .evidence h3,.case-card h2,.case-card h3,.portfolio-card h3,.article-preview,.graph-svg text,.graph-svg title,.case-detail p,.case-detail ol,.case-detail ul,.rubric td:first-child,.review-box p,.review-box ul,.selected-text,.translation-result,.profile-mini>div';
const dynamic = [
  [/^(\d+) tin · (\d+) liên kết$/, '$1 articles · $2 links'],
  [
    /^Tổng quan thư viện · (\d+) tin · (\d+) case · (\d+) bài viết$/,
    'Library overview · $1 articles · $2 cases · $3 drafts',
  ],
  [/^Cập nhật (.+) · Phiên bản (\d+)$/, 'Updated $1 · Version $2'],
  [/^Đã lưu · Phiên bản (\d+)$/, 'Saved · Version $1'],
  [/^Cập nhật:? (.+)$/, 'Updated $1'],
  [/^Đã kiểm tra (.+)$/, 'Checked $1'],
  [/^(\d+) từ$/, '$1 words'],
  [/^(\d+) điểm$/, '$1 points'],
  [/^(\d+) phút · (.+)$/, '$1 min · $2'],
  [/^HỆ SINH THÁI · (\d+) TIN$/, 'ECOSYSTEM · $1 ARTICLES'],
  [/^(\d+)\/(\d+) tin trong khoảng chọn$/, '$1/$2 articles in this period'],
  [/^(\d+) liên kết trong toàn hồ sơ$/, '$1 links in this ecosystem'],
  [/^(\d+) bài mới$/, '$1 new articles'],
  [/^(\d+) phút$/, '$1 min'],
  [/^Bật (.+)$/, 'Enable $1'],
  [/^(\d+) thực thể \/ chủ đề$/, '$1 entities / topics'],
  [/^Đang xem kết quả cho$/, 'Showing results for'],
  [/^· (\d+) ngày$/, '· $1 days'],
  [
    /^(\d+) bài khớp từ khóa · (\d+) bài mới lưu · (\d+) bài đã có trong thư viện\.$/,
    '$1 matching articles · $2 newly saved · $3 already in your library.',
  ],
  [
    /^(\d+) kết quả không được giữ \(không khớp từ khóa, trùng, ngoài thời gian hoặc vượt giới hạn\)\.$/,
    '$1 results excluded (keyword mismatch, duplicates, outside the period or over the limit).',
  ],
  [
    /^Kéo nút \/ kéo nền \/ cuộn để thu phóng\. Hiện (\d+) tin mới nhất trong bộ lọc, tối đa 60\.$/,
    'Drag nodes / pan the background / scroll to zoom. Showing $1 newest matching articles, up to 60.',
  ],
];
export function translateUI(text) {
  if (language === 'vi' || typeof text !== 'string') return text;
  const trimmed = text.trim();
  if (!trimmed) return text;
  const lookup = (key) => (Object.hasOwn(messages, key) ? messages[key] : undefined);
  let translated = lookup(trimmed);
  if (!translated) {
    const core = trimmed
      .replace(/^[＋+↻↗←→↓↑⚙✧◇◆×⌕◫▧▤✎◷⌘\s]+/u, '')
      .replace(/[↗←→↓↑…\s]+$/u, '');
    if (lookup(core)) translated = trimmed.replace(core, lookup(core));
  }
  if (!translated)
    for (const [pattern, replacement] of dynamic) {
      if (pattern.test(trimmed)) {
        translated = trimmed.replace(pattern, replacement);
        break;
      }
    }
  if (!translated && /tin trong thư viện|kết quả tìm kiếm/.test(trimmed))
    translated = trimmed
      .replace('tin trong thư viện', 'articles in library')
      .replace('kết quả tìm kiếm', 'search results')
      .replace('mới nhất trước', 'newest first')
      .replace('đã lưu', 'saved');
  if (!translated && /^.+ · \d{2}\/\d{2}\/\d{4} · \d+ nguồn$/.test(trimmed))
    translated = trimmed.replace(/(\d+) nguồn$/, (_, count) => count + (count === '1' ? ' source' : ' sources'));
  if (!translated) return text;
  translated = translated.replace(
    / · (Cơ bản|Trung cấp|Nâng cao)$/,
    (_, level) => ` · ${lookup(level)}`,
  );
  return text.replace(trimmed, translated);
}
export function initUILanguage() {
  const toggle = document.querySelector('#ui-language-toggle');
  const ignored = (element) =>
    element?.closest(protectedContent) || element?.closest('#ui-language-toggle');
  function localizeText(node) {
    const parent = node.parentElement;
    if (!parent || ignored(parent)) return;
    const option = parent.closest('option');
    if (option && !option.hasAttribute('value')) option.setAttribute('value', option.textContent);
    const value = node.nodeValue,
      previous = originals.get(node);
    const original = previous && previous.last === value ? previous.original : value;
    const last = translateUI(original);
    originals.set(node, { original, last });
    if (last !== value) node.nodeValue = last;
  }
  function localizeAttributes(element) {
    if (ignored(element)) return;
    const cache = attributes.get(element) || {};
    for (const name of ['aria-label', 'title', 'placeholder']) {
      if (!element.hasAttribute(name)) continue;
      const value = element.getAttribute(name),
        previous = cache[name];
      const original = previous && previous.last === value ? previous.original : value;
      const last = translateUI(original);
      cache[name] = { original, last };
      if (last !== value) element.setAttribute(name, last);
    }
    attributes.set(element, cache);
  }
  function localize(root) {
    if (root.nodeType === Node.TEXT_NODE) {
      localizeText(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE || ignored(root)) return;
    localizeAttributes(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) localizeText(walker.currentNode);
    root.querySelectorAll('[aria-label],[title],[placeholder]').forEach(localizeAttributes);
  }
  function update() {
    document.documentElement.lang = language;
    toggle.querySelector('#ui-language-label').textContent = language.toUpperCase();
    toggle.setAttribute(
      'aria-label',
      language === 'vi' ? 'Switch interface to English' : 'Chuyển giao diện sang tiếng Việt',
    );
    toggle.title =
      language === 'vi'
        ? 'Ngôn ngữ giao diện: Việt / English'
        : 'Interface language: English / Vietnamese';
    document.querySelector('#today').textContent = new Date().toLocaleDateString(uiLocale(), {
      timeZone: 'Asia/Ho_Chi_Minh',
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    localize(document.body);
  }
  toggle.addEventListener('click', () => {
    language = language === 'vi' ? 'en' : 'vi';
    try {
      localStorage.setItem('studio-ui-language', language);
    } catch {
      /* Keep current page usable. */
    }
    update();
  });
  new MutationObserver((changes) => {
    for (const change of changes) {
      if (change.type === 'characterData') localizeText(change.target);
      else if (change.type === 'attributes') localizeAttributes(change.target);
      else change.addedNodes.forEach(localize);
    }
  }).observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['aria-label', 'title', 'placeholder'],
  });
  update();
}
