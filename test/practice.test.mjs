import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../lib/store.mjs';
import { Studio } from '../lib/service.mjs';
test('Consulting and copywriting keep distinct briefs, rubric and draft structure', async () => {
  const store = new Store({ path: ':memory:' }),
    studio = new Studio(store);
  try {
    await studio.initialize();
    await studio.seedDemo();
    const consulting = await studio.createCase({ event_id: 'demo-trade', track: 'consulting' });
    const copy = await studio.createCase({
      event_id: 'demo-trade',
      track: 'copywriting',
      brief: {
        audience: 'CEO SME',
        channel: 'Email',
        tone: 'Ngắn gọn',
        objective: 'Đăng ký nhận bản tin',
      },
    });
    assert.equal(consulting.track, 'consulting');
    assert.ok(consulting.questions.some((q) => q.includes('issue tree')));
    assert.equal(copy.track, 'copywriting');
    assert.ok(copy.decision.includes('CEO SME'));
    assert.ok(copy.decision.includes('Email'));
    for (const c of [consulting, copy])
      assert.equal(
        c.rubric.reduce((sum, r) => sum + r.points, 0),
        100,
      );
    const a = await studio.createAnalysis(consulting.id),
      b = await studio.createAnalysis(copy.id);
    assert.ok(a.body.includes('Issue tree'));
    assert.ok(b.body.includes('CTA'));
    assert.equal(b.track, 'copywriting');
    assert.equal((await studio.createAnalysis(copy.id)).id, b.id);
    await assert.rejects(studio.createCase({ event_id: 'demo-trade', track: 'invalid' }));
    await assert.rejects(
      studio.createCase({ event_id: 'demo-trade', track: 'copywriting', brief: { audience: 123 } }),
    );
  } finally {
    store.close();
  }
});
