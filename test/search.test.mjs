import test from 'node:test';
import assert from 'node:assert/strict';
import { searchSource, matchesSearch, filterSearchResults } from '../lib/news.mjs';
test('Search URL keeps the destination fixed and validates keyword and time window', () => {
  const source = searchSource('ngân hàng Việt Nam & https://localhost', 7),
    url = new URL(source.url);
  assert.equal(url.hostname, 'news.google.com');
  assert.equal(url.pathname, '/rss/search');
  assert.equal(
    url.searchParams.get('q'),
    '"ngân" "hàng" "Việt" "Nam" "&" "https://localhost" when:7d',
  );
  assert.equal(url.searchParams.get('ceid'), 'VN:vi');
  assert.throws(() => searchSource('a', 7));
  assert.throws(() => searchSource('bank', 999));
});

test('All keywords can appear apart, in either order and across title and summary', () => {
  const article = {
    title: 'Ngân hàng tăng đầu tư công nghệ',
    summary: 'Dự báo giá vàng biến động',
  };
  for (const query of ['ngân vàng', 'vàng ngân', '  NGAN   VANG  ', 'ngân, vàng']) {
    assert.equal(matchesSearch(article, query), true, query);
  }
  assert.equal(matchesSearch(article, 'ngân dầu mỏ'), false);
  assert.equal(matchesSearch(article, 'ngân hàn'), false);
  assert.equal(matchesSearch(article, ''), false);
  assert.equal(matchesSearch({ title: '黑石集团投资人工智能' }, '人工智能 黑石'), true);
  assert.equal(
    new URL(searchSource('ngân vàng').url).searchParams.get('q'),
    '"ngân" "vàng" when:7d',
  );
  assert.equal(
    new URL(
      searchSource('vàng ngân', 1827, 'vi', { from: '2021-11-22', to: '2022-11-22' }).url,
    ).searchParams.get('q'),
    '"vàng" "ngân" after:2021-11-22 before:2022-11-22',
  );
});
test('Deloitte/McKinsey results require actual keyword evidence, exact words and valid recency', () => {
  assert.equal(
    matchesSearch({ title: 'Cost reduction in the UK', summary: 'Survey findings' }, 'Deloitte'),
    false,
  );
  assert.equal(
    matchesSearch({ title: 'New report', summary: 'Deloitte forecasts growth' }, 'Deloitte'),
    true,
  );
  assert.equal(matchesSearch({ title: 'McKinsey: AI workforce', summary: '' }, 'mckinsey'), true);
  assert.equal(
    matchesSearch({ title: 'McKinseyFake consultancy', summary: '' }, 'McKinsey'),
    false,
  );
  assert.equal(
    matchesSearch({ title: 'NGÂN HÀNG tại VIỆT NAM', summary: '' }, 'ngan hang viet nam'),
    true,
  );
  const clock = Date.parse('2026-10-14T10:00:00Z');
  const item = (id, date, title = 'Deloitte report') => ({
    id,
    published_at: date,
    title,
    summary: '',
  });
  const result = filterSearchResults(
    [
      item('a', '2026-10-13T10:00:00Z'),
      item('b', '2026-10-14T09:00:00Z'),
      item('a', '2026-10-13T10:00:00Z'),
      item('old', '2026-09-01T10:00:00Z'),
      item('future', '2027-01-01T10:00:00Z'),
      item('wrong', '2026-10-14T08:00:00Z', 'Unrelated report'),
    ],
    'Deloitte',
    7,
    clock,
  );
  assert.deepEqual(
    result.map((a) => a.id),
    ['b', 'a'],
  );
});
