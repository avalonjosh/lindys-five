/**
 * The admin Analytics date window: a preset (today, yesterday, 7d, 30d, 12mo)
 * or a custom from/to (Eastern dates, inclusive). Every analytics endpoint
 * resolves the same query string through here so the panels agree.
 */

export type AnalyticsGrain = 'hour' | 'day' | 'month';

export interface AnalyticsWindow {
  /** GA4 date strings (relative like "6daysAgo", or YYYY-MM-DD). */
  start: string;
  end: string;
  days: number;
  /** How many days before today the window ends (0 = includes today). */
  endDaysAgo: number;
  /** Equal-length window just before, for "vs previous"; null when there's no honest one. */
  prev: { start: string; end: string } | null;
  grain: AnalyticsGrain;
}

const MAX_CUSTOM_DAYS = 400;

export function easternToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const daysAgoOf = (iso: string) =>
  Math.round((Date.parse(`${easternToday()}T12:00:00Z`) - Date.parse(`${iso}T12:00:00Z`)) / 86400000);

const PRESETS: Record<string, AnalyticsWindow> = {
  today: { start: 'today', end: 'today', days: 1, endDaysAgo: 0, prev: { start: '1daysAgo', end: '1daysAgo' }, grain: 'hour' },
  yesterday: { start: '1daysAgo', end: '1daysAgo', days: 1, endDaysAgo: 1, prev: { start: '2daysAgo', end: '2daysAgo' }, grain: 'hour' },
  '7d': { start: '6daysAgo', end: 'today', days: 7, endDaysAgo: 0, prev: { start: '13daysAgo', end: '7daysAgo' }, grain: 'day' },
  '30d': { start: '29daysAgo', end: 'today', days: 30, endDaysAgo: 0, prev: { start: '59daysAgo', end: '30daysAgo' }, grain: 'day' },
  // GA4 keeps ~14 months, so 12 months has no previous window to compare.
  '12mo': { start: '365daysAgo', end: 'today', days: 365, endDaysAgo: 0, prev: null, grain: 'month' },
};

export function resolveAnalyticsWindow(params: URLSearchParams): AnalyticsWindow | { error: string } {
  const range = params.get('range') || 'today';
  if (range === 'alltime') return PRESETS['12mo'];
  if (PRESETS[range]) return PRESETS[range];
  if (range !== 'custom') return { error: 'Unknown range' };

  const from = params.get('from') || '';
  const to = params.get('to') || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return { error: 'Pick a start and end date' };
  const endDaysAgo = daysAgoOf(to);
  const days = daysAgoOf(from) - endDaysAgo + 1;
  if (endDaysAgo < 0) return { error: "The end date can't be in the future" };
  if (days < 1) return { error: 'The start date must be on or before the end date' };
  if (days > MAX_CUSTOM_DAYS) return { error: `Pick ${MAX_CUSTOM_DAYS} days or fewer` };
  return {
    start: from,
    end: to,
    days,
    endDaysAgo,
    prev: days <= 180 ? { start: shiftDate(from, -days), end: shiftDate(from, -1) } : null,
    grain: days === 1 ? 'hour' : days <= 92 ? 'day' : 'month',
  };
}
