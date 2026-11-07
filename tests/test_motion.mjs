import assert from 'node:assert/strict';
import { createMotionProbe } from '../motion.js';

let total = 0;
function check(name, test) { test(); total++; console.log(`PASS ${name}`); }
function capture({ hz = 60, frames = 750, options = {}, stalls = {} } = {}) {
  const probe = createMotionProbe({ enabled: true, ...options });
  let now = 0;
  probe.feed({ now, sceneId: 'studio', renderMs: 3 });
  for (let i = 0; i < frames; i++) {
    now += stalls[i] ?? 1000 / hz;
    probe.feed({ now, sceneId: 'studio', phase: i < 400 ? 'idle' : 'drag', renderMs: 3, drawCalls: 8, triangles: 24000 });
  }
  return probe;
}

check('disabled capture does not retain scenes or samples', () => {
  const probe = createMotionProbe();
  probe.feed({ now: 0 });
  probe.feed({ now: 100 });
  probe.setVisibility('studio', false, 100);
  assert.equal(probe.enabled, false);
  assert.deepEqual(Object.keys(probe.report().scenes), []);
});

check('stable 60 Hz clears fixed target after warmup and enough samples', () => {
  const result = capture().report().scenes.studio;
  assert.equal(result.gate.status, 'pass');
  assert.ok(result.sampleCount >= 600);
  assert.ok(result.durationMs >= 10000);
  assert.ok(Math.abs(result.averageFps - 60) < .001);
  assert.ok(result.excluded.warmupFrames >= 89);
  assert.equal(result.warmupRemainingMs, 0);
  assert.equal(result.workload.drawCalls.mean, 8);
  assert.equal(result.phases.drag.workload.triangles.mean, 24000);
});

check('stable 30 Hz cannot silently lower the quality target', () => {
  const report = capture({ hz: 30 }).report();
  assert.equal(report.targetHz, 60);
  assert.equal(report.scenes.studio.gate.status, 'fail');
  assert.ok(report.scenes.studio.gate.reasons.includes('too-many-late-frames'));
  assert.throws(() => createMotionProbe({ targetHz: 30 }), RangeError);
});

check('visible stalls retain raw elapsed time and fail even if most frames are smooth', () => {
  const result = capture({ stalls: { 200: 200, 500: 80 } }).report().scenes.studio;
  assert.equal(result.stallsOver50Ms, 2);
  assert.equal(result.intervalMs.max, 200);
  assert.equal(result.rawFrames.filter(frame => frame.intervalMs > 50).length, 2);
  assert.equal(result.gate.status, 'fail');
  assert.ok(result.gate.reasons.includes('visible-stall-over-50ms'));
});

check('warmup boundary never clips a long frame', () => {
  const probe = createMotionProbe({ enabled: true });
  for (const now of [0, 1000, 1400, 2000]) probe.feed({ now, renderMs: 1 });
  const result = probe.report().scenes.default;
  assert.equal(result.excluded.warmupIntervalMs, 1400);
  assert.equal(result.intervalMs.max, 600);
  assert.equal(result.stallsOver50Ms, 1);
  assert.equal(result.warmupRemainingMs, 0);
});

check('hidden gap and resume baseline are excluded without a new warmup', () => {
  const probe = createMotionProbe({ enabled: true, warmupMs: 30 });
  for (const now of [0, 20, 40, 60]) probe.feed({ now, renderMs: 1 });
  probe.setVisibility('default', false, 70);
  probe.feed({ now: 5000, visible: false });
  probe.setVisibility('default', true, 10000);
  probe.feed({ now: 10000, renderMs: 1 });
  probe.feed({ now: 10020, renderMs: 1 });
  const result = probe.report().scenes.default;
  assert.equal(result.sampleCount, 3);
  assert.equal(result.intervalMs.max, 20);
  assert.equal(result.excluded.hiddenMs, 9930);
  assert.equal(result.excluded.hiddenFeeds, 1);
  assert.equal(result.excluded.baselineFrames, 2);
  assert.equal(result.warmupRemainingMs, 0);
});

check('warmup accumulates across visibility toggles and repeated visible notifications', () => {
  const probe = createMotionProbe({ enabled: true, warmupMs: 100 });
  let now = 0;
  for (let cycle = 0; cycle < 8; cycle++) {
    probe.setVisibility('default', true, now);
    probe.feed({ now, renderMs: 1 });
    now += 20;
    probe.setVisibility('default', true, now);
    probe.feed({ now, renderMs: 1 });
    probe.setVisibility('default', false, now);
    now += 100;
  }
  const result = probe.report().scenes.default;
  assert.equal(result.warmupRemainingMs, 0);
  assert.equal(result.excluded.warmupFrames, 5);
  assert.equal(result.sampleCount, 3);
});

check('background samples are marked and not interpreted as visible stalls', () => {
  const probe = createMotionProbe({ enabled: true, warmupMs: 0 });
  probe.feed({ now: 0, renderMs: 1 });
  probe.feed({ now: 16, renderMs: 1 });
  probe.feed({ now: 1000, background: true });
  probe.feed({ now: 10000, background: true });
  probe.feed({ now: 20000, renderMs: 1 });
  probe.feed({ now: 20016, renderMs: 1 });
  const result = probe.report().scenes.default;
  assert.equal(result.sampleCount, 2);
  assert.equal(result.stallsOver50Ms, 0);
  assert.equal(result.excluded.backgroundFeeds, 2);
  assert.equal(result.excluded.hiddenMs, 19000);
});

