/* 只读数据层与玩法规则；所有模拟数值均由 SIM 标识。时间展示统一 UTC+8。 */
(function (root) {
  'use strict';
  const HOUR = 3600000;
  const API = 'https://api.squeekchain.com';
  function number(value) {
    if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  function normalizeStatus(raw, now = Date.now()) {
    const m = raw?.measurement || {};
    const observed = Date.parse(m.observedAt || ''), received = Date.parse(m.receivedAt || '');
    const stamp = Number.isFinite(received) ? received : observed;
    const ttl = (number(m.staleAfterSeconds) || 120) * 1000;
    const speed = number(m.speedMmPerSecond), milli = number(m.rpmMilli);
    const valid = m.freshness === 'online' && m.provenance === 'hardware' && ['IDLE','ACTIVE'].includes(m.coreStatus) && Number.isFinite(stamp) && now - stamp <= ttl && stamp - now < 60000;
    const state = !valid || (speed === null && milli === null) ? 'unknown' : ((speed || 0) > 0 || (milli || 0) > 0) ? 'running' : 'idle';
    const b = raw?.builder?.anchor || {};
    return {state, speed: valid ? speed : null, rpm: valid && milli !== null ? milli / 1000 : null,
      distanceKm: valid && number(m.distanceMm) !== null ? number(m.distanceMm) / 1e6 : null,
      observedAt: Number.isFinite(observed) ? observed : stamp, freshnessAt: stamp, staleAfter: ttl, block: number(b.blockHeight),
      progress: number(b.blockProgress) === null ? null : Math.min(100, number(b.blockProgress) / 1e7),
      chain: raw?.chain?.name || raw?.network?.name || raw?.network || '网络待核实', raw};
  }
  function normalizeBuckets(stats) {
    const rows = [];
    for (const day of stats?.activity?.days || []) {
      const midnight = Date.parse(day.date + 'T00:00:00Z');
      if (!Number.isFinite(midnight)) continue;
      for (const b of day.buckets || []) {
        const minute = number(b.startMinuteUtc);
        if (minute === null || minute >= 1440) continue;
        const time = midnight + (minute + (minute < 720 ? 1440 : 0)) * 60000;
        const missing = ['missing', 'future'].includes(b.coverage);
        rows.push({time, work: missing ? null : number(b.workUnits), complete: b.coverage === 'complete', coverage: b.coverage || 'unknown'});
      }
    }
    return rows.sort((a, b) => a.time - b.time);
  }
  function activityWindow(rows, hours, now = Date.now()) {
    const start = now - hours * HOUR;
    const data = rows.filter(b => b.time >= start && b.time < now);
    const known = data.filter(b => b.work !== null);
    return {data, active: known.filter(b => b.work > 0).length,
      idle: known.filter(b => b.work === 0).length,
      missing: Math.max(0, Math.ceil(hours * 2) - known.length),
      work: known.length ? known.reduce((sum, b) => sum + b.work, 0) : null,
      coverage: Math.min(100, known.length / (hours * 2) * 100)};
  }
  function idleLowerBound(rows, now = Date.now()) {
    /* 仅连续完整零工作桶构成静止下界；缺测不能推断为睡眠。 */
    const prior = rows.filter(b => b.time + 1800000 <= now);
    if (!prior.length || now - (prior.at(-1).time + 1800000) > 1800000 || !prior.at(-1).complete || prior.at(-1).work === null) return null;
    let end = prior.at(-1).time + 1800000, minutes = 0;
    for (let i = prior.length - 1; i >= 0; i--) {
      const b = prior[i];
      if (!b.complete || b.work !== 0 || b.time + 1800000 !== end) break;
      minutes += 30; end = b.time;
    }
    return minutes;
  }
  function units(base, decimals = 18, fraction = 2) {
    if (base === null || base === undefined || !/^\d+$/.test(String(base))) return '—';
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) return '—';
    const value = BigInt(base), divider = 10n ** BigInt(decimals);
    const whole = (value / divider).toLocaleString('en-US');
    const places = Math.min(decimals, fraction);
    return places ? whole + '.' + (value % divider).toString().padStart(decimals, '0').slice(0, places) : whole;
  }
  function mintNumber(settlement) {
    const s = settlement?.mining?.rangeMintedBaseUnits;
    if (s === null || s === undefined || !/^\d+$/.test(String(s))) return null;
    return Number(BigInt(s) / 10n ** 12n) / 1e6;
  }
  function reserveRate(state, speed, idleMinutes) {
    if (state === 'unknown') return null;
    if (state === 'running') return Math.max(.25, Math.round((5.25 - (speed || 0) / 60) * 4) / 4);
    if (idleMinutes === null) return null;
    return Math.min(21, 5.25 + Math.floor(idleMinutes / 30) * .25);
  }
  function hash(text) {
    let value = 2166136261;
    for (const ch of String(text)) { value ^= ch.charCodeAt(0); value = Math.imul(value, 16777619); }
    return value >>> 0;
  }
  function localDay(time = Date.now()) { return new Date(time + 8 * HOUR).toISOString().slice(0, 10); }
  const signs = ['白羊','金牛','双子','巨蟹','狮子','处女','天秤','天蝎','射手','摩羯','水瓶','双鱼'];
  function fortune(rows, sign, now = Date.now()) {
    const midnight = Date.parse(localDay(now) + 'T00:00:00+08:00');
    const day = rows.filter(b => b.time >= midnight - 24 * HOUR && b.time < midnight);
    const known = day.filter(b => b.work !== null);
    if (!known.length) return null;
    const work = known.reduce((sum, b) => sum + b.work, 0);
    const seed = hash(localDay(now) + '/' + sign + '/' + work);
    const active = known.filter(b => b.work > 0).length;
    return {seed, work, active, coverage: known.length / 48, lucky: seed % 88 + 1,
      verdict: active > 12 ? '轮转乾坤' : active > 3 ? '瓜子入库' : '以睡为进',
      good: ['囤瓜子','摸鱼养神','给朋友递瓜子','修好你的跑轮','早睡等仓鼠','夸奖打工鼠'][seed % 6],
      avoid: ['替仓鼠加班','盯着零转速焦虑','把打盹当利空','向跑轮要确定性','熬夜等奇迹','怪罪无辜瓜子'][(seed >>> 5) % 6]};
  }
  function simulation(kind = 'running', now = Date.now()) {
    const sleeping = kind === 'sleeping', running = kind === 'running';
    const speed = running ? 420 + Math.round(Math.sin(now / 1500) * 35) : 0;
    const midnight = Date.parse(localDay(now) + 'T00:00:00+08:00');
    const rows = [];
    const last = Math.floor(now / 1800000) * 1800000;
    for (let n = 335; n >= 0; n--) {
      const time = last - n * 1800000;
      const wave = (hash(String(time)) % 100);
      const resting = sleeping && n < 17;
      rows.push({time, work: resting ? 0 : wave > 60 ? wave * 9 : 0, complete: true, coverage:'complete'});
    }
    const mint = '124206900000000000000000';
    const settlement = {summary:{completedBlockCount:'18',workAdded:'38120'}, mining:{rangeMintedBaseUnits:mint}};
    return {status:{state:running?'running':'idle', speed,rpm:speed/12, distanceKm:3.842,block:12896,progress:68.4,observedAt:now,staleAfter:120000,chain:'SIMULATION'},
      rows, idleMinutes:running ? 0 : sleeping ? 510 : 0, settlement,
      settlement7:{summary:{completedBlockCount:'126',workAdded:'266840'},mining:{rangeMintedBaseUnits:'869448300000000000000000'}},
      economy:{asset:{decimals:18},supply:{liveSupplyBaseUnits:'10248869000000000000000000'}}, midnight};
  }
  const api = {API,HOUR,number,normalizeStatus,normalizeBuckets,activityWindow,idleLowerBound,units,mintNumber,reserveRate,hash,localDay,signs,fortune,simulation};
  root.SqueekCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
