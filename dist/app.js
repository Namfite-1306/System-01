import { LANGUAGES, sourceLanguage } from './languages.js';
import { initUILanguage, uiLocale, translateUI } from './ui-language.js';
import { initTranslation } from './translation.js';
import { ecosystemView, bindEcosystems } from './ecosystems.js';
import { bindGraph } from './graph.js';
import { esc, matchesSearch, wordCount, markdownPreview } from './ui-utils.js';
import { createApi } from './api.js';
const confirm = (message) => window.confirm(translateUI(message));
const prompt = (message, value) => window.prompt(translateUI(message), value);
const $ = (s) => document.querySelector(s);
const date = (s) =>
  s
    ? new Date(s).toLocaleDateString(uiLocale(), {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : 'Chưa rõ ngày';
const labels = {
  events: 'Bàn tin tức',
  timeline: 'Dòng sự kiện',
  graph: 'Bản đồ liên kết',
  ecosystems: 'Hệ sinh thái',
  cases: 'Case & brief',
  analyses: 'Bài viết',
  portfolio: 'Portfolio',
  settings: 'Nguồn & thiết lập',
};
let state = { events: [], sources: [], cases: [], analyses: [], jobs: [], profile: {} },
  health = {},
  page = location.hash.slice(1) || 'events',
  topic = 'Tất cả',
  query = '',
  showDemo = false,
  bookmarkedOnly = false,
  graphId = '',
  selectedCase = '',
  selectedAnalysis = '',
  dirty = false,
  toastTimer;
let renderVersion = 0;
const canLeave = () => !dirty || confirm('Có thay đổi chưa lưu. Rời trang và bỏ thay đổi?');
const draftKey = (id) => `studio-draft:${id}`;
function rememberDraft() {
  try {
    sessionStorage.setItem(
      draftKey(selectedAnalysis),
      JSON.stringify({
        title: $('#analysis-title').value,
        body: $('#analysis-body').value,
        revision: state.analyses.find((a) => a.id === selectedAnalysis)?.revision,
      }),
    );
  } catch {
    toast('Không lưu được bản khôi phục trong trình duyệt. Hãy lưu bản nháp.', true);
  }
}

let workTrack = sessionStorage.getItem('work-track') || 'consulting';
const trackName = (t) => (t === 'copywriting' ? 'Copywriting' : 'Consulting');
let visibleCount = 20,
  period = 'all',
  remoteSearch = null,
  newsKeyword = '',
  newsDays = 1827,
  newsLanguage = 'vi-en',
  libraryLanguage = 'all',
  searchPending = false,
  searchError = '';
const timestamp = (s) =>
  s
    ? new Date(s).toLocaleString(uiLocale(), {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Chưa cập nhật';
let token = sessionStorage.getItem('studio-token') || '';
const api = createApi({
  getToken: () => token,
  setToken: (value) => {
    token = value;
    sessionStorage.setItem('studio-token', value);
  },
  requestToken: () => prompt('Nhập STUDIO_API_TOKEN để kết nối (chỉ lưu trong phiên này):'),
});
initTranslation(api);
initUILanguage();
function toast(text, bad = false) {
  $('#toast').textContent = text;
  $('#toast').className = `visible${bad ? ' error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($('#toast').className = ''), 6000);
}
async function refresh() {
  const [s, h] = await Promise.all([api('/state'), api('/health')]);
  state = s;
  health = h;
  $('#connection').textContent =
    h.database === 'sqlite' ? 'SQLite · Đã kết nối' : 'Supabase · Đã kết nối';
  $('#event-count').textContent = state.events.length;
  $('#case-count').textContent = state.cases.length;
}
function filtered() {
  return state.events
    .filter(
      (e) =>
        (!remoteSearch || remoteSearch.event_ids.includes(e.id)) &&
        (topic === 'Tất cả' || e.topic === topic) &&
        (libraryLanguage === 'all' || sourceLanguage(e) === libraryLanguage) &&
        (!query.trim() || matchesSearch(e, query)) &&
        (period === 'all' ||
          new Date(e.published_at || e.created_at).getTime() >=
            Date.now() - Number(period) * 86400000) &&
        (showDemo || !e.is_demo) &&
        (!bookmarkedOnly || e.bookmarked),
    )
    .sort((a, b) => (b.published_at || b.created_at).localeCompare(a.published_at || a.created_at));
}
const tag = (e) =>
  `<span class="tag ${e.topic === 'Thế giới' ? 'world' : ''}">${esc(e.topic)}</span>${e.is_demo ? '<span class="tag demo">Mẫu</span>' : ''}`;
function heading(eyebrow, title, description, actions = '') {
  return `<div class="page-head"><div>${eyebrow ? '<div class="eyebrow">' + eyebrow + '</div>' : ''}<h1>${title}</h1><p>${description}</p></div><div class="head-actions">${actions}</div></div>`;
}
function empty(title, text, actions = '') {
  return `<div class="empty"><span style="font-size:32px;color:#9eb49b">◫</span><h2>${title}</h2><p>${text}</p>${actions}</div>`;
}
function eventCard(e) {
  return `<article class="news-card" data-language="${esc(sourceLanguage(e))}"><button class="bookmark ${e.bookmarked ? 'saved' : ''}" data-bookmark="${e.id}" aria-label="${e.bookmarked ? 'Bỏ lưu' : 'Lưu'} sự kiện">${e.bookmarked ? '◆' : '◇'}</button><div class="news-meta">${tag(e)}${sourceLanguage(e) ? `<span class="language-tag">${LANGUAGES[sourceLanguage(e)]}</span>` : ''}<span>${esc(e.primary_source || 'Nguồn RSS')} · ${date(e.published_at)} · ${e.article_ids.length} nguồn</span></div><h3>${e.primary_url ? `<a href="${esc(e.primary_url)}" target="_blank" rel="noopener noreferrer" title="Mở bài báo trong tab mới">${esc(e.title)} ↗</a>` : `<button data-detail="${e.id}">${esc(e.title)}</button>`}</h3><p lang="${esc(sourceLanguage(e) || '')}">${esc(e.summary)}</p><div class="card-bottom"><div class="chips"><button class="card-action" data-detail="${e.id}">Hồ sơ nguồn</button><span class="chip">${e.is_demo ? 'Tình huống giả lập' : 'Nguồn RSS'}</span>${e.entity_ids.length ? `<span class="chip">${e.entity_ids.length} thực thể / chủ đề</span>` : ''}</div><button class="btn small" data-add-ecosystem="${e.id}">＋ Thêm vào hệ sinh thái</button><button class="btn soft small" data-case-event="${e.id}">${workTrack === 'copywriting' ? 'Tạo content brief ↗' : 'Tạo consulting case ↗'}</button></div></article>`;
}
function sourceRows() {
  return state.sources
    .map(
      (s) =>
        `<div class="source-row"><span class="source-logo">${esc((s.language || '?').toUpperCase())}</span><div>${esc(s.name)}<small><span>${esc(LANGUAGES[s.language] || '')}</span> · <span>${s.last_checked ? `Cập nhật: ${timestamp(s.last_checked)}` : s.enabled ? 'Sẵn sàng lấy RSS' : 'Đã tắt'}</span></small></div><span class="dot ${s.last_status === 'error' ? 'error' : ''}" title="${esc(s.last_error || 'Nguồn RSS')}"></span></div>`,
    )
    .join('');
}
function toolbar() {
  return `<div class="toolbar"><div class="tabs">${['Tất cả', 'Kinh tế', 'Kinh doanh', 'Thế giới', 'Tin tìm kiếm'].map((t) => `<button class="tab ${topic === t ? 'active' : ''}" data-topic="${t}" aria-pressed="${topic === t}">${t}</button>`).join('')}</div><label class="language-picker" for="library-language">Nguồn tin<select id="library-language">${languageOptions(libraryLanguage)}</select></label><div class="search"><span>⌕</span><input id="search" placeholder="Lọc tin đã lưu…" value="${esc(query)}" aria-label="Tìm kiếm sự kiện"></div></div><div class="filter-options"><label for="period">Thời gian</label><select id="period">${[
    ['all', 'Tất cả thời gian'],
    ['1', '24 giờ qua'],
    ['7', '7 ngày qua'],
    ['30', '30 ngày qua'],
    ['365', '1 năm qua'],
    ['1827', '5 năm gần nhất'],
  ]
    .map(([v, l]) => `<option value="${v}" ${period === v ? 'selected' : ''}>${l}</option>`)
    .join(
      '',
    )}</select><button class="btn small" id="reset-filters">Xóa bộ lọc</button></div><p class="translation-hint">Bôi đen một từ hoặc đoạn ngắn trong tin để dịch sang tiếng Anh.</p><div class="feed-label"><span>${filtered().length} ${remoteSearch ? 'kết quả tìm kiếm' : 'tin trong thư viện'} · ${bookmarkedOnly ? 'đã lưu' : 'mới nhất trước'}</span><div><label><input id="show-demo" type="checkbox" ${showDemo ? 'checked' : ''}> Hiện mẫu</label> <button class="card-action" id="saved-filter" aria-pressed="${bookmarkedOnly}">${bookmarkedOnly ? 'Hiện tất cả' : '◇ Đã lưu'}</button></div></div>`;
}
function workModeBar() {
  return `<section class="work-mode"><div><h2>${workTrack === 'copywriting' ? 'Từ insight đến nội dung thuyết phục' : 'Từ dữ kiện đến khuyến nghị kinh doanh'}</h2><p>${workTrack === 'copywriting' ? 'Xây brief, hook, thông điệp và CTA từ nguồn đáng tin cậy.' : 'Luyện cấu trúc vấn đề, phân tích định lượng và giao tiếp với lãnh đạo.'}</p></div><div class="mode-tabs" role="group" aria-label="Hướng làm việc"><button data-track="consulting" aria-pressed="${workTrack === 'consulting'}">Consulting</button><button data-track="copywriting" aria-pressed="${workTrack === 'copywriting'}">Copywriting</button></div></section>`;
}
function languageOptions(selected, search = false) {
  const entries = search
    ? [['vi-en', 'Việt + Anh'], ['all', 'Tất cả 6 ngôn ngữ'], ...Object.entries(LANGUAGES)]
    : [['all', 'Tất cả ngôn ngữ'], ...Object.entries(LANGUAGES)];
  return entries
    .map(
      ([v, label]) => `<option value="${v}" ${v === selected ? 'selected' : ''}>${label}</option>`,
    )
    .join('');
}
function newsSearchPanel() {
  return `<section class="news-search-panel"><div><h2>Tìm tin mới theo từ khóa</h2><p>Tìm tin từ 6 ngôn ngữ. Hãy dùng từ khóa phù hợp với ngôn ngữ nguồn (ví dụ: 黑石 cho Blackstone). Chỉ lưu bài có đủ từ khóa trong tiêu đề hoặc mô tả, xếp mới nhất trước. Tìm 5 năm được chia theo từng năm, tối đa 400 bài; không phải kho báo chí đầy đủ.</p></div><form id="news-search-form" aria-busy="${searchPending}"><input id="news-keyword" aria-label="Từ khóa tìm tin mới" placeholder="Ví dụ: ngân hàng Việt Nam" minlength="2" maxlength="160" required value="${esc(newsKeyword)}" ${searchPending ? 'disabled' : ''}><label class="language-picker" for="news-language">Nguồn tìm kiếm<select id="news-language" ${searchPending ? 'disabled' : ''}>${languageOptions(newsLanguage, true)}</select></label><select id="news-days" aria-label="Khoảng thời gian tìm tin" ${searchPending ? 'disabled' : ''}>${[
    [1, '24 giờ qua'],
    [7, '7 ngày qua'],
    [30, '30 ngày qua'],
    [90, '3 tháng qua'],
    [365, '1 năm qua'],
    [1827, '5 năm gần nhất'],
  ]
    .map(([v, l]) => `<option value="${v}" ${newsDays === v ? 'selected' : ''}>${l}</option>`)
    .join(
      '',
    )}</select><button class="btn primary" type="submit" ${searchPending ? 'disabled' : ''}>${searchPending ? 'Đang tìm và lưu…' : 'Tìm & lưu tin mới'}</button></form><div class="search-feedback" role="status" aria-live="polite">${searchPending ? '<p>Đang lấy tin mới. Bạn có thể tiếp tục xem thư viện trong lúc chờ.</p>' : searchError ? `<p class="error-text">${esc(searchError)} Bạn có thể thử lại.</p>` : remoteSearch ? `<div class="search-result-note">Đang xem kết quả cho <strong>“${esc(remoteSearch.query)}”</strong> · ${remoteSearch.days === 1 ? '24 giờ' : remoteSearch.days === 1827 ? '5 năm' : remoteSearch.days + ' ngày'}<br>${remoteSearch.matched} bài khớp từ khóa · ${remoteSearch.inserted} bài mới lưu · ${Math.max(0, remoteSearch.matched - remoteSearch.inserted)} bài đã có trong thư viện.${remoteSearch.search_report ? `<br>${remoteSearch.search_report.excluded} kết quả không được giữ (không khớp từ khóa, trùng, ngoài thời gian hoặc vượt giới hạn).${remoteSearch.search_report.partial ? ' Một nguồn ngôn ngữ lỗi; kết quả chưa đầy đủ.' : ''}` : ''}<br><button class="btn small" id="clear-remote-search">Xem toàn bộ thư viện</button></div>` : ''}</div></section>`;
}
function workflowSteps() {
  return (
    '<div class="workflow-steps" aria-label="Quy trình nghiên cứu">' +
    [
      ['events', '01', 'Đọc tin'],
      ['cases', '02', 'Tạo case'],
      ['analyses', '03', 'Viết bài'],
      ['portfolio', '04', 'Xuất bản'],
    ]
      .map(
        ([p, n, t]) =>
          `<button data-page="${p}" class="${page === p ? 'current' : ''}"><span>${n}</span>${t}<b>→</b></button>`,
      )
      .join('') +
    '</div>'
  );
}
function restoreDraftNotice() {
  const a = state.analyses.find((a) => a.id === selectedAnalysis);
  if (page !== 'analyses' || !a || !$('#analysis-body')) return;
  let cached;
  try {
    cached = JSON.parse(sessionStorage.getItem(draftKey(a.id)) || 'null');
  } catch {
    return;
  }
  if (!cached || (cached.body === a.body && cached.title === a.title)) return;
  const panel = document.createElement('div');
  panel.className = 'notice';
  panel.innerHTML =
    '<strong>Có bản viết chưa lưu trong phiên này.</strong> Khôi phục để tiếp tục hoặc bỏ bản tạm. <button class="btn small" id="restore-draft">Khôi phục</button> <button class="btn small" id="discard-draft">Bỏ bản tạm</button>';
  $('.editor').prepend(panel);
  $('#restore-draft').onclick = () => {
    $('#analysis-title').value = cached.title;
    $('#analysis-body').value = cached.body;
    dirty = true;
    $('#save-status').textContent = 'Đã khôi phục · Chưa lưu';
    panel.remove();
  };
  $('#discard-draft').onclick = () => {
    sessionStorage.removeItem(draftKey(a.id));
    panel.remove();
  };
}
function nextStepPanel() {
  const draft = state.analyses.find(
    (a) =>
      a.status === 'draft' &&
      (a.track || state.cases.find((c) => c.id === a.case_id)?.track || 'consulting') === workTrack,
  );
  return `<div class="focus-panel"><h2>${draft ? 'Tiếp tục bản nháp' : 'Chọn một tin để bắt đầu'}</h2><p>${draft ? esc(draft.title) : 'Đọc bài gốc, kiểm tra nguồn rồi tạo case hoặc content brief.'}</p>${draft ? `<button class="btn primary small" data-open-analysis="${draft.id}">Tiếp tục viết ↗</button>` : '<button class="btn soft small" data-page="cases">Mở case & brief ↗</button>'}</div>`;
}
function eventsPage() {
  const events = filtered(),
    real = state.events.filter((e) => !e.is_demo),
    enabled = state.sources.filter((s) => s.enabled).length;
  return (
    heading(
      '',
      'Bàn tin tức',
      'Chọn tin đáng chú ý, kiểm tra nguồn và biến thành bài phân tích của bạn.',
      `<button class="btn" data-page="settings">⚙ Nguồn tin</button><button class="btn primary" id="ingest">↻ Lấy tin mới</button>`,
    ) +
    workModeBar() +
    `<details class="search-discovery" ${remoteSearch || searchPending || searchError ? 'open' : ''}><summary>Tìm thêm tin từ Internet <span>Google News · 6 ngôn ngữ</span></summary>${newsSearchPanel()}</details>` +
    `<details class="workspace-overview"><summary>Tổng quan thư viện · ${real.length} tin · ${state.cases.length} case · ${state.analyses.length} bài viết</summary>${workflowSteps()}<div class="stats"><div class="stat"><span class="icon">◫</span><span class="stat-label">Sự kiện từ nguồn thật</span><strong>${real.length}</strong><small>${state.events.filter((e) => e.is_demo).length} tình huống mẫu riêng biệt</small></div><div class="stat"><span class="icon">⌘</span><span class="stat-label">Nguồn đang theo dõi</span><strong>${enabled.toString().padStart(2, '0')}</strong><small><b>RSS</b> · kinh tế & thế giới</small></div><div class="stat"><span class="icon">▤</span><span class="stat-label">Case trong thư viện</span><strong>${state.cases.length.toString().padStart(2, '0')}</strong><small>Đề bài có thời điểm chốt dữ liệu</small></div><div class="stat"><span class="icon">✎</span><span class="stat-label">Bài phân tích cá nhân</span><strong>${state.analyses.length.toString().padStart(2, '0')}</strong><small><b>${state.analyses.filter((a) => a.status === 'published').length} đã xuất bản</b> trong portfolio local</small></div></div></details><div class="content-grid"><section>${toolbar()}<div class="feed">${events.length ? events.slice(0, visibleCount).map(eventCard).join('') + (events.length > visibleCount ? '<button class="btn" id="load-more">Hiện thêm sự kiện ↓</button>' : '') : empty(state.events.length ? 'Không có tin khớp bộ lọc' : 'Chưa có tin tức', remoteSearch?.matched === 0 ? 'Không có bài nhắc đủ từ khóa trong khoảng thời gian này. Thử 30 ngày hoặc từ khóa khác.' : state.events.length ? 'Thử đổi từ khóa, thời gian hoặc bỏ lọc tin đã lưu.' : 'Nhấn Lấy tin mới để cập nhật từ các nguồn RSS.', state.events.length ? '<button class="btn primary" id="empty-reset">Xóa bộ lọc</button>' : '<button class="btn primary" id="empty-ingest">Lấy tin mới</button>')}</div></section><aside class="right-rail">${nextStepPanel()}<div class="panel"><div class="panel-heading"><h2>Nguồn theo dõi</h2><button class="card-action" data-page="settings">Quản lý</button></div>${sourceRows()}</div><div class="panel"><div class="panel-heading"><h2>Nhịp nghiên cứu</h2></div><ol class="rail-note"><li>Chọn một diễn biến đáng chú ý</li><li>Đặt câu hỏi và kiểm tra nguồn</li><li>Phân tích, xây dựng kịch bản</li><li>Xuất bản góc nhìn của bạn</li></ol></div></aside></div>`
  );
}
function timelinePage() {
  return (
    heading(
      'THEO DÕI DIỄN BIẾN',
      'Dòng sự kiện',
      'Sắp xếp theo ngày đăng bài. Ngày xảy ra sự kiện được lưu riêng và có thể chưa xác định.',
    ) +
    toolbar() +
    `<section class="timeline">${
      filtered().length
        ? filtered()
            .slice(0, visibleCount)
            .map(
              (e) =>
                `<div class="timeline-item"><div class="timeline-date">${date(e.published_at)}</div>${eventCard(e)}</div>`,
            )
            .join('') +
          (filtered().length > visibleCount
            ? '<button class="btn" id="load-more">Hiện thêm sự kiện ↓</button>'
            : '')
        : empty('Chưa có dòng sự kiện', 'Lấy tin từ bàn tin tức để bắt đầu.')
    }</section>`
  );
}
async function graphPage() {
  if (!state.events.length)
    return (
      heading(
        'KHÁM PHÁ LIÊN HỆ',
        'Bản đồ liên kết',
        'Khám phá sự kiện qua các thực thể và chủ đề chung.',
      ) + empty('Chưa có sự kiện', 'Thêm tin thật hoặc tình huống mẫu từ bàn tin tức.')
    );
  if (!state.events.some((e) => e.id === graphId))
    graphId =
      (
        filtered().find((e) => e.entity_ids.length >= 2) ||
        filtered().find((e) => e.entity_ids.length) ||
        filtered()[0]
      )?.id || state.events[0].id;
  const g = await api(`/events/${graphId}/graph`);
  const nodes = g.nodes;
  const coords = {};
  const center = nodes.find((n) => n.center);
  coords[center.id] = { x: 420, y: 265 };
  const entities = nodes.filter((n) => n.type !== 'event');
  const related = nodes.filter((n) => n.type === 'event' && !n.center);
  entities.forEach((n, i) => {
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / Math.max(entities.length, 1);
    coords[n.id] = { x: 420 + Math.cos(angle) * 145, y: 265 + Math.sin(angle) * 130 };
  });
  related.forEach((n, i) => {
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / Math.max(related.length, 1);
    coords[n.id] = { x: 420 + Math.cos(angle) * 305, y: 265 + Math.sin(angle) * 220 };
  });
  const lines = g.edges
    .map((e) => {
      const a = coords[e.from],
        b = coords[e.to];
      if (!a || !b) return '';
      return `<line data-from="${e.from}" data-to="${e.to}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${e.status === 'hypothesis' ? '#c6a367' : e.status === 'confirmed' ? '#21775f' : '#cedbcc'}" stroke-width="${e.status === 'association' ? 1.3 : 2}" ${e.status === 'hypothesis' ? 'stroke-dasharray="6 5"' : ''}><title>${esc(e.label)}${e.reason ? `: ${esc(e.reason)}` : ''}</title></line>`;
    })
    .join('');
  const circles = nodes
    .map((n) => {
      const { x, y } = coords[n.id];
      const r = n.center ? 38 : n.type === 'event' ? 23 : 27;
      const text = n.label.length > 24 ? n.label.slice(0, 23) + '…' : n.label;
      return `<g data-node-id="${n.id}" data-x="${x}" data-y="${y}" transform="translate(${x},${y})" tabindex="0" role="button" aria-label="${esc(n.label)}" ${n.type === 'event' ? `data-detail="${n.id}"` : `data-entity="${esc(n.label)}"`}><circle r="${r}" fill="${n.center ? '#193e35' : n.type === 'event' ? '#e4ecdf' : '#b7cd9e'}" stroke="${n.center ? '#193e35' : '#8eac82'}" stroke-width="1.5"/><text text-anchor="middle" y="5" font-size="${n.center ? 17 : 13}" fill="${n.center ? '#fff' : '#395e43'}">${n.center ? '◫' : n.type === 'event' ? '◫' : '⌘'}</text><rect x="-91" y="${r + 10}" width="182" height="22" rx="4" fill="#fff" opacity=".95"/><text text-anchor="middle" y="${r + 25}" fill="#516951" font-size="10">${esc(text)}</text><title>${esc(n.label)}</title></g>`;
    })
    .join('');
  const selected = state.events.find((e) => e.id === graphId);
  return (
    heading(
      'KHÁM PHÁ LIÊN HỆ',
      'Bản đồ liên kết',
      'Các đường nối giúp khám phá liên hệ; chúng không tự chứng minh quan hệ nhân quả.',
    ) +
    `<div class="graph-layout"><div class="graph-panel"><div class="graph-controls"><span class="eyebrow">TRỌNG TÂM</span><select id="graph-select" aria-label="Chọn sự kiện trọng tâm">${state.events.map((e) => `<option value="${e.id}" ${e.id === graphId ? 'selected' : ''}>${esc(e.title)}</option>`).join('')}</select><button class="btn small" data-detail="${graphId}">Chi tiết ↗</button></div><div class="graph-navigation"><button class="btn small" id="graph-zoom-in" aria-label="Phóng to bản đồ">＋</button><button class="btn small" id="graph-zoom-out" aria-label="Thu nhỏ bản đồ">−</button><button class="btn small" id="graph-reset">Đặt lại bố cục</button><span>Kéo nút để sắp xếp · Kéo nền để di chuyển · Cuộn để thu/phóng</span></div><svg class="graph-svg" tabindex="0" data-graph-id="${graphId}" viewBox="0 0 840 530" aria-label="Bản đồ sự kiện và chủ đề">${lines}${circles}</svg><div class="legend"><span>Sự kiện</span><span>Thực thể / chủ đề</span><span>Giả thuyết · nét đứt</span></div></div><aside class="right-rail" style="display:grid"><div class="panel"><div class="eyebrow">SỰ KIỆN TRỌNG TÂM</div><h3>${esc(selected.title)}</h3><p class="rail-note">${esc(selected.summary)}</p><button class="btn primary small" data-case-event="${graphId}">Tạo case từ sự kiện ↗</button></div><div class="panel"><h3>Quan hệ có bằng chứng</h3><p class="rail-note">“Cùng đề cập” được xác định theo từ khóa. Quan hệ khác cần nguồn và giải thích do bạn duyệt.</p><button class="btn small" id="add-relationship">＋ Thêm quan hệ</button>${g.edges
      .filter((e) => e.status !== 'association')
      .map(
        (e) =>
          `<p class="rail-note"><span class="tag ${e.status}">${esc(e.status)}</span> ${esc(e.label)}<br>${esc(e.reason)}</p>`,
      )
      .join('')}</div></aside></div>`
  );
}
function caseDetail(c) {
  return (
    heading(
      'ĐỀ BÀI PHÂN TÍCH',
      `<span data-no-translate>${esc(c.title)}</span>`,
      `${trackName(c.track)} · Dữ liệu chốt ngày ${date(c.cutoff_at)} · ${c.mode === 'ai' ? 'Tạo bằng AI' : 'Đề theo mẫu'} · ${c.is_demo ? 'Tình huống giả lập' : 'Dữ liệu RSS'}`,
      `<button class="btn" id="back-cases">← Thư viện case</button><button class="btn primary" data-start-analysis="${c.id}">${c.track === 'copywriting' ? '✎ Bắt đầu viết' : '✎ Bắt đầu phân tích'}</button>`,
    ) +
    `<div class="case-detail"><div class="notice info">Đề giữ nguyên dữ kiện tại thời điểm tạo. Tin mới không tự thay đổi đề bài này.</div><div class="panel"><div class="eyebrow">VAI TRÒ CỦA BẠN</div><h3 data-no-translate>${esc(c.role)}</h3><h2>Bối cảnh</h2><p class="dialog-body">${esc(c.context)}</p><h2>${c.track === 'copywriting' ? 'Mục tiêu nội dung' : 'Quyết định cần đưa ra'}</h2><p class="dialog-body">${esc(c.decision)}</p><h2>${c.track === 'copywriting' ? 'Câu hỏi xây thông điệp' : 'Câu hỏi phân tích'}</h2><ol>${c.questions.map((q) => `<li>${esc(q)}</li>`).join('')}</ol><h2>Yêu cầu đầu ra</h2><ul>${c.deliverables.map((q) => `<li>${esc(q)}</li>`).join('')}</ul><h2>Giả định & dữ liệu thiếu</h2><ul>${c.assumptions.map((q) => `<li>${esc(q)}</li>`).join('')}</ul><h2>Tiêu chí đánh giá</h2><table class="rubric">${c.rubric.map((r) => `<tr><td>${esc(r.criterion)}</td><td>${r.points} điểm</td></tr>`).join('')}</table><h2>Hồ sơ nguồn</h2>${c.evidence.map((e) => `<div class="evidence"><small>${date(e.published_at)}</small>${e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">${esc(e.title)} ↗</a>` : esc(e.title)}<p>${esc(e.summary)}</p></div>`).join('')}</div></div>`
  );
}
function casesPage() {
  const list = state.cases.filter((c) => (c.track || 'consulting') === workTrack);
  const c = state.cases.find((c) => c.id === selectedCase);
  if (c) return caseDetail(c);
  return (
    workModeBar() +
    heading(
      'LUYỆN TẬP CÓ MỤC TIÊU',
      workTrack === 'copywriting' ? 'Content briefs' : 'Consulting cases',
      'Đề bài gắn với sự kiện, có ngữ cảnh cá nhân và tiêu chí đánh giá.',
      `<button class="btn" data-page="settings">Hồ sơ học tập</button><button class="btn primary" data-page="events">＋ Chọn sự kiện</button>`,
    ) +
    (list.length
      ? `<div class="case-grid">${list.map((c, i) => `<article class="case-card"><div class="news-meta"><span class="case-number">CASE ${String(state.cases.length - i).padStart(2, '0')}</span><span class="tag">${trackName(c.track)}</span><span class="tag">${c.mode === 'ai' ? 'AI' : 'Theo mẫu'}</span>${c.is_demo ? '<span class="tag demo">Mẫu</span>' : ''}<span>${date(c.created_at)}</span></div><h3>${esc(c.title)}</h3><p data-no-translate>${esc(c.decision)}</p><div class="card-bottom"><span class="chip">${c.profile_snapshot.duration} phút · ${esc(c.profile_snapshot.difficulty)}</span><button class="card-action" data-open-case="${c.id}">Mở đề bài ↗</button></div></article>`).join('')}</div>`
      : empty(
          'Case đầu tiên bắt đầu từ một câu hỏi',
          'Chọn một sự kiện trên bàn tin tức rồi nhấn “Tạo case”.',
          `<button class="btn primary" data-page="events">Khám phá sự kiện ↗</button>`,
        ))
  );
}
function analysesPage() {
  const list = state.analyses.filter(
    (a) =>
      (a.track || state.cases.find((c) => c.id === a.case_id)?.track || 'consulting') === workTrack,
  );
  const a = state.analyses.find((a) => a.id === selectedAnalysis);
  if (!a)
    return (
      workModeBar() +
      heading(
        'BÀI VIẾT CỦA BẠN',
        workTrack === 'copywriting' ? 'Nội dung & bản nháp' : 'Phân tích & khuyến nghị',
        'Viết lập luận của bạn. Kiểm tra bằng chứng. Xuất bản khi sẵn sàng.',
        `<button class="btn primary" data-page="cases">＋ Chọn case</button>`,
      ) +
      (list.length
        ? `<div class="case-grid">${list.map((a) => `<div class="case-card"><span class="tag ${a.status === 'published' ? 'confirmed' : ''}">${a.status === 'published' ? 'Đã xuất bản' : 'Bản nháp'}</span>${a.is_demo ? ' <span class="tag demo">Mẫu</span>' : ''}<h3>${esc(a.title)}</h3><p>Cập nhật ${date(a.updated_at)} · Phiên bản ${a.revision}</p><button class="btn small" data-open-analysis="${a.id}">Tiếp tục viết ↗</button></div>`).join('')}</div>`
        : empty(
            'Góc nhìn của bạn, được lưu lại',
            'Mở một case và bắt đầu phân tích để tạo bài viết đầu tiên.',
            `<button class="btn primary" data-page="cases">Mở thư viện case</button>`,
          ))
    );
  const c = state.cases.find((c) => c.id === a.case_id);
  return (
    heading(
      trackName(c?.track),
      c?.track === 'copywriting' ? 'Viết nội dung.' : 'Xây dựng khuyến nghị.',
      `Case: ${esc(c?.title || '')} · ${a.is_demo ? 'Dữ liệu mẫu' : 'Dữ liệu từ RSS'}`,
      `<button class="btn" id="back-analyses">← Thư viện</button><button class="btn" id="preview-analysis">Xem trước</button><button class="btn primary" id="save-analysis">Lưu bản nháp</button>`,
    ) +
    `<div class="editor-layout"><div class="editor-toolbar-hint">Ctrl / ⌘ + S để lưu · Bản khôi phục giữ trong phiên trình duyệt</div><div class="editor"><input class="title-input" id="analysis-title" aria-label="Tiêu đề bài" value="${esc(a.title)}"><textarea class="body-input" id="analysis-body" aria-label="Nội dung bài viết">${esc(a.body)}</textarea><div class="editor-status"><span id="save-status">Đã lưu · Phiên bản ${a.revision}</span><span id="word-count">${wordCount(a.body)} từ</span></div></div><aside class="right-rail" style="display:grid"><div class="panel"><div class="eyebrow">${trackName(c?.track)} · BRIEF</div><p class="rail-note" data-no-translate>${esc(c?.decision || '')}${c?.track === 'copywriting' ? `<br><br>Đối tượng: ${esc(c.brief?.audience || 'Chưa xác định')}<br>Kênh: ${esc(c.brief?.channel || 'LinkedIn')}<br>Giọng điệu: ${esc(c.brief?.tone || 'Rõ ràng, đáng tin cậy')}` : ''}</p><button class="btn small" data-open-case="${c?.id}">Mở đề & nguồn</button></div><div class="panel"><div class="eyebrow">TỪ BẢN NHÁP ĐẾN PORTFOLIO</div><div class="button-row"><button class="btn small" id="review-analysis" ${health.ai_configured ? '' : 'disabled'}>✧ AI phản biện</button><button class="btn small" id="export-pdf">↓ Xuất PDF</button><button class="btn primary small" id="publish-analysis">Xuất bản local ↗</button></div><p class="rail-note">${health.ai_configured ? 'AI đánh giá theo tiêu chí và nguồn; cần số dư API.' : 'Cấu hình OPENAI_API_KEY ở máy chủ để mở phản biện AI.'}<br>Xuất bản lưu một bản nội dung đã duyệt. Chỉnh sửa sau đó tạo lại bản nháp.</p></div><div class="panel"><h3>Gợi ý tự kiểm tra</h3>${c?.track === 'copywriting' ? '<p class="rail-note">□ Đúng đối tượng và kênh?<br>□ Hook rõ và có ích?<br>□ Claim có bằng chứng?<br>□ Giọng điệu nhất quán?<br>□ CTA cụ thể?</p>' : '<p class="rail-note">□ Kết luận trả lời đúng quyết định?<br>□ Dữ kiện có nguồn?<br>□ Giả định đã ghi rõ?<br>□ Có phương án thay thế?<br>□ Nêu điều làm thay đổi kết luận?</p>'}</div>${a.review ? `<div class="panel review-box"><h3>Phản biện gần nhất</h3><p>${esc(a.review.summary)}</p><h3>Điểm cần kiểm tra</h3><ul>${a.review.issues.map((s) => `<li>${esc(s)}</li>`).join('')}</ul><h3>Câu hỏi</h3><ul>${a.review.questions.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}</aside></div>`
  );
}
function portfolioPage() {
  const published = state.analyses.filter((a) => a.status === 'published');
  return (
    heading(
      'AN EVIDENCE-LED PORTFOLIO',
      'Góc nhìn đã xuất bản.',
      'Các bài bạn đã duyệt trong portfolio local. Kết nối website thật ở cấu hình máy chủ sau.',
    ) +
    (published.length
      ? `<div class="case-grid">${published.map((a) => `<article class="portfolio-card"><span class="eyebrow">PERSONAL ANALYSIS · ${date(a.published_at)}</span>${a.is_demo ? ' <span class="tag demo">Tình huống mẫu</span>' : ''}<h3>${esc(a.published_snapshot.title)}</h3><p>${esc(a.published_snapshot.body.replace(/^#+ /gm, '').slice(0, 220))}…</p><div class="button-row"><a class="btn primary small" href="/portfolio/${a.id}" target="_blank" rel="noopener noreferrer">Đọc bài ↗</a><button class="btn small" data-open-analysis="${a.id}">Chỉnh sửa</button></div></article>`).join('')}</div>`
      : empty(
          'Portfolio bắt đầu từ bài phân tích đầu tiên',
          'Viết bài, kiểm tra nguồn và duyệt xuất bản từ trình biên tập.',
          `<button class="btn primary" data-page="analyses">Mở bài phân tích</button>`,
        ))
  );
}
function settingsPage() {
  const p = state.profile;
  return (
    heading(
      'CẤU HÌNH KHÔNG GIAN',
      'Nguồn & thiết lập',
      'Chọn nguồn tin, định hình ngữ cảnh học tập và kiểm tra kết nối.',
    ) +
    `<div class="setting-grid"><div><section class="panel"><h2>Nguồn RSS</h2><p class="rail-note">Chỉ lấy tiêu đề, mô tả và link từ RSS. Nội dung đầy đủ của bài báo không được tự động sao chép.</p>${state.sources.map((s) => `<div class="setting-row"><div><strong style="font-size:12px">${esc(s.name)}</strong><p>${esc(s.url)}</p><p>${s.last_status === 'error' ? `Lỗi: ${esc(s.last_error)}` : s.last_checked ? `Đã kiểm tra ${date(s.last_checked)}` : 'Chưa lấy dữ liệu'}</p></div><input class="switch" type="checkbox" data-source="${s.id}" aria-label="Bật ${esc(s.name)}" ${s.enabled ? 'checked' : ''}></div>`).join('')}<div class="button-row"><button class="btn primary" id="settings-ingest">↻ Lấy tin mới</button><button class="btn" id="seed-demo">Thêm dữ liệu mẫu</button></div></section><section class="panel" style="margin-top:20px"><h2>Trạng thái hệ thống</h2><div class="status-list">Cơ sở dữ liệu <span>${health.database}</span><br>OpenAI API <span>${health.ai_configured ? 'Đã cấu hình' : 'Chưa cấu hình'}</span><br>Portfolio webhook <span>${health.portfolio_configured ? 'Đã cấu hình' : 'Chưa cấu hình'}</span><br>Lịch tự động local <span>${health.scheduler_minutes ? `${health.scheduler_minutes} phút` : 'Tắt'}</span></div><p class="rail-note">n8n có workflow trong thư mục workflows để import. Máy chủ chỉ nhận API token qua header, không đưa key OpenAI ra trình duyệt.</p><button class="btn small" id="backup">↓ Tải bản sao dữ liệu JSON</button></section><section class="panel" style="margin-top:20px"><h2>Nhật ký tác vụ</h2>${
      state.jobs
        .slice(0, 10)
        .map(
          (j) =>
            `<div class="job-row">${esc(j.type)} <span class="tag ${j.status === 'failed' ? 'hypothesis' : 'confirmed'}">${esc(j.status)}</span><small>${date(j.created_at)}</small>${j.error ? `<small class="error-text">${esc(j.error)}</small>` : j.result?.inserted !== undefined ? `<small>${j.result.inserted} bài mới</small>` : ''}</div>`,
        )
        .join('') || '<p class="rail-note">Chưa có tác vụ.</p>'
    }</section></div><section class="panel"><h2>Hồ sơ học tập</h2><p class="rail-note">Hồ sơ này được gửi cùng dữ liệu nguồn khi tạo case. API không tự đọc lịch sử ChatGPT của bạn.</p><form id="profile-form"><div class="field"><label for="role">Vai trò khi giải case</label><input id="role" name="role" value="${esc(p.role)}" required maxlength="2000"></div><div class="field"><label for="goal">Mục tiêu học tập</label><textarea id="goal" name="goal" required>${esc(p.goal)}</textarea></div><div class="field"><label for="topics">Ngành và chủ đề quan tâm</label><textarea id="topics" name="topics" required>${esc(p.topics)}</textarea></div><div class="form-grid"><div class="field"><label for="difficulty">Độ khó</label><select id="difficulty" name="difficulty">${['Cơ bản', 'Trung cấp', 'Nâng cao'].map((x) => `<option ${p.difficulty === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div class="field"><label for="duration">Thời gian làm (phút)</label><input id="duration" name="duration" type="number" value="${p.duration}" min="15" max="240" required></div></div><div class="field"><label for="language">Ngôn ngữ</label><input id="language" name="language" value="${esc(p.language)}" required></div><button class="btn primary" type="submit">Lưu hồ sơ học tập</button></form></section></div>`
  );
}
async function render() {
  const version = ++renderVersion;
  if (!labels[page]) page = 'events';
  $('#breadcrumb-current').textContent = labels[page];
  document.querySelectorAll('.sidebar [data-page]').forEach((b) => {
    b.classList.toggle('active', b.dataset.page === page);
    if (b.dataset.page === page) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  const html =
    page === 'events'
      ? eventsPage()
      : page === 'timeline'
        ? timelinePage()
        : page === 'graph'
          ? await graphPage()
          : page === 'ecosystems'
            ? ecosystemView(state, eventCard)
            : page === 'cases'
              ? casesPage()
              : page === 'analyses'
                ? analysesPage()
                : page === 'portfolio'
                  ? portfolioPage()
                  : settingsPage();
  if (version !== renderVersion) return;
  $('#main').innerHTML = html;
  bind();
  restoreDraftNotice();
}
async function navigate(next, { detail = false } = {}) {
  if (!canLeave()) return;
  dirty = false;
  if (!detail && next === 'cases') selectedCase = '';
  if (!detail && next === 'analyses') selectedAnalysis = '';
  page = next;
  location.hash = next;
  await render();
  window.scrollTo(0, 0);
}
function dialog(html) {
  $('#dialog-content').innerHTML = html;
  $('#detail-dialog').showModal();
  $('#dialog-content')
    .querySelectorAll('[data-close]')
    .forEach((b) => (b.onclick = () => $('#detail-dialog').close()));
  bind($('#dialog-content'));
}
async function detail(id) {
  const e = await api(`/events/${id}`);
  dialog(
    `<div class="dialog-top"><div>${tag(e)}<h2>${esc(e.title)}</h2></div><button class="close" data-close aria-label="Đóng">×</button></div><div class="dialog-body"><p>${esc(e.summary)}</p><p class="rail-note">Ngày đăng: ${date(e.published_at)} · Ngày xảy ra: ${e.occurred_at ? date(e.occurred_at) : 'Chưa xác định'}</p><div class="chips">${e.entities.map((x) => `<span class="chip">${esc(x.name)}</span>`).join('')}</div><h3>Hồ sơ nguồn</h3>${e.articles.map((a) => `<div class="evidence" data-language="${esc(sourceLanguage(a))}"><small>${esc(a.source_name)} · ${date(a.published_at)}</small>${a.url ? `<a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">${esc(a.title)} ↗</a>` : esc(a.title)}<p>${esc(a.summary)}</p></div>`).join('')}<div class="button-row"><button class="btn primary" data-case-event="${e.id}">Tạo case ↗</button><button class="btn" data-focus="${e.id}">Mở bản đồ liên kết</button></div></div>`,
  );
}
function createCaseDialog(id) {
  const e = state.events.find((x) => x.id === id);
  if (!e) return;
  $('#detail-dialog').close();
  dialog(
    `<div class="dialog-top"><div><div class="eyebrow">TẠO ĐỀ BÀI</div><h2>${workTrack === 'copywriting' ? 'Tạo content brief' : 'Tạo consulting case'}</h2></div><button class="close" data-close aria-label="Đóng">×</button></div><p class="dialog-body">${esc(e.title)}</p>${e.is_demo ? '<div class="notice">Đây là tình huống giả lập, không phải tin thời sự đã xác minh.</div>' : ''}<div class="notice info">Hồ sơ: ${workTrack === 'copywriting' ? 'Copywriter / Content strategist' : 'Consultant / Business analyst'} · ${esc(state.profile.difficulty)} · ${state.profile.duration} phút</div><div class="field"><label for="case-track">Hướng đề bài</label><select id="case-track"><option value="consulting" ${workTrack === 'consulting' ? 'selected' : ''}>Consulting · phân tích & khuyến nghị</option><option value="copywriting" ${workTrack === 'copywriting' ? 'selected' : ''}>Copywriting · brief & nội dung</option></select></div><div class="brief-fields"><div class="field"><label for="brief-objective">Mục tiêu / quyết định cần hỗ trợ</label><input id="brief-objective" maxlength="2000" placeholder="Ví dụ: tăng nhận biết thương hiệu / lựa chọn thị trường"></div><div class="copy-fields" ${workTrack === 'copywriting' ? '' : 'hidden'}><div class="form-grid"><div class="field"><label for="brief-audience">Đối tượng đọc</label><input id="brief-audience" maxlength="2000" placeholder="Ví dụ: CEO doanh nghiệp vừa"></div><div class="field"><label for="brief-channel">Kênh nội dung</label><select id="brief-channel"><option>LinkedIn</option><option>Website / landing page</option><option>Email</option><option>Facebook</option><option>Bài blog</option></select></div></div><div class="field"><label for="brief-tone">Giọng điệu</label><input id="brief-tone" maxlength="2000" placeholder="Rõ ràng, đáng tin cậy"></div></div></div><div class="field"><label for="case-mode">Cách tạo đề</label><select id="case-mode"><option value="template">Theo mẫu có cấu trúc · không gọi AI</option><option value="ai" ${health.ai_configured ? '' : 'disabled'}>AI dựa trên hồ sơ và nguồn ${health.ai_configured ? '' : '· chưa cấu hình API key'}</option></select></div><p class="rail-note">Đề giữ bản sao nguồn và hồ sơ tại thời điểm tạo. Bạn sẽ tự viết bản phân tích hoặc nội dung; đề theo mẫu không cần số dư API.</p><button class="btn primary" id="confirm-case">Tạo đề bài ↗</button>`,
  );
  $('#case-track').onchange = (e) => {
    $('.copy-fields').hidden = e.target.value !== 'copywriting';
  };
  $('#confirm-case').onclick = () =>
    busy($('#confirm-case'), async () => {
      const mode = $('#case-mode').value,
        track = $('#case-track').value,
        brief = {
          objective: $('#brief-objective').value,
          ...(track === 'copywriting'
            ? {
                audience: $('#brief-audience').value,
                channel: $('#brief-channel').value,
                tone: $('#brief-tone').value,
              }
            : {}),
        };
      const j = await api('/cases', 'POST', { event_id: id, mode, track, brief });
      $('#detail-dialog').close();
      toast('Đang tạo đề case…');
      const result = await waitJob(j.id);
      await refresh();
      selectedCase = result.id;
      workTrack = result.track || track;
      sessionStorage.setItem('work-track', workTrack);
      await navigate('cases', { detail: true });
      toast('Đề case đã được lưu.');
    });
}
async function waitJob(id) {
  for (let i = 0; i < 300; i++) {
    await new Promise((r) => setTimeout(r, 1200));
    const j = await api(`/jobs/${id}`);
    if (j.status === 'failed') throw new Error(j.error);
    if (j.status === 'succeeded') return j.result;
  }
  throw new Error('Tác vụ còn chạy; xem nhật ký trong thiết lập.');
}
async function busy(button, fn) {
  const old = button?.textContent;
  if (button) {
    button.disabled = true;
    button.textContent = 'Đang xử lý…';
  }
  try {
    await fn();
  } catch (e) {
    toast(e.message, true);
  } finally {
    if (button?.isConnected) {
      button.disabled = false;
      button.textContent = old;
    }
  }
}
async function ingest(button) {
  await busy(button, async () => {
    const j = await api('/ingest', 'POST', {});
    toast('Đang lấy RSS từ các nguồn đang bật…');
    const result = await waitJob(j.id);
    await refresh();
    if (!dirty) await render();
    const failed = result.reports.filter((r) => r.status === 'error');
    toast(
      `Đã thêm ${result.inserted} bài mới.${failed.length ? ` ${failed.length} nguồn lỗi; xem nhật ký.` : ''}`,
    );
  });
}
async function saveCurrent() {
  const a = state.analyses.find((x) => x.id === selectedAnalysis);
  if (!a) return null;
  const updated = await api(`/analyses/${a.id}`, 'PATCH', {
    title: $('#analysis-title').value,
    body: $('#analysis-body').value,
    revision: a.revision,
  });
  state.analyses = state.analyses.map((x) => (x.id === updated.id ? updated : x));
  const changed =
    $('#analysis-title') &&
    ($('#analysis-title').value !== updated.title || $('#analysis-body').value !== updated.body);
  dirty = Boolean(changed);
  if (!dirty) sessionStorage.removeItem(draftKey(updated.id));
  if ($('#save-status'))
    $('#save-status').textContent = dirty
      ? 'Có thay đổi mới chưa lưu'
      : `Đã lưu · Phiên bản ${updated.revision}`;
  return updated;
}
async function download(path, name) {
  const r = await fetch(`/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!r.ok) {
    const e = await r.json();
    throw new Error(e.error);
  }
  const blob = await r.blob(),
    href = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 30000);
}
function bind(root = document) {
  bindEcosystems(root, {
    api,
    getState: () => state,
    refresh,
    render,
    navigate,
    dialog,
    toast,
    busy,
  });
  root.querySelectorAll('[data-track]').forEach(
    (b) =>
      (b.onclick = async () => {
        if (dirty && !confirm('Rời bài chưa lưu để đổi hướng làm việc?')) return;
        dirty = false;
        workTrack = b.dataset.track;
        sessionStorage.setItem('work-track', workTrack);
        selectedCase = '';
        selectedAnalysis = '';
        await render();
      }),
  );
  if (root === document) bindGraph($('.graph-svg'));
  if ($('#clear-remote-search'))
    $('#clear-remote-search').onclick = () => {
      remoteSearch = null;
      topic = 'Tất cả';
      query = '';
      period = 'all';
      libraryLanguage = 'all';
      bookmarkedOnly = false;
      searchError = '';
      render();
    };
  if ($('#news-keyword'))
    $('#news-keyword').oninput = (e) => {
      newsKeyword = e.target.value;
    };
  if ($('#news-language'))
    $('#news-language').onchange = (e) => {
      newsLanguage = e.target.value;
    };
  if ($('#library-language'))
    $('#library-language').onchange = (e) => {
      libraryLanguage = e.target.value;
      visibleCount = 20;
      render();
    };
  if ($('#news-days'))
    $('#news-days').onchange = (e) => {
      newsDays = Number(e.target.value);
    };
  if ($('#news-search-form'))
    $('#news-search-form').onsubmit = async (e) => {
      e.preventDefault();
      if (searchPending) return;
      const keyword = $('#news-keyword').value.trim(),
        days = Number($('#news-days').value);
      newsKeyword = keyword;
      newsDays = days;
      searchPending = true;
      searchError = '';
      await render();
      try {
        const j = await api('/search-news', 'POST', {
          query: keyword,
          days,
          languages:
            newsLanguage === 'all'
              ? Object.keys(LANGUAGES)
              : newsLanguage === 'vi-en'
                ? ['vi', 'en']
                : [newsLanguage],
        });
        remoteSearch = await waitJob(j.id);
        topic = 'Tất cả';
        query = '';
        period = 'all';
        libraryLanguage = 'all';
        bookmarkedOnly = false;
        visibleCount = 20;
        await refresh();
        toast('Kết quả đã được lưu vào thư viện.');
      } catch (err) {
        searchError = err.message;
        toast(err.message, true);
      } finally {
        searchPending = false;
        if (page === 'events') await render();
      }
    };
  if ($('#period'))
    $('#period').onchange = (e) => {
      period = e.target.value;
      visibleCount = 20;
      render();
    };
  if ($('#empty-reset')) $('#empty-reset').onclick = () => $('#reset-filters').click();
  if ($('#reset-filters'))
    $('#reset-filters').onclick = () => {
      topic = 'Tất cả';
      query = '';
      period = 'all';
      libraryLanguage = 'all';
      bookmarkedOnly = false;
      showDemo = false;
      remoteSearch = null;
      visibleCount = 20;
      render();
    };
  root
    .querySelectorAll('[data-page]')
    .forEach(
      (b) => (b.onclick = () => navigate(b.dataset.page).catch((e) => toast(e.message, true))),
    );
  root.querySelectorAll('[data-detail]').forEach((b) => {
    b.onclick = () => detail(b.dataset.detail).catch((e) => toast(e.message, true));
    if (b.tagName.toLowerCase() === 'g')
      b.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          b.onclick();
        }
      };
  });
  root
    .querySelectorAll('[data-case-event]')
    .forEach((b) => (b.onclick = () => createCaseDialog(b.dataset.caseEvent)));
  root.querySelectorAll('[data-focus]').forEach(
    (b) =>
      (b.onclick = () => {
        $('#detail-dialog').close();
        graphId = b.dataset.focus;
        navigate('graph');
      }),
  );
  root.querySelectorAll('[data-bookmark]').forEach(
    (b) =>
      (b.onclick = () =>
        busy(b, async () => {
          const e = state.events.find((x) => x.id === b.dataset.bookmark);
          await api(`/events/${e.id}`, 'PATCH', { bookmarked: !e.bookmarked });
          await refresh();
          await render();
        })),
  );
  root.querySelectorAll('[data-topic]').forEach(
    (b) =>
      (b.onclick = () => {
        topic = b.dataset.topic;
        visibleCount = 20;
        render();
      }),
  );
  root.querySelectorAll('[data-open-case]').forEach(
    (b) =>
      (b.onclick = () => {
        if (!canLeave()) return;
        dirty = false;
        selectedCase = b.dataset.openCase;
        workTrack = state.cases.find((c) => c.id === selectedCase)?.track || 'consulting';
        sessionStorage.setItem('work-track', workTrack);
        navigate('cases', { detail: true });
      }),
  );
  root.querySelectorAll('[data-open-analysis]').forEach(
    (b) =>
      (b.onclick = () => {
        if (!canLeave()) return;
        dirty = false;
        selectedAnalysis = b.dataset.openAnalysis;
        workTrack =
          state.analyses.find((a) => a.id === selectedAnalysis)?.track ||
          state.cases.find(
            (c) => c.id === state.analyses.find((a) => a.id === selectedAnalysis)?.case_id,
          )?.track ||
          'consulting';
        sessionStorage.setItem('work-track', workTrack);
        navigate('analyses', { detail: true });
      }),
  );
  root.querySelectorAll('[data-start-analysis]').forEach(
    (b) =>
      (b.onclick = () =>
        busy(b, async () => {
          const a = await api('/analyses', 'POST', { case_id: b.dataset.startAnalysis });
          await refresh();
          selectedAnalysis = a.id;
          await navigate('analyses', { detail: true });
        })),
  );
  root.querySelectorAll('[data-source]').forEach(
    (b) =>
      (b.onchange = () =>
        busy(null, async () => {
          await api(`/sources/${b.dataset.source}`, 'PATCH', { enabled: b.checked });
          await refresh();
          toast('Đã cập nhật nguồn.');
        })),
  );
  root.querySelectorAll('[data-entity]').forEach((b) => {
    b.onclick = () => toast(`Chủ đề: ${b.dataset.entity}. Các đường nối thể hiện cùng đề cập.`);
    b.onkeydown = (e) => {
      if (e.key === 'Enter') b.onclick();
    };
  });
  for (const id of ['ingest', 'empty-ingest', 'settings-ingest'])
    if ($(`#${id}`)) $(`#${id}`).onclick = (e) => ingest(e.currentTarget);
  if ($('#seed-demo'))
    $('#seed-demo').onclick = (e) =>
      busy(e.currentTarget, async () => {
        await api('/demo', 'POST', {});
        await refresh();
        await render();
        toast('Đã thêm tình huống mẫu, được gắn nhãn riêng.');
      });
  if ($('#search'))
    $('#search').oninput = (e) => {
      query = e.target.value;
      visibleCount = 20;
      const start = e.target.selectionStart;
      render().then(() => {
        $('#search').focus();
        $('#search').setSelectionRange(start, start);
      });
    };
  if ($('#load-more'))
    $('#load-more').onclick = () => {
      visibleCount += 20;
      render();
    };
  if ($('#show-demo'))
    $('#show-demo').onchange = (e) => {
      showDemo = e.target.checked;
      render();
    };
  if ($('#saved-filter'))
    $('#saved-filter').onclick = () => {
      bookmarkedOnly = !bookmarkedOnly;
      render();
    };
  if ($('#graph-select'))
    $('#graph-select').onchange = (e) => {
      graphId = e.target.value;
      render();
    };
  if ($('#add-relationship')) $('#add-relationship').onclick = relationshipDialog;
  if ($('#back-cases'))
    $('#back-cases').onclick = () => {
      selectedCase = '';
      render();
    };
  if ($('#back-analyses'))
    $('#back-analyses').onclick = async () => {
      if (dirty && !confirm('Rời bài chưa lưu?')) return;
      dirty = false;
      selectedAnalysis = '';
      render();
    };
  if ($('#profile-form'))
    $('#profile-form').onsubmit = (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      busy(e.submitter, async () => {
        const input = Object.fromEntries(new FormData(form));
        input.duration = Number(input.duration);
        await api('/profile', 'PATCH', input);
        await refresh();
        toast('Đã lưu hồ sơ học tập.');
      });
    };
  if ($('#analysis-body'))
    for (const s of ['#analysis-body', '#analysis-title'])
      $(s).oninput = () => {
        const saved = state.analyses.find((a) => a.id === selectedAnalysis);
        dirty =
          $('#analysis-title').value !== saved.title || $('#analysis-body').value !== saved.body;
        if (dirty) rememberDraft();
        else sessionStorage.removeItem(draftKey(selectedAnalysis));
        $('#save-status').textContent = dirty
          ? 'Có thay đổi chưa lưu'
          : `Đã lưu · Phiên bản ${saved.revision}`;
        $('#word-count').textContent = `${wordCount($('#analysis-body').value)} từ`;
      };
  if ($('#save-analysis'))
    $('#save-analysis').onclick = (e) =>
      busy(e.currentTarget, async () => {
        await saveCurrent();
        toast('Đã lưu bản nháp.');
      });
  if ($('#preview-analysis'))
    $('#preview-analysis').onclick = () =>
      dialog(
        `<div class="dialog-top"><h2>${esc($('#analysis-title').value)}</h2><button class="close" data-close aria-label="Đóng">×</button></div><div class="article-preview">${markdownPreview($('#analysis-body').value)}</div>`,
      );
  if ($('#export-pdf'))
    $('#export-pdf').onclick = (e) =>
      busy(e.currentTarget, async () => {
        if (dirty) await saveCurrent();
        await download(`/analyses/${selectedAnalysis}/pdf`, 'bai-phan-tich.pdf');
        toast('Đã xuất PDF.');
      });
  if ($('#review-analysis'))
    $('#review-analysis').onclick = (e) =>
      busy(e.currentTarget, async () => {
        if (dirty) await saveCurrent();
        const j = await api(`/analyses/${selectedAnalysis}/review`, 'POST', {});
        toast('AI đang phản biện theo rubric và nguồn…');
        await waitJob(j.id);
        await refresh();
        if (!dirty) await render();
        toast('Đã lưu phản biện.');
      });
  if ($('#publish-analysis'))
    $('#publish-analysis').onclick = (e) =>
      busy(e.currentTarget, async () => {
        if (dirty) await saveCurrent();
        const a = state.analyses.find((a) => a.id === selectedAnalysis);
        if (
          !confirm(
            `Duyệt xuất bản phiên bản ${a.revision}? ${health.portfolio_configured ? 'Bài sẽ được gửi đến portfolio webhook đã cấu hình.' : 'Bài sẽ xuất hiện trong portfolio local. Kiểm tra claim và thông tin khách hàng trước khi xuất bản.'}`,
          )
        )
          return;
        await api(`/analyses/${selectedAnalysis}/publish`, 'POST', {
          confirm: true,
          revision: a.revision,
        });
        await refresh();
        await navigate('portfolio');
        toast('Đã xuất bản phiên bản bạn duyệt.');
      });
  if ($('#backup'))
    $('#backup').onclick = (e) =>
      busy(e.currentTarget, () => download('/export', 'research-backup.json'));
}
async function relationshipDialog() {
  const e = await api(`/events/${graphId}`);
  const candidates = state.events.filter((x) => x.id !== e.id && x.is_demo === e.is_demo);
  if (!candidates.length) return toast('Cần thêm một sự kiện cùng nhóm dữ liệu.', true);
  dialog(
    `<div class="dialog-top"><h2>Thêm quan hệ có bằng chứng</h2><button class="close" data-close aria-label="Đóng">×</button></div><form id="relationship-form"><p class="rail-note">Từ: ${esc(e.title)}</p><div class="field"><label for="rel-to">Đến sự kiện</label><select id="rel-to" name="to">${candidates.map((x) => `<option value="${x.id}">${esc(x.title)}</option>`).join('')}</select></div><div class="field"><label for="rel-label">Loại quan hệ</label><input id="rel-label" name="label" placeholder="Ví dụ: Có thể ảnh hưởng đến" required maxlength="120"></div><div class="field"><label for="rel-status">Mức độ xác nhận</label><select id="rel-status" name="status"><option value="hypothesis">Giả thuyết của tôi</option><option value="reported">Nguồn tin nhận định</option><option value="confirmed">Tôi đã kiểm tra bằng chứng</option></select></div><div class="field"><label for="rel-reason">Giải thích và bằng chứng cụ thể</label><textarea id="rel-reason" name="reason" required></textarea></div><div class="field"><label for="rel-evidence">Nguồn chứng minh</label><select id="rel-evidence" name="evidence_id">${e.articles.map((x) => `<option value="${x.id}">${esc(x.title)}</option>`).join('')}</select></div><button class="btn primary" type="submit">Lưu quan hệ</button></form>`,
  );
  $('#relationship-form').onsubmit = (ev) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    busy(ev.submitter, async () => {
      const input = Object.fromEntries(new FormData(form));
      await api('/relationships', 'POST', {
        from: e.id,
        to: input.to,
        label: input.label,
        status: input.status,
        reason: input.reason,
        evidence_ids: [input.evidence_id],
      });
      $('#detail-dialog').close();
      await render();
      toast('Đã lưu quan hệ và nguồn.');
    });
  };
}
window.addEventListener('hashchange', async () => {
  const next = location.hash.slice(1) || 'events';
  if (next === 'main' || next === page) return;
  if (!canLeave()) {
    location.hash = page;
    return;
  }
  dirty = false;
  page = next;
  await render();
  window.scrollTo(0, 0);
});
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && $('#save-analysis')) {
    e.preventDefault();
    $('#save-analysis').click();
  }
});
window.addEventListener('beforeunload', (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});
$('#today').textContent = new Date().toLocaleDateString(uiLocale(), {
  timeZone: 'Asia/Ho_Chi_Minh',
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
try {
  await refresh();
  await render();
} catch (e) {
  $('#connection').textContent = 'Chưa kết nối';
  $('#main').innerHTML = empty(
    'Chưa kết nối máy chủ local',
    `Khởi động Research Studio bằng npm start, rồi mở http://127.0.0.1:4318.<br>${esc(e.message)}`,
    `<button class="btn primary" id="retry">Thử lại</button>`,
  );
  $('#retry').onclick = () => location.reload();
}
