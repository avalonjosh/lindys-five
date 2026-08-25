'use client';

import { useEffect, useState } from 'react';
import type { GameData, Sport } from '@/lib/perfectseason/types';

const cache: Partial<Record<Sport, Promise<GameData>>> = {};

function load(sport: Sport): Promise<GameData> {
  cache[sport] ??= fetch(`/api/perfectseason/data/${sport}`).then((r) => {
    if (!r.ok) throw new Error(`Failed to load ${sport} data (${r.status})`);
    return r.json() as Promise<GameData>;
  });
  return cache[sport]!;
}

/** Fetches the sport's player pools on the client (kept out of the JS bundle). */
export function useGameData(sport: Sport): { data: GameData | null; error: string | null } {
  const [data, setData] = useState<GameData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    load(sport)
      .then((d) => live && setData(d))
      .catch((e: Error) => {
        delete cache[sport];
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [sport]);
  return { data, error };
}
