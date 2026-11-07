// QA-only frame capture. No timers, RAF, DOM, globals, or adaptive FPS target.
// Feed the renderer's raw RAF/performance timestamp, never its clamped physics dt.
const DEFAULTS = Object.freeze({
  enabled: false, targetHz: 60, warmupMs: 1500, minSamples: 600,
  minDurationMs: 10000, maxSamples: 36000, maxLateRatio: .01,
});

function stats(values) {
  if (!values.length) return { count: 0, mean: null, p50: null, p95: null, p99: null, max: null };
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = p => sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
  return {
    count: values.length, mean: values.reduce((a, b) => a + b, 0) / values.length,
    p50: percentile(.5), p95: percentile(.95), p99: percentile(.99), max: sorted.at(-1),
  };
}

const finiteNonnegative = n => Number.isFinite(n) && n >= 0;

function summarize(frames, budgetMs) {
  const intervalMs = stats(frames.map(f => f.intervalMs));
  const renderMs = stats(frames.filter(f => f.renderMs !== null).map(f => f.renderMs));
  const durationMs = frames.reduce((sum, frame) => sum + frame.intervalMs, 0);
  return {
    sampleCount: frames.length, durationMs,
    averageFps: durationMs ? frames.length * 1000 / durationMs : null,
    intervalMs, renderMs,
    lateFrames: frames.filter(f => f.intervalMs > budgetMs * 1.5).length,
    stallsOver50Ms: frames.filter(f => f.intervalMs > 50).length,
    workload: {
      drawCalls: stats(frames.filter(f => f.drawCalls !== null).map(f => f.drawCalls)),
      triangles: stats(frames.filter(f => f.triangles !== null).map(f => f.triangles)),
    },
  };
}

function gate(metrics, scene, config, tailGapMs) {
  const reasons = [];
  if (scene.overflow) reasons.push('capture-limit-reached');
  if (metrics.sampleCount < config.minSamples) reasons.push('too-few-samples');
  if (metrics.durationMs < config.minDurationMs) reasons.push('too-short');
  if (reasons.length) return { status: 'insufficient', reasons };
  const budgetMs = 1000 / config.targetHz;
  if (metrics.intervalMs.p95 > budgetMs * 1.5) reasons.push('p95-over-1.5-frame-budget');
  if (metrics.intervalMs.p99 > budgetMs * 2) reasons.push('p99-over-2-frame-budgets');
  if (metrics.lateFrames / metrics.sampleCount > config.maxLateRatio) reasons.push('too-many-late-frames');
  if (metrics.stallsOver50Ms) reasons.push('visible-stall-over-50ms');
  // A renderer can freeze after collecting enough good samples. No following
  // RAF then exists to report the long interval; the capture cutoff closes it.
  if (tailGapMs !== null && tailGapMs > 50) reasons.push('visible-tail-over-50ms');
  if (metrics.renderMs.p95 !== null && metrics.renderMs.p95 > budgetMs) reasons.push('render-p95-over-frame-budget');
  return { status: reasons.length ? 'fail' : 'pass', reasons };
}

/**
 * Capture at the end of an existing render callback:
 *   probe.feed({ now: rafTimestamp, renderMs, sceneId: 'studio', phase: 'sculpt',
 *                visible: document.visibilityState === 'visible', drawCalls, triangles });
 * If RAF stops while hidden, call setVisibility on that transition. Resume starts
 * a new baseline, but never restarts the scene's one-time visible warmup budget.
 * report() is a detached snapshot, including raw samples, suitable for a QA <pre>.
 */
