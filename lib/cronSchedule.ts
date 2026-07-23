import vercelConfig from '@/vercel.json';

/**
 * Single source of truth for the automation schedule: parses the cron
 * expressions straight out of vercel.json and computes each job's next run,
 * rendered in Eastern time via Intl (DST-correct by construction). The admin
 * UI must never hand-write schedule strings again — they drifted and mixed
 * EDT/EST conversions when it did.
 */

export interface CronJob {
  /** Route path, e.g. /api/cron/news-scan */
  path: string;
  /** Last path segment, e.g. news-scan */
  slug: string;
  /** Raw cron expression (UTC), e.g. "0 10 * * 2,5" */
  schedule: string;
  /** Human summary derived from the expression, in ET, e.g. "Tue & Fri · 6:00 AM EDT" */
  humanSchedule: string;
  /** Next run as a Date */
  nextRun: Date;
  /** Next run formatted in ET, e.g. "Fri, Jul 24 · 6:00 AM EDT" */
  nextRunLabel: string;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseField(field: string, max: number): number[] {
  // Supports "*", "a", "a,b,c" — the only forms vercel.json uses.
  if (field === '*') return Array.from({ length: max + 1 }, (_, i) => i);
  return field.split(',').map(Number).filter(n => Number.isFinite(n));
}

/** Next UTC instant matching a `min hour * * dow` cron expression (the only
 * shape in vercel.json — day-of-month/month are always `*`). */
export function nextRunUtc(schedule: string, from: Date = new Date()): Date {
  const [minF, hourF, , , dowF] = schedule.trim().split(/\s+/);
  const minutes = parseField(minF, 59);
  const hours = parseField(hourF, 23);
  const dows = parseField(dowF, 6);

  const candidate = new Date(from.getTime());
  candidate.setUTCSeconds(0, 0);
  candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);

  // Scan minute-by-scan is wasteful; scan by day/hour/minute lists instead.
  for (let dayOffset = 0; dayOffset < 8; dayOffset++) {
    const day = new Date(Date.UTC(
      candidate.getUTCFullYear(), candidate.getUTCMonth(), candidate.getUTCDate() + dayOffset
    ));
    if (!dows.includes(day.getUTCDay())) continue;
    for (const h of [...hours].sort((a, b) => a - b)) {
      for (const m of [...minutes].sort((a, b) => a - b)) {
        const t = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), h, m));
        if (t >= candidate) return t;
      }
    }
  }
  // Unreachable for valid expressions (every dow list matches within 7 days)
  return candidate;
}

function etTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });
}

/** Human day-pattern summary from the dow field, e.g. "Daily", "Mon", "Tue & Fri". */
function dayPattern(dowField: string): string {
  if (dowField === '*') return 'Daily';
  const days = parseField(dowField, 6).map(d => DAY_NAMES[d]);
  return days.join(' & ');
}

export function getCronJobs(now: Date = new Date()): CronJob[] {
  return (vercelConfig.crons ?? []).map(({ path, schedule }) => {
    const slug = path.split('/').pop() ?? path;
    const nextRun = nextRunUtc(schedule, now);
    const [, hourF, , , dowF] = schedule.trim().split(/\s+/);
    // Human schedule: day pattern + the ET rendering of the next run's time.
    // Using the actual next-run instant keeps EDT/EST correct automatically.
    const timeLabel = etTime(nextRun);
    const multiTime = hourF.includes(',');
    const human = multiTime
      ? `${dayPattern(dowF)} · ${hourF.split(',').map(h => etTime(nextRunUtc(`${schedule.split(/\s+/)[0]} ${h} * * ${dowF}`, now))).join(' & ')}`
      : `${dayPattern(dowF)} · ${timeLabel}`;
    return {
      path,
      slug,
      schedule,
      humanSchedule: human,
      nextRun,
      nextRunLabel: `${nextRun.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' })} · ${timeLabel}`,
    };
  });
}

/** Lookup by slug, e.g. cronJob('news-scan'). */
export function cronJob(slug: string, now: Date = new Date()): CronJob | undefined {
  return getCronJobs(now).find(j => j.slug === slug);
}

/** The soonest-next N jobs (for the Overview automation snapshot). */
export function upcomingRuns(count: number, now: Date = new Date()): CronJob[] {
  return [...getCronJobs(now)].sort((a, b) => a.nextRun.getTime() - b.nextRun.getTime()).slice(0, count);
}
