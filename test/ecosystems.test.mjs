import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../lib/store.mjs';
import { Studio } from '../lib/service.mjs';
import { Ecosystems } from '../lib/ecosystems.mjs';
import { createServer } from '../server.mjs';
import { searchSource, filterSearchResults, historyStart } from '../lib/news.mjs';
test('Five-year boundary accepts historical articles and rejects outside/future results', () => {
  const clock = Date.parse('2026-10-27T12:00:00Z');
  assert.equal(historyStart(clock), Date.parse('2021-10-27T12:00:00Z'));
  const article = (id, date) => ({
    id,
    title: 'Blackstone investment',
    summary: '',
    published_at: date,
  });
  const items = filterSearchResults(
    [
      article('old', '2021-10-26T12:00:00Z'),
      article('edge', '2021-10-27T12:00:00Z'),
      article('lastyear', '2025-10-27T12:00:00Z'),
      article('future', '2027-10-27T12:00:00Z'),
    ],
    'Blackstone',
    1827,
    clock,
  );
  assert.deepEqual(
    items.map((i) => i.id),
    ['lastyear', 'edge'],
  );
  const url = new URL(
    searchSource('Blackstone', 1827, 'en', { from: '2021-10-27', to: '2022-10-27' }).url,
  );
  assert.equal(url.hostname, 'news.google.com');
  assert.match(url.searchParams.get('q'), /after:2021-10-27 before:2022-10-27/);
});
test('Ecosystems persist independent memberships and editable scoped links through the API', async (t) => {
  const store = new Store({ path: ':memory:' }),
    { server, studio } = await createServer({ store });
  await studio.seedDemo();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(
    () =>
      new Promise((r) =>
        server.close(() => {
          store.close();
          r();
        }),
      ),
  );
  const call = async (path, method = 'GET', body) => {
    const r = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, data: await r.json() };
  };
  let a = (await call('/ecosystems', 'POST', { name: 'Blackstone', event_id: 'demo-trade' })).data;
  const b = (await call('/ecosystems', 'POST', { name: 'Company B', event_id: 'demo-trade' })).data;
  await call(`/ecosystems/${a.id}/members`, 'POST', { event_id: 'demo-currency' });
  await call(`/ecosystems/${a.id}/members`, 'POST', { event_id: 'demo-trade' });
  a = (await call(`/ecosystems/${a.id}`)).data;
  assert.equal(a.event_ids.length, 2);
  const link = {
    from: 'demo-trade',
    to: 'demo-currency',
    label: 'Có thể tác động',
    reason: 'Giả thuyết dựa trên hai tin',
    status: 'hypothesis',
  };
  a = (await call(`/ecosystems/${a.id}/links`, 'POST', link)).data;
  const linkId = a.links[0].id;
  a = (
    await call(`/ecosystems/${a.id}/links/${linkId}`, 'PATCH', {
      ...link,
      label: 'Cập nhật',
      status: 'reported',
    })
  ).data;
  assert.equal(a.links[0].label, 'Cập nhật');
  assert.equal(a.links[0].status, 'reported');
  assert.equal((await call(`/ecosystems/${b.id}`)).data.links.length, 0);
  assert.equal((await call(`/ecosystems/${b.id}/links`, 'POST', link)).status, 400);
  assert.equal(
    (await call(`/ecosystems/${a.id}/links/${linkId}`, 'PATCH', { ...link, reason: '' })).status,
    400,
  );
  await call(`/ecosystems/${a.id}/links/${linkId}`, 'DELETE');
  assert.equal((await call(`/ecosystems/${a.id}`)).data.links.length, 0);
  await call(`/ecosystems/${a.id}/links`, 'POST', link);
  await call(`/ecosystems/${a.id}/members/demo-trade`, 'DELETE');
  a = (await call(`/ecosystems/${a.id}`)).data;
  assert.equal(a.links.length, 0);
  assert.equal((await call('/events/demo-trade')).status, 200);
  await call(`/ecosystems/${a.id}`, 'PATCH', { name: 'Blackstone Research' });
  assert.ok((await call('/state')).data.ecosystems.some((e) => e.name === 'Blackstone Research'));
  assert.equal((await call('/export')).data.records.ecosystem.length, 2);
  const eco = new Ecosystems(store);
  await Promise.all([eco.add(a.id, 'demo-trade'), eco.add(a.id, 'demo-energy')]);
  assert.equal((await eco.required(a.id)).event_ids.length, 3);
});
