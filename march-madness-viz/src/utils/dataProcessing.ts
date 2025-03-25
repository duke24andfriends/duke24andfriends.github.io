import { BracketData, GameWinner, UserScore, TeamConfidence, getRoundNameFromGameId, getPointsForGame, ROUNDS } from '../types';

/**
 * Calculate scores for each user based on bracket data and game winners
 */
export const calculateScores = (bracketData: BracketData, gameWinners: GameWinner[]): UserScore[] => {
  const userScores: { [username: string]: UserScore } = {};
  const completedGameIds = gameWinners.map(game => game.gameId);
  
  // Initialize user scores
  Object.values(bracketData.games).forEach(game => {
    Object.keys(game.picks).forEach(username => {
      if (!userScores[username]) {
        userScores[username] = {
          username,
          score: 0,
          correctPicks: 0,
          totalPicks: 0
        };
      }
    });
  });
  
  // Calculate scores based on completed games
  gameWinners.forEach(gameWinner => {
    const gameId = gameWinner.gameId;
    const game = bracketData.games[gameId];
    const points = getPointsForGame(gameId);
    
    if (game) {
      Object.entries(game.picks).forEach(([username, pick]) => {
        userScores[username].totalPicks += 1;
        
        if (pick === gameWinner.winner) {
          userScores[username].score += points;
          userScores[username].correctPicks += 1;
        }
      });
    }
  });
  
  return Object.values(userScores).sort((a, b) => b.score - a.score);
};

/**
 * Calculate team confidence data (what % of users picked each team for each round)
 */
export const calculateTeamConfidence = (bracketData: BracketData): TeamConfidence[] => {
  const teams = new Set<string>();
  const totalUsers = bracketData.metadata.total_brackets;
  
  // Get all teams that appear in the bracket
  Object.values(bracketData.games).forEach(game => {
    Object.values(game.picks).forEach(teamCode => {
      teams.add(teamCode);
    });
  });
  
  const teamConfidence: TeamConfidence[] = Array.from(teams).map(team => ({
    team,
    round64: 0,
    round32: 0,
    sweet16: 0,
    elite8: 0,
    finalFour: 0,
    championship: 0
  }));

  // Count team appearances in each round
  Object.entries(bracketData.games).forEach(([gameId, game]) => {
    const round = getRoundNameFromGameId(gameId);
    const roundLower = round.toLowerCase().replace('_', '');
    
    Object.values(game.stats.pick_distribution).forEach((count, index) => {
      const teamCode = Object.keys(game.stats.pick_distribution)[index];
      const team = teamConfidence.find(t => t.team === teamCode);
      
      if (team) {
        // @ts-ignore - dynamically accessing property
        team[roundLower] = (count / totalUsers) * 100;
      }
    });
  });
  
  return teamConfidence.sort((a, b) => b.championship - a.championship);
};

/**
 * Calculate pick accuracy for each round
 */
export const calculateRoundAccuracy = (bracketData: BracketData, gameWinners: GameWinner[]) => {
  const accuracy: { [round: string]: { correct: number, total: number, accuracy: number } } = {
    ROUND_64: { correct: 0, total: 0, accuracy: 0 },
    ROUND_32: { correct: 0, total: 0, accuracy: 0 },
    SWEET_16: { correct: 0, total: 0, accuracy: 0 },
    ELITE_8: { correct: 0, total: 0, accuracy: 0 },
    FINAL_FOUR: { correct: 0, total: 0, accuracy: 0 },
    CHAMPIONSHIP: { correct: 0, total: 0, accuracy: 0 }
  };
  
  // Map of game winners for easy lookup
  const winnerMap: { [gameId: string]: string } = {};
  gameWinners.forEach(game => {
    winnerMap[game.gameId] = game.winner;
  });
  
  // Calculate accuracy for each round
  Object.entries(bracketData.games).forEach(([gameId, game]) => {
    const winner = winnerMap[gameId];
    if (!winner) return; // Skip games that haven't been played
    
    const round = getRoundNameFromGameId(gameId);
    
    Object.values(game.picks).forEach(pick => {
      accuracy[round].total += 1;
      if (pick === winner) {
        accuracy[round].correct += 1;
      }
    });
  });
  
  // Calculate percentage accuracy
  Object.keys(accuracy).forEach(round => {
    if (accuracy[round].total > 0) {
      accuracy[round].accuracy = (accuracy[round].correct / accuracy[round].total) * 100;
    }
  });
  
  return accuracy;
};

/**
 * Calculate leaderboard changes over time (as games are completed)
 */
export const calculateLeaderboardTrend = (bracketData: BracketData, gameWinners: GameWinner[]) => {
  const trends: { gameId: string, scores: UserScore[] }[] = [];
  const sortedGameWinners = [...gameWinners].sort((a, b) => parseInt(a.gameId) - parseInt(b.gameId));
  
  // Calculate leaderboard after each game
  for (let i = 0; i < sortedGameWinners.length; i++) {
    const currentGameWinners = sortedGameWinners.slice(0, i + 1);
    const scores = calculateScores(bracketData, currentGameWinners);
    trends.push({
      gameId: currentGameWinners[i].gameId,
      scores: scores.slice(0, 10) // Top 10 users
    });
  }
  
  return trends;
};

