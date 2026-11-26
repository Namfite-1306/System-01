import { createClient } from '@supabase/supabase-js';
import { createServer } from '../server.mjs';
import { Store, UserStore } from './store.mjs';
import { Studio, error } from './service.mjs';
import { timingSafeEqual } from 'node:crypto';

export function hostedConfig(env = process.env) {
  const url = env.SUPABASE_URL || 'https://ozxiphcwcgpwukffehlt.supabase.co';
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || '';
  if (
    !publishableKey ||
    (!publishableKey.startsWith('sb_publishable_') && publishableKey.split('.').length !== 3)
  )
    throw error('Thiếu SUPABASE_PUBLISHABLE_KEY trên Vercel.', 503);
  return { url, publishableKey };
}

function client(config) {
  return createClient(config.url, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function handleHosted(req, res, { defer, env = process.env } = {}) {
  const send = (data, status = 200) => {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(JSON.stringify(data));
  };
  try {
    const config = hostedConfig(env);
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path === '/api/config' && req.method === 'GET')
      return send({
        auth: 'supabase',
        supabaseUrl: config.url,
        supabaseKey: config.publishableKey,
      });

    if (path === '/api/cron' && req.method === 'GET') {
      const given = Buffer.from(req.headers.authorization || '');
      const expected = Buffer.from(`Bearer ${env.CRON_SECRET || ''}`);
      if (!env.CRON_SECRET || given.length !== expected.length || !timingSafeEqual(given, expected))
        throw error('Cần xác thực lịch RSS.', 401);
      if (!env.SUPABASE_SERVICE_ROLE_KEY)
        throw error('Thiếu SUPABASE_SERVICE_ROLE_KEY cho lịch RSS.', 503);
      const store = new Store({
        supabaseUrl: config.url,
        supabaseKey: env.SUPABASE_SERVICE_ROLE_KEY,
        table: 'research_feed_records',
      });
      const studio = new Studio(store, { serverless: true });
      await studio.initialize();
      return send(await studio.collect());
    }

    if (/^\/portfolio\/[^/]+$/.test(path) && req.method === 'GET') {
      const supabase = client(config);
      const store = {
        remote: true,
        get: async (kind, id) => {
          if (kind !== 'analysis') return null;
          const { data, error: failed } = await supabase.rpc('research_published_analysis', {
            analysis_id: id,
          });
          if (failed) throw error('Không tải được bài đã xuất bản.', 502);
          return data;
        },
      };
      const { server } = await createServer({
        store,
        authenticated: true,
        serverless: true,
        skipInitialize: true,
      });
      return await server.listeners('request')[0](req, res);
    }

    const accessToken = (req.headers.authorization || '').replace(/^Bearer /i, '');
    if (!accessToken) throw error('Hãy đăng nhập để mở không gian nghiên cứu.', 401);
    const { data, error: authError } = await client(config).auth.getUser(accessToken);
    if (authError || !data.user) throw error('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.', 401);
    const store = new UserStore({
      supabaseUrl: config.url,
      supabaseKey: config.publishableKey,
      accessToken,
      ownerId: data.user.id,
    });
    const { server } = await createServer({ store, authenticated: true, serverless: true, defer });
    return await server.listeners('request')[0](req, res);
  } catch (failure) {
    console.error('Hosted request failed', failure.status || 500, failure.message);
    if (!res.headersSent)
      send(
        {
          error: failure.status
            ? failure.message
            : 'Không kết nối được dữ liệu. Kiểm tra cấu hình Supabase.',
        },
        failure.status || 500,
      );
  }
}
