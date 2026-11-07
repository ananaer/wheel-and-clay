/* 只把官方明确给出的带时间戳的转动记录作为历史证据，不把峰值时间冒充最后活动时间。 */
export function activityEvidence(raw, now = Date.now()) {
  const generated = Date.parse(raw?.generatedAt || '');
  const record = raw?.records?.peakObservedRpmMilli;
  const at = Date.parse(record?.occurredAt || ''), rpm = Number(record?.value) / 1000;
  if (!Number.isFinite(generated) || generated > now + 60000 || now - generated > 1800000) return null;
  if (!Number.isFinite(at) || at > now + 60000 || now - at > 8 * 86400000 || !Number.isFinite(rpm) || rpm <= 0) return null;
  return { at, rpm };
}