/**
 * Calculate hypothetical scores based on predicted winners
 */
export const calculateHypotheticalScores = (
  bracketData: BracketData, 
  actualGameWinners: GameWinner[], 
  predictedGameWinners: GameWinner[]
): UserScore[] => {
  // Combine actual and predicted winners, with predicted taking precedence if there's overlap
  const mergedWinners: { [gameId: string]: string } = {};
  actualGameWinners.forEach(game => {
    mergedWinners[game.gameId] = game.winner;
  });
  
  predictedGameWinners.forEach(game => {
    mergedWinners[game.gameId] = game.winner;
  });
  
  const combinedWinners = Object.entries(mergedWinners).map(([gameId, winner]) => ({
    gameId,
    winner
  }));
  
  return calculateScores(bracketData, combinedWinners);
};

/**
 * Calculate win probability for each user based on game probabilities
 */
export const calculateWinProbability = (
  bracketData: BracketData,
  actualGameWinners: GameWinner[],
  gameProbabilities: { [gameId: string]: { [teamCode: string]: number } }
) => {
  // Get actual score from completed games
  const baseScores = calculateScores(bracketData, actualGameWinners);
  const userBaseScores: { [username: string]: number } = {};
  baseScores.forEach(score => {
    userBaseScores[score.username] = score.score;
  });
  
  // Get all incomplete game IDs
  const completedGameIds = new Set(actualGameWinners.map(game => game.gameId));
  const incompleteGameIds = Object.keys(bracketData.games).filter(gameId => !completedGameIds.has(gameId));
  
  // Run simulations (simple expected value calculation)
  const userExpectedScores: { [username: string]: number } = { ...userBaseScores };
  
  incompleteGameIds.forEach(gameId => {
    const game = bracketData.games[gameId];
    const points = getPointsForGame(gameId);
    const probs = gameProbabilities[gameId] || {};
    
    Object.entries(game.picks).forEach(([username, teamPick]) => {
      // Add expected points based on win probability
      const winProb = probs[teamPick] || 0;
      userExpectedScores[username] += points * winProb;
    });
  });
  
  // Sort by expected score
  const results = Object.entries(userExpectedScores)
    .map(([username, expectedScore]) => ({
      username,
      expectedScore,
      baseScore: userBaseScores[username],
      winProbability: 0 // Will be calculated below
    }))
    .sort((a, b) => b.expectedScore - a.expectedScore);
  
  // Simple win probability - this could be improved with more sophisticated simulations
  const totalExpectedScore = results.reduce((sum, user) => sum + user.expectedScore, 0);
  results.forEach(user => {
    user.winProbability = (user.expectedScore / totalExpectedScore) * 100;
  });
  
  return results;
};

/**
 * Parse game winners CSV data
 */
export const parseGameWinners = (csvText: string): GameWinner[] => {
  const lines = csvText.trim().split('\n');
  const winners: GameWinner[] = [];
  
  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const [gameId, winner] = lines[i].split(',');
    if (gameId && winner) {
      winners.push({
        gameId,
        winner: winner.trim()
      });
    }
  }
  
  return winners;
};

// Parse game results CSV
export function parseGameResults(csv: string): { 
  gameId: string; 
  winner: string; 
  loser: string; 
  order: number;
  winnerSeed: number;
  loserSeed: number;
}[] {
  // Split CSV into lines
  const lines = csv.split('\n');
  
  // Extract header row and find column indices
  const header = lines[0].split(',').map(col => col.trim());
  const gameIdIndex = header.indexOf('Game ID');
  const winnerIndex = header.indexOf('Winner');
  const loserIndex = header.indexOf('Loser');
  const orderIndex = header.indexOf('Order');
  const winnerSeedIndex = header.indexOf('Winner Seed');
  const loserSeedIndex = header.indexOf('Loser Seed');

  
  // Parse data rows
  return lines.slice(1)
  .filter(line => line.trim() !== '')
  .map(line => {
    const columns = line.split(',').map(col => col.trim().replace(/\r$/, ''));
    
    return {
      gameId: columns[gameIdIndex],
      winner: columns[winnerIndex],
      loser: columns[loserIndex],
      order: parseInt(columns[orderIndex], 10),
      winnerSeed: parseInt(columns[winnerSeedIndex], 10),
      loserSeed: parseInt(columns[loserSeedIndex], 10)
    };
  });
}

// Get opponent for a team in a game
export function getOpponent(gameResults: { gameId: string; winner: string; loser: string }[], 
                          gameId: string, 
                          team: string): string {
  const game = gameResults.find(g => g.gameId === gameId);
  if (!game) return '';
  
  if (game.winner === team) return game.loser;
  if (game.loser === team) return game.winner;
  
  return '';
} 