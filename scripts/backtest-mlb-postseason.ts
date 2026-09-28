/**
 * Backtest the MLB postseason series model: predict every series (best-of-3
 * or longer) from its first game, score against the result, and compare
 * regression / home-field settings. Usage:
 *   npx tsx scripts/backtest-mlb-postseason.ts [--from 2015 --to 2025]
 */
import { teamStrength, seriesWinProb, type MLBTeamRecord } from '../lib/utils/mlbPostseasonOdds';

const arg = (name: string, def: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : def;
};
const FROM = arg('from', 2015);
const TO = arg('to', 2025);

interface Series { season: number; bestOf: number; a: number; b: number; aHome: boolean[]; aWon: boolean }

async function json(url: string) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  return res.json();
}

async function loadSeason(season: number) {
  const st = await json(`https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason`);
  const records = new Map<number, MLBTeamRecord>();
  for (const rec of st.records || []) {
    for (const t of rec.teamRecords) records.set(t.team.id, { wins: t.wins, losses: t.losses, runsScored: t.runsScored, runsAllowed: t.runsAllowed });
  }
  const sch = await json(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&season=${season}&gameType=F,D,L,W`);
  const games = (sch.dates || []).flatMap((d: any) => d.games).filter((g: any) => g.status?.abstractGameState === 'Final' && g.status?.detailedState !== 'Postponed');
  const bySeries = new Map<string, any[]>();
  for (const g of games) {
    const ids = [g.teams.home.team.id, g.teams.away.team.id].sort().join('-');
    const key = `${g.seriesDescription}|${ids}`;
    bySeries.set(key, [...(bySeries.get(key) || []), g]);
  }
  const series: Series[] = [];
  for (const list of bySeries.values()) {
    list.sort((x, y) => (x.seriesGameNumber || 0) - (y.seriesGameNumber || 0) || x.gameDate.localeCompare(y.gameDate));
    const bestOf = list[0].gamesInSeries || list.length;
    if (bestOf < 3) continue;
    const a = list[0].teams.home.team.id;
    const b = list[0].teams.away.team.id;
    let aw = 0;
    let bw = 0;
    for (const g of list) {
      const aIsHome = g.teams.home.team.id === a;
      const aWin = aIsHome ? g.teams.home.isWinner : g.teams.away.isWinner;
      if (aWin) aw++; else bw++;
    }
    // Full-length host pattern from the games played, padded with the standard format.
    const std = bestOf === 3 ? [true, true, true] : bestOf === 5 ? [true, true, false, false, true] : [true, true, false, false, false, true, true];
    const aHome = std.map((h, i) => (list[i] ? list[i].teams.home.team.id === a : h));
    if (!records.has(a) || !records.has(b)) continue;
    series.push({ season, bestOf, a, b, aHome, aWon: aw > bw });
  }
  return { records, series };
}

(async () => {
  const seasons = [];
  for (let s = FROM; s <= TO; s++) seasons.push(await loadSeason(s));
  const all = seasons.flatMap((x) => x.series.map((sr) => ({ ...sr, records: x.records })));
  console.log(`${all.length} series, ${FROM}-${TO}. Host (game 1 home team) won ${all.filter((s) => s.aWon).length}.`);

  const score = (regression: number, homeLogit: number) => {
    let brier = 0;
    let logLoss = 0;
    for (const s of all) {
      const sa = teamStrength(s.records.get(s.a)!, regression);
      const sb = teamStrength(s.records.get(s.b)!, regression);
      const p = seriesWinProb(sa, sb, s.bestOf, 0, 0, s.aHome, homeLogit);
      const y = s.aWon ? 1 : 0;
      brier += (p - y) ** 2;
      logLoss += -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
    }
    return { brier: brier / all.length, logLoss: logLoss / all.length };
  };

  console.log('coin flip: brier 0.2500, logloss 0.6931');
  for (const homeLogit of [0, 0.08, 0.16]) {
    for (const regression of [0.25, 0.5, 0.75, 1]) {
      const r = score(regression, homeLogit);
      console.log(`home ${homeLogit.toFixed(2)} regression ${regression.toFixed(2)}: brier ${r.brier.toFixed(4)}, logloss ${r.logLoss.toFixed(4)}`);
    }
  }
})();
