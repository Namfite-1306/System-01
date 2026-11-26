import { randomUUID } from 'node:crypto';
import { SerialQueue } from './serial.mjs';
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
export class Ecosystems {
  constructor(store) {
    this.store = store;
    this.queue = new SerialQueue();
  }
  async required(id) {
    const e = await this.store.get('ecosystem', id);
    if (!e) throw fail('Không tìm thấy hệ sinh thái', 404);
    return e;
  }
  async event(id) {
    if (!(await this.store.get('event', id))) throw fail('Không tìm thấy tin tức', 404);
  }
  name(value) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 120)
      throw fail('Tên cần từ 1 đến 120 ký tự');
    return value.trim();
  }
  create({ name, event_id }) {
    return this.queue.run(async () => {
      const title = this.name(name);
      if (event_id) await this.event(event_id);
      const now = new Date().toISOString();
      return this.store.put('ecosystem', {
        id: randomUUID(),
        name: title,
        event_ids: event_id ? [event_id] : [],
        links: [],
        created_at: now,
        updated_at: now,
      });
    });
  }
  change(id, work) {
    return this.queue.run(async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const e = await this.required(id);
        const previousTime = e.updated_at;
        await work(e);
        e.updated_at = new Date(Math.max(Date.now(), Date.parse(previousTime) + 1)).toISOString();
        if (!this.store.ownerId) return this.store.put('ecosystem', e);
        if (await this.store.compareUpdated('ecosystem', e, previousTime)) return e;
      }
      throw fail('Hệ sinh thái vừa thay đổi ở phiên khác. Hãy thử lại.', 409);
    });
  }
  rename(id, name) {
    return this.change(id, (e) => {
      e.name = this.name(name);
    });
  }
  add(id, event_id) {
    return this.change(id, async (e) => {
      await this.event(event_id);
      e.event_ids = [...new Set([...e.event_ids, event_id])];
    });
  }
  remove(id, event_id) {
    return this.change(id, (e) => {
      e.event_ids = e.event_ids.filter((x) => x !== event_id);
      e.links = e.links.filter((l) => l.from !== event_id && l.to !== event_id);
    });
  }
  link(id, input, linkId) {
    return this.change(id, (e) => {
      if (
        !e.event_ids.includes(input.from) ||
        !e.event_ids.includes(input.to) ||
        input.from === input.to
      )
        throw fail('Chọn hai tin khác nhau trong hệ sinh thái');
      if (!['hypothesis', 'reported', 'confirmed'].includes(input.status))
        throw fail('Trạng thái liên kết không hợp lệ');
      for (const key of ['label', 'reason'])
        if (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > 2000)
          throw fail('Cần tên liên kết và giải thích / bằng chứng');
      if (linkId && !e.links.some((l) => l.id === linkId))
        throw fail('Không tìm thấy liên kết', 404);
      const link = {
        id: linkId || randomUUID(),
        from: input.from,
        to: input.to,
        label: input.label.trim().slice(0, 120),
        reason: input.reason.trim(),
        status: input.status,
      };
      e.links = linkId ? e.links.map((l) => (l.id === linkId ? link : l)) : [...e.links, link];
    });
  }
  unlink(id, linkId) {
    return this.change(id, (e) => {
      if (!e.links.some((l) => l.id === linkId)) throw fail('Không tìm thấy liên kết', 404);
      e.links = e.links.filter((l) => l.id !== linkId);
    });
  }
}