check('scenes maintain independent timestamps and workload', () => {
  const probe = createMotionProbe({ enabled: true, warmupMs: 0 });
  for (const now of [0, 20, 40]) {
    probe.feed({ sceneId: 'home', now, renderMs: 2, drawCalls: 4 });
    probe.feed({ sceneId: 'studio', now: now + 5, renderMs: 4, drawCalls: 10 });
  }
  const { home, studio } = probe.report().scenes;
  assert.equal(home.intervalMs.mean, 20);
  assert.equal(studio.intervalMs.mean, 20);
  assert.equal(home.workload.drawCalls.mean, 4);
  assert.equal(studio.workload.drawCalls.mean, 10);
});

check('invalid timestamps cannot erase elapsed visible time or invent backwards intervals', () => {
  const probe = createMotionProbe({ enabled: true, warmupMs: 0 });
  for (const now of [0, 20, NaN, -1, 20, 10, 220]) probe.feed({ now, renderMs: 1 });
  const result = probe.report().scenes.default;
  assert.equal(result.excluded.invalidTimestamps, 2);
  assert.equal(result.excluded.nonIncreasingTimestamps, 2);
  assert.deepEqual(result.rawFrames.map(frame => frame.intervalMs), [20, 200]);
});

check('missing render cost still retains a valid frame interval', () => {
  const probe = createMotionProbe({ enabled: true, warmupMs: 0 });
  probe.feed({ now: 0 });
  probe.feed({ now: 100, renderMs: NaN });
  const result = probe.report().scenes.default;
  assert.equal(result.intervalMs.max, 100);
  assert.equal(result.renderMs.count, 0);
  assert.equal(result.excluded.missingRenderTimings, 1);
});

check('insufficient observations never pass based on a short smooth burst', () => {
  assert.equal(capture({ frames: 200 }).report().scenes.studio.gate.status, 'insufficient');
  const highRate = capture({ hz: 120, frames: 700, options: { warmupMs: 0 } }).report().scenes.studio;
  assert.ok(highRate.gate.reasons.includes('too-short'));
});

check('capture limit is explicit and cannot turn partial evidence into a pass', () => {
  const result = capture({ frames: 750, options: { maxSamples: 610, warmupMs: 0 } }).report().scenes.studio;
  assert.equal(result.sampleCount, 610);
  assert.equal(result.excluded.captureLimitFrames, 140);
  assert.equal(result.gate.status, 'insufficient');
  assert.ok(result.gate.reasons.includes('capture-limit-reached'));
});

check('reports are detached and reset explicitly starts a fresh session', () => {
  const probe = capture();
  const first = probe.report();
  first.scenes.studio.rawFrames[0].intervalMs = 9999;
  first.scenes.studio.excluded.warmupFrames = 9999;
  first.criteria.minSamples = 1;
  const second = probe.report();
  assert.ok(second.scenes.studio.intervalMs.max < 17);
  assert.ok(second.scenes.studio.excluded.warmupFrames < 100);
  assert.equal(second.criteria.minSamples, 600);
  probe.reset();
  assert.deepEqual(Object.keys(probe.report().scenes), []);
});

check('expensive rendering fails its own budget even with regular incoming timestamps', () => {
  const probe = createMotionProbe({ enabled: true, warmupMs: 0 });
  for (let i = 0; i <= 610; i++) probe.feed({ now: i * (1000 / 60), renderMs: 22 });
  const result = probe.report().scenes.default;
  assert.equal(result.gate.status, 'fail');
  assert.ok(result.gate.reasons.includes('render-p95-over-frame-budget'));
});

check('a visible renderer freezing after enough smooth frames cannot pass', () => {
  const probe = capture();
  const before = probe.report().scenes.studio;
  assert.equal(before.gate.status, 'pass');
  const finalFrame = before.rawFrames.at(-1).now;
  const after = probe.report({ now: finalFrame + 8000 }).scenes.studio;
  assert.equal(after.gate.status, 'fail');
  assert.ok(after.gate.reasons.includes('visible-tail-over-50ms'));
  assert.ok(Math.abs(after.tailGapMs - 8000) < .000001);
  assert.ok(Math.abs(after.maxObservedGapMs - 8000) < .000001);
  assert.equal(after.sampleCount, before.sampleCount, 'the absent frame is not invented');
  assert.equal(after.rawFrames.length, before.rawFrames.length);
});

check('capture cutoff catches a final stall before another RAF can report it', () => {
  const probe = capture();
  const finalFrame = probe.report().scenes.studio.rawFrames.at(-1).now;
  const result = probe.report({ now: finalFrame + 120 }).scenes.studio;
  assert.equal(result.gate.status, 'fail');
  assert.equal(result.stallsOver50Ms, 0, 'completed intervals remain distinct from the unfinished tail');
  assert.equal(result.tailGapMs, 120);
});

check('a scene intentionally hidden before cutoff has no missing visible tail', () => {
  const probe = capture();
  const finalFrame = probe.report().scenes.studio.rawFrames.at(-1).now;
  probe.setVisibility('studio', false, finalFrame + 10);
  const result = probe.report({ now: finalFrame + 8000 }).scenes.studio;
  assert.equal(result.visible, false);
  assert.equal(result.tailGapMs, null);
  assert.equal(result.gate.status, 'pass');
});

check('normal pending frame and an invalid cutoff do not falsely fail or alter state', () => {
  const probe = capture();
  const finalFrame = probe.report().scenes.studio.rawFrames.at(-1).now;
  assert.equal(probe.report({ now: finalFrame + 16 }).scenes.studio.gate.status, 'pass');
  assert.equal(probe.report({ now: finalFrame - 1 }).scenes.studio.tailGapMs, null);
  assert.equal(probe.report({ now: NaN }).scenes.studio.tailGapMs, null);
  assert.equal(probe.report().scenes.studio.tailGapMs, null);
});

console.log(`RESULT ${total}/${total}`);
