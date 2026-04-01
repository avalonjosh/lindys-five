import type { MLBGameResult, MLBStandingsTeam, MLBScoreGame, MLBBoxScoreData, MLBBatterLine, MLBPitcherLine, MLBScoringPlay, MLBPitcherPreview, MLBTeamSeasonStats, MLBRecentGame, MLBSeriesRecord } from '../types/mlb';

const MLB_API_BASE = 'https://statsapi.mlb.com/api/v1';

// Simple in-memory cache
const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL = 60_000; // 60 seconds

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiry) return entry.data as T;
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      if (res.status === 429 || res.status >= 500) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        continue;
      }
      throw new Error(`MLB API error: ${res.status}`);
    } catch (err) {
      if (attempt === retries - 1) throw err;
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }
  throw new Error('MLB API: max retries exceeded');
}

export async function fetchMLBSchedule(teamId: number, season: number): Promise<MLBGameResult[]> {
  const cacheKey = `mlb-schedule-${teamId}-${season}`;
  const cached = getCached<MLBGameResult[]>(cacheKey);
  if (cached) return cached;

  const url = `${MLB_API_BASE}/schedule?sportId=1&teamId=${teamId}&season=${season}&gameType=R&hydrate=team,linescore`;
  const res = await fetchWithRetry(url);
  const data = await res.json();

  const games: MLBGameResult[] = [];

  for (const dateEntry of data.dates || []) {
    for (const game of dateEntry.games || []) {
      const isHome = game.teams?.home?.team?.id === teamId;
      const teamData = isHome ? game.teams?.home : game.teams?.away;
      const opponentData = isHome ? game.teams?.away : game.teams?.home;

      const status = game.status?.detailedState || '';
      const isComplete = status === 'Final' || status === 'Completed Early';
      const isLive = status === 'In Progress' || status === 'Warming Up';
      const isPending = !isComplete && !isLive;

      const teamScore = teamData?.score ?? 0;
      const opponentScore = opponentData?.score ?? 0;

      let outcome: 'W' | 'L' | 'PENDING' = 'PENDING';
      if (isComplete) {
        outcome = teamScore > opponentScore ? 'W' : 'L';
      }

      const opponentTeam = opponentData?.team;
      const opponentAbbrev = opponentTeam?.abbreviation || '???';
      const opponentId = opponentTeam?.id || 0;

      // Format date to ET
      const gameDate = new Date(game.gameDate || dateEntry.date);
      const dateStr = gameDate.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' });
      const timeStr = gameDate.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });

      const result: MLBGameResult = {
        date: dateStr,
        startTime: timeStr,
        opponent: opponentAbbrev,
        opponentLogo: `https://www.mlbstatic.com/team-logos/${opponentId}.svg`,
        isHome,
        teamScore,
        opponentScore,
        outcome,
        gameState: status,
        gameId: game.gamePk,
      };

      // Live game data
      if (isLive && game.linescore) {
        result.inning = game.linescore.currentInning;
        result.inningHalf = game.linescore.isTopInning ? 'Top' : 'Bot';
      }

      games.push(result);
    }
  }

  // Sort by date
  games.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateA.getTime() - dateB.getTime();
  });

  setCache(cacheKey, games);
  return games;
}

export async function fetchMLBStandings(season?: number): Promise<MLBStandingsTeam[]> {
  const year = season || new Date().getFullYear();
  const cacheKey = `mlb-standings-${year}`;
  const cached = getCached<MLBStandingsTeam[]>(cacheKey);
  if (cached) return cached;

  const url = `${MLB_API_BASE}/standings?leagueId=103,104&season=${year}&hydrate=team`;
  const res = await fetchWithRetry(url);
  const data = await res.json();

  const teams: MLBStandingsTeam[] = [];

  const DIVISION_MAP: Record<number, string> = {
    201: 'American League East',
    202: 'American League Central',
    200: 'American League West',
    204: 'National League East',
    205: 'National League Central',
    203: 'National League West',
  };

  const LEAGUE_MAP: Record<number, string> = {
    103: 'American League',
    104: 'National League',
  };

  for (const record of data.records || []) {
    const division = DIVISION_MAP[record.division?.id] || record.division?.name || '';
    const league = LEAGUE_MAP[record.league?.id] || record.league?.name || '';

    for (const teamRecord of record.teamRecords || []) {
      const team = teamRecord.team;
      const splits = teamRecord.records?.splitRecords || [];
      const findSplit = (type: string) => splits.find((r: { type: string }) => r.type === type);
      const l10 = findSplit('lastTen');
      const home = findSplit('home');
      const away = findSplit('away');
      const expectedRecords = teamRecord.records?.expectedRecords || [];
      const xWL = expectedRecords.find((r: { type: string }) => r.type === 'xWinLoss');

      teams.push({
        teamId: team?.id || 0,
        teamAbbrev: team?.abbreviation || '???',
        teamName: team?.name || '',
        teamLogo: `https://www.mlbstatic.com/team-logos/${team?.id || 0}.svg`,
        wins: teamRecord.wins || 0,
        losses: teamRecord.losses || 0,
        winPct: parseFloat(teamRecord.winningPercentage || '0'),
        gamesBack: teamRecord.gamesBack === '-' ? 0 : parseFloat(teamRecord.gamesBack || '0'),
        streak: teamRecord.streak?.streakCode || '',
        last10: l10 ? `${l10.wins}-${l10.losses}` : '',
        homeRecord: home ? `${home.wins}-${home.losses}` : '',
        awayRecord: away ? `${away.wins}-${away.losses}` : '',
        runsScored: teamRecord.runsScored || 0,
        runsAllowed: teamRecord.runsAllowed || 0,
        runDifferential: teamRecord.runDifferential || 0,
        wildCardGamesBack: teamRecord.wildCardGamesBack === '-' ? 0 : parseFloat(teamRecord.wildCardGamesBack || '0'),
        expectedWins: xWL?.wins ?? 0,
        expectedLosses: xWL?.losses ?? 0,
        division,
        league,
        divisionRank: teamRecord.divisionRank ? parseInt(teamRecord.divisionRank) : 0,
        wildCardRank: teamRecord.wildCardRank ? parseInt(teamRecord.wildCardRank) : undefined,
      });
    }
  }

  setCache(cacheKey, teams);
  return teams;
}

export async function fetchMLBScores(date: string): Promise<MLBScoreGame[]> {
  const cacheKey = `mlb-scores-${date}`;
  const cached = getCached<MLBScoreGame[]>(cacheKey);
  if (cached) return cached;

  const url = `${MLB_API_BASE}/schedule?sportId=1&date=${date}&hydrate=team,linescore,broadcasts`;
  const res = await fetchWithRetry(url);
  const data = await res.json();

  const games: MLBScoreGame[] = [];

  for (const dateEntry of data.dates || []) {
    for (const game of dateEntry.games || []) {
      const home = game.teams?.home;
      const away = game.teams?.away;
      const status = game.status?.detailedState || '';
      const isLive = status === 'In Progress' || status === 'Warming Up';

      const gameDate = new Date(game.gameDate || dateEntry.date);
      const timeStr = gameDate.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });

      const scoreGame: MLBScoreGame = {
        gameId: game.gamePk,
        gameState: status,
        startTime: timeStr,
        awayTeam: {
          abbrev: away?.team?.abbreviation || '???',
          name: away?.team?.name || '',
          logo: `https://www.mlbstatic.com/team-logos/${away?.team?.id || 0}.svg`,
          score: away?.score ?? 0,
          wins: away?.leagueRecord?.wins,
          losses: away?.leagueRecord?.losses,
        },
        homeTeam: {
          abbrev: home?.team?.abbreviation || '???',
          name: home?.team?.name || '',
          logo: `https://www.mlbstatic.com/team-logos/${home?.team?.id || 0}.svg`,
          score: home?.score ?? 0,
          wins: home?.leagueRecord?.wins,
          losses: home?.leagueRecord?.losses,
        },
      };

      if (isLive && game.linescore) {
        scoreGame.inning = game.linescore.currentInning;
        scoreGame.inningHalf = game.linescore.isTopInning ? 'Top' : 'Bot';
      }

      // Extract TV networks
      const tvBroadcasts = (game.broadcasts || [])
        .filter((b: { type: string }) => b.type === 'TV')
        .map((b: { name: string }) => b.name)
        .slice(0, 2);
      if (tvBroadcasts.length > 0) {
        scoreGame.tvNetworks = tvBroadcasts.join(', ');
      }

      games.push(scoreGame);
    }
  }

  setCache(cacheKey, games);
  return games;
}

