import { BracketData, GameResult } from '../types';

export interface StrategyMetrics {
  /** % of picks that took the best-seeded team among those picked for that game. */
  chalk: number;
  /** % of picks that matched the pool's most popular pick. */
  herding: number;
  /** Sum over games of how unpopular a non-consensus pick was (0 = always with the crowd). */
  deviation: number;
}

export interface StrategyPercentiles {
  chalk: number;
  herding: number;
  deviation: number;
}

export function computeStrategyMetrics(bracketData: BracketData, gameResults: GameResult[]): Map<string, StrategyMetrics> {
  const seed = new Map<string, number>();
  gameResults.forEach((r) => {
    seed.set(r.winner, r.winnerSeed);
    seed.set(r.loser, r.loserSeed);
  });

  const totals = new Map<string, { chalk: number; herding: number; deviation: number; picks: number }>();

  Object.values(bracketData.games).forEach((game) => {
    const counts: Record<string, number> = {};
    Object.values(game.picks).forEach((pick) => {
      counts[pick] = (counts[pick] || 0) + 1;
    });

    let chalkPick = '';
    let bestSeed = Infinity;
    let popularPick = '';
    let maxPicks = 0;
    Object.entries(counts).forEach(([team, n]) => {
      const s = seed.get(team);
      if (s !== undefined && s < bestSeed) {
        bestSeed = s;
        chalkPick = team;
      }
      if (n > maxPicks) {
        maxPicks = n;
        popularPick = team;
      }
    });

    Object.entries(game.picks).forEach(([user, pick]) => {
      const t = totals.get(user) ?? { chalk: 0, herding: 0, deviation: 0, picks: 0 };
      t.picks += 1;
      if (pick === chalkPick) t.chalk += 1;
      if (pick === popularPick) t.herding += 1;
      else t.deviation += 1 - (counts[pick] || 0) / maxPicks;
      totals.set(user, t);
    });
  });

  const result = new Map<string, StrategyMetrics>();
  totals.forEach((t, user) => {
    result.set(user, {
      chalk: t.picks ? (t.chalk / t.picks) * 100 : 0,
      herding: t.picks ? (t.herding / t.picks) * 100 : 0,
      deviation: t.deviation,
    });
  });
  return result;
}

/** Share of the pool (0–100) that this user scores at or above, per metric. */
export function strategyPercentiles(all: Map<string, StrategyMetrics>, username: string): StrategyPercentiles | null {
  const me = all.get(username);
  if (!me) return null;
  const values = [...all.values()];
  const pct = (key: keyof StrategyMetrics) =>
    (values.filter((v) => v[key] <= me[key]).length / values.length) * 100;
  return { chalk: pct('chalk'), herding: pct('herding'), deviation: pct('deviation') };
}
