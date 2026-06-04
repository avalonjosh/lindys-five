'use client';

import type { GameData } from '@/lib/perfectseason/types';
import { franchiseLogo } from './ui';

interface FranchisePickerProps {
  data: GameData;
  onPick: (franchiseId: string) => void;
}

function recentName(names: Record<string, string>, activeDecades: string[]): string {
  for (let i = activeDecades.length - 1; i >= 0; i--) {
    const n = names[activeDecades[i]];
    if (n) return n;
  }
  return Object.values(names)[0] ?? '';
}

/** Choose a franchise to build an all-time team for (Franchise mode). */
export default function FranchisePicker({ data, onPick }: FranchisePickerProps) {
  const franchises = data.franchises
    .map((f) => ({ id: f.id, name: recentName(f.names, f.activeDecades), logo: franchiseLogo(f.id) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="rounded-2xl border-2 border-gray-200 bg-white p-4 shadow-md">
      <p className="mb-1 text-lg font-bold text-sabres-navy" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
        Build an all-time team
      </p>
      <p className="mb-3 text-xs text-gray-500">Pick a franchise. The spins draw decades from its whole history.</p>
      <div className="grid grid-cols-2 gap-2">
        {franchises.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onPick(f.id)}
            className="flex items-center gap-2 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 px-2.5 py-2 text-left transition-all hover:border-sabres-blue hover:shadow-md active:scale-[0.99]"
          >
            {f.logo && <img src={f.logo} alt="" className="h-6 w-auto shrink-0" />}
            <span className="truncate text-xs font-bold text-gray-800">{f.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
