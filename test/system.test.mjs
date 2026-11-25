import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../lib/store.mjs';
import { parseFeed, canonical, SOURCES } from '../lib/news.mjs';
import { createServer } from '../server.mjs';
test('RSS/Atom preserve dates, sanitize descriptions, deduplicate canonical links', () => {
  const xml =
    '<rss><channel><item><title><![CDATA[A & B]]></title><link>https://example.com/news?utm_source=test</link><description><![CDATA[<p>Thông tin <b>mới</b></p>]]></description><pubDate>Mon, 12 Oct 2026 01:00:00 GMT</pubDate></item></channel></rss>';
  const [a] = parseFeed(xml, SOURCES[0]);
  assert.equal(a.title, 'A & B');
  assert.equal(a.summary, 'Thông tin mới');
  assert.equal(a.published_at, '2026-10-12T01:00:00.000Z');
  assert.equal(a.url, 'https://example.com/news');
  assert.equal(canonical('javascript:alert(1)'), null);
  const [b] = parseFeed(
    '<feed><entry><title>Atom</title><link rel="alternate" href="https://example.com/a"/><updated>bad-date</updated><summary>Note</summary></entry></feed>',
    SOURCES[0],
  );
  assert.equal(b.url, 'https://example.com/a');
  assert.equal(b.published_at, null);
  assert.throws(() => parseFeed('<!DOCTYPE foo><rss/>', SOURCES[0]));
});
test('end-to-end: immutable case, revision protection, review configuration, PDF, publish snapshot, private API', async (t) => {
  const store = new Store({ path: ':memory:' });
  const { server, studio } = await createServer({ store });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(
    () =>
      new Promise((r) =>
        server.close(() => {
          store.close();
          r();
        }),
      ),
  );
  const call = async (path, method = 'GET', body, headers = {}) => {
    const r = await fetch(base + path, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: r.status,
      data: r.headers.get('content-type')?.includes('application/json')
        ? await r.json()
        : await r.text(),
    };
  };
  assert.equal((await call('/api/health')).status, 200);
  assert.equal(
    (await call('/api/health', 'GET', undefined, { Origin: 'https://evil.example' })).status,
    403,
  );
  assert.equal((await call('/api/demo', 'POST', {})).status, 200);
  const demoArticle = await store.get('article', 'article-demo-trade');
  await store.put('article', { ...demoArticle, url: 'https://example.com/source' });
  assert.equal(
    (await call('/api/state')).data.events.find((e) => e.id === 'demo-trade').primary_url,
    'https://example.com/source',
  );
  const first = await studio.createCase({ event_id: 'demo-trade', mode: 'template' });
  const original = first.evidence[0].summary;
  const article = await store.get('article', 'article-demo-trade');
  await store.put('article', { ...article, summary: 'Updated later' });
  assert.equal((await store.get('case', first.id)).evidence[0].summary, original);
  const cjob = (await call('/api/cases', 'POST', { event_id: 'demo-trade', mode: 'template' }))
    .data;
  let j;
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 20));
    j = (await call(`/api/jobs/${cjob.id}`)).data;
    if (j.status === 'succeeded') break;
  }
  assert.equal(j.status, 'succeeded');
  const a = (await call('/api/analyses', 'POST', { case_id: first.id })).data;
  const saved = (
    await call(`/api/analyses/${a.id}`, 'PATCH', {
      title: 'Phân tích cá nhân <script>alert(1)</script>',
      body:
        '# Kết luận\n\n' +
        'Phân tích tác động và bằng chứng, giả định, kịch bản thay thế. '.repeat(40),
      revision: 1,
    })
  ).data;
  assert.equal(saved.revision, 2);
  assert.equal(
    (await call(`/api/analyses/${a.id}`, 'PATCH', { title: 'Other', body: 'Other', revision: 1 }))
      .status,
    409,
  );
  const concurrent = await Promise.all(
    [
      studio.saveAnalysis(a.id, { title: saved.title, body: saved.body, revision: 2 }),
      studio.saveAnalysis(a.id, { title: saved.title, body: saved.body, revision: 2 }),
    ].map((p) =>
      p.then(
        () => 200,
        (e) => e.status,
      ),
    ),
  );
  assert.deepEqual(concurrent.sort(), [200, 409]);
  assert.equal(
    (await call('/api/cases', 'POST', { event_id: 'demo-trade', mode: 'ai' })).status,
    409,
  );
  assert.equal((await call(`/api/analyses/${a.id}/review`, 'POST', {})).status, 409);
  const pdf = await fetch(base + `/api/analyses/${a.id}/pdf`);
  assert.equal(pdf.status, 200);
  const bytes = Buffer.from(await pdf.arrayBuffer());
  assert.equal(bytes.subarray(0, 4).toString(), '%PDF');
  assert.ok(bytes.length > 10000);
  assert.equal((await call(`/api/analyses/${a.id}/publish`, 'POST', { revision: 3 })).status, 409);
  assert.equal(
    (await call(`/api/analyses/${a.id}/publish`, 'POST', { confirm: true, revision: 3 })).status,
    200,
  );
  const publicPage = await call(`/portfolio/${a.id}`);
  assert.equal(publicPage.status, 200);
  assert.ok(publicPage.data.includes('&lt;script&gt;'));
  assert.ok(!publicPage.data.includes('<script>alert'));
  assert.equal(
    (
      await call('/api/relationships', 'POST', {
        from: 'demo-trade',
        to: 'demo-currency',
        label: 'Ảnh hưởng',
        reason: 'Giả thuyết',
        status: 'confirmed',
        evidence_ids: [],
      })
    ).status,
    400,
  );
  const graph = (await call('/api/events/demo-trade/graph')).data;
  assert.ok(graph.edges.some((e) => e.status === 'hypothesis'));
  assert.ok(graph.nodes.length >= 4);
  assert.equal((await call('/api/sources/bbc-world', 'PATCH', { enabled: false })).status, 200);
  assert.equal(
    (await call('/api/sources/bbc-world', 'PATCH', { url: 'http://127.0.0.1' })).status,
    400,
  );
  const backup = (await call('/api/export')).data;
  assert.ok(backup.records.case.length >= 2);
});
