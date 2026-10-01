import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getUserId } from '@/lib/perfectseason/server/session';
import { rateLimit, clientIp } from '@/lib/perfectseason/server/ratelimit';
import { accountOptIn } from '@/lib/perfectseason/server/accountEmail';
import { findSubscriberByEmail, removeSubscriberTeam } from '@/lib/newsletter';
import { userKey, userTeams, type User } from '@/lib/perfectseason/leaderboard';
import { findTeam } from '@/lib/teamConfig';
import type { EmailKind, EmailPrefs, NewsletterSubscriber } from '@/lib/types';

/**
 * Email preferences: which teams' recaps, which kinds of email, or none at all.
 * Two ways in: the signed-in account (Settings), or the subscriber id from an
 * email's unsubscribe link (/email-preferences?id=..., no sign-in needed; the
 * id is the same capability the one-click unsubscribe already relies on).
 */

const KINDS: EmailKind[] = ['gameRecaps', 'setRecaps', 'digest', 'specials'];

type Who = { sub: NewsletterSubscriber | null; user: User | null };

async function resolve(request: NextRequest, id: string | null): Promise<Who | null> {
  if (id) {
    const sub = await kv.get<NewsletterSubscriber>(`email:subscriber:${id}`);
    return sub ? { sub, user: null } : null;
  }
  const userId = await getUserId(request);
  const user = userId ? await kv.get<User>(userKey(userId)) : null;
  if (!user) return null;
  return { sub: await findSubscriberByEmail(user.email), user };
}

function view({ sub, user }: Who) {
  const active = !!sub && !sub.unsubscribedAt;
  return {
    email: sub?.email ?? user?.email ?? '',
    subscribed: active,
    unsubscribed: !!sub?.unsubscribedAt,
    // Opted in, but waiting on an email confirmation before anything is sent.
    pending: active && !sub!.verified,
    teams: active ? sub!.teams ?? [] : [],
    prefs: Object.fromEntries(KINDS.map((k) => [k, sub?.prefs?.[k] !== false])) as Record<EmailKind, boolean>,
    // Signed in: the account's My Teams, offered as switches even before they get recaps.
    myTeams: user ? userTeams(user) : [],
  };
}

export async function GET(request: NextRequest) {
  const who = await resolve(request, request.nextUrl.searchParams.get('id'));
  if (!who) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(view(who));
}

export async function POST(request: NextRequest) {
  let body: { id?: string; prefs?: EmailPrefs; team?: { slug?: string; on?: boolean }; unsubscribeAll?: boolean; resubscribe?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (!(await rateLimit(`nl:rl:prefs:${body.id ?? clientIp(request)}`, 60, 3600))) {
    return NextResponse.json({ error: 'Too many changes. Try again later.' }, { status: 429 });
  }

  let who = await resolve(request, typeof body.id === 'string' ? body.id : null);
  if (!who) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const reload = async () => (who = (await resolve(request, typeof body.id === 'string' ? body.id : null)) ?? who);

  try {
    // Turn one team's recaps on or off.
    if (body.team && typeof body.team.slug === 'string' && findTeam(body.team.slug) && typeof body.team.on === 'boolean') {
      const slug = body.team.slug;
      if (!body.team.on) {
        if (who.sub) await removeSubscriberTeam(who.sub.email, slug);
      } else if (who.user) {
        // Account: same rules as everywhere else (held until the email is confirmed).
        await accountOptIn(who.user, [slug], 'email-preferences');
      } else if (who.sub) {
        // From an email link: this address already proved itself, so just add the team (and come back if unsubscribed).
        const sub = who.sub;
        const teams = Array.from(new Set([...(sub.teams ?? []), slug]));
        await kv.set(`email:subscriber:${sub.id}`, { ...sub, teams, unsubscribedAt: undefined });
        for (const t of teams) await kv.sadd(`email:subscribers:team:${t}`, sub.id);
      }
      await reload();
    }

    // Kinds of email.
    if (body.prefs && who.sub) {
      const prefs: EmailPrefs = { ...(who.sub.prefs ?? {}) };
      for (const k of KINDS) if (typeof body.prefs[k] === 'boolean') prefs[k] = body.prefs[k];
      await kv.set(`email:subscriber:${who.sub.id}`, { ...who.sub, prefs });
      await reload();
    }

    // Everything off.
    if (body.unsubscribeAll && who.sub && !who.sub.unsubscribedAt) {
      const sub = who.sub;
      await kv.set(`email:subscriber:${sub.id}`, { ...sub, unsubscribedAt: new Date().toISOString() });
      for (const t of sub.teams ?? []) await kv.srem(`email:subscribers:team:${t}`, sub.id);
      await reload();
    }

    // Back on, with the teams they had.
    if (body.resubscribe && who.sub?.unsubscribedAt) {
      const sub = who.sub;
      if (who.user && !who.user.emailVerifiedAt) {
        await accountOptIn(who.user, sub.teams ?? [], 'email-preferences');
      } else {
        await kv.set(`email:subscriber:${sub.id}`, { ...sub, unsubscribedAt: undefined });
        for (const t of sub.teams ?? []) await kv.sadd(`email:subscribers:team:${t}`, sub.id);
      }
      await reload();
    }
  } catch (err) {
    console.error('Email preferences update failed:', err);
    return NextResponse.json({ error: "Couldn't save that right now. Try again in a minute." }, { status: 500 });
  }

  return NextResponse.json(view(who));
}
