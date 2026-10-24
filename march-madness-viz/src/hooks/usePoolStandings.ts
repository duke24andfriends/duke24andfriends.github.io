import { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { ROUNDS, getPointsForGame, getRoundNameFromGameId } from '../types';

export type RoundKey = keyof typeof ROUNDS;

export const ROUND_ORDER: RoundKey[] = [
  'ROUND_64',
  'ROUND_32',
  'SWEET_16',
  'ELITE_8',
  'FINAL_FOUR',
  'CHAMPIONSHIP',
];

export const ROUND_LABELS: Record<RoundKey, { long: string; short: string }> = {
  ROUND_64: { long: 'Round of 64', short: 'R64' },
  ROUND_32: { long: 'Round of 32', short: 'R32' },
  SWEET_16: { long: 'Sweet 16', short: 'S16' },
  ELITE_8: { long: 'Elite 8', short: 'E8' },
  FINAL_FOUR: { long: 'Final Four', short: 'F4' },
  CHAMPIONSHIP: { long: 'Championship', short: 'Champ' },
};

/** Every round is worth the same total (e.g. 32 games x 10 pts). */
export const ROUND_MAX_POINTS = 320;

export interface Standing {
  username: string;
  fullName: string;
  bracketName: string;
  score: number;
  maxPossible: number;
  rank: number;
  previousRank: number;
  /** Positive means the bracket moved up. */
  rankChange: number;
  delta: number;
  roundScores: Record<RoundKey, number>;
  /** Cumulative score after each completed game, in play order. */
  history: number[];
  champion?: string;
}

export interface PoolSummary {
  totalBrackets: number;
  average: number;
  median: number;
  highestPossible: number;
  low: number;
  high: number;
  gamesPlayed: number;
}

function competitionRanks(scores: Map<string, number>): Map<string, number> {
  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const ranks = new Map<string, number>();
  sorted.forEach(([user, score], i) => {
    const prev = sorted[i - 1];
    ranks.set(user, prev && prev[1] === score ? ranks.get(prev[0])! : i + 1);
  });
  return ranks;
}

/**
 * Standings derived directly from bracket picks and results.
 * `lookback` is how many games back to compare against for deltas and rank movement.
 */
export function usePoolStandings(lookback = 1) {
  const { bracketData, gameResults, userNameMapping } = useData();

  return useMemo(() => {
    if (!bracketData) {
      return { standings: [] as Standing[], summary: null as PoolSummary | null };
    }

    const usernames = new Set<string>();
    Object.values(bracketData.games).forEach((game) =>
      Object.keys(game.picks).forEach((u) => usernames.add(u))
    );
    const users = [...usernames];

    const ordered = [...gameResults].sort((a, b) => a.order - b.order);
    const eliminated = new Set(gameResults.map((r) => r.loser));
    const completed = new Set(gameResults.map((r) => r.gameId));

    const running = new Map<string, number>(users.map((u) => [u, 0]));
    const history = new Map<string, number[]>(users.map((u) => [u, []]));
    const roundScores = new Map<string, Record<RoundKey, number>>(
      users.map((u) => [
        u,
        Object.fromEntries(ROUND_ORDER.map((r) => [r, 0])) as Record<RoundKey, number>,
      ])
    );

    for (const result of ordered) {
      const picks = bracketData.games[result.gameId]?.picks ?? {};
      const points = getPointsForGame(result.gameId);
      const round = getRoundNameFromGameId(result.gameId) as RoundKey;
      for (const u of users) {
        if (picks[u] === result.winner) {
          running.set(u, running.get(u)! + points);
          roundScores.get(u)![round] += points;
        }
        history.get(u)!.push(running.get(u)!);
      }
    }

    const step = Math.min(lookback, ordered.length);
    const previousScores = new Map<string, number>(
      users.map((u) => {
        const h = history.get(u)!;
        return [u, h.length - step > 0 ? h[h.length - step - 1] : 0];
      })
    );

    const currentRanks = competitionRanks(running);
    const previousRanks = competitionRanks(previousScores);

    const standings: Standing[] = users.map((u) => {
      let maxPossible = running.get(u)!;
      Object.entries(bracketData.games).forEach(([gameId, game]) => {
        const pick = game.picks[u];
        if (!completed.has(gameId) && pick && !eliminated.has(pick)) {
          maxPossible += getPointsForGame(gameId);
        }
      });
      const mapping = userNameMapping[u];
      const rank = currentRanks.get(u)!;
      const previousRank = previousRanks.get(u)!;
      return {
        username: u,
        fullName: mapping?.fullName || u,
        bracketName: mapping?.bracketName || u,
        score: running.get(u)!,
        maxPossible,
        rank,
        previousRank,
        rankChange: step > 0 ? previousRank - rank : 0,
        delta: running.get(u)! - previousScores.get(u)!,
        roundScores: roundScores.get(u)!,
        history: history.get(u)!,
        champion: bracketData.games['63']?.picks[u],
      };
    });

    standings.sort((a, b) => a.rank - b.rank || b.maxPossible - a.maxPossible);

    const scores = standings.map((s) => s.score).sort((a, b) => a - b);
    const mid = Math.floor(scores.length / 2);
    const summary: PoolSummary = {
      totalBrackets: bracketData.metadata.total_brackets || users.length,
      average: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      median: scores.length
        ? scores.length % 2
          ? scores[mid]
          : Math.round((scores[mid - 1] + scores[mid]) / 2)
        : 0,
      highestPossible: Math.max(0, ...standings.map((s) => s.maxPossible)),
      low: scores[0] ?? 0,
      high: scores[scores.length - 1] ?? 0,
      gamesPlayed: ordered.length,
    };

    return { standings, summary };
  }, [bracketData, gameResults, userNameMapping, lookback]);
}

export function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
