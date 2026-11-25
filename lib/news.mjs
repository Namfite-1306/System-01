import { XMLParser } from 'fast-xml-parser';
import { createHash } from 'node:crypto';
import { matchesSearch } from '../dist/ui-utils.js';
export { matchesSearch };
export const NEWS_LOCALES = {
  vi: { hl: 'vi', gl: 'VN', ceid: 'VN:vi' },
  en: { hl: 'en-US', gl: 'US', ceid: 'US:en' },
  zh: { hl: 'zh-CN', gl: 'CN', ceid: 'CN:zh-Hans' },
  de: { hl: 'de', gl: 'DE', ceid: 'DE:de' },
  fr: { hl: 'fr', gl: 'FR', ceid: 'FR:fr' },
  es: { hl: 'es', gl: 'ES', ceid: 'ES:es' },
};
export function validateLanguages(languages = ['vi', 'en']) {
  if (
    !Array.isArray(languages) ||
    !languages.length ||
    languages.length > 6 ||
    languages.some((l) => !Object.hasOwn(NEWS_LOCALES, l))
  )
    throw Object.assign(new Error('Chọn ít nhất một ngôn ngữ nguồn hợp lệ'), { status: 400 });
  return [...new Set(languages)];
}
export const SOURCES = [
  {
    id: 'rthk-finance',
    name: 'RTHK 財經',
    url: 'https://rthk9.rthk.hk/rthk/news/rss/c_expressnews_cfinance.xml',
    language: 'zh',
    topic: 'Kinh tế',
    enabled: true,
  },
  {
    id: 'tagesschau-business',
    name: 'Tagesschau Wirtschaft',
    url: 'https://www.tagesschau.de/wirtschaft/index~rss2.xml',
    language: 'de',
    topic: 'Kinh tế',
    enabled: true,
  },
  {
    id: 'lemonde-economy',
    name: 'Le Monde Économie',
    url: 'https://www.lemonde.fr/economie/rss_full.xml',
    language: 'fr',
    topic: 'Kinh tế',
    enabled: true,
  },
  {
    id: 'elpais-economy',
    name: 'EL PAÍS Economía',
    url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/economia/portada',
    language: 'es',
    topic: 'Kinh tế',
    enabled: true,
  },
  {
    id: 'bbc-business',
    language: 'en',
    name: 'BBC Business',
    url: 'https://feeds.bbci.co.uk/news/business/rss.xml',
    topic: 'Kinh doanh',
    enabled: true,
  },
  {
    id: 'bbc-world',
    language: 'en',
    name: 'BBC World',
    url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    topic: 'Thế giới',
    enabled: true,
  },
  {
    id: 'vnexpress-business',
    language: 'vi',
    name: 'VnExpress Kinh doanh',
    url: 'https://vnexpress.net/rss/kinh-doanh.rss',
    topic: 'Kinh tế',
    enabled: true,
  },
  {
    id: 'vnexpress-world',
    language: 'vi',
    name: 'VnExpress Thế giới',
    url: 'https://vnexpress.net/rss/the-gioi.rss',
    topic: 'Thế giới',
    enabled: true,
  },
];
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  processEntities: true,
});
export const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 24);
export const clean = (s) =>
  String(typeof s === 'object' ? (s?.['#text'] ?? '') : (s ?? ''))
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#\d+|#x[\da-f]+);/gi, (entity) => {
      const named = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&apos;': "'",
        '&nbsp;': ' ',
      };
      if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
      const num = entity.toLowerCase().startsWith('&#x')
        ? parseInt(entity.slice(3, -1), 16)
        : parseInt(entity.slice(2, -1), 10);
      return num > 0 && num <= 0x10ffff ? String.fromCodePoint(num) : '';
    })
    .replace(/\s+/g, ' ')
    .trim();
export function canonical(value) {
  try {
    const u = new URL(value);
    if (!['https:', 'http:'].includes(u.protocol)) return null;
    u.hash = '';
    for (const key of [...u.searchParams.keys()])
      if (/^(utm_|fbclid|gclid)/.test(key)) u.searchParams.delete(key);
    return u.href;
  } catch {
    return null;
  }
}
export function parseFeed(xml, source, now = new Date().toISOString()) {
  if (/<!(DOCTYPE|ENTITY)/i.test(xml)) throw new Error('DTD không được hỗ trợ');
  const doc = parser.parse(xml);
  const raw = doc.rss?.channel?.item ?? doc.feed?.entry ?? [];
  const items = Array.isArray(raw) ? raw : [raw];
  return items.slice(0, 80).flatMap((item) => {
    const links = Array.isArray(item.link) ? item.link : [item.link];
    const link = links.find(
      (x) => typeof x === 'string' || !x?.['@_rel'] || x['@_rel'] === 'alternate',
    );
    const url = canonical(typeof link === 'object' ? link?.['@_href'] : link);
    const title = clean(item.title);
    if (!url || !title) return [];
    const date = new Date(clean(item.pubDate ?? item.published ?? item.updated));
    const summary = clean(item.description ?? item.summary ?? item.content).slice(0, 1600);
    return [
      {
        id: hash(url),
        url,
        title,
        summary,
        source_id: source.id,
        language: source.language,
        source_name:
          source.id === 'google-news-search' ? clean(item.source) || source.name : source.name,
        topic: source.topic,
        published_at: Number.isNaN(+date) ? null : date.toISOString(),
        fetched_at: now,
        is_demo: false,
      },
    ];
  });
}
export async function fetchFeed(source) {
  // Only the preconfigured allowlist is fetched; user-supplied URLs are not accepted.
  if (!SOURCES.some((s) => s.id === source.id && s.url === source.url))
    throw new Error('Nguồn không nằm trong danh sách cho phép');
  return readFeed(source);
}
export const SEARCH_DAYS = [1, 7, 30, 90, 365, 1827];
export function historyStart(clock = Date.now()) {
  const d = new Date(clock);
  d.setUTCFullYear(d.getUTCFullYear() - 5);
  return d.getTime();
}
export function searchSource(query, days = 7, language = 'vi', range) {
  if (typeof query !== 'string' || query.trim().length < 2 || query.trim().length > 160)
    throw new Error('Từ khóa cần từ 2 đến 160 ký tự');
  if (!SEARCH_DAYS.includes(days)) throw new Error('Khoảng thời gian tìm kiếm không hợp lệ');
  validateLanguages([language]);
  const keywords = query.trim().replace(/["“”]/g, '').trim();
  if (keywords.length < 2) throw new Error('Cần từ khóa có nội dung');
  const terms = keywords
    .split(/\s+/)
    .map((term) => `"${term}"`)
    .join(' ');
  const url = new URL('https://news.google.com/rss/search');
  url.search = new URLSearchParams({
    q: range ? `${terms} after:${range.from} before:${range.to}` : `${terms} when:${days}d`,
    ...NEWS_LOCALES[language],
  }).toString();
  return {
    id: 'google-news-search',
    name: 'Google News',
    url: url.href,
    language,
    topic: 'Tin tìm kiếm',
  };
}
export async function searchNews(query, days = 7, languages = ['vi', 'en']) {
  languages = validateLanguages(languages);
  const ranges = [];
  if (days === 1827) {
    let start = historyStart();
    for (let i = 0; i < 5; i++) {
      const end = new Date(start);
      end.setUTCFullYear(end.getUTCFullYear() + 1);
      ranges.push({
        from: new Date(start - 86400000).toISOString().slice(0, 10),
        to: new Date(end.getTime() + 86400000).toISOString().slice(0, 10),
      });
      start = end.getTime();
    }
  }
  const sources = (ranges.length ? ranges : [undefined]).flatMap((range) =>
    languages.map((language) => searchSource(query, days, language, range)),
  );
  const results = [];
  for (let i = 0; i < sources.length; i += 4)
    results.push(...(await Promise.allSettled(sources.slice(i, i + 4).map(readFeed))));
  if (results.every((r) => r.status === 'rejected'))
    throw new Error('Không kết nối được Google News. Hãy thử lại.');
  const articles = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  // Keep a quota for every annual/language window so recent years cannot crowd out older ones.
  const candidates =
    days === 1827
      ? results.flatMap((r) =>
          r.status === 'fulfilled'
            ? filterSearchResults(r.value, query, days).slice(
                0,
                Math.floor(400 / (5 * languages.length)),
              )
            : [],
        )
      : articles;
  const selected = filterSearchResults(candidates, query, days).map((a) => ({
    ...a,
    search_query: query.trim(),
  }));
  selected.search_report = {
    fetched: articles.length,
    excluded: articles.length - selected.length,
    partial: results.some((r) => r.status === 'rejected'),
    windows: ranges.length || 1,
    limit: days === 1827 ? 400 : 80,
    historical: days === 1827,
    languages,
    failed_sources: results.flatMap((r, i) =>
      r.status === 'rejected' ? [sources[i].language] : [],
    ),
  };
  return selected;
}
export function filterSearchResults(articles, query, days, clock = Date.now()) {
  const seen = new Set();
  return articles
    .filter((a) => {
      const time = new Date(a.published_at).getTime();
      if (
        !a.published_at ||
        !Number.isFinite(time) ||
        time < (days === 1827 ? historyStart(clock) : clock - days * 86400000) ||
        time > clock + 300000 ||
        !matchesSearch(a, query) ||
        seen.has(a.id)
      )
        return false;
      seen.add(a.id);
      return true;
    })
    .sort((a, b) => b.published_at.localeCompare(a.published_at))
    .slice(0, days === 1827 ? 400 : 80);
}
async function readFeed(source) {
  const r = await fetch(source.url, {
    headers: {
      'User-Agent': 'ResearchStudio/0.1 (personal RSS reader)',
      Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
    },
    redirect: 'error',
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`RSS HTTP ${r.status}`);
  const reader = r.body.getReader();
  let bytes = 0;
  const chunks = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > 3_000_000) {
      await reader.cancel();
      throw new Error('RSS vượt giới hạn 3 MB');
    }
    chunks.push(Buffer.from(value));
  }
  return parseFeed(Buffer.concat(chunks).toString('utf8'), source);
}
const GROUPS = [
  {
    name: 'Lãi suất & tiền tệ',
    terms: [
      'interest rate',
      'central bank',
      'inflation',
      'lãi suất',
      'lạm phát',
      'federal reserve',
      'fed rate',
      'tỷ giá',
    ],
  },
  {
    name: 'Thương mại quốc tế',
    terms: ['tariff', 'trade war', 'export', 'import', 'thuế quan', 'xuất khẩu', 'nhập khẩu'],
  },
  { name: 'Năng lượng', terms: ['oil', 'energy', 'gas price', 'dầu', 'năng lượng', 'opec'] },
  {
    name: 'Công nghệ & AI',
    terms: [
      'artificial intelligence',
      ' ai ',
      'chip',
      'semiconductor',
      'trí tuệ nhân tạo',
      'công nghệ',
    ],
  },
];
export function entitiesFor(article) {
  const text = ` ${article.title} ${article.summary} `.toLowerCase();
  return [
    ...GROUPS.filter((g) => g.terms.some((t) => text.includes(t))).map((g) => ({
      id: hash(g.name),
      name: g.name,
      type: 'Chủ đề',
    })),
    ...[
      ['Việt Nam', ['vietnam', 'việt nam']],
      ['Hoa Kỳ', [' us ', ' u.s. ', 'united states', 'america', 'mỹ']],
      ['Trung Quốc', ['china', 'chinese', 'trung quốc']],
      ['Châu Âu', ['europe', ' eu ', 'châu âu']],
    ]
      .filter(([, terms]) => terms.some((t) => text.includes(t)))
      .map(([name]) => ({ id: hash(name), name, type: 'Địa lý' })),
  ];
}
export function headlineKey(article) {
  return hash(
    article.title
      .toLowerCase()
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N} ]/gu, '')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}
