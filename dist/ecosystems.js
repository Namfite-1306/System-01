import { translateUI } from './ui-language.js';
const confirm = (message) => window.confirm(translateUI(message));
import { esc, normalize } from './ui-utils.js';
let selected = '',
  from = '',
  to = '',
  keyword = '',
  limit = 20,
  tab = 'timeline';
const statusLabel = {
  hypothesis: 'Giả thuyết',
  reported: 'Nguồn nhận định',
  confirmed: 'Đã kiểm tra',
};
export function ecosystemView(state, eventCard) {
  const list = state.ecosystems || [],
    eco = list.find((e) => e.id === selected);
  if (!eco)
    return `<div class="page-head"><div><div class="eyebrow">HỒ SƠ CÔNG TY / CHỦ ĐỀ</div><h1>Hệ sinh thái</h1><p>Gom tin từ nhiều thời điểm, theo dõi diễn biến và tự xây liên kết có giải thích.</p></div><button class="btn primary" data-eco-new>Tạo hệ sinh thái</button></div>${list.length ? `<div class="case-grid">${list.map((e) => `<article class="case-card"><span class="tag">${e.event_ids.length} tin · ${e.links.length} liên kết</span><h2 data-no-translate>${esc(e.name)}</h2><p>Cập nhật ${new Date(e.updated_at).toLocaleDateString('vi-VN')}</p><button class="btn primary small" data-eco-open="${e.id}">Mở hồ sơ ↗</button></article>`).join('')}</div>` : '<div class="empty"><h2>Bắt đầu từ một công ty</h2><p>Tìm Blackstone, mở thẻ tin rồi nhấn “Thêm vào hệ sinh thái”. Bạn cũng có thể tạo một hồ sơ trống ở đây.</p></div>'}`;
  const members = state.events.filter((e) => eco.event_ids.includes(e.id)),
    events = members
      .filter((e) => {
        const date = (e.published_at || '').slice(0, 10);
        return (
          (!from || date >= from) &&
          (!to || date <= to) &&
          (!keyword || normalize(e.title + ' ' + e.summary).includes(normalize(keyword)))
        );
      })
      .sort((a, b) =>
        (b.published_at || b.created_at).localeCompare(a.published_at || a.created_at),
      );
  const title = (id) =>
    state.events.find((e) => e.id === id)?.title || 'Tin không còn trong thư viện';
  return `<div class="page-head"><div><div class="eyebrow">HỆ SINH THÁI · ${members.length} TIN</div><h1 data-no-translate>${esc(eco.name)}</h1><p>Hồ sơ do bạn tuyển chọn. Ngày hiển thị là ngày đăng, không mặc định là ngày xảy ra sự kiện.</p></div><div class="head-actions"><button class="btn" data-eco-back>← Tất cả hồ sơ</button><button class="btn" data-eco-rename="${eco.id}">Đổi tên</button><button class="btn primary" data-eco-link="${eco.id}" ${members.length < 2 ? 'disabled' : ''}>Thêm liên kết</button></div></div>
 <section class="panel eco-filters"><div class="field"><label for="eco-keyword">Lọc tin trong hồ sơ</label><input id="eco-keyword" value="${esc(keyword)}" placeholder="Từ khóa trong tiêu đề / mô tả"></div><div class="field"><label for="eco-from">Từ ngày (UTC)</label><input id="eco-from" type="date" value="${from}"></div><div class="field"><label for="eco-to">Đến ngày (UTC)</label><input id="eco-to" type="date" value="${to}"></div><div class="button-row"><button class="btn small" data-eco-apply>Áp dụng</button><button class="btn small" data-eco-range="month">Tháng trước</button><button class="btn small" data-eco-range="year">Năm trước</button><button class="btn small" data-eco-range="all">Tất cả</button></div></section>
 <div class="toolbar"><div class="tabs"><button class="tab ${tab === 'timeline' ? 'active' : ''}" data-eco-tab="timeline">Dòng thời gian</button><button class="tab ${tab === 'graph' ? 'active' : ''}" data-eco-tab="graph">Bản đồ liên kết</button></div><span>${events.length}/${members.length} tin trong khoảng chọn</span></div>
 ${from && to && from > to ? '<div class="notice">Ngày bắt đầu đang sau ngày kết thúc.</div>' : ''}
 ${
   tab === 'timeline'
     ? `<div class="feed">${
         events
           .slice(0, limit)
           .map(
             (e) =>
               `<div class="eco-news">${eventCard(e)}<button class="btn small" data-eco-remove="${e.id}" data-ecosystem="${eco.id}">Bỏ khỏi hồ sơ này</button></div>`,
           )
           .join('') ||
         '<div class="empty">Không có tin trong khoảng này. Đổi bộ lọc hoặc tìm tin lịch sử rồi thêm vào hồ sơ.</div>'
       }${events.length > limit ? '<button class="btn" data-eco-more>Hiện thêm tin</button>' : ''}</div>`
     : graph(eco, events)
 }
 <section class="panel eco-links"><div class="panel-heading"><h2>Liên kết do bạn biên tập</h2><span>${eco.links.length} liên kết trong toàn hồ sơ</span></div><p class="rail-note">Kéo các nút chỉ đổi vị trí. Dùng Sửa liên kết để đổi hai tin, tên quan hệ, trạng thái và bằng chứng. “Đã kiểm tra” là đánh giá của bạn.</p>${eco.links.map((l) => `<article class="evidence"><span class="tag ${l.status}">${statusLabel[l.status]}</span><h3>${esc(l.label)}</h3><p>${esc(title(l.from))} → ${esc(title(l.to))}</p><p>${esc(l.reason)}</p><div class="button-row"><button class="btn small" data-eco-edit="${l.id}" data-ecosystem="${eco.id}">Sửa liên kết</button><button class="btn small" data-eco-unlink="${l.id}" data-ecosystem="${eco.id}">Xóa liên kết</button></div></article>`).join('') || '<p class="rail-note">Chưa có liên kết. Thêm ít nhất hai tin rồi chọn “Thêm liên kết”.</p>'}</section>`;
}
function graph(eco, events) {
  const visible = events.slice(0, 60),
    positions = new Map(
      visible.map((e, i) => {
        const angle = (i * 2 * Math.PI) / Math.max(visible.length, 1),
          r = visible.length === 1 ? 0 : 180 + (i % 2) * 45;
        return [e.id, { x: 420 + Math.cos(angle) * r, y: 265 + Math.sin(angle) * r }];
      }),
    );
  return `<div class="graph-panel"><div class="graph-navigation"><button class="btn small" id="graph-zoom-in" aria-label="Phóng to bản đồ">＋</button><button class="btn small" id="graph-zoom-out" aria-label="Thu nhỏ bản đồ">−</button><button class="btn small" id="graph-reset">Đặt lại bố cục</button><span>Kéo nút / kéo nền / cuộn để thu phóng. Hiện ${visible.length} tin mới nhất trong bộ lọc, tối đa 60.</span></div><svg class="graph-svg" tabindex="0" data-graph-id="eco-${eco.id}" viewBox="0 0 840 530" aria-label="Bản đồ hệ sinh thái">${eco.links
    .filter((l) => positions.has(l.from) && positions.has(l.to))
    .map((l) => {
      const a = positions.get(l.from),
        b = positions.get(l.to);
      return `<line data-from="${l.from}" data-to="${l.to}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${l.status === 'hypothesis' ? '#b58948' : '#428568'}" stroke-width="2" ${l.status === 'hypothesis' ? 'stroke-dasharray="5 4"' : ''}><title>${esc(l.label)}</title></line>`;
    })
    .join('')}${visible
    .map((e) => {
      const p = positions.get(e.id);
      return `<g data-node-id="${e.id}" data-x="${p.x}" data-y="${p.y}" transform="translate(${p.x},${p.y})" data-detail="${e.id}" tabindex="0" role="button" aria-label="${esc(e.title)}"><circle r="17" fill="#21775f"/><text y="35" text-anchor="middle" font-size="11" fill="#203c35">${esc(e.title.slice(0, 24))}…</text><title>${esc(e.title)}</title></g>`;
    })
    .join(
      '',
    )}</svg>${visible.length ? '' : '<p class="empty">Chưa có tin trong khoảng chọn.</p>'}</div>`;
}
export function bindEcosystems(root, ctx) {
  const { api, getState, refresh, render, navigate, dialog, toast, busy } = ctx;
  const close = () => document.querySelector('#detail-dialog').close();
  const update = async () => {
    await refresh();
    await render();
  };
  const modal = (eventId, renameId) => {
    const state = getState(),
      list = state.ecosystems || [],
      current = list.find((e) => e.id === renameId);
    dialog(
      `<div class="dialog-top"><h2>${current ? 'Đổi tên hệ sinh thái' : eventId ? 'Thêm vào hệ sinh thái' : 'Tạo hệ sinh thái'}</h2><button class="close" data-close aria-label="Đóng">×</button></div><form id="eco-add-form">${eventId ? `<p>${esc(state.events.find((e) => e.id === eventId)?.title)}</p><div class="field"><label for="eco-mode">Thêm vào</label><select id="eco-mode"><option value="existing" ${list.length ? '' : 'disabled'}>Hệ sinh thái đã có</option><option value="new" ${list.length ? '' : 'selected'}>Hệ sinh thái mới</option></select></div><div class="field" id="eco-existing-field" ${list.length ? '' : 'hidden'}><label for="eco-existing">Chọn hệ sinh thái</label><select id="eco-existing">${list.map((e) => `<option value="${e.id}">${esc(e.name)} (${e.event_ids.length} tin)</option>`).join('')}</select></div>` : ''}<div class="field" id="eco-name-field" ${eventId && list.length ? 'hidden' : ''}><label for="eco-name">Tên hệ sinh thái</label><input id="eco-name" maxlength="120" value="${esc(current?.name || '')}" placeholder="Ví dụ: Blackstone"></div><button class="btn primary" type="submit">${current ? 'Lưu tên' : 'Thêm vào hệ sinh thái'}</button></form>`,
    );
    const $ = (s) => document.querySelector(s);
    if ($('#eco-mode'))
      $('#eco-mode').onchange = (e) => {
        $('#eco-existing-field').hidden = e.target.value === 'new';
        $('#eco-name-field').hidden = e.target.value !== 'new';
      };
    $('#eco-add-form').onsubmit = (e) => {
      e.preventDefault();
      const existing = $('#eco-mode')?.value === 'existing',
        name = $('#eco-name').value,
        id = $('#eco-existing')?.value;
      busy(e.submitter, async () => {
        const result = current
          ? await api(`/ecosystems/${current.id}`, 'PATCH', { name })
          : existing
            ? await api(`/ecosystems/${id}/members`, 'POST', { event_id: eventId })
            : await api('/ecosystems', 'POST', { name, ...(eventId ? { event_id: eventId } : {}) });
        close();
        await update();
        toast(`Đã lưu vào “${result.name}”.`);
      });
    };
  };
  root
    .querySelectorAll('[data-add-ecosystem]')
    .forEach((b) => (b.onclick = () => modal(b.dataset.addEcosystem)));
  root.querySelectorAll('[data-eco-new]').forEach((b) => (b.onclick = () => modal()));
  root
    .querySelectorAll('[data-eco-rename]')
    .forEach((b) => (b.onclick = () => modal(null, b.dataset.ecoRename)));
  root.querySelectorAll('[data-eco-open]').forEach(
    (b) =>
      (b.onclick = () => {
        selected = b.dataset.ecoOpen;
        from = '';
        to = '';
        keyword = '';
        limit = 20;
        navigate('ecosystems');
      }),
  );
  root.querySelectorAll('[data-eco-back]').forEach(
    (b) =>
      (b.onclick = () => {
        selected = '';
        render();
      }),
  );
  root.querySelectorAll('[data-eco-tab]').forEach(
    (b) =>
      (b.onclick = () => {
        tab = b.dataset.ecoTab;
        render();
      }),
  );
  root.querySelectorAll('[data-eco-more]').forEach(
    (b) =>
      (b.onclick = () => {
        limit += 20;
        render();
      }),
  );
  root.querySelectorAll('[data-eco-apply]').forEach(
    (b) =>
      (b.onclick = () => {
        keyword = document.querySelector('#eco-keyword').value;
        from = document.querySelector('#eco-from').value;
        to = document.querySelector('#eco-to').value;
        limit = 20;
        render();
      }),
  );
  root.querySelectorAll('[data-eco-range]').forEach(
    (b) =>
      (b.onclick = () => {
        const now = new Date(),
          year = now.getUTCFullYear(),
          month = now.getUTCMonth();
        const iso = (d) => d.toISOString().slice(0, 10);
        if (b.dataset.ecoRange === 'all') {
          from = '';
          to = '';
          keyword = '';
        } else if (b.dataset.ecoRange === 'month') {
          from = iso(new Date(Date.UTC(year, month - 1, 1)));
          to = iso(new Date(Date.UTC(year, month, 0)));
        } else {
          from = `${year - 1}-01-01`;
          to = `${year - 1}-12-31`;
        }
        limit = 20;
        render();
      }),
  );
  root.querySelectorAll('[data-eco-remove]').forEach(
    (b) =>
      (b.onclick = () => {
        if (
          !confirm(
            'Bỏ tin khỏi hồ sơ này? Liên kết của tin trong hồ sơ này cũng được gỡ; tin gốc vẫn ở thư viện.',
          )
        )
          return;
        busy(b, async () => {
          await api(`/ecosystems/${b.dataset.ecosystem}/members/${b.dataset.ecoRemove}`, 'DELETE');
          await update();
        });
      }),
  );
  root.querySelectorAll('[data-eco-unlink]').forEach(
    (b) =>
      (b.onclick = () => {
        if (!confirm('Xóa liên kết này? Hai tin vẫn được giữ trong hồ sơ.')) return;
        busy(b, async () => {
          await api(`/ecosystems/${b.dataset.ecosystem}/links/${b.dataset.ecoUnlink}`, 'DELETE');
          await update();
        });
      }),
  );
  const edit = (ecoId, linkId) => {
    const state = getState(),
      eco = state.ecosystems.find((e) => e.id === ecoId),
      link = eco.links.find((l) => l.id === linkId),
      members = state.events.filter((e) => eco.event_ids.includes(e.id));
    if (members.length < 2) return toast('Cần ít nhất hai tin trong hệ sinh thái.', true);
    const options = (id) =>
      members
        .map(
          (e) =>
            `<option value="${e.id}" ${e.id === id ? 'selected' : ''}>${esc(e.title)}</option>`,
        )
        .join('');
    dialog(
      `<div class="dialog-top"><h2>${link ? 'Sửa' : 'Thêm'} liên kết</h2><button class="close" data-close aria-label="Đóng">×</button></div><form id="eco-link-form"><div class="field"><label for="eco-link-from">Từ tin</label><select id="eco-link-from" name="from">${options(link?.from || members[0].id)}</select></div><div class="field"><label for="eco-link-to">Đến tin</label><select id="eco-link-to" name="to">${options(link?.to || members[1].id)}</select></div><div class="field"><label for="eco-link-label">Tên quan hệ</label><input id="eco-link-label" name="label" required maxlength="120" value="${esc(link?.label || '')}" placeholder="Ví dụ: Cập nhật tiếp theo / Có thể ảnh hưởng"></div><div class="field"><label for="eco-link-status">Mức độ xác nhận</label><select id="eco-link-status" name="status">${Object.entries(
        statusLabel,
      )
        .map(
          ([v, l]) => `<option value="${v}" ${link?.status === v ? 'selected' : ''}>${l}</option>`,
        )
        .join(
          '',
        )}</select></div><div class="field"><label for="eco-link-reason">Giải thích / bằng chứng (có thể kèm URL)</label><textarea id="eco-link-reason" name="reason" required maxlength="2000">${esc(link?.reason || '')}</textarea></div><button class="btn primary" type="submit">Lưu liên kết</button></form>`,
    );
    document.querySelector('#eco-link-form').onsubmit = (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.currentTarget));
      busy(e.submitter, async () => {
        await api(
          `/ecosystems/${ecoId}/links${link ? '/' + link.id : ''}`,
          link ? 'PATCH' : 'POST',
          data,
        );
        close();
        await update();
        toast('Đã lưu liên kết trong hồ sơ.');
      });
    };
  };
  root
    .querySelectorAll('[data-eco-link]')
    .forEach((b) => (b.onclick = () => edit(b.dataset.ecoLink)));
  root
    .querySelectorAll('[data-eco-edit]')
    .forEach((b) => (b.onclick = () => edit(b.dataset.ecosystem, b.dataset.ecoEdit)));
}
