import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual, randomUUID } from 'node:crypto';
import { Store } from './lib/store.mjs';
import { Studio, error } from './lib/service.mjs';
import { SOURCES, SEARCH_DAYS, validateLanguages, matchesSearch } from './lib/news.mjs';
import { Translator } from './lib/translation.mjs';
import { Ecosystems } from './lib/ecosystems.mjs';
import { pdfBuffer } from './lib/pdf.mjs';
const ROOT = dirname(fileURLToPath(import.meta.url));
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
function markdown(body) {
  return body
    .split('\n')
    .map((line) => {
      const m = line.match(/^(#{1,3})\s+(.+)/);
      return m
        ? `<h${m[1].length}>${esc(m[2])}</h${m[1].length}>`
        : `<p>${esc(line) || '&nbsp;'}</p>`;
    })
    .join('');
}
function page(a) {
  const s = a.published_snapshot;
  return `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(s.title)}</title><style>body{font:17px/1.8 system-ui;color:#243b37;background:#fafbf8;margin:0}article{max-width:780px;margin:65px auto;padding:0 24px}a{color:#16735f}h1{line-height:1.2;font-size:38px}header{color:#16735f;font-size:12px;letter-spacing:2px}p{white-space:pre-wrap}aside{border-top:1px solid #ccc;margin-top:40px;padding-top:20px}</style><article><header>RESEARCH STUDIO / PERSONAL ANALYSIS${a.is_demo ? ' / DỮ LIỆU MẪU' : ''}</header><h1>${esc(s.title)}</h1><small>Dữ liệu chốt: ${esc(s.cutoff_at.slice(0, 10))} · Bài phân tích cá nhân</small>${markdown(s.body)}<aside><h2>Nguồn tham khảo</h2>${s.evidence.map((e) => `<p>${e.url ? `<a href="${esc(e.url)}" rel="noopener noreferrer">${esc(e.title)}</a>` : esc(e.title)}</p>`).join('')}</aside></article></html>`;
}
export async function createServer(options = {}) {
  const localDatabase = process.env.DATABASE_BACKEND === 'sqlite';
  const store =
    options.store ??
    new Store({
      path: process.env.DATABASE_PATH || resolve(ROOT, 'data/research.sqlite'),
      supabaseUrl: localDatabase ? '' : process.env.SUPABASE_URL,
      supabaseKey: localDatabase ? '' : process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
  const studio = new Studio(store, {
    openaiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    portfolioUrl: process.env.PORTFOLIO_WEBHOOK_URL,
    portfolioToken: process.env.PORTFOLIO_WEBHOOK_TOKEN,
    serverless: options.serverless,
    defer: options.defer,
  });
  if (!options.skipInitialize) await studio.initialize();
  const ecosystems = new Ecosystems(store);
  const translator = new Translator();
  const token = options.authenticated ? '' : process.env.STUDIO_API_TOKEN || '';
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Cache-Control', 'no-store');
    const json = (obj, status = 200) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(obj));
    };
    try {
      const url = new URL(req.url, 'http://localhost');
      const path = url.pathname;
      const method = req.method;
      // The private API rejects cross-origin browser calls; n8n uses server-to-server auth.
      const origin = req.headers.origin;
      const localHost = req.headers.host;
      if (
        !token &&
        !options.authenticated &&
        !['localhost', '127.0.0.1', '[::1]'].includes(new URL(`http://${localHost}`).hostname)
      )
        throw error('Host không được phép', 403);
      if (origin && new URL(origin).host !== localHost) throw error('Origin không được phép', 403);
      if (path === '/api/config' && method === 'GET') return json({ auth: 'local' });
      if (path.startsWith('/api/') && token) {
        const given = (req.headers.authorization || '').replace(/^Bearer /, '');
        const x = Buffer.from(given),
          y = Buffer.from(token);
        if (x.length !== y.length || !timingSafeEqual(x, y)) throw error('Cần API token', 401);
      }
      if (path.startsWith('/api/') && !['GET', 'POST', 'PATCH', 'DELETE'].includes(method))
        throw error('Method không được hỗ trợ', 405);
      let body = {};
      if (['POST', 'PATCH'].includes(method)) {
        if (!String(req.headers['content-type']).startsWith('application/json'))
          throw error('Yêu cầu Content-Type application/json', 415);
        let raw = '';
        for await (const chunk of req) {
          raw += chunk;
          if (Buffer.byteLength(raw) > 250000) throw error('Nội dung quá lớn', 413);
        }
        try {
          body = JSON.parse(raw || '{}');
        } catch {
          throw error('JSON không hợp lệ');
        }
        if (!body || Array.isArray(body) || typeof body !== 'object')
          throw error('Cần JSON object');
      }
      if (path === '/api/health' && method === 'GET')
        return json({
          status: 'ok',
          database: store.remote ? 'supabase' : 'sqlite',
          ai_configured: Boolean(studio.config.openaiKey),
          model: studio.config.model,
          portfolio_configured: Boolean(studio.config.portfolioUrl),
          scheduler_minutes: options.serverless
            ? 1440
            : Number(process.env.INGEST_INTERVAL_MINUTES || 0),
        });
      if (path === '/api/state' && method === 'GET') {
        const kinds = ['event', 'source', 'case', 'analysis', 'job', 'ecosystem'];
        const values = await Promise.all(kinds.map((k) => store.all(k)));
        // Full job results remain at /api/jobs/:id; the dashboard needs only summaries.
        values[4] = values[4].slice(0, 30).map((j) => ({
          ...j,
          result: j.result ? { inserted: j.result.inserted, matched: j.result.matched } : undefined,
        }));
        const articles = new Map((await store.all('article')).map((a) => [a.id, a]));
        values[0] = values[0].map((e) => ({
          ...e,
          primary_source:
            e.article_ids.map((id) => articles.get(id)?.source_name).find(Boolean) || '',
          primary_url: e.article_ids.map((id) => articles.get(id)?.url).find(Boolean) || null,
          primary_language:
            e.article_ids
              .map((id) => {
                const a = articles.get(id);
                return a?.language || SOURCES.find((s) => s.id === a?.source_id)?.language;
              })
              .find(Boolean) || '',
        }));
        return json({
          ...Object.fromEntries(
            kinds.map((k, i) => [k === 'analysis' ? 'analyses' : `${k}s`, values[i]]),
          ),
          profile: await store.get('profile', 'personal'),
        });
      }
      if (path === '/api/events' && method === 'GET') {
        let events = await store.all('event');
        const q = (url.searchParams.get('q') || '').toLowerCase();
        const topic = url.searchParams.get('topic');
        const from = url.searchParams.get('from');
        const to = url.searchParams.get('to');
        events = events.filter(
          (e) =>
            (!q.trim() || matchesSearch(e, q)) &&
            (!topic || e.topic === topic) &&
            (!from || (e.published_at || '') >= from) &&
            (!to || (e.published_at || '') <= to),
        );
        return json(events);
      }
      let match = path.match(/^\/api\/events\/([^/]+)(\/graph)?$/);
      if (match && method === 'GET')
        return json(match[2] ? await studio.graph(match[1]) : await studio.detail(match[1]));
      if (match && method === 'PATCH') {
        const e = await studio.required('event', match[1]);
        if (typeof body.bookmarked !== 'boolean') throw error('bookmarked phải là boolean');
        return json(await store.put('event', { ...e, bookmarked: body.bookmarked }));
      }
      if (path === '/api/ingest' && method === 'POST') return json(await studio.ingest(), 202);
      if (path === '/api/translate' && method === 'POST')
        return json(await translator.translate(body.text, body.source));
      if (path === '/api/search-news' && method === 'POST') {
        if (
          typeof body.query !== 'string' ||
          body.query.trim().length < 2 ||
          body.query.trim().length > 160 ||
          !SEARCH_DAYS.includes(body.days ?? 7)
        )
          throw error('Cần từ khóa 2–160 ký tự và khoảng thời gian được hỗ trợ (tối đa 5 năm)');
        const languages = validateLanguages(body.languages);
        return json(
          await studio.job('search', () =>
            studio.search(body.query.trim(), body.days ?? 7, languages),
          ),
          202,
        );
      }
      if (path === '/api/ecosystems' && method === 'POST')
        return json(await ecosystems.create(body), 201);
      let eco = path.match(/^\/api\/ecosystems\/([^/]+)(?:\/(members|links)(?:\/([^/]+))?)?$/);
      if (eco) {
        const [, id, action, item] = eco;
        if (!action && method === 'GET') return json(await ecosystems.required(id));
        if (!action && method === 'PATCH') return json(await ecosystems.rename(id, body.name));
        if (action === 'members' && method === 'POST')
          return json(await ecosystems.add(id, body.event_id));
        if (action === 'members' && item && method === 'DELETE')
          return json(await ecosystems.remove(id, item));
        if (action === 'links' && method === 'POST' && !item)
          return json(await ecosystems.link(id, body), 201);
        if (action === 'links' && item && method === 'PATCH')
          return json(await ecosystems.link(id, body, item));
        if (action === 'links' && item && method === 'DELETE')
          return json(await ecosystems.unlink(id, item));
      }
      if (path === '/api/demo' && method === 'POST') return json(await studio.seedDemo());
      match = path.match(/^\/api\/jobs\/([^/]+)$/);
      if (match && method === 'GET') return json(await studio.required('job', match[1]));
      match = path.match(/^\/api\/sources\/([^/]+)$/);
      if (match && method === 'PATCH') {
        const s = await studio.required('source', match[1]);
        if (typeof body.enabled !== 'boolean' || !SOURCES.some((x) => x.id === s.id))
          throw error('Nguồn không hợp lệ');
        return json(await store.put('source', { ...s, enabled: body.enabled }));
      }
      if (path === '/api/profile' && method === 'PATCH') {
        const p = await store.get('profile', 'personal');
        for (const f of ['role', 'goal', 'topics', 'difficulty', 'language'])
          if (typeof body[f] !== 'string' || body[f].length > 2000)
            throw error(`Trường ${f} không hợp lệ`);
        if (!Number.isInteger(body.duration) || body.duration < 15 || body.duration > 240)
          throw error('Thời gian từ 15 đến 240 phút');
        return json(
          await store.put('profile', {
            ...p,
            ...Object.fromEntries(
              ['role', 'goal', 'topics', 'difficulty', 'duration', 'language'].map((f) => [
                f,
                body[f],
              ]),
            ),
          }),
        );
      }
      if (path === '/api/cases' && method === 'POST') {
        await studio.required('event', body.event_id);
        if (body.mode === 'ai' && !studio.config.openaiKey)
          throw error(
            'Chưa cấu hình OPENAI_API_KEY; dùng chế độ theo mẫu hoặc cấu hình ở máy chủ.',
            409,
          );
        return json(await studio.job('case', () => studio.createCase(body)), 202);
      }
      match = path.match(/^\/api\/cases\/([^/]+)$/);
      if (match && method === 'GET') return json(await studio.required('case', match[1]));
      if (path === '/api/analyses' && method === 'POST')
        return json(await studio.createAnalysis(body.case_id), 201);
      match = path.match(/^\/api\/analyses\/([^/]+)(\/(review|publish|pdf))?$/);
      if (match) {
        const id = match[1],
          action = match[3];
        if (method === 'GET' && !action) return json(await studio.required('analysis', id));
        if (method === 'PATCH' && !action) return json(await studio.saveAnalysis(id, body));
        if (method === 'POST' && action === 'review') {
          if (!studio.config.openaiKey)
            throw error('Chưa cấu hình OPENAI_API_KEY để phản biện.', 409);
          return json(await studio.job('review', () => studio.review(id)), 202);
        }
        if (method === 'POST' && action === 'publish') return json(await studio.publish(id, body));
        if (method === 'GET' && action === 'pdf') {
          const a = await studio.required('analysis', id),
            c = await studio.required('case', a.case_id);
          const pdf = await pdfBuffer(a, c.evidence);
          res.writeHead(200, {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="analysis-${id}.pdf"`,
          });
          return res.end(pdf);
        }
      }
      if (path === '/api/relationships' && method === 'POST') {
        if (!['hypothesis', 'reported', 'confirmed'].includes(body.status))
          throw error('Trạng thái quan hệ không hợp lệ');
        const a = await studio.detail(body.from),
          b = await studio.detail(body.to);
        if (a.id === b.id || a.is_demo !== b.is_demo) throw error('Hai sự kiện không hợp lệ');
        if (
          typeof body.label !== 'string' ||
          !body.label.trim() ||
          typeof body.reason !== 'string' ||
          !body.reason.trim()
        )
          throw error('Cần loại quan hệ và giải thích');
        if (
          !Array.isArray(body.evidence_ids) ||
          !body.evidence_ids.length ||
          !body.evidence_ids.every((id) => [...a.article_ids, ...b.article_ids].includes(id))
        )
          throw error('Cần bằng chứng từ hai sự kiện');
        return json(
          await store.put('relationship', {
            id: randomUUID(),
            from: a.id,
            to: b.id,
            label: body.label.slice(0, 120),
            reason: body.reason.slice(0, 2000),
            status: body.status,
            evidence_ids: body.evidence_ids,
            created_at: new Date().toISOString(),
          }),
          201,
        );
      }
      if (path === '/api/export' && method === 'GET') {
        res.setHeader('Content-Disposition', 'attachment; filename="research-backup.json"');
        const kinds = [
          'source',
          'article',
          'event',
          'entity',
          'relationship',
          'ecosystem',
          'case',
          'analysis',
          'profile',
          'job',
        ];
        return json({
          version: 1,
          exported_at: new Date().toISOString(),
          records: Object.fromEntries(
            await Promise.all(kinds.map(async (k) => [k, await store.all(k)])),
          ),
        });
      }
      if (path === '/api/portfolio' && method === 'GET')
        return json(
          (await store.all('analysis'))
            .filter((a) => a.status === 'published')
            .map((a) => ({
              id: a.id,
              title: a.published_snapshot.title,
              is_demo: a.is_demo,
              published_at: a.published_at,
              url: `/portfolio/${a.id}`,
            })),
        );
      if (path.startsWith('/api/')) throw error('Endpoint không tồn tại', 404);
      match = path.match(/^\/portfolio\/([^/]+)$/);
      if (match && method === 'GET') {
        const a = await studio.required('analysis', match[1]);
        if (a.status !== 'published') throw error('Bài chưa xuất bản', 404);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(page(a));
      }
      if (method !== 'GET' && method !== 'HEAD') throw error('Method không được hỗ trợ', 405);
      const file = resolve(
        ROOT,
        'dist',
        `.${path === '/' ? '/index.html' : decodeURIComponent(path)}`,
      );
      if (
        !file.startsWith(resolve(ROOT, 'dist') + '/') &&
        !file.startsWith(resolve(ROOT, 'dist') + '\\')
      )
        throw error('Không được phép', 403);
      const info = await stat(file).catch(() => null);
      if (!info?.isFile()) throw error('Không tìm thấy trang', 404);
      const types = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.svg': 'image/svg+xml',
      };
      res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
      res.end(method === 'HEAD' ? '' : await readFile(file));
    } catch (e) {
      json(
        {
          error: e.status ? e.message : 'Tác vụ thất bại. Kiểm tra cấu hình máy chủ.',
          ...(process.env.NODE_ENV !== 'production' ? { detail: e.message } : {}),
        },
        e.status || 500,
      );
    }
  });
  return { server, store, studio };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const host = process.env.HOST || '127.0.0.1';
  if (!['127.0.0.1', 'localhost', '::1'].includes(host) && !process.env.STUDIO_API_TOKEN)
    throw new Error('Cấu hình STUDIO_API_TOKEN trước khi mở máy chủ ra mạng');
  const { server, store, studio } = await createServer();
  const port = Number(process.env.PORT || 4318);
  server.listen(port, host, () => console.log(`Research Studio: http://${host}:${port}`));
  const minutes = Number(process.env.INGEST_INTERVAL_MINUTES || 0);
  const timer =
    minutes >= 15
      ? setInterval(() => studio.ingest().catch((e) => console.error(e.message)), minutes * 60000)
      : null;
  const stop = () => {
    if (timer) clearInterval(timer);
    server.close(() => {
      store.close();
      process.exit(0);
    });
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
