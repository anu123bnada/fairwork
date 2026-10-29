// Delay before the next background refresh. Healthy reads repeat on the base interval; each failure doubles the wait up to a ceiling so a struggling service is not hammered.
export const LIVE_BASE_MS = 45_000;
export const LIVE_MAX_MS = 5 * 60_000;
export const nextRefreshDelay = (failures: number, base = LIVE_BASE_MS, max = LIVE_MAX_MS) => Math.min(max, base * 2 ** Math.max(0, Math.min(failures, 10)));
