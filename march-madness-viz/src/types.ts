// Game related types
export interface GameWinner {
  gameId: string;
  winner: string;
}

export interface GameResult {
  gameId: string;
  winner: string;
  loser: string;
  winnerSeed: number;
  loserSeed: number;
}

export interface BracketData {
  games: {
    [gameId: string]: {
      stats: {
        pick_distribution: { [team: string]: number };
        total_picks: number;
      };
      picks?: { [username: string]: string };
    };
  };
  metadata: {
    total_brackets: number;
  };
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

export interface UserScore {
  username: string;
  score: number;
  actualScore: number;
  roundScores?: {
    [round: string]: number;
  };
  maxPossibleScore?: number;
  champion?: string;
}

// Round definitions
export const ROUNDS = {
  ROUND_64: Array.from({ length: 32 }, (_, i) => (i + 1).toString()),
  ROUND_32: Array.from({ length: 16 }, (_, i) => (i + 33).toString()),
  SWEET_16: Array.from({ length: 8 }, (_, i) => (i + 49).toString()),
  ELITE_8: Array.from({ length: 4 }, (_, i) => (i + 57).toString()),
  FINAL_FOUR: Array.from({ length: 2 }, (_, i) => (i + 61).toString()),
  CHAMPIONSHIP: ['63']
} as const;

// Function to determine the round name from a game ID
export const getRoundNameFromGameId = (gameId: string): string => {
  const id = parseInt(gameId);
  if (id <= 32) return "ROUND_64";
  if (id <= 48) return "ROUND_32";
  if (id <= 56) return "SWEET_16";
  if (id <= 60) return "ELITE_8";
  if (id <= 62) return "FINAL_FOUR";
  return "CHAMPIONSHIP";
};

// Function to get points for a game based on its round
export const getPointsForGame = (gameId: string): number => {
  const roundName = getRoundNameFromGameId(gameId);
  switch (roundName) {
    case 'ROUND_64': return 10;
    case 'ROUND_32': return 20;
    case 'SWEET_16': return 40;
    case 'ELITE_8': return 80;
    case 'FINAL_FOUR': return 160;
    case 'CHAMPIONSHIP': return 320;
    default: return 0;
  }
}; 