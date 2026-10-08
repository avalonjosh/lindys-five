/**
 * "Last run" records for the scheduled jobs, so the daily health check can tell
 * a job that's failing (or has stopped running) from one that's fine.
 * Each job's GET is wrapped: `export const GET = withCronHealth('game-recap', handler)`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export type CronRunStatus = 'ok' | 'partial' | 'failed';

export interface CronRun {
  at: string; // ISO
  status: CronRunStatus;
  /** Short reason for partial/failed, or a note like "skipped: disabled". */
  note?: string;
  httpStatus: number;
}

export const cronRunKey = (name: string) => `health:cron:${name}`;

/** Read the outcome from a job's JSON reply (they share loose conventions). */
function judge(httpStatus: number, body: Record<string, unknown> | null): { status: CronRunStatus; note?: string } {
  const message = (v: unknown) => (typeof v === 'string' ? v : v != null ? JSON.stringify(v) : '').slice(0, 200);
  if (httpStatus >= 500 || body?.success === false) return { status: 'failed', note: message(body?.message ?? body?.error) || `HTTP ${httpStatus}` };
  if (httpStatus >= 400) return { status: 'failed', note: message(body?.error) || `HTTP ${httpStatus}` };
  if (body?.error) return { status: 'failed', note: message(body.error) };
  const results = Array.isArray(body?.results) ? (body!.results as Record<string, unknown>[]) : [];
  const failedItems = results.filter((r) => r && typeof r === 'object' && r.error);
  if (failedItems.length > 0) return { status: 'partial', note: `${failedItems.length} of ${results.length} items failed: ${message(failedItems[0].error)}` };
  if (Array.isArray(body?.errors) && body!.errors.length > 0) return { status: 'partial', note: message(body!.errors[0]) };
  if (body?.skipped) return { status: 'ok', note: `skipped: ${message(body.skipped)}` };
  return { status: 'ok' };
}

async function record(name: string, run: CronRun) {
  try {
    await kv.set(cronRunKey(name), run, { ex: 60 * 60 * 24 * 60 });
  } catch {
    /* never let bookkeeping break the job */
  }
}

export function withCronHealth(name: string, handler: (request: NextRequest) => Promise<NextResponse>) {
  return async function GET(request: NextRequest): Promise<NextResponse> {
    try {
      const response = await handler(request);
      // Unauthorized hits are someone else poking the URL, not a run.
      if (response.status !== 401) {
        let body: Record<string, unknown> | null = null;
        try {
          body = await response.clone().json();
        } catch {
          /* non-JSON reply */
        }
        await record(name, { at: new Date().toISOString(), httpStatus: response.status, ...judge(response.status, body) });
      }
      return response;
    } catch (error) {
      await record(name, { at: new Date().toISOString(), httpStatus: 500, status: 'failed', note: (error as Error).message?.slice(0, 200) });
      return NextResponse.json({ error: 'Cron job failed', message: (error as Error).message }, { status: 500 });
    }
  };
}