export function createMotionProbe(options = {}) {
  const config = { ...DEFAULTS, ...options };
  for (const key of ['targetHz', 'minSamples', 'minDurationMs', 'maxSamples']) {
    if (!Number.isFinite(config[key]) || config[key] <= 0) throw new RangeError(`Invalid ${key}`);
  }
  if (!finiteNonnegative(config.warmupMs) || !finiteNonnegative(config.maxLateRatio)) throw new RangeError('Invalid motion thresholds');
  if (config.targetHz < 60) throw new RangeError('Motion QA requires a target of at least 60 Hz');
  const scenes = new Map();

  function getScene(id) {
    if (!scenes.has(id)) scenes.set(id, {
      frames: [], lastNow: null, active: true, hiddenAt: null, overflow: 0,
      warmupRemainingMs: config.warmupMs,
      exclusions: {
        baselineFrames: 0, warmupFrames: 0, warmupIntervalMs: 0,
        hiddenFeeds: 0, backgroundFeeds: 0, hiddenTransitions: 0, hiddenMs: 0,
        invalidTimestamps: 0, nonIncreasingTimestamps: 0, missingRenderTimings: 0,
      },
    });
    return scenes.get(id);
  }

  function visibility(scene, active, now) {
    if (active === scene.active) return;
    scene.active = active;
    scene.lastNow = null;
    if (!active) {
      scene.exclusions.hiddenTransitions++;
      scene.hiddenAt = finiteNonnegative(now) ? now : null;
    } else {
      if (scene.hiddenAt !== null && finiteNonnegative(now) && now >= scene.hiddenAt) {
        scene.exclusions.hiddenMs += now - scene.hiddenAt;
      }
      scene.hiddenAt = null;
    }
  }

  function setVisibility(sceneId = 'default', visible, now, { background = false } = {}) {
    if (!config.enabled) return;
    visibility(getScene(String(sceneId)), Boolean(visible) && !background, now);
  }

  function feed({ now, renderMs, sceneId = 'default', phase = 'default', visible = true,
    background = false, drawCalls, triangles } = {}) {
    if (!config.enabled) return;
    const scene = getScene(String(sceneId));
    visibility(scene, Boolean(visible) && !background, now);
    if (!scene.active) {
      scene.exclusions.hiddenFeeds++;
      if (background) scene.exclusions.backgroundFeeds++;
      return;
    }
    if (!finiteNonnegative(now)) { scene.exclusions.invalidTimestamps++; return; }
    if (scene.lastNow === null) {
      scene.lastNow = now;
      scene.exclusions.baselineFrames++;
      return;
    }
    const intervalMs = now - scene.lastNow;
    if (intervalMs <= 0) { scene.exclusions.nonIncreasingTimestamps++; return; }
    scene.lastNow = now;
    if (scene.warmupRemainingMs > 0) {
      const previousRemaining = scene.warmupRemainingMs;
      scene.warmupRemainingMs = Math.max(0, previousRemaining - intervalMs);
      if (intervalMs <= previousRemaining) {
        scene.exclusions.warmupFrames++;
        scene.exclusions.warmupIntervalMs += intervalMs;
        return;
      }
      // Preserve a whole interval crossing the warmup boundary: a visible long
      // frame must never disappear because its first milliseconds were warmup.
    }
    if (scene.frames.length >= config.maxSamples) { scene.overflow++; return; }
    if (!finiteNonnegative(renderMs)) scene.exclusions.missingRenderTimings++;
    scene.frames.push({
      now, intervalMs, phase: String(phase),
      renderMs: finiteNonnegative(renderMs) ? renderMs : null,
      drawCalls: finiteNonnegative(drawCalls) ? drawCalls : null,
      triangles: finiteNonnegative(triangles) ? triangles : null,
    });
  }

  function report({ now } = {}) {
    const sceneReports = Object.create(null);
    const budgetMs = 1000 / config.targetHz;
    for (const [id, scene] of scenes) {
      const metrics = summarize(scene.frames, budgetMs);
      // This is a censored interval (no next frame), not a fabricated frame.
      // Hidden scenes have no pending visible interval and must be exempt.
      const tailGapMs = scene.active && scene.lastNow !== null && finiteNonnegative(now) && now >= scene.lastNow
        ? now - scene.lastNow : null;
      const phaseFrames = new Map();
      for (const frame of scene.frames) {
        if (!phaseFrames.has(frame.phase)) phaseFrames.set(frame.phase, []);
        phaseFrames.get(frame.phase).push(frame);
      }
      const phases = Object.create(null);
      for (const [phase, frames] of phaseFrames) phases[phase] = summarize(frames, budgetMs);
      sceneReports[id] = {
        ...metrics, gate: gate(metrics, scene, config, tailGapMs), phases,
        lastFrameAt: scene.lastNow, tailGapMs,
        maxObservedGapMs: Math.max(metrics.intervalMs.max ?? 0, tailGapMs ?? 0),
        visible: scene.active, warmupRemainingMs: scene.warmupRemainingMs,
        excluded: { ...scene.exclusions, captureLimitFrames: scene.overflow },
        rawFrames: scene.frames.map(frame => ({ ...frame })),
      };
    }
    return {
      enabled: Boolean(config.enabled), targetHz: config.targetHz, budgetMs,
      criteria: {
        minSamples: config.minSamples, minDurationMs: config.minDurationMs,
        warmupMs: config.warmupMs, maxSamples: config.maxSamples,
        p95IntervalMaxMs: budgetMs * 1.5, p99IntervalMaxMs: budgetMs * 2,
        maxLateRatio: config.maxLateRatio, maxStallsOver50Ms: 0,
        renderP95MaxMs: budgetMs,
      },
      notes: [
        'Intervals are raw consecutive visible frame timestamps, never clamped simulation deltas.',
        'Warmup is consumed once per scene by visible intervals; visibility changes do not restart it.',
        'An interval crossing the warmup boundary is retained in full, including visible stalls.',
        'Visibility gaps and the first resumed frame are excluded; callers must signal visibility changes.',
        'A cutoff timestamp checks the unfinished visible tail separately; it is not counted as a completed frame.',
        'A passing frame gate is necessary, not a replacement for visual interaction review.',
      ],
      scenes: sceneReports,
    };
  }

  return Object.freeze({ enabled: Boolean(config.enabled), feed, setVisibility, report, reset: () => scenes.clear() });
}
