import { GameResult } from '../types';

/** Matches nav "Rounds" link: current tournament round from completed games. */
export function getMostRecentRound(gameResults: GameResult[]): string {
  if (!gameResults || gameResults.length === 0) return 'ROUND_64';

  const maxGameId = Math.max(...gameResults.map((game) => parseInt(game.gameId, 10)));

  if (maxGameId <= 32) return 'ROUND_64';
  if (maxGameId <= 48) return 'ROUND_32';
  if (maxGameId <= 56) return 'SWEET_16';
  if (maxGameId <= 60) return 'ELITE_8';
  if (maxGameId <= 62) return 'FINAL_FOUR';
  if (maxGameId <= 63) return 'CHAMPIONSHIP';

  return 'ROUND_64';
}