export async function fetchMLBBoxScore(gameId: number): Promise<MLBBoxScoreData> {
  const cacheKey = `mlb-boxscore-${gameId}`;
  const cached = getCached<MLBBoxScoreData>(cacheKey);
  if (cached) return cached;

  const res = await fetchWithRetry(`https://statsapi.mlb.com/api/v1.1/game/${gameId}/feed/live`);
  const data = await res.json();

  const gd = data.gameData;
  const ld = data.liveData;
  const ls = ld?.linescore;
  const bs = ld?.boxscore;

  const parseBatters = (side: 'away' | 'home'): MLBBatterLine[] => {
    const teamBs = bs?.teams?.[side];
    const batterIds: number[] = teamBs?.batters || [];
    const players = teamBs?.players || {};
    return batterIds.map((id: number) => {
      const p = players[`ID${id}`];
      const stats = p?.stats?.batting;
      const season = p?.seasonStats?.batting;
      if (!stats || stats.atBats === undefined) return null;
      return {
        name: p?.person?.fullName || '',
        position: p?.position?.abbreviation || '',
        ab: stats.atBats || 0,
        r: stats.runs || 0,
        h: stats.hits || 0,
        rbi: stats.rbi || 0,
        bb: stats.baseOnBalls || 0,
        so: stats.strikeOuts || 0,
        avg: season?.avg || '.000',
      };
    }).filter((b: MLBBatterLine | null): b is MLBBatterLine => b !== null && (b.ab > 0 || b.bb > 0 || b.r > 0));
  };

  const parsePitchers = (side: 'away' | 'home'): MLBPitcherLine[] => {
    const teamBs = bs?.teams?.[side];
    const pitcherIds: number[] = teamBs?.pitchers || [];
    const players = teamBs?.players || {};
    return pitcherIds.map((id: number) => {
      const p = players[`ID${id}`];
      const stats = p?.stats?.pitching;
      const season = p?.seasonStats?.pitching;
      if (!stats || !stats.inningsPitched) return null;
      let decision: string | undefined;
      if (stats.wins > 0) decision = 'W';
      else if (stats.losses > 0) decision = 'L';
      else if (stats.saves > 0) decision = 'S';
      else if (stats.holds > 0) decision = 'H';
      return {
        name: p?.person?.fullName || '',
        ip: stats.inningsPitched || '0.0',
        h: stats.hits || 0,
        r: stats.runs || 0,
        er: stats.earnedRuns || 0,
        bb: stats.baseOnBalls || 0,
        so: stats.strikeOuts || 0,
        era: season?.era || '0.00',
        decision,
      };
    }).filter(Boolean) as MLBPitcherLine[];
  };

  const plays = ld?.plays;
  const scoringPlayIndices: number[] = plays?.scoringPlays || [];
  const allPlays = plays?.allPlays || [];
  const scoringPlays: MLBScoringPlay[] = scoringPlayIndices.map((idx: number) => {
    const play = allPlays[idx];
    return {
      inning: play?.about?.inning || 0,
      halfInning: play?.about?.halfInning || 'top',
      description: play?.result?.description || '',
      awayScore: play?.result?.awayScore || 0,
      homeScore: play?.result?.homeScore || 0,
    };
  });

  const awayId = gd?.teams?.away?.id || 0;
  const homeId = gd?.teams?.home?.id || 0;

  const result: MLBBoxScoreData = {
    gameId,
    status: gd?.status?.detailedState || '',
    venue: gd?.venue?.name || '',
    dateTime: gd?.datetime?.dateTime || '',
    awayTeam: {
      id: awayId,
      abbreviation: gd?.teams?.away?.abbreviation || '',
      teamName: gd?.teams?.away?.teamName || '',
      logo: `https://www.mlbstatic.com/team-logos/${awayId}.svg`,
      probablePitcherId: gd?.probablePitchers?.away?.id,
    },
    homeTeam: {
      id: homeId,
      abbreviation: gd?.teams?.home?.abbreviation || '',
      teamName: gd?.teams?.home?.teamName || '',
      logo: `https://www.mlbstatic.com/team-logos/${homeId}.svg`,
      probablePitcherId: gd?.probablePitchers?.home?.id,
    },
    linescore: {
      innings: (ls?.innings || []).map((inn: { num: number; away: { runs: number }; home: { runs: number } }) => ({
        num: inn.num,
        away: { runs: inn.away?.runs ?? 0 },
        home: { runs: inn.home?.runs ?? 0 },
      })),
      away: { runs: ls?.teams?.away?.runs || 0, hits: ls?.teams?.away?.hits || 0, errors: ls?.teams?.away?.errors || 0 },
      home: { runs: ls?.teams?.home?.runs || 0, hits: ls?.teams?.home?.hits || 0, errors: ls?.teams?.home?.errors || 0 },
    },
    currentInning: ls?.currentInning,
    inningHalf: ls?.inningHalf,
    batters: { away: parseBatters('away'), home: parseBatters('home') },
    pitchers: { away: parsePitchers('away'), home: parsePitchers('home') },
    scoringPlays,
  };

  if (result.status === 'Final' || result.status === 'Completed Early') {
    setCache(cacheKey, result);
  }

  return result;
}

