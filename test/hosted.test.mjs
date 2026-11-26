import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { handleHosted, hostedConfig } from '../lib/hosted.mjs';
import { Store, UserStore } from '../lib/store.mjs';
import { Studio } from '../lib/service.mjs';
import { readFile } from 'node:fs/promises';

test('Hosted configuration exposes only the public key and requires Supabase', () => {
  assert.throws(() => hostedConfig({}), /SUPABASE_PUBLISHABLE_KEY/);
  assert.throws(() => hostedConfig({ SUPABASE_PUBLISHABLE_KEY: 'sb_secret_wrong' }));
  assert.equal(
    hostedConfig({ SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' }).publishableKey,
    'sb_publishable_test',
  );
  assert.throws(() => new UserStore({}), /cấu hình/);
});

test('Vercel keeps deferred jobs alive and cold initialization preserves active jobs', async () => {
  const store = new Store({ path: ':memory:' });
  const pending = [];
  const studio = new Studio(store, { serverless: true, defer: (promise) => pending.push(promise) });
  try {
    const job = await studio.job('example', async () => ({ completed: true }));
    assert.equal(pending.length, 1);
    await Promise.all(pending);
    assert.equal((await store.get('job', job.id)).status, 'succeeded');
    await store.put('job', { id: 'active', status: 'running' });
    await studio.initialize();
    assert.equal((await store.get('job', 'active')).status, 'running');
  } finally {
    store.close();
  }
});

test('Hosted API validates users and isolates workspaces through owner filters and user JWTs', async (t) => {
  const originalFetch = globalThis.fetch;
  const users = {
    'token-a': { id: '11111111-1111-4111-8111-111111111111', email: 'a@example.test' },
    'token-b': { id: '22222222-2222-4222-8222-222222222222', email: 'b@example.test' },
  };
  const records = new Map();
  const calls = [];
  const env = {
    SUPABASE_URL: 'https://supabase.example.test',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    SUPABASE_SERVICE_ROLE_KEY: 'must-never-reach-browser',
  };
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(input);
    if (url.hostname !== 'supabase.example.test') return originalFetch(input, options);
    const headers = new Headers(options.headers);
    const user = users[(headers.get('authorization') || '').replace('Bearer ', '')];
    const reply = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    if (url.pathname === '/auth/v1/user')
      return reply(
        user ? { ...user, aud: 'authenticated' } : { message: 'Invalid token' },
        user ? 200 : 401,
      );
    calls.push({ url, options, user });
    if (!user) return reply({ message: 'Unauthorized' }, 401);
    assert.equal(headers.get('apikey'), env.SUPABASE_PUBLISHABLE_KEY);
    const kind = url.searchParams.get('kind')?.slice(3);
    const id = url.searchParams.get('id')?.slice(3);
    if (url.pathname === '/rest/v1/research_feed_records') return reply([]);
    assert.equal(url.pathname, '/rest/v1/research_user_records');
    assert.equal(url.searchParams.get('owner_id'), `eq.${user.id}`);
    const key = (kind, id) => `${user.id}:${kind}:${id}`;
    const method = options.method || 'GET';
    if (method === 'POST') {
      const input = JSON.parse(options.body);
      const added = [];
      for (const row of Array.isArray(input) ? input : [input]) {
        assert.equal(row.owner_id, user.id);
        const recordKey = key(row.kind, row.id);
        if (headers.get('prefer').includes('ignore-duplicates') && records.has(recordKey)) continue;
        records.set(recordKey, row);
        added.push(row);
      }
      return reply(added, 201);
    }
    let rows = [...records.values()].filter(
      (row) => row.owner_id === user.id && row.kind === kind && (!id || row.id === id),
    );
    if (method === 'PATCH') {
      const revision = url.searchParams.get('payload->>revision')?.slice(3);
      if (revision) rows = rows.filter((row) => String(row.payload.revision) === revision);
      for (const row of rows) Object.assign(row, JSON.parse(options.body));
    }
    return reply(rows);
  };
  const deferred = [];
  const server = http.createServer((req, res) =>
    handleHosted(req, res, { env, defer: (promise) => deferred.push(promise) }),
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await Promise.allSettled(deferred);
    globalThis.fetch = originalFetch;
    await new Promise((resolve) => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, token = '', method = 'GET', body) => {
    const response = await originalFetch(base + path, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, data: await response.json() };
  };
  const config = await request('/api/config');
  assert.equal(config.status, 200);
  assert.ok(!JSON.stringify(config).includes(env.SUPABASE_SERVICE_ROLE_KEY));
  assert.equal((await request('/api/state')).status, 401);
  assert.equal((await request('/api/state', 'invalid')).status, 401);
  assert.equal((await request('/api/cron')).status, 401);
  assert.equal((await request('/api/demo', 'token-a', 'POST', {})).status, 200);
  assert.ok((await request('/api/state', 'token-a')).data.events.length > 0);
  assert.equal((await request('/api/state', 'token-b')).data.events.length, 0);
  assert.equal((await request('/api/events/demo-trade', 'token-b')).status, 404);
  const job = await request('/api/cases', 'token-a', 'POST', {
    event_id: 'demo-trade',
    mode: 'template',
  });
  await Promise.all(deferred);
  const completed = await request(`/api/jobs/${job.data.id}`, 'token-a');
  assert.equal(completed.data.status, 'succeeded');
  const caseId = completed.data.result.id;
  assert.equal((await request(`/api/cases/${caseId}`, 'token-b')).status, 404);
  const drafts = await Promise.all([
    request('/api/analyses', 'token-a', 'POST', { case_id: caseId }),
    request('/api/analyses', 'token-a', 'POST', { case_id: caseId }),
  ]);
  assert.equal(drafts[0].data.id, drafts[1].data.id);
  assert.equal((await request(`/api/analyses/${drafts[0].data.id}`, 'token-b')).status, 404);
  const save = { title: 'Owned draft', body: 'Saved text', revision: 1 };
  assert.equal(
    (await request(`/api/analyses/${drafts[0].data.id}`, 'token-a', 'PATCH', save)).status,
    200,
  );
  assert.equal(
    (await request(`/api/analyses/${drafts[0].data.id}`, 'token-a', 'PATCH', save)).status,
    409,
  );
  assert.ok(calls.every((call) => call.user));
});

test('Multi-user SQL limits private rows to the authenticated owner', async () => {
  const sql = await readFile(new URL('../supabase/003_multi_user.sql', import.meta.url), 'utf8');
  assert.match(sql, /using \(\(select auth.uid\(\)\) = owner_id\)/);
  assert.match(sql, /with check \(\(select auth.uid\(\)\) = owner_id\)/);
  assert.match(sql, /enable row level security/g);
  assert.match(sql, /r.payload->>'status' = 'published'/);
});
