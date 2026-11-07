import { createMotionProbe } from './motion.js';

const CAPTURE_MS = 20000;
const COUNTDOWN_MS = 2000;
const noop = () => {};

/**
 * Opt-in local performance diagnostics. Production callers pass enabled:false and receive
 * inert callbacks: no DOM, browser listeners, timers, or additional RAF loops.
 * Render callbacks consume the existing renderer RAF, while the page sampler and
 * optional scroll driver have independent, button-started, bounded RAF loops.
 */
export function installMotionQA({ enabled = false } = {}) {
  if (!enabled) return Object.freeze({
    callbacks: () => ({ onFrame: noop, onVisibility: noop }), report: () => null, dispose: noop,
  });

  const rendererProbe = createMotionProbe({ enabled: true });
  const pageProbe = createMotionProbe({ enabled: true });
  const sceneVisibility = new Map();
  const sceneCallbacks = new Map();
  let active = false, pending = false, disposed = false;
  let pageFrame = 0, scrollFrame = 0, countdownTimer = 0, stopTimer = 0;
  let scenario = null, startedAt = null, startNow = 0, lastReport = null;
  let maxScroll = 0;
  let diagnostics = null, longTaskObserver = null, previousPageFrame = null;
  const viewport = () => ({ width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio });
  const sameViewport = (left, right) => left.width === right.width && left.height === right.height && left.dpr === right.dpr;

  function onViewportResize() {
    if (!active || !diagnostics) return;
    const now = performance.now(), current = viewport();
    const previous = diagnostics.viewportResizeEvents.at(-1) || diagnostics.viewportStart;
    if (!sameViewport(previous, current)) diagnostics.viewportChanged = true;
    diagnostics.viewportResizeEvents.push({ now, sinceStartMs: now - startNow, ...current });
  }

  // Layout reads are restricted to visibility transitions and detected long
  // frames. The normal frame path only compares timestamps.
  function diagnosticContext(extraSceneId = null) {
    const readStarted = performance.now();
    const canvases = [];
    for (const [id, visible] of sceneVisibility) {
      if (!visible && id !== extraSceneId) continue;
      const canvas = document.getElementById(id);
      if (!canvas?.getBoundingClientRect) continue;
      const bounds = canvas.getBoundingClientRect();
      canvases.push({
        sceneId: id, reportedVisible: visible,
        intersectsViewport: bounds.bottom > 0 && bounds.right > 0 && bounds.top < window.innerHeight && bounds.left < window.innerWidth,
        bounds: { top: bounds.top, left: bounds.left, right: bounds.right, bottom: bounds.bottom, width: bounds.width, height: bounds.height },
      });
    }
    return {
      scrollY: window.scrollY, documentHidden: document.hidden,
      visibleSceneIds: [...sceneVisibility].filter(([, visible]) => visible).map(([id]) => id),
      canvases, contextReadMs: performance.now() - readStarted,
    };
  }

  function recordLongTasks(entries, cutoff = Infinity) {
    if (!diagnostics) return;
    for (const entry of entries) {
      if (entry.startTime < startNow || entry.startTime >= cutoff) continue;
      diagnostics.longTasks.push({
        startTime: entry.startTime, sinceStartMs: entry.startTime - startNow,
        duration: entry.duration, name: entry.name,
        attribution: Array.from(entry.attribution || [], item => ({
          name: item.name, containerType: item.containerType,
          containerName: item.containerName, containerId: item.containerId,
          containerSrc: item.containerSrc,
        })),
      });
    }
  }

  function beginDiagnostics() {
    previousPageFrame = null;
    diagnostics = {
      longTaskSupport: 'unsupported', longTaskError: null, longTasks: [],
      viewportStart: { now: startNow, ...viewport() }, viewportEnd: null, viewportResizeEvents: [], viewportChanged: false,
      initialSceneVisibility: Object.fromEntries(sceneVisibility),
      visibilityTransitions: [], pageLongFrames: [],
      notes: [
        'All diagnostic timestamps use the same performance clock as raw frames.',
        'Bounds and scrollY are read only on visibility transitions or page intervals over 50 ms.',
        'contextReadMs exposes diagnostic layout-read cost; a nearby event is correlation, not proof of cause.',
        'Long-task entries describe main-thread tasks; absence does not rule out GPU or compositor stalls.',
      ],
    };
    const Observer = globalThis.PerformanceObserver;
    if (typeof Observer !== 'function' || (Observer.supportedEntryTypes && !Observer.supportedEntryTypes.includes('longtask'))) return;
    try {
      longTaskObserver = new Observer(list => { if (active) recordLongTasks(list.getEntries()); });
      longTaskObserver.observe({ type: 'longtask', buffered: false });
      diagnostics.longTaskSupport = 'supported';
    } catch (error) {
      longTaskObserver?.disconnect();
      longTaskObserver = null;
      diagnostics.longTaskSupport = 'failed';
      diagnostics.longTaskError = String(error?.message || error);
    }
  }

  function endDiagnostics(cutoff) {
    if (!longTaskObserver) return;
    recordLongTasks(longTaskObserver.takeRecords(), cutoff);
    longTaskObserver.disconnect();
    longTaskObserver = null;
  }

  const panel = document.createElement('details');
  panel.id = 'motion-qa';
  panel.innerHTML = `
    <summary>流畅度验收</summary>
    <div class="mqa-body">
      <p>固定 60 帧目标；每次先等 2 秒，再采样 20 秒。连续帧与渲染耗时分别记录。</p>
      <div class="mqa-actions">
        <button type="button" data-scenario="manual">采样 20 秒</button>
        <button type="button" data-scenario="scroll">开始滚动采样</button>
        <button type="button" data-scenario="hold">持续按压测试</button>
        <button type="button" data-action="report">报告</button>
        <button type="button" data-action="cancel" disabled>停止采样</button>
      </div>
      <p id="motion-qa-status" role="status" aria-live="polite">尚未采样。按压测试需要亲自拖动或持续按住陶坯。</p>
      <pre id="motion-qa-summary">尚无报告</pre>
      <details class="mqa-raw"><summary>完整原始报告</summary><pre id="motion-qa-report">null</pre></details>
    </div>`;
  const style = document.createElement('style');
  style.textContent = `
    #motion-qa { position:fixed; right:12px; bottom:12px; z-index:2147483600; width:min(360px,calc(100vw - 24px)); color:#f3f0df; background:#191e1cf5; border:1px solid #70786a; border-radius:12px; box-shadow:0 6px 24px #0005; font:12px/1.5 system-ui,sans-serif; text-align:left; }
    #motion-qa > summary { cursor:pointer; padding:10px 14px; font-weight:650; user-select:none; }
    #motion-qa .mqa-body { padding:0 14px 12px; max-height:65vh; overflow:auto; }
    #motion-qa p { margin:8px 0; color:#cfdbc8; font:inherit; }
    #motion-qa .mqa-actions { display:flex; gap:6px; flex-wrap:wrap; }
    #motion-qa button { cursor:pointer; border:1px solid #738472; background:#303d32; color:#f4f6ed; border-radius:7px; padding:6px 9px; font:inherit; }
    #motion-qa button:disabled { opacity:.4; cursor:default; }
    #motion-qa button:focus-visible, #motion-qa summary:focus-visible { outline:2px solid #d3e4a1; outline-offset:2px; }
    #motion-qa pre { white-space:pre-wrap; overflow-wrap:anywhere; color:#e5eddb; background:#101612; border-radius:6px; padding:9px; font:11px/1.55 ui-monospace,monospace; margin:9px 0; text-align:left; }
    #motion-qa .mqa-raw summary { cursor:pointer; }
    #motion-qa-report { max-height:240px; overflow:auto; }
  `;
  document.head.append(style);
  document.body.append(panel);
  const heading = panel.querySelector(':scope > summary');
  const status = panel.querySelector('#motion-qa-status');
  const summary = panel.querySelector('#motion-qa-summary');
  const rawReport = panel.querySelector('#motion-qa-report');
  const starts = [...panel.querySelectorAll('[data-scenario]')];
  const reportButton = panel.querySelector('[data-action="report"]');
  const cancelButton = panel.querySelector('[data-action="cancel"]');

  function setBusy(busy) {
    starts.forEach(button => { button.disabled = busy; });
    reportButton.disabled = busy;
    cancelButton.disabled = !busy;
  }

  function callbacks(sceneId) {
    const id = String(sceneId);
    if (sceneCallbacks.has(id)) return sceneCallbacks.get(id);
    sceneVisibility.set(id, true);
    const handlers = Object.freeze({
      onFrame(frame = {}) {
        if (!active || disposed) return;
        const visible = frame.visible ?? sceneVisibility.get(id);
        rendererProbe.feed({ ...frame, sceneId: id, visible, background: document.hidden || Boolean(frame.background) });
      },
      onVisibility(value, now = performance.now()) {
        if (disposed) return;
        const visible = typeof value === 'object' && value !== null ? Boolean(value.visible) : Boolean(value);
        const timestamp = typeof value === 'object' && value !== null ? value.now ?? now : now;
        const previous = sceneVisibility.get(id);
        sceneVisibility.set(id, visible);
        if (active) {
          rendererProbe.setVisibility(id, visible, timestamp, { background: document.hidden });
          if (previous !== visible) diagnostics.visibilityTransitions.push({
            now: timestamp, sinceStartMs: timestamp - startNow,
            sceneId: id, from: previous, to: visible, kind: 'scene',
            ...diagnosticContext(id),
          });
        }
      },
    });
    sceneCallbacks.set(id, handlers);
    return handlers;
  }

  function onDocumentVisibility() {
    if (!active) return;
    const now = performance.now();
    previousPageFrame = null;
    diagnostics.visibilityTransitions.push({
      now, sinceStartMs: now - startNow, sceneId: 'page', kind: 'document',
      to: !document.hidden, ...diagnosticContext(),
    });
    pageProbe.setVisibility('page', !document.hidden, now, { background: document.hidden });
    for (const [id, visible] of sceneVisibility) {
      rendererProbe.setVisibility(id, visible, now, { background: document.hidden });
    }
  }

  function pageTick(now) {
    pageFrame = 0;
    if (!active || disposed) return;
    if (!document.hidden && previousPageFrame !== null && now - previousPageFrame > 50) {
      diagnostics.pageLongFrames.push({
        now, sinceStartMs: now - startNow, intervalMs: now - previousPageFrame,
        previousFrameAt: previousPageFrame, ...diagnosticContext(),
      });
    }
    previousPageFrame = document.hidden ? null : now;
    pageProbe.feed({ now, sceneId: 'page', phase: scenario, renderMs: null, visible: !document.hidden, background: document.hidden });
    pageFrame = requestAnimationFrame(pageTick);
  }

  function scrollTick(now) {
    scrollFrame = 0;
    if (!active || disposed) return;
    // Two cosine cycles over 20 s: continuous velocity at both ends, no repeated
    // native smooth-scroll cancellation. This driver is separate from pageTick.
    const progress = Math.min(1, Math.max(0, (now - startNow) / CAPTURE_MS));
    const top = maxScroll * (.5 - .5 * Math.cos(progress * Math.PI * 4));
    if (!document.hidden) window.scrollTo({ top, left: 0, behavior: 'instant' });
    if (progress < 1) scrollFrame = requestAnimationFrame(scrollTick);
  }

  function clearScheduling() {
    clearTimeout(countdownTimer);
    clearTimeout(stopTimer);
    cancelAnimationFrame(pageFrame);
    cancelAnimationFrame(scrollFrame);
    countdownTimer = stopTimer = pageFrame = scrollFrame = 0;
  }

  const label = key => ({ manual: '手动交互', scroll: '滚动往返', hold: '持续按压' })[key] || key;
  const grade = state => ({ pass: '通过', fail: '未通过', insufficient: '证据不足' })[state] || state;
  const number = value => Number.isFinite(value) ? value.toFixed(2) : '—';

  function renderReport(report) {
    const lines = [`场景：${label(report.scenario)}${report.aborted ? '（提前停止）' : ''}`];
    if (report.viewportChanged) lines.push('视口采样中变化，本轮不用于前后比较。');
    const format = (name, result) => {
      lines.push(`${name}：${grade(result.gate.status)} · ${result.sampleCount} 帧 · ${(result.durationMs / 1000).toFixed(1)} 秒`);
      lines.push(`  帧间隔 p95 ${number(result.intervalMs.p95)} / p99 ${number(result.intervalMs.p99)} / 最长 ${number(result.intervalMs.max)} 毫秒`);
      lines.push(`  超预算帧 ${result.lateFrames} · >50 毫秒 ${result.stallsOver50Ms}`);
      if (result.tailGapMs !== null && result.tailGapMs > 50) lines.push(`  仍可见但已 ${number(result.tailGapMs)} 毫秒未收到下一帧`);
      if (result.renderMs.count) lines.push(`  渲染耗时 p95 ${number(result.renderMs.p95)} 毫秒`);
    };
    for (const [id, result] of Object.entries(report.renderer.scenes)) format(`渲染器 ${id}`, result);
    if (!Object.keys(report.renderer.scenes).length) lines.push('渲染器：未采到样本，不能判定通过');
    if (report.page.scenes.page) format('页面', report.page.scenes.page);
    else lines.push('页面：未采到样本');
    if (report.missingSceneIds.length) lines.push(`未采到的已注册场景：${report.missingSceneIds.join('、')}`);
    lines.push('帧指标通过后仍需检查拖动、惯性与画面连续性。');
    summary.textContent = lines.join('\n');
    // Full, detached JSON is written once after capture. No expensive report,
    // quantile sorting, or JSON serialization runs inside the sampled frame loop.
    rawReport.textContent = JSON.stringify(report, null, 2);
  }

  function finish(aborted = false) {
    // Capture the cutoff before UI writes, sorting, or JSON serialization can
    // introduce their own delay. It also exposes a renderer that stopped RAF.
    const finishedNow = performance.now();
    const hadStarted = active;
    active = pending = false;
    endDiagnostics(finishedNow);
    clearScheduling();
    setBusy(false);
    heading.textContent = '流畅度验收';
    if (!hadStarted) {
      status.textContent = '已取消倒计时。';
      return;
    }
    diagnostics.viewportEnd = { now: finishedNow, ...viewport() };
    if (!sameViewport(diagnostics.viewportStart, diagnostics.viewportEnd)) diagnostics.viewportChanged = true;
    const renderer = rendererProbe.report({ now: finishedNow });
    const page = pageProbe.report({ now: finishedNow });
    const sampledSceneIds = Object.keys(renderer.scenes).filter(id => renderer.scenes[id].sampleCount > 0);
    lastReport = {
      schemaVersion: 1, scenario, scenarioLabel: label(scenario), aborted,
      startedAt, finishedAt: new Date().toISOString(), wallDurationMs: finishedNow - startNow,
      requestedDurationMs: CAPTURE_MS, countdownMs: COUNTDOWN_MS,
      pageUrl: location.origin + location.pathname,
      registeredSceneIds: [...sceneCallbacks.keys()], sampledSceneIds,
      missingSceneIds: [...sceneCallbacks.keys()].filter(id => !sampledSceneIds.includes(id)),
      scrollFixture: scenario === 'scroll' ? { maxScrollPx: maxScroll, cycles: 2, driver: 'independent-raf-cosine' } : null,
      pointerFixture: scenario === 'hold' ? 'manual-user-input-required' : null,
      viewportChanged: diagnostics.viewportChanged,
      overall: {
        status: diagnostics.viewportChanged ? 'invalid' : 'review-required',
        reasons: diagnostics.viewportChanged ? ['viewport-changed-during-capture'] : [],
        scope: 'Comparison validity only; original frame gates remain authoritative for each sampled scene.',
      },
      renderer, page, diagnostics,
    };
    renderReport(lastReport);
    status.textContent = aborted ? '采样提前停止；查看各场景证据是否足够。' : '采样结束。报告已生成；页面通过不代表未采到的渲染器通过。';
    panel.open = true;
  }

  function beginCapture() {
    countdownTimer = 0;
    if (!pending || disposed) return;
    pending = false;
    rendererProbe.reset();
    pageProbe.reset();
    startedAt = new Date().toISOString();
    startNow = performance.now();
    active = true;
    beginDiagnostics();
    // Initial state is carried into the session, including offscreen canvases.
    for (const [id, visible] of sceneVisibility) rendererProbe.setVisibility(id, visible, startNow, { background: document.hidden });
    pageProbe.setVisibility('page', !document.hidden, startNow, { background: document.hidden });
    heading.textContent = `正在验收：${label(scenario)}`;
    status.textContent = scenario === 'hold' ? '采样中：请持续按压或拖动陶坯，直到报告出现。' : '采样中：20 秒后自动生成报告。';
    pageFrame = requestAnimationFrame(pageTick);
    if (scenario === 'scroll') {
      maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      scrollFrame = requestAnimationFrame(scrollTick);
    }
    stopTimer = setTimeout(() => finish(false), CAPTURE_MS);
  }

  function start(nextScenario) {
    if (active || pending || disposed) return;
    scenario = nextScenario;
    pending = true;
    setBusy(true);
    heading.textContent = `2 秒后验收：${label(scenario)}`;
    status.textContent = scenario === 'scroll' ? '2 秒后开始上下往返滚动，请暂时不要手动滚动。' : '2 秒后开始；随后操作页面，采样期间不刷新报告。';
    panel.open = false;
    if (scenario === 'scroll') window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    countdownTimer = setTimeout(beginCapture, COUNTDOWN_MS);
  }

  function onPanelClick(event) {
    const button = event.target.closest('button');
    if (!button || !panel.contains(button) || button.disabled) return;
    if (button.dataset.scenario) start(button.dataset.scenario);
    else if (button.dataset.action === 'cancel') finish(true);
    else if (button.dataset.action === 'report') {
      if (lastReport) renderReport(lastReport);
      else status.textContent = '尚无报告。请先完成一次采样。';
    }
  }

  panel.addEventListener('click', onPanelClick);
  document.addEventListener('visibilitychange', onDocumentVisibility);
  window.addEventListener('resize', onViewportResize, { passive: true });
  return Object.freeze({
    callbacks,
    // Return the last completed report; never perturb an active capture.
    report: () => lastReport ? JSON.parse(JSON.stringify(lastReport)) : null,
    dispose() {
      if (disposed) return;
      disposed = true;
      active = pending = false;
      endDiagnostics(performance.now());
      clearScheduling();
      panel.removeEventListener('click', onPanelClick);
      document.removeEventListener('visibilitychange', onDocumentVisibility);
      window.removeEventListener('resize', onViewportResize);
      panel.remove();
      style.remove();
    },
  });
}
