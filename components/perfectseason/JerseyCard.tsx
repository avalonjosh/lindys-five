'use client';

import { useState } from 'react';
import { NHL_TEAMS, MLB_TEAMS } from '@/lib/teamConfig';
import { franchiseLogo } from '@/lib/perfectseason/logos';
import { nhlConfig } from '@/lib/perfectseason/config.nhl';
import { mlbConfig } from '@/lib/perfectseason/config.mlb';
import { statCells } from './ui';
import { TIER_LABEL, type CardTier, type StreakCard } from '@/lib/perfectseason/cards';

const FRAME: Record<CardTier, string> = { bronze: '#B87333', silver: '#AEB7C2', gold: '#D4AF37' };

/** Team colors for the jersey: the franchise's current colors, else Lindy's Five navy/gold. */
function jerseyColors(card: StreakCard): { body: string; trim: string } {
  const teams = card.sport === 'nhl' ? NHL_TEAMS : MLB_TEAMS;
  const team = Object.values(teams).find((t) => t.abbreviation === card.player.franchiseId);
  if (!team) return { body: '#003087', trim: '#FFB81C' };
  const trim = team.colors.secondary.toUpperCase() === team.colors.primary.toUpperCase() ? '#FFFFFF' : team.colors.secondary;
  return { body: team.colors.primary, trim };
}

const lastName = (name: string) => name.trim().split(/\s+/).slice(1).join(' ') || name;

function earnedLabel(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/**
 * A Lindy's Five streak card in the "jersey back" design: team-color jersey,
 * nameplate across the shoulders, big number, small team badge, tier band.
 * Tap to flip to the back (stats, when and how it was earned). `width` scales
 * the whole card (5:7).
 */
export default function JerseyCard({ card, width = 280, owner }: { card: StreakCard; width?: number; owner?: string }) {
  const [back, setBack] = useState(false);
  const k = width / 320;
  const px = (n: number) => `${Math.round(n * k)}px`;
  const frame = FRAME[card.tier];
  const { body, trim } = jerseyColors(card);
  const logo = franchiseLogo(card.player.franchiseId, card.sport, 'dark');
  const config = card.sport === 'nhl' ? nhlConfig : mlbConfig;
  const stats = statCells({ id: card.player.id, name: card.player.name, pos: card.player.pos, score: 0, line: card.player.line }, config).filter((c) => c.value !== '');
  const bigText = card.player.number ?? card.player.pos[0] ?? '';
  const game = card.sport === 'nhl' ? '82-0' : '162-0';

  return (
    <button
      type="button"
      onClick={() => setBack((b) => !b)}
      aria-label={`${card.player.name} streak card, ${card.milestone}-day ${TIER_LABEL[card.tier]}. Show ${back ? 'front' : 'back'}.`}
      className="block shrink-0 rounded-2xl text-left transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-sabres-blue/40"
      style={{ width: px(320), height: px(448) }}
    >
      {!back ? (
        <div
          className="relative flex h-full w-full flex-col items-center overflow-hidden rounded-2xl"
          style={{ background: body, border: `${px(10)} solid ${frame}` }}
        >
          <div className="absolute inset-x-0 top-0" style={{ height: px(150), background: 'rgba(255,255,255,0.08)', borderRadius: `0 0 50% 50% / 0 0 ${px(46)} ${px(46)}` }} />
          <div className="relative flex w-full items-center justify-between" style={{ padding: `${px(14)} ${px(16)} 0` }}>
            <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: px(20), letterSpacing: '0.06em', color: trim }}>Lindy&apos;s Five</span>
            <span
              className="flex items-center justify-center overflow-hidden rounded-full"
              style={{ width: px(34), height: px(34), border: `${px(2)} solid ${trim}`, background: card.sport === 'mlb' ? '#FFFFFF' : 'transparent' }}
            >
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" style={{ width: px(24), height: px(24), objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: px(10), fontWeight: 800, color: '#FFFFFF' }}>{card.player.franchiseId}</span>
              )}
            </span>
          </div>
          <div
            className="relative max-w-full truncate px-2 font-extrabold uppercase text-white"
            style={{ marginTop: px(30), fontSize: px(lastName(card.player.name).length > 11 ? 26 : 34), letterSpacing: '0.14em' }}
          >
            {lastName(card.player.name)}
          </div>
          <div
            className="relative leading-none"
            style={{
              marginTop: px(-4),
              fontFamily: 'Bebas Neue, sans-serif',
              fontSize: px(bigText.length > 2 ? 150 : 200),
              color: trim,
              WebkitTextStroke: `${px(5)} #FFFFFF`,
            }}
          >
            {bigText}
          </div>
          <div
            className="absolute inset-x-0 bottom-0 flex items-center justify-between"
            style={{ height: px(52), padding: `0 ${px(16)}`, background: frame }}
          >
            <span className="font-extrabold uppercase" style={{ fontSize: px(18), letterSpacing: '0.08em', color: '#141B2D' }}>{card.milestone}-Day Streak</span>
            <span className="font-semibold uppercase" style={{ fontSize: px(14), letterSpacing: '0.1em', color: '#141B2D' }}>{TIER_LABEL[card.tier]}</span>
          </div>
        </div>
      ) : (
        <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl bg-[#FBF8F1]" style={{ border: `${px(10)} solid ${frame}` }}>
          <div className="flex items-center justify-between" style={{ background: body, padding: `${px(12)} ${px(14)}` }}>
            <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: px(22), letterSpacing: '0.06em', color: trim }}>Lindy&apos;s Five</span>
            <span className="font-semibold uppercase text-white" style={{ fontSize: px(12), letterSpacing: '0.1em' }}>Streak Series</span>
          </div>
          <div className="flex flex-1 flex-col" style={{ padding: px(14), gap: px(12) }}>
            <div>
              <div className="font-extrabold uppercase text-gray-900" style={{ fontSize: px(22), letterSpacing: '0.04em', lineHeight: 1.1 }}>{card.player.name}</div>
              <div className="text-gray-600" style={{ fontSize: px(13) }}>
                {card.player.pos.join('/')} · {card.player.franchiseName} · {card.player.decade}
              </div>
            </div>
            {stats.length > 0 && (
              <div className="grid grid-cols-4" style={{ gap: px(6) }}>
                {stats.slice(0, 4).map((s) => (
                  <div key={s.label} className="rounded-lg bg-[#EEF1F6] text-center" style={{ padding: `${px(6)} 0` }}>
                    <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: px(22), color: body }}>{s.value}</div>
                    <div className="text-gray-600" style={{ fontSize: px(10) }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-dashed border-gray-300 text-gray-800" style={{ paddingTop: px(10), fontSize: px(13), lineHeight: 1.5 }}>
              <div><span className="font-semibold">Earned:</span> {card.milestone}-Day {game} Streak, {earnedLabel(card.date)}</div>
              <div><span className="font-semibold">From:</span> your best pick in that day&apos;s Daily</div>
              {owner && <div><span className="font-semibold">Collector:</span> {owner}</div>}
            </div>
            <div className="mt-auto text-gray-500" style={{ fontSize: px(10), lineHeight: 1.4 }}>
              Not affiliated with the NHL, MLB, their players&apos; associations or any team. Earned in play on lindysfive.com, never sold.
            </div>
          </div>
        </div>
      )}
    </button>
  );
}
