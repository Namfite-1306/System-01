import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export class Store {
  constructor({ path = './data/research.sqlite', supabaseUrl = '', supabaseKey = '' } = {}) {
    this.remote = Boolean(supabaseUrl && supabaseKey);
    this.url = supabaseUrl.replace(/\/$/, '');
    this.key = supabaseKey;
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
    const r = await fetch(`${this.url}/rest/v1/research_records?${query}`, {
      method,
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${this.key}`,
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
        `kind=eq.${encodeURIComponent(kind)}&select=payload&order=updated_at.desc&limit=500&offset=${offset}`,
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
