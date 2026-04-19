'use client';

import { useState } from 'react';
import type { TeamHistory } from '@/lib/data/teamHistory';
import { TEAMS } from '@/lib/teamConfig';
import PlayoffTimeline from '@/components/history/PlayoffTimeline';
import FranchiseTimeline from '@/components/history/FranchiseTimeline';

type TabKey = 'playoff' | 'franchise';

interface TeamColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface HistoryTabsProps {
  history: TeamHistory;
  teamColors: TeamColors;
}

export default function HistoryTabs({ history, teamColors }: HistoryTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('playoff');
  const teamAbbreviation = TEAMS[history.slug]?.abbreviation ?? history.slug.toUpperCase();

  return (
    <div>
      <div
        role="tablist"
        aria-label="Team history sections"
        className="flex gap-1 sm:gap-2 mb-6 border-b border-gray-200"
      >
        <TabButton
          active={activeTab === 'playoff'}
          onClick={() => setActiveTab('playoff')}
          accentColor={teamColors.primary}
        >
          Playoff History
        </TabButton>
        <TabButton
          active={activeTab === 'franchise'}
          onClick={() => setActiveTab('franchise')}
          accentColor={teamColors.primary}
        >
          Franchise History
        </TabButton>
      </div>

      {activeTab === 'playoff' && (
        <PlayoffTimeline
          appearances={history.playoffAppearances}
          teamColors={teamColors}
          teamAbbreviation={teamAbbreviation}
        />
      )}

      {activeTab === 'franchise' && (
        <FranchiseTimeline events={history.franchiseTimeline} />
      )}
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  accentColor: string;
  children: React.ReactNode;
}

function TabButton({ active, onClick, accentColor, children }: TabButtonProps) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-colors border-b-2 -mb-px ${
        active
          ? 'text-gray-900'
          : 'text-gray-500 hover:text-gray-700 border-transparent'
      }`}
      style={active ? { borderBottomColor: accentColor } : undefined}
    >
      {children}
    </button>
  );
}
