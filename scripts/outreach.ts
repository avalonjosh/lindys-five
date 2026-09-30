// Record outreach activity on the production contacts (KV), using the same
// sequence rules as the admin tab. Needs KV_REST_API_URL / KV_REST_API_TOKEN
// in .env.local.
//
//   npx tsx scripts/outreach.ts find <text>
//   npx tsx scripts/outreach.ts sent <id...> [--date 2026-10-01] [--x]
//   npx tsx scripts/outreach.ts followup <id...> [--date 2026-10-08]
//   npx tsx scripts/outreach.ts replied <id> [--date ...] [--note "said he'd share it"]
//   npx tsx scripts/outreach.ts converted|declined <id> [--note "..."]
//   npx tsx scripts/outreach.ts bounced <id...>
//   npx tsx scripts/outreach.ts set <id> email=new@address.com
//   npx tsx scripts/outreach.ts due | status

import { readFileSync } from 'fs';
import { applyOutreachEvent, isFollowupDue, sequenceLabel, type OutreachContact, type OutreachEvent } from '../lib/outreach';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

async function main() {
  const { kv } = await import('@vercel/kv');
  const [cmd, ...rest] = process.argv.slice(2);
  const flag = (name: string) => {
    const i = rest.indexOf(`--${name}`);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  const flags = new Set(['--date', '--note']);
  const args = rest.filter((a, i) => !a.startsWith('--') && !flags.has(rest[i - 1]));
  const at = flag('date') ? new Date(`${flag('date')}T16:00:00Z`).toISOString() : undefined;
  const note = flag('note');

  const all = async (): Promise<OutreachContact[]> => {
    const ids = await kv.smembers('outreach:contacts');
    if (ids.length === 0) return [];
    const rows = await kv.mget<(OutreachContact | null)[]>(...ids.map((id) => `outreach:contact:${id}`));
    return rows.filter((c): c is OutreachContact => c !== null);
  };
  const line = (c: OutreachContact) =>
    `${c.id} | ${c.name} | ${c.outlet} | ${c.team} | ${c.email || c.twitter || 'no contact info'} | ${c.status}${sequenceLabel(c) ? ` | ${sequenceLabel(c)}` : ''}${c.outcome ? ` | ${c.outcome}` : ''}`;
  const load = async (id: string) => {
    const c = await kv.get<OutreachContact>(`outreach:contact:${id}`);
    if (!c) throw new Error(`No contact with id ${id}`);
    return c;
  };
  const apply = async (ids: string[], event: OutreachEvent) => {
    if (ids.length === 0) throw new Error('Give at least one contact id (use "find" to look one up)');
    for (const id of ids) {
      const updated = applyOutreachEvent(await load(id), event);
      await kv.set(`outreach:contact:${id}`, updated);
      console.log(line(updated));
    }
  };

  switch (cmd) {
    case 'find': {
      const q = args.join(' ').toLowerCase();
      (await all()).filter((c) => `${c.id} ${c.name} ${c.outlet} ${c.team} ${c.email}`.toLowerCase().includes(q)).forEach((c) => console.log(line(c)));
      break;
    }
    case 'sent': await apply(args, { kind: 'sent', at, channel: rest.includes('--x') ? 'x' : undefined }); break;
    case 'followup': await apply(args, { kind: 'followup', at }); break;
    case 'replied': await apply(args, { kind: 'replied', at, outcome: note }); break;
    case 'converted': await apply(args, { kind: 'converted', outcome: note }); break;
    case 'declined': await apply(args, { kind: 'declined', outcome: note }); break;
    case 'bounced': await apply(args, { kind: 'bounced' }); break;
    case 'set': {
      const [id, ...pairs] = args;
      const c = await load(id);
      const allowed = ['name', 'outlet', 'email', 'twitter', 'website', 'notes', 'outcome', 'team', 'type'];
      for (const pair of pairs) {
        const eq = pair.indexOf('=');
        const key = pair.slice(0, eq);
        if (eq < 0 || !allowed.includes(key)) throw new Error(`Can't set "${pair}" (allowed: ${allowed.join(', ')})`);
        (c as unknown as Record<string, string>)[key] = pair.slice(eq + 1);
      }
      c.updatedAt = new Date().toISOString();
      await kv.set(`outreach:contact:${id}`, c);
      console.log(line(c));
      break;
    }
    case 'due': {
      const due = (await all()).filter((c) => isFollowupDue(c));
      console.log(due.length ? due.map(line).join('\n') : 'No follow-ups due.');
      break;
    }
    case 'status': {
      const contacts = await all();
      const counts: Record<string, number> = {};
      for (const c of contacts) counts[c.status] = (counts[c.status] || 0) + 1;
      console.log(`${contacts.length} contacts`, counts);
      console.log(`Follow-ups sent: ${contacts.filter((c) => c.followupSentAt).length}, due now: ${contacts.filter((c) => isFollowupDue(c)).length}`);
      contacts.filter((c) => c.contactedAt).sort((a, b) => (a.contactedAt! < b.contactedAt! ? 1 : -1)).forEach((c) => console.log(line(c)));
      break;
    }
    default:
      console.log('Commands: find, sent, followup, replied, converted, declined, bounced, set, due, status');
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