export async function fetchPitcherStats(playerId: number, season: number): Promise<MLBPitcherPreview | null> {
  if (!playerId) return null;
  const cacheKey = `mlb-pitcher-${playerId}-${season}`;
  const cached = getCached<MLBPitcherPreview>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetchWithRetry(`${MLB_API_BASE}/people/${playerId}?hydrate=stats(group=%5Bpitching%5D,type=%5Bseason%5D,season=${season})`);
    const data = await res.json();
    const p = data.people?.[0];
    const stats = p?.stats?.[0]?.splits?.[0]?.stat;

    const result: MLBPitcherPreview = {
      id: playerId,
      name: p?.fullName || '',
      era: stats?.era || '-.--',
      wins: stats?.wins || 0,
      losses: stats?.losses || 0,
      ip: stats?.inningsPitched || '0.0',
      so: stats?.strikeOuts || 0,
      whip: stats?.whip || '-.--',
    };

    setCache(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

export async function fetchTeamSeasonStats(teamId: number, season: number): Promise<MLBTeamSeasonStats | null> {
  const cacheKey = `mlb-teamstats-${teamId}-${season}`;
  const cached = getCached<MLBTeamSeasonStats>(cacheKey);
  if (cached) return cached;

  try {
    const [hittingRes, pitchingRes] = await Promise.all([
      fetchWithRetry(`${MLB_API_BASE}/teams/${teamId}/stats?stats=season&group=hitting&season=${season}`),
      fetchWithRetry(`${MLB_API_BASE}/teams/${teamId}/stats?stats=season&group=pitching&season=${season}`),
    ]);
    const hittingData = await hittingRes.json();
    const pitchingData = await pitchingRes.json();

    const h = hittingData.stats?.[0]?.splits?.[0]?.stat;
    const p = pitchingData.stats?.[0]?.splits?.[0]?.stat;

    const gamesPlayed = h?.gamesPlayed || 1;
    const result: MLBTeamSeasonStats = {
      batting: {
        avg: h?.avg || '.000',
        ops: h?.ops || '.000',
        hr: h?.homeRuns || 0,
        runsPerGame: (h?.runs / gamesPlayed).toFixed(1) || '0.0',
      },
      pitching: {
        era: p?.era || '0.00',
        whip: p?.whip || '0.00',
        soPerNine: p?.strikeoutsPer9Inn || '0.00',
      },
    };

    setCache(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

export async function fetchRecentGames(teamId: number, season: number, limit = 10): Promise<MLBRecentGame[]> {
  const cacheKey = `mlb-recent-${teamId}-${season}`;
  const cached = getCached<MLBRecentGame[]>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetchWithRetry(`${MLB_API_BASE}/schedule?sportId=1&teamId=${teamId}&season=${season}&gameType=R&hydrate=team,linescore`);
    const data = await res.json();

    const games: MLBRecentGame[] = [];
    for (const dateEntry of data.dates || []) {
      for (const game of dateEntry.games || []) {
        const status = game.status?.detailedState;
        if (status !== 'Final' && status !== 'Completed Early') continue;
        const isHome = game.teams?.home?.team?.id === teamId;
        const teamScore = isHome ? game.teams?.home?.score : game.teams?.away?.score;
        const oppScore = isHome ? game.teams?.away?.score : game.teams?.home?.score;
        const opp = isHome ? game.teams?.away?.team?.abbreviation : game.teams?.home?.team?.abbreviation;
        games.push({
          date: dateEntry.date,
          opponent: opp || '???',
          won: teamScore > oppScore,
          teamScore: teamScore ?? 0,
          oppScore: oppScore ?? 0,
        });
      }
    }

    const result = games.slice(-limit);
    setCache(cacheKey, result);
    return result;
  } catch {
    return [];
  }
}

export async function fetchSeasonSeries(teamId1: number, teamId2: number, season: number): Promise<MLBSeriesRecord> {
  const cacheKey = `mlb-series-${teamId1}-${teamId2}-${season}`;
  const cached = getCached<MLBSeriesRecord>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetchWithRetry(`${MLB_API_BASE}/schedule?sportId=1&teamId=${teamId1}&season=${season}&gameType=R&hydrate=team,linescore`);
    const data = await res.json();

    let wins = 0;
    let losses = 0;
    const games: MLBSeriesRecord['games'] = [];

    for (const dateEntry of data.dates || []) {
      for (const game of dateEntry.games || []) {
        const away = game.teams?.away;
        const home = game.teams?.home;
        const isVsTeam2 = away?.team?.id === teamId2 || home?.team?.id === teamId2;
        if (!isVsTeam2) continue;
        const status = game.status?.detailedState;
        if (status !== 'Final' && status !== 'Completed Early') continue;

        const isHome = home?.team?.id === teamId1;
        const team1Score = isHome ? home?.score : away?.score;
        const team2Score = isHome ? away?.score : home?.score;

        if (team1Score > team2Score) wins++;
        else losses++;

        games.push({
          date: dateEntry.date,
          awayScore: away?.score ?? 0,
          homeScore: home?.score ?? 0,
          awayAbbrev: away?.team?.abbreviation || '',
          homeAbbrev: home?.team?.abbreviation || '',
        });
      }
    }

    const result = { wins, losses, games };
    setCache(cacheKey, result);
    return result;
  } catch {
    return { wins: 0, losses: 0, games: [] };
  }
}
