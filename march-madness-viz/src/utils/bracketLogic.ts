import { GameWinner, GameResult, getRoundNameFromGameId } from '../types';

// Interface definitions
export interface GameProbability {
  [team: string]: number;
}

export interface GameProbabilities {
  [gameId: string]: GameProbability;
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

export interface ProbabilityScore extends UserScore {
  baseScore: number;
  expectedScore: number;
  winProbability: number;
}

// For paths to victory
export interface CriticalGame {
  gameId: string;
  teams: string[];
  impact: number;
}

export interface PathToVictory {
  username: string;
  possiblePaths: number;
  criticalGames: CriticalGame[];
}

// Game dependency mapping
export const gameToFeederGames: Record<string, string[]> = {
  // Round of 32
  "33": ["1", "2"], "34": ["3", "4"], "35": ["5", "6"], "36": ["7", "8"],
  "37": ["9", "10"], "38": ["11", "12"], "39": ["13", "14"], "40": ["15", "16"],
  "41": ["17", "18"], "42": ["19", "20"], "43": ["21", "22"], "44": ["23", "24"],
  "45": ["25", "26"], "46": ["27", "28"], "47": ["29", "30"], "48": ["31", "32"],
  
  // Sweet 16
  "49": ["33", "34"], "50": ["35", "36"], "51": ["37", "38"], "52": ["39", "40"],
  "53": ["41", "42"], "54": ["43", "44"], "55": ["45", "46"], "56": ["47", "48"],
  
  // Elite 8
  "57": ["49", "50"], "58": ["51", "52"], "59": ["53", "54"], "60": ["55", "56"],
  
  // Final Four
  "61": ["57", "58"], "62": ["59", "60"],
  
  // Championship
  "63": ["61", "62"]
};

// Find all games that depend on a given game
export const findDependentGames = (gameId: string): string[] => {
  const dependentGames: string[] = [];
  
  // Create a reverse map to find games that use a given game as input
  const reverseMap: Record<string, string[]> = {};
  
  Object.entries(gameToFeederGames).forEach(([game, feeders]) => {
    feeders.forEach(feeder => {
      if (!reverseMap[feeder]) {
        reverseMap[feeder] = [];
      }
      reverseMap[feeder].push(game);
    });
  });
  
  // Recursively find all dependent games
  const findDependent = (gId: string) => {
    if (reverseMap[gId]) {
      reverseMap[gId].forEach(depGame => {
        dependentGames.push(depGame);
        findDependent(depGame);
      });
    }
  };
  
  findDependent(gameId);
  
  return dependentGames;
};

// Get game teams from bracketData
export const getGameTeams = (
  gameId: string, 
  bracketData: any
): string[] => {
  if (!bracketData || !bracketData.games[gameId]) return [];
  const game = bracketData.games[gameId];
  return Object.keys(game.stats.pick_distribution);
};

// Get game teams considering previous game results
export const getGameTeamsConsistent = (
  gameId: string, 
  bracketData: any, 
  gameResults: any[], 
  gameWinners: GameWinner[], 
  predictedWinners: GameWinner[]
): string[] => {
  if (!bracketData) return [];
  
  const game = bracketData.games[gameId];
  if (!game) return [];
  
  // For first round games, pull from gameResults to ensure we have all teams including 16 seeds
  const roundName = getRoundNameFromGameId(gameId);
  if (roundName === "ROUND_64") {
    // Find this game in gameResults to get both winner and loser
    const gameResult = gameResults.find(result => result.gameId === gameId);
    if (gameResult) {
      return [gameResult.winner, gameResult.loser];
    }
    // If not found in gameResults, fall back to bracket data
    return Object.keys(game.stats.pick_distribution);
  }
  
  // For later rounds, the teams should be determined by winners of previous games
  const feederGames = gameToFeederGames[gameId];
  if (!feederGames) return Object.keys(game.stats.pick_distribution);
  
  // Determine which teams should be in this game based on previous winners
  const teams: string[] = [];
  
  for (const feederGameId of feederGames) {
    // Check if there's an actual winner for this feeder game
    const actualWinner = gameWinners.find(w => w.gameId === feederGameId)?.winner;
    
    // Or a predicted winner
    const predictedWinner = predictedWinners.find(w => w.gameId === feederGameId)?.winner;
    
    if (actualWinner) {
      teams.push(actualWinner);
    } else if (predictedWinner) {
      teams.push(predictedWinner);
    } else {
      // If no winner is determined, just show "TBD"
      teams.push("TBD");
    }
  }
  
  return teams;
};

// Get the predicted winner for a game
export const getPredictedWinner = (gameId: string, predictedWinners: GameWinner[]): string => {
  return predictedWinners.find(g => g.gameId === gameId)?.winner || '';
};

// Get the actual winner for a game
export const getActualWinner = (gameId: string, gameWinners: GameWinner[]): string => {
  return gameWinners.find(g => g.gameId === gameId)?.winner || '';
};

// Determine if we have a winner (actual or predicted) for a game
export const hasWinner = (
  gameId: string, 
  gameWinners: GameWinner[], 
  predictedWinners: GameWinner[]
): boolean => {
  return !!getActualWinner(gameId, gameWinners) || !!getPredictedWinner(gameId, predictedWinners);
};

// Update game probability
export const updateGameProbability = (
  gameId: string, 
  team: string, 
  probability: number,
  gameProbabilities: GameProbabilities,
  getGameTeams: (gameId: string) => string[]
): GameProbabilities => {
  const otherTeam = getGameTeams(gameId).find(t => t !== team);
  if (!otherTeam) return gameProbabilities;
  
  const gameProbs = { ...(gameProbabilities[gameId] || {}) };
  gameProbs[team] = probability;
  gameProbs[otherTeam] = 1 - probability;
  
  return {
    ...gameProbabilities,
    [gameId]: gameProbs
  };
};

// Simulate random outcomes based on probabilities
export const simulateRandomOutcomes = (
  bracketData: any,
  gameProbabilities: GameProbabilities,
  getActualWinner: (gameId: string) => string,
  getGameTeamsConsistent: (gameId: string) => string[]
): GameWinner[] => {
  if (!bracketData) return [];
  
  // Get all unplayed games
  const unplayedGameIds = Object.keys(bracketData.games).filter(
    gameId => !getActualWinner(gameId)
  );
  
  // For each unplayed game, randomly select a winner based on probabilities
  const newPredictions: GameWinner[] = [];
  
  unplayedGameIds.forEach(gameId => {
    const teams = getGameTeamsConsistent(gameId);
    if (teams.length !== 2 || teams.includes("TBD")) return;
    
    // Get probabilities for this game, default to 50/50 if not set
    const probs = gameProbabilities[gameId] || {
      [teams[0]]: 0.5,
      [teams[1]]: 0.5
    };
    
    // Generate a random number between 0 and 1
    const rand = Math.random();
    
    // Select winner based on probabilities
    let winner = teams[0];
    if (rand > probs[teams[0]]) {
      winner = teams[1];
    }
    
    // Add to predictions
    newPredictions.push({ gameId, winner });
  });
  
  return newPredictions;
};

// Set popular picks to win based on pick distribution
export const setPopularWinners = (
  bracketData: any,
  incompleteGames: Array<[string, any]>
): GameWinner[] => {
  if (!bracketData) return [];
  
  const popularPicks: GameWinner[] = [];
  
  incompleteGames.forEach(([gameId, game]) => {
    if (!game || !game.stats || !game.stats.pick_distribution) return;
    
    // Get the teams and their pick counts
    const pickDistribution = game.stats.pick_distribution;
    const teams = Object.keys(pickDistribution);
    
    if (teams.length < 2) return;
    
    // Find the team with the most picks
    let mostPopularTeam = '';
    let maxPicks = 0;
    
    teams.forEach(team => {
      const pickCount = pickDistribution[team] || 0;
      if (pickCount > maxPicks) {
        maxPicks = pickCount;
        mostPopularTeam = team;
      }
    });
    
    if (mostPopularTeam) {
      popularPicks.push({
        gameId,
        winner: mostPopularTeam
      });
    }
  });
  
  return popularPicks;
};

// Set pick percentage probabilities
export const setPickPercentageProbabilities = (
  bracketData: any,
  incompleteGames: Array<[string, any]>
): GameProbabilities => {
  if (!bracketData) return {};
  
  const probabilities: GameProbabilities = {};
  
  incompleteGames.forEach(([gameId, game]) => {
    if (!game || !game.stats || !game.stats.pick_distribution) return;
    
    const teams = Object.keys(game.stats.pick_distribution);
    if (teams.length !== 2) return;
    
    const totalPicks = game.stats.total_picks;
    const prob1 = game.stats.pick_distribution[teams[0]] / totalPicks;
    
    probabilities[gameId] = {
      [teams[0]]: prob1,
      [teams[1]]: 1 - prob1
    };
  });
  
  return probabilities;
};

// Set equal 50/50 probabilities
export const setEqualProbabilities = (
  bracketData: any,
  incompleteGames: Array<[string, any]>
): GameProbabilities => {
  if (!bracketData) return {};
  
  const probabilities: GameProbabilities = {};
  
  incompleteGames.forEach(([gameId, game]) => {
    if (!game || !game.stats || !game.stats.pick_distribution) return;
    
    const teams = Object.keys(game.stats.pick_distribution);
    if (teams.length !== 2) return;
    
    probabilities[gameId] = {
      [teams[0]]: 0.5,
      [teams[1]]: 0.5
    };
  });
  
  return probabilities;
};

// Define regions and their game IDs
export const getBracketRegions = () => {
  return {
    SOUTH: { // Auburn region (Top Left)
      name: "South",
      // Order: 1/16, 8/9, 5/12, 4/13, 6/11, 3/14, 7/10, 2/15
      round64: ["1", "2", "3", "4", "5", "6", "7", "8"],
      round32: ["33", "34", "35", "36"],                   
      sweet16: ["49", "50"],                              
      elite8: ["57"]                                      
    },
    WEST: { // Duke region (Top Right)
      name: "West",
      // Order: 1/16, 8/9, 5/12, 4/13, 6/11, 3/14, 7/10, 2/15
      round64: ["9", "10", "11", "12", "13", "14", "15", "16"],
      round32: ["37", "38", "39", "40"],
      sweet16: ["51", "52"],
      elite8: ["58"]
    },
    EAST: { // Houston region (Bottom Right)
      name: "East",
      // Order: 1/16, 8/9, 5/12, 4/13, 6/11, 3/14, 7/10, 2/15
      round64: ["17", "18", "19", "20", "21", "22", "23", "24"],
      round32: ["41", "42", "43", "44"],
      sweet16: ["53", "54"],
      elite8: ["59"]
    },
    MIDWEST: { // Florida region (Bottom Left)
      name: "Midwest",
      // Order: 1/16, 8/9, 5/12, 4/13, 6/11, 3/14, 7/10, 2/15
      round64: ["25", "26", "27", "28", "29", "30", "31", "32"],
      round32: ["45", "46", "47", "48"],
      sweet16: ["55", "56"],
      elite8: ["60"]
    },
    FINAL_FOUR: {
      name: "Final Four",
      games: ["61", "62"],
      championship: ["63"]
    }
  };
};

// Update predicted winner and remove dependent predictions if needed
export const updatePredictedWinner = (
  gameId: string, 
  winner: string,
  predictedWinners: GameWinner[],
  getGameTeamsConsistent: (gameId: string) => string[]
): GameWinner[] => {
  // Remove existing prediction for this game
  const newPredictions = [...predictedWinners.filter(g => g.gameId !== gameId)];
  
  // If we're selecting a winner (not just removing), add it to predictions
  if (winner) {
    newPredictions.push({ gameId, winner });
  }
  
  // Find all games that depend on this game
  const dependentGames = findDependentGames(gameId);
  
  // Remove predictions for dependent games if they contain the removed team
  // or if they depend on a game whose prediction was just changed
  if (dependentGames.length > 0) {
    dependentGames.forEach(depGameId => {
      const predictionForGame = predictedWinners.find(p => p.gameId === depGameId);
      if (predictionForGame) {
        // Get the updated teams for this dependent game based on current predictions
        const updatedTeams = getGameTeamsConsistent(depGameId);
        
        // If the teams don't include the predicted winner, remove the prediction
        if (!updatedTeams.includes(predictionForGame.winner) && !updatedTeams.includes("TBD")) {
          const index = newPredictions.findIndex(p => p.gameId === depGameId);
          if (index !== -1) {
            newPredictions.splice(index, 1);
          }
        }
      }
    });
  }
  
  return newPredictions;
}; 