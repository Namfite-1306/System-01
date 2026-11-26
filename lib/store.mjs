import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export class Store {
  constructor({
    path = './data/research.sqlite',
    supabaseUrl = '',
    supabaseKey = '',
    accessToken = supabaseKey,
    table = 'research_records',
    ownerId = '',
  } = {}) {
    this.remote = Boolean(supabaseUrl && supabaseKey);
    this.url = supabaseUrl.replace(/\/$/, '');
    this.key = supabaseKey;
    this.accessToken = accessToken;
    this.table = table;
    this.ownerId = ownerId;
    if (!this.remote) {
      mkdirSync(dirname(resolve(path)), { recursive: true });
      this.db = new DatabaseSync(path);
      this.db.exec(
        'PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS research_records(kind TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,updated_at TEXT NOT NULL, PRIMARY KEY(kind,id));',
      );
      this.db.exec(
        'PRAGMA busy_timeout=5000; CREATE INDEX IF NOT EXISTS records_kind_updated ON research_records(kind,updated_at DESC);',
      );
    }
  }
  async request(query, method = 'GET', body, prefer = 'resolution=merge-duplicates') {
    const params = new URLSearchParams(query);
    if (this.ownerId) {
      params.set('owner_id', `eq.${this.ownerId}`);
      if (params.has('on_conflict')) params.set('on_conflict', 'owner_id,kind,id');
      if (body && method === 'POST')
        body = Array.isArray(body)
          ? body.map((row) => ({ ...row, owner_id: this.ownerId }))
          : { ...body, owner_id: this.ownerId };
    }
    const r = await fetch(`${this.url}/rest/v1/${this.table}?${params}`, {
      method,
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        Prefer: prefer,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw new Error(`Supabase HTTP ${r.status}`);
    return r.status === 204 || r.headers.get('content-length') === '0'
      ? null
      : r.text().then((t) => (t ? JSON.parse(t) : null));
  }
  async all(kind) {
    if (!this.remote)
      return this.db
        .prepare('SELECT payload FROM research_records WHERE kind=? ORDER BY updated_at DESC')
        .all(kind)
        .map((r) => JSON.parse(r.payload));
    const rows = [];
    let offset = 0;
    while (true) {
      const page = await this.request(
        `kind=eq.${encodeURIComponent(kind)}&select=payload&order=updated_at.desc,id.asc&limit=500&offset=${offset}`,
      );
      rows.push(...page.map((r) => r.payload));
      if (page.length < 500) break;
      offset += 500;
    }
    return rows;
  }
  async get(kind, id) {
    if (!this.remote) {
      const r = this.db
        .prepare('SELECT payload FROM research_records WHERE kind=? AND id=?')
        .get(kind, id);
      return r ? JSON.parse(r.payload) : null;
    }
    const rows = await this.request(
      `kind=eq.${encodeURIComponent(kind)}&id=eq.${encodeURIComponent(id)}&select=payload`,
    );
    return rows[0]?.payload ?? null;
  }
  async put(kind, item) {
    const updated = new Date().toISOString();
    if (!this.remote)
      this.db
        .prepare(
          'INSERT INTO research_records VALUES(?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at',
        )
        .run(kind, item.id, JSON.stringify(item), updated);
    else
      await this.request('on_conflict=kind,id', 'POST', {
        kind,
        id: item.id,
        payload: item,
        updated_at: updated,
      });
    return item;
  }
  async insert(kind, item) {
    if (!this.remote) {
      const existing = await this.get(kind, item.id);
      return existing || this.put(kind, item);
    }
    const rows = await this.request(
      'on_conflict=kind,id',
      'POST',
      { kind, id: item.id, payload: item, updated_at: new Date().toISOString() },
      'resolution=ignore-duplicates,return=representation',
    );
    return rows?.[0]?.payload || this.get(kind, item.id);
  }
  async putMany(records) {
    if (!records.length) return;
    const unique = [
      ...new Map(records.map((record) => [`${record.kind}:${record.item.id}`, record])).values(),
    ];
    if (!this.remote) {
      for (const { kind, item } of unique) await this.put(kind, item);
      return;
    }
    const updated_at = new Date().toISOString();
    await this.request(
      'on_conflict=kind,id',
      'POST',
      unique.map(({ kind, item }) => ({
        kind,
        id: item.id,
        payload: item,
        updated_at,
      })),
    );
  }
  async compareUpdated(kind, item, previousTime) {
    const result = await this.request(
      `kind=eq.${encodeURIComponent(kind)}&id=eq.${encodeURIComponent(item.id)}&payload->>updated_at=eq.${encodeURIComponent(previousTime)}`,
      'PATCH',
      { payload: item, updated_at: new Date().toISOString() },
      'return=representation',
    );
    return Boolean(result?.length);
  }
  async remove(kind, id) {
    if (!this.remote)
      this.db.prepare('DELETE FROM research_records WHERE kind=? AND id=?').run(kind, id);
    else
      await this.request(
        `kind=eq.${encodeURIComponent(kind)}&id=eq.${encodeURIComponent(id)}`,
        'DELETE',
      );
  }
  async comparePut(kind, item, revision) {
    const updated = new Date().toISOString();
    if (!this.remote)
      return (
        this.db
          .prepare(
            "UPDATE research_records SET payload=?,updated_at=? WHERE kind=? AND id=? AND json_extract(payload,'$.revision')=?",
          )
          .run(JSON.stringify(item), updated, kind, item.id, revision).changes === 1
      );
    const result = await this.request(
      `kind=eq.${encodeURIComponent(kind)}&id=eq.${encodeURIComponent(item.id)}&payload->>revision=eq.${revision}`,
      'PATCH',
      { payload: item, updated_at: updated },
      'return=representation',
    );
    return Boolean(result?.length);
  }
  close() {
    this.db?.close();
  }
}

const sharedKinds = new Set(['source', 'article', 'event', 'entity']);
export class UserStore extends Store {
  constructor(options) {
    if (!options.ownerId || !options.supabaseUrl || !options.supabaseKey || !options.accessToken)
      throw new Error('Thiếu cấu hình kho dữ liệu theo tài khoản');
    super({ ...options, table: 'research_user_records' });
    this.feed = new Store({ ...options, ownerId: '', table: 'research_feed_records' });
  }
  async all(kind) {
    if (!sharedKinds.has(kind)) return super.all(kind);
    const [own, shared] = await Promise.all([super.all(kind), this.feed.all(kind)]);
    return [...new Map([...shared, ...own].map((item) => [item.id, item])).values()];
  }
  async get(kind, id) {
    const own = await super.get(kind, id);
    return own || (sharedKinds.has(kind) ? this.feed.get(kind, id) : null);
  }
}
