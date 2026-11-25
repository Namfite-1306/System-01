import test from 'node:test';
import assert from 'node:assert/strict';
import { SerialQueue } from '../lib/serial.mjs';
import { Store } from '../lib/store.mjs';
import { Studio } from '../lib/service.mjs';
import { createApi } from '../dist/api.js';
import { markdownPreview, wordCount, normalize } from '../dist/ui-utils.js';

test('Record queue recovers from failure without overlapping work', async () => {
  const queue = new SerialQueue(),
    order = [];
  const a = queue.run(async () => {
    order.push('a');
    await new Promise((r) => setTimeout(r, 15));
    throw new Error('expected');
  });
  const b = queue.run(async () => {
    order.push('b');
    return 2;
  });
  await assert.rejects(a);
  assert.equal(await b, 2);
  assert.deepEqual(order, ['a', 'b']);
});
test('Simultaneous start-writing actions reuse the same draft', async () => {
  const store = new Store({ path: ':memory:' }),
    studio = new Studio(store);
  try {
    await studio.initialize();
    await studio.seedDemo();
    const c = await studio.createCase({ event_id: 'demo-trade' });
    const drafts = await Promise.all([studio.createAnalysis(c.id), studio.createAnalysis(c.id)]);
    assert.equal(drafts[0].id, drafts[1].id);
    assert.equal((await store.all('analysis')).length, 1);
  } finally {
    store.close();
  }
});
test('Expired session token can be replaced once without retry loops', async () => {
  let token = 'expired',
    calls = 0;
  const api = createApi({
    getToken: () => token,
    setToken: (value) => {
      token = value;
    },
    requestToken: () => 'valid',
    fetcher: async (_, options) => {
      calls++;
      return new Response(
        JSON.stringify(
          options.headers.Authorization === 'Bearer valid'
            ? { status: 'ok' }
            : { error: 'Unauthorized' },
        ),
        { status: options.headers.Authorization === 'Bearer valid' ? 200 : 401 },
      );
    },
  });
  assert.equal((await api('/health')).status, 'ok');
  assert.equal(calls, 2);
});
test('Preview escapes injected markup; Vietnamese search and word count stay consistent', () => {
  const html = markdownPreview('# Title\n<script>alert(1)</script>\n- point');
  assert.ok(html.includes('<h1>Title</h1>'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.equal(wordCount('   '), 0);
  assert.equal(wordCount('một hai'), 2);
  assert.equal(normalize('ĐẦU TƯ'), 'dau tu');
});
