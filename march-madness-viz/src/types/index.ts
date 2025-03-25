export interface BracketData {
  metadata: {
    total_brackets: number;
    group_url: string;
  };
  games: {
    [gameId: string]: GameData;
  };
  total_brackets: number;
}

export interface GameData {
  picks: {
    [username: string]: string; // Team code that the user picked
  };
  stats: {
    total_picks: number;
    pick_distribution: {
      [teamCode: string]: number; // Number of users who picked this team
    };
  };
}

export interface GameWinner {
  gameId: string;
  winner: string;
}

export interface GameResult {
  gameId: string;
  winner: string;
  loser: string;
  order: number;
  winnerSeed: number;
  loserSeed: number;
}

export interface UserScore {
  username: string;
  score: number;
  correctPicks: number;
  totalPicks: number;
  roundScores?: {
    [round: string]: number;
  };
  maxPossibleScore?: number;
  champion?: string;
}

export interface TeamConfidence {
  team: string;
  round64: number;
  round32: number;
  sweet16: number;
  elite8: number;
  finalFour: number;
  championship: number;
}

export interface RoundAccuracy {
  correct: number;
  total: number;
  accuracy: number;
}

export interface LeaderboardTrend {
  gameId: string;
  scores: UserScore[];
  order?: number;
}

// Game IDs by round
export const ROUNDS = {
  ROUND_64: Array.from({ length: 32 }, (_, i) => String(i + 1)),
  ROUND_32: Array.from({ length: 16 }, (_, i) => String(i + 33)),
  SWEET_16: Array.from({ length: 8 }, (_, i) => String(i + 49)),
  ELITE_8: Array.from({ length: 4 }, (_, i) => String(i + 57)),
  FINAL_FOUR: ["61", "62"],
  CHAMPIONSHIP: ["63"]
};

// Points per round
export const POINTS_PER_ROUND = {
  ROUND_64: 10,
  ROUND_32: 20,
  SWEET_16: 40,
  ELITE_8: 80,
  FINAL_FOUR: 160,
  CHAMPIONSHIP: 320
};

// Helper function to get the round name from a game ID
export function getRoundNameFromGameId(gameId: string): string {
  const id = Number(gameId);
  if (id >= 1 && id <= 32) return "ROUND_64";
  if (id >= 33 && id <= 48) return "ROUND_32";
  if (id >= 49 && id <= 56) return "SWEET_16";
  if (id >= 57 && id <= 60) return "ELITE_8";
  if (id === 61 || id === 62) return "FINAL_FOUR";
  if (id === 63) return "CHAMPIONSHIP";
  return "";
}

// Helper function to get points for a game based on its ID
export function getPointsForGame(gameId: string): number {
  const roundName = getRoundNameFromGameId(gameId);
  return POINTS_PER_ROUND[roundName as keyof typeof POINTS_PER_ROUND] || 0;
} 