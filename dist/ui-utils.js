export const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export const normalize = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();
export function matchesSearch(article, query) {
  const keywords = normalize(query).match(/[\p{L}\p{N}]+/gu) || [];
  const text = normalize(`${article.title ?? ''} ${article.summary ?? ''}`);
  const words = new Set(text.match(/[\p{L}\p{N}]+/gu) || []);
  return (
    keywords.length > 0 &&
    keywords.every((word) => (/\p{Script=Han}/u.test(word) ? text.includes(word) : words.has(word)))
  );
}
export const wordCount = (s) =>
  String(s ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
export function markdownPreview(text) {
  return String(text)
    .split('\n')
    .map((line) => {
      const heading = line.match(/^(#{1,3})\s+(.+)/);
      if (heading) return `<h${heading[1].length}>${esc(heading[2])}</h${heading[1].length}>`;
      if (/^[-*] /.test(line)) return `<p class="preview-list">• ${esc(line.slice(2))}</p>`;
      return `<p>${esc(line) || '&nbsp;'}</p>`;
    })
    .join('');
}
