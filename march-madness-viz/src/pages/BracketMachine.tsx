import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Stack,
  Tabs,
  Tab,
  Grid,
  MenuItem,
  FormControl,
  FormLabel,
  Slider,
  Chip,
  CircularProgress,
  Divider,
  Card,
  CardHeader,
  CardContent,
  Select,
  FormControlLabel,
  Switch,
  TableContainer,
  Paper,
  InputLabel,
  Tooltip,
  Alert
} from '@mui/material';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';
import { useData } from '../context/DataContext';
import { 
  calculateHypotheticalScores, 
  calculateWinProbability, 
} from '../utils/dataProcessing';
import { GameWinner, GameResult, getRoundNameFromGameId } from '../types';
import CheckIcon from '@mui/icons-material/Check';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import RefreshIcon from '@mui/icons-material/Refresh';
import PeopleIcon from '@mui/icons-material/People';
import EqualizerIcon from '@mui/icons-material/Equalizer';
import CasinoIcon from '@mui/icons-material/Casino';
import PercentIcon from '@mui/icons-material/Percent';

// Register chart components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  ChartTooltip,
  Legend
);

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`bracket-tab-${index}`}
      aria-labelledby={`bracket-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

// Define TypeScript types for our component
interface GameProbability {
  [team: string]: number;
}

interface GameProbabilities {
  [gameId: string]: GameProbability;
}

interface UserScore {
  username: string;
  score: number;
  actualScore: number;
  roundScores?: {
    [round: string]: number;
  };
  maxPossibleScore?: number;
  champion?: string;
}

interface ProbabilityScore extends UserScore {
  baseScore: number;
  expectedScore: number;
  winProbability: number;
}

// For paths to victory
interface CriticalGame {
  gameId: string;
  teams: string[];
  impact: number;
}

interface PathToVictory {
  username: string;
  possiblePaths: number;
  criticalGames: CriticalGame[];
}

const BracketMachine = () => {
  const { 
    bracketData, 
    gameWinners, 
    gameResults,
    loading, 
    error, 
    userScores: initialUserScores,
    setHypotheticalWinners,
    resetHypotheticalWinners
  } = useData();
  
  const [predictedWinners, setPredictedWinners] = useState<GameWinner[]>([]);
  const [gameProbabilities, setGameProbabilities] = useState<GameProbabilities>({});
  const [probabilityMode, setProbabilityMode] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [simulationRun, setSimulationRun] = useState(false);
  
  // Games that haven't been played yet
  const completedGameIds = useMemo(() => 
    new Set(gameWinners.map(g => g.gameId)), 
    [gameWinners]
  );
  
  // Create a map of team seeds for display
  const teamSeedMap = useMemo(() => {
    const seedMap = new Map<string, number>();
    if (gameResults) {
      gameResults.forEach(game => {
        seedMap.set(game.winner, game.winnerSeed);
        seedMap.set(game.loser, game.loserSeed);
      });
    }
    return seedMap;
  }, [gameResults]);
  
  const incompleteGames = useMemo(() => {
    if (!bracketData) return [];
    
    return Object.entries(bracketData.games)
      .filter(([gameId]) => !completedGameIds.has(gameId))
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
  }, [bracketData, completedGameIds]);
  
  // Group games by round
  const gamesByRound = useMemo(() => {
    const rounds: {[roundName: string]: Array<[string, any]>} = {};
    
    if (incompleteGames && incompleteGames.length > 0) {
      for (const game of incompleteGames) {
        const gameId = game[0];
        const roundName = getRoundNameFromGameId(gameId);
        
        if (!rounds[roundName]) {
          rounds[roundName] = [];
        }
        
        rounds[roundName].push(game);
      }
    }
    
    return rounds;
  }, [incompleteGames]);
  
  // Calculate scores based on current state (used for the leaderboard)
  const {
    currentScore,
    projectedScore,
    maxPossibleScore,
    topUsers
  } = useMemo(() => {
    // Default values if data is not available
    if (!bracketData) {
      return { 
        currentScore: 0, 
        projectedScore: 0, 
        maxPossibleScore: 0, 
        topUsers: [] 
      };
    }
    
    // Calculate current score (only from completed games)
    let current = 0;
    
    // Calculate projected score (current + predicted)
    let projected = 0;
    
    // Calculate max possible score
    let maxPossible = 0;
    
    // Create a map of predicted winners for quick lookup
    const predictedWinnersMap = new Map(
      predictedWinners.map(game => [game.gameId, game.winner])
    );
    
    // Create a map of actual winners for quick lookup
    const actualWinnersMap = new Map(
      gameWinners.map(game => [game.gameId, game.winner])
    );
    
    // Get a map of seed values for teams
    const seedMap = new Map<string, number>();
    if (gameResults) {
      gameResults.forEach(game => {
        seedMap.set(game.winner, game.winnerSeed);
        seedMap.set(game.loser, game.loserSeed);
      });
    }
    
    // Track eliminated teams
    const eliminatedTeams = new Set<string>();
    gameResults.forEach(game => {
      if (game.loser) {
        eliminatedTeams.add(game.loser);
      }
    });
    
    // Go through each game and calculate scores
    Object.entries(bracketData.games).forEach(([gameId, game]) => {
      // Skip if there are no picks for this game
      if (!game.picks || Object.keys(game.picks).length === 0) return;
      
      // Get the actual winner if the game is completed
      const actualWinner = actualWinnersMap.get(gameId);
      
      // Get the predicted winner if we've made a prediction
      const predictedWinner = predictedWinnersMap.get(gameId);
      
      // Get point value for this game
      const roundName = getRoundNameFromGameId(gameId);
      const pointValue = 
        roundName === 'ROUND_64' ? 10 :
        roundName === 'ROUND_32' ? 20 :
        roundName === 'SWEET_16' ? 40 :
        roundName === 'ELITE_8' ? 80 :
        roundName === 'FINAL_FOUR' ? 160 : 320;
      
      // If game is completed and we picked it correctly, add to current score
      if (actualWinner && predictedWinner === actualWinner) {
        current += pointValue;
      }
      
      // Add to projected score if we have a prediction and the game is not completed
      // or if the game is completed and we got it right
      if ((predictedWinner && !actualWinner) || 
          (predictedWinner && actualWinner && predictedWinner === actualWinner)) {
        projected += pointValue;
      }
      
      // For max possible, include all games that aren't completed
      // or completed games we got right
      if (!actualWinner) {
        // For incomplete games, we can only get points if our pick isn't eliminated
        if (predictedWinner && !eliminatedTeams.has(predictedWinner)) {
          maxPossible += pointValue;
        }
      } else if (predictedWinner === actualWinner) {
        // For completed games, we only get points if we picked correctly
        maxPossible += pointValue;
      }
    });
    
    // Add current score to projected and max possible
    projected += current;
    maxPossible += current;
    
    // Get top users for the chart - using the userScores from props
    const top = [...initialUserScores].sort((a, b) => b.score - a.score).slice(0, 10);
    
    return { 
      currentScore: current, 
      projectedScore: projected, 
      maxPossibleScore: maxPossible, 
      topUsers: top
    };
  }, [bracketData, initialUserScores, gameWinners, predictedWinners, gameResults]);
  
  // Calculate probability scores for all users using existing function
  const probabilityScores = useMemo(() => {
    if (!probabilityMode || !bracketData || Object.keys(gameProbabilities).length === 0) {
      return [];
    }
    
    return calculateWinProbability(bracketData, gameWinners, gameProbabilities);
  }, [bracketData, gameWinners, gameProbabilities, probabilityMode]);
  
  // Update the chartData calculation to use hypothetical scores
  const chartData = useMemo(() => {
    const users = probabilityMode && probabilityScores.length > 0 
      ? probabilityScores.slice(0, 25) 
      : initialUserScores.slice(0, 25);
    
    const labels = users.map(user => user.username);
    
    return {
      labels,
      datasets: [
        {
          label: 'Current Score',
          data: users.map(user => user.actualScore || 0),
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        },
        {
          label: 'Projected Score',
          data: users.map(user => user.score),
          backgroundColor: 'rgba(75, 192, 192, 0.5)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        },
        {
          label: 'Max Possible',
          data: users.map(user => (user as UserScore).maxPossibleScore || user.score),
          backgroundColor: 'rgba(255, 206, 86, 0.5)',
          borderColor: 'rgba(255, 206, 86, 1)',
          borderWidth: 1
        }
      ]
    };
  }, [probabilityMode, probabilityScores, initialUserScores]);
  
  // Simulates random outcomes based on probabilities
  const simulateRandomOutcomes = () => {
    if (!bracketData || !probabilityMode) return;
    
    // Get all unplayed games
    const unplayedGameIds = Object.keys(bracketData.games).filter(
      gameId => !getActualWinner(gameId)
    );
    
    // Reset existing predictions first to avoid conflicts
    const newPredictions: GameWinner[] = [];
    
    // For each unplayed game, randomly select a winner based on probabilities
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
    
    // Update predictions all at once
    setPredictedWinners(newPredictions);
    setHypotheticalWinners(newPredictions);
    setSimulationRun(true);
  };
  
  // Update predicted winner
  const updatePredictedWinner = (gameId: string, winner: string) => {
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
    
    // Update state
    setPredictedWinners(newPredictions);
    setHypotheticalWinners(newPredictions);
  };
  
  // Find all games that depend on a given game
  const findDependentGames = (gameId: string): string[] => {
    const dependentGames: string[] = [];
    
    // Map from game ID to the two previous games that feed into it
    const gameToFeederGames: Record<string, string[]> = {
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
  
  // Update game probability
  const updateGameProbability = (gameId: string, team: string, probability: number) => {
    const otherTeam = getGameTeams(gameId).find(t => t !== team);
    if (!otherTeam) return;
    
    setGameProbabilities(prev => {
      const gameProbs = { ...(prev[gameId] || {}) };
      gameProbs[team] = probability;
      gameProbs[otherTeam] = 1 - probability;
      
      return {
        ...prev,
        [gameId]: gameProbs
      };
    });
    
    // If in probability mode, update hypothetical winners based on probabilities
    if (probabilityMode) {
      const probPredictions = Object.entries(gameProbabilities).map(([gameId, probs]) => {
        const teams = Object.keys(probs);
        if (teams.length >= 2) {
          const team1 = teams[0];
          const team2 = teams[1];
          const winner = probs[team1] > probs[team2] ? team1 : team2;
          return { gameId, winner };
        }
        return { gameId, winner: teams[0] || '' };
      });
      
      setHypotheticalWinners(probPredictions);
    }
  };
  
  // Reset predictions
  const resetPredictions = () => {
    setPredictedWinners([]);
    setGameProbabilities({});
    resetHypotheticalWinners();
  };
  
  // Get game teams
  const getGameTeams = (gameId: string): string[] => {
    if (!bracketData || !bracketData.games[gameId]) return [];
    const game = bracketData.games[gameId];
    return Object.keys(game.stats.pick_distribution);
  };
  
  // Handle tab change
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  // Get paths to victory data for selected user
  // const pathsToVictoryData = useMemo(() => {
  //   if (!pathsToVictoryUser) return null;
  //   return calculatePathsToVictory(pathsToVictoryUser);
  // }, [pathsToVictoryUser, bracketData, completedGameIds, initialUserScores]);
  
  // // Set favorite teams to win (based on seed)
  const setFavoriteWinners = () => {
    if (!bracketData) return;
    
    const favPredictions: GameWinner[] = [];
    
    incompleteGames.forEach(([gameId, game]) => {
      const teams = Object.keys(game.stats.pick_distribution);
      if (teams.length !== 2) return;
      
      // Get seeds for both teams
      const team1 = teams[0];
      const team2 = teams[1];
      const seed1 = teamSeedMap.get(team1) || 16;
      const seed2 = teamSeedMap.get(team2) || 16;
      
      // Lower seed number is better (1 is best)
      const winner = seed1 <= seed2 ? team1 : team2;
      
      favPredictions.push({
        gameId,
        winner
      });
    });
    
    // Update both predictedWinners and hypotheticalWinners
    setPredictedWinners(favPredictions);
    setHypotheticalWinners(favPredictions);
  };
  
  // Set pick percentage probabilities
  const setPickPercentageProbabilities = () => {
    if (!bracketData) return;
    
    const newProbs: GameProbabilities = {};
    
    incompleteGames.forEach(([gameId, game]) => {
      const teams = Object.keys(game.stats.pick_distribution);
      if (teams.length !== 2) return;
      
      const totalPicks = game.stats.total_picks;
      const prob1 = game.stats.pick_distribution[teams[0]] / totalPicks;
      
      newProbs[gameId] = {
        [teams[0]]: prob1,
        [teams[1]]: 1 - prob1
      };
    });
    
    setGameProbabilities(newProbs);
    setProbabilityMode(true);
  };
  
  // Set equal 50/50 probabilities
  const setEqualProbabilities = () => {
    if (!bracketData) return;
    
    const newProbs: GameProbabilities = {};
    
    incompleteGames.forEach(([gameId, game]) => {
      const teams = Object.keys(game.stats.pick_distribution);
      if (teams.length !== 2) return;
      
      newProbs[gameId] = {
        [teams[0]]: 0.5,
        [teams[1]]: 0.5
      };
    });
    
    setGameProbabilities(newProbs);
    setProbabilityMode(true);
  };
  
  // Define regions and their game IDs based on the bracket structure
  const regions = useMemo(() => {
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
  }, []);

  // Function to get teams for a game and ensure consistency with previous game results
  const getGameTeamsConsistent = (gameId: string): string[] => {
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
    // Map from game ID to the two previous games that feed into it
    const gameToFeederGames: Record<string, string[]> = {
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
  
  // Function to get the predicted winner for a game
  const getPredictedWinner = (gameId: string): string => {
    return predictedWinners.find(g => g.gameId === gameId)?.winner || '';
  };
  
  // Function to get the actual winner for a game
  const getActualWinner = (gameId: string): string => {
    return gameWinners.find(g => g.gameId === gameId)?.winner || '';
  };
  
  // Function to determine if we have a winner (actual or predicted) for a game
  const hasWinner = (gameId: string): boolean => {
    return !!getActualWinner(gameId) || !!getPredictedWinner(gameId);
  };
  
  // Function to render a bracket game
  const renderBracketGame = (gameId: string, round: string) => {
    const teams = getGameTeamsConsistent(gameId);
    const actualWinner = getActualWinner(gameId);
    const predictedWinner = getPredictedWinner(gameId);
    const isCompletedGame = !!actualWinner;
    
    // Get seeds for teams - use teamSeedMap that's populated from the CSV
    const teamSeeds = teams.map(team => {
      const seed = teamSeedMap.get(team) || '';
      return seed ? `(${seed})` : '';
    });
    
    return (
      <Paper 
        key={gameId} 
        elevation={1}
        sx={{ 
          p: 1, 
          mb: 1, 
          position: 'relative',
          bgcolor: 'background.paper',
          transition: 'background-color 0.3s ease'
        }}
      >
        <Stack spacing={1}>
          {teams.map((team, index) => {
            if (team === "TBD") {
              return (
                <Box 
                  key={index}
                  sx={{ 
                    p: 1, 
                    borderRadius: 1,
                    border: '1px dashed',
                    borderColor: 'divider',
                    opacity: 0.7
                  }}
                >
                  <Typography variant="body2">TBD</Typography>
                </Box>
              );
            }
            
            const isWinner = actualWinner === team || (!actualWinner && predictedWinner === team);
            const isLoser = isCompletedGame && actualWinner !== team;
            const seedText = teamSeeds[index] || '';
            
            return (
              <Box 
                key={team}
                onClick={() => {
                  if (!isCompletedGame && !probabilityMode) {
                    updatePredictedWinner(gameId, team);
                  }
                }}
                sx={{ 
                  p: 1, 
                  borderRadius: 1,
                  cursor: isCompletedGame ? 'default' : 'pointer',
                  bgcolor: isWinner 
                    ? (isCompletedGame ? 'rgba(144, 238, 144, 0.8)' : 'primary.light') 
                    : (isLoser ? 'rgba(255, 200, 200, 0.5)' : 'background.paper'),
                  border: '1px solid',
                  borderColor: isWinner 
                    ? (isCompletedGame ? 'success.dark' : 'primary.main') 
                    : (isLoser ? 'error.light' : 'divider'),
                  '&:hover': {
                    bgcolor: isCompletedGame 
                      ? (isWinner ? 'success.main' : isLoser ? 'error.light' : 'background.paper') 
                      : 'action.hover'
                  }
                }}
              >
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="body2">
                    {seedText && (
                      <Typography component="span" variant="caption" sx={{ mr: 1, fontWeight: 'bold' }}>
                        {seedText}
                      </Typography>
                    )}
                    {team}
                  </Typography>
                  
                  {isWinner && (
                    <CheckIcon fontSize="small" color={isCompletedGame ? "success" : "primary"} />
                  )}
                </Stack>
              </Box>
            );
          })}
        </Stack>
        
        {probabilityMode && !isCompletedGame && (
          <Box sx={{ mt: 2 }}>
            <Divider sx={{ mb: 1 }} />
            <Typography variant="caption">Set Win Probability:</Typography>
            {teams.filter(t => t !== "TBD").map((team) => (
              <Box key={team} sx={{ mt: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="caption" sx={{ 
                    minWidth: 60,
                    maxWidth: 80, 
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {team}
                  </Typography>
                  <Slider
                    size="small"
                    value={gameProbabilities[gameId]?.[team] || 0.5}
                    onChange={(_, val) => {
                      // Ensure value is between 0 and 1
                      const limitedVal = Math.min(Math.max(val as number, 0), 1);
                      updateGameProbability(gameId, team, limitedVal);
                    }}
                    min={0}
                    max={1}
                    step={0.05}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
                    marks={[
                      { value: 0, label: '0%' },
                      { value: 0.5, label: '50%' },
                      { value: 1, label: '100%' }
                    ]}
                  />
                  <Typography variant="caption" sx={{ minWidth: 36 }}>
                    {((gameProbabilities[gameId]?.[team] || 0.5) * 100).toFixed(0)}%
                  </Typography>
                </Stack>
              </Box>
            ))}
          </Box>
        )}
      </Paper>
    );
  };
  
  // Render the bracket for a region
  const renderRegion = (regionKey: string, regionData: any) => {
    // Determine if this is a right-side region (East or Midwest)
    const isRightRegion = regionKey === 'EAST' || regionKey === 'MIDWEST';
    
    return (
      <Grid item xs={12} md={6} key={regionKey}>
        <Paper 
          elevation={2} 
          sx={{ 
            p: 2, 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column'
          }}
        >
          <Typography variant="h6" gutterBottom>{regionData.name} Region</Typography>
          
          <Grid container spacing={1}>
            {isRightRegion ? (
              // For East and Midwest, reverse the order (right to left)
              <>
                {/* Elite 8 (rightmost for East/Midwest) */}
                <Grid item xs={3} sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Typography variant="subtitle2" gutterBottom align="right">
                    Elite 8
                  </Typography>
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    my: 7
                  }}>
                    {regionData.elite8?.map((gameId: string) => 
                      <Box key={gameId} sx={{ width: '100%' }}>
                        {renderBracketGame(gameId, 'ELITE_8')}
                      </Box>
                    )}
                  </Box>
                </Grid>
                
                {/* Sweet 16 */}
                <Grid item xs={3} sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Typography variant="subtitle2" gutterBottom align="right">
                    Sweet 16
                  </Typography>
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    my: 5 
                  }}>
                    {regionData.sweet16?.map((gameId: string, index: number) => 
                      <Box key={gameId} sx={{ 
                        width: '100%', 
                        mt: index > 0 ? 15 : 0
                      }}>
                        {renderBracketGame(gameId, 'SWEET_16')}
                      </Box>
                    )}
                  </Box>
                </Grid>
                
                {/* Round of 32 */}
                <Grid item xs={3} sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Typography variant="subtitle2" gutterBottom align="right">
                    Round of 32
                  </Typography>
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    my: 3
                  }}>
                    {regionData.round32?.map((gameId: string, index: number) => 
                      <Box key={gameId} sx={{ 
                        width: '100%', 
                        mt: index > 0 ? 7 : 0
                      }}>
                        {renderBracketGame(gameId, 'ROUND_32')}
                      </Box>
                    )}
                  </Box>
                </Grid>
                
                {/* Round of 64 (leftmost for East/Midwest) */}
                <Grid item xs={3} sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Typography variant="subtitle2" gutterBottom align="right">
                    Round of 64
                  </Typography>
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'flex-end' 
                  }}>
                    {regionData.round64?.map((gameId: string) => 
                      <Box key={gameId} sx={{ width: '100%' }}>
                        {renderBracketGame(gameId, 'ROUND_64')}
                      </Box>
                    )}
                  </Box>
                </Grid>
              </>
            ) : (
              // For South and West, keep original order (left to right)
              <>
                {/* First Round (Round of 64) */}
                <Grid item xs={3} sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Typography variant="subtitle2" gutterBottom align="left">
                    Round of 64
                  </Typography>
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'flex-start' 
                  }}>
                    {regionData.round64?.map((gameId: string) => 
                      <Box key={gameId} sx={{ width: '100%' }}>
                        {renderBracketGame(gameId, 'ROUND_64')}
                      </Box>
                    )}
                  </Box>
                </Grid>
                
                {/* Second Round (Round of 32) */}
                <Grid item xs={3} sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Typography variant="subtitle2" gutterBottom align="left">
                    Round of 32
                  </Typography>
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    my: 3
                  }}>
                    {regionData.round32?.map((gameId: string, index: number) => 
                      <Box key={gameId} sx={{ 
                        width: '100%', 
                        mt: index > 0 ? 7 : 0
                      }}>
                        {renderBracketGame(gameId, 'ROUND_32')}
                      </Box>
                    )}
                  </Box>
                </Grid>
                
                {/* Sweet 16 */}
                <Grid item xs={3} sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Typography variant="subtitle2" gutterBottom align="left">
                    Sweet 16
                  </Typography>
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    my: 5 
                  }}>
                    {regionData.sweet16?.map((gameId: string, index: number) => 
                      <Box key={gameId} sx={{ 
                        width: '100%', 
                        mt: index > 0 ? 15 : 0
                      }}>
                        {renderBracketGame(gameId, 'SWEET_16')}
                      </Box>
                    )}
                  </Box>
                </Grid>
                
                {/* Elite 8 */}
                <Grid item xs={3} sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Typography variant="subtitle2" gutterBottom align="left">
                    Elite 8
                  </Typography>
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    my: 7
                  }}>
                    {regionData.elite8?.map((gameId: string) => 
                      <Box key={gameId} sx={{ width: '100%' }}>
                        {renderBracketGame(gameId, 'ELITE_8')}
                      </Box>
                    )}
                  </Box>
                </Grid>
              </>
            )}
          </Grid>
        </Paper>
      </Grid>
    );
  };
  
  // Render the Final Four and Championship
  const renderFinalFour = () => {
    return (
      <Grid container spacing={2} sx={{ mt: 3 }}>
        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom align="center">Final Four & Championship</Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={5}>
                <Typography variant="subtitle2" gutterBottom align="center">
                  Final Four
                </Typography>
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    {renderBracketGame('61', 'FINAL_FOUR')}
                  </Grid>
                  <Grid item xs={6}>
                    {renderBracketGame('62', 'FINAL_FOUR')}
                  </Grid>
                </Grid>
              </Grid>
              
              <Grid item xs={12} md={2} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ArrowForwardIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
              </Grid>
              
              <Grid item xs={12} md={5}>
                <Typography variant="subtitle2" gutterBottom align="center">
                  Championship
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <Box sx={{ width: '60%' }}>
                    {renderBracketGame('63', 'CHAMPIONSHIP')}
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    );
  };
  
  // Set popular picks to win (based on user pick distribution)
  const setPopularWinners = () => {
    if (!bracketData) return;
    
    // Get unplayed games
    const unplayedGameIds = Object.keys(bracketData.games).filter(
      gameId => !getActualWinner(gameId)
    );
    
    // For each unplayed game, find the most popular pick
    unplayedGameIds.forEach(gameId => {
      const game = bracketData.games[gameId];
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
        // Update the winner for this game
        updatePredictedWinner(gameId, mostPopularTeam);
      }
    });
  };
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (error || !bracketData) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="error" gutterBottom>
          Error Loading Data
        </Typography>
        <Typography>
          {error || "Failed to load bracket data. Please try again later."}
        </Typography>
      </Box>
    );
  }
  
  // For the Paths to Victory simulation results
  const topContenders = [...probabilityScores].slice(0, 3);
  const lastPlace = [...probabilityScores].slice(-1)[0];
  
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Bracket Machine
      </Typography>
      
      <Typography variant="body1" paragraph>
        Explore different bracket scenarios and see how they affect the leaderboard.
      </Typography>
      
      <Tabs value={tabValue} onChange={handleTabChange}>
        <Tab label="Bracket Editor" />
        <Tab label="Projected Leaderboard" />
        {/* <Tab label="Paths to Victory" /> */}
      </Tabs>
      
      <TabPanel value={tabValue} index={0}>
        <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
          <FormControlLabel
            control={
              <Switch
                checked={probabilityMode}
                onChange={() => setProbabilityMode(!probabilityMode)}
                color="primary"
              />
            }
            label={probabilityMode ? "Probability Mode" : "Winner Mode"}
          />
          
          <Button 
            variant="outlined" 
            onClick={resetPredictions}
            color="secondary"
          >
            Reset All Picks
          </Button>
          
          {probabilityMode && (
            <>
              <Button 
                variant="outlined" 
                onClick={setPickPercentageProbabilities}
                color="primary"
              >
                Set Pick % Probabilities
              </Button>
              
              <Button 
                variant="outlined" 
                onClick={setEqualProbabilities}
                color="primary"
              >
                Set 50/50 Probabilities
              </Button>
              
              <Button 
                variant="outlined" 
                onClick={simulateRandomOutcomes}
                color="primary"
              >
                Run Simulation
              </Button>
            </>
          )}
          
          {!probabilityMode && (
            <Button 
              variant="outlined" 
              onClick={setPopularWinners}
              color="primary"
            >
              Set Popular Picks
            </Button>
          )}
        </Stack>
        
        {probabilityMode && simulationRun && (
          <Card sx={{ mb: 3, bgcolor: 'success.light' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Simulation Results
              </Typography>
              
              <Typography variant="body1">
                Based on your current probability settings, here are the top contenders:
              </Typography>
              
              <Stack spacing={2} sx={{ mt: 2 }}>
                {topContenders.map((user, index) => (
                  <Box key={user.username}>
                    <Typography variant="subtitle1">
                      {index + 1}. {user.username}
                    </Typography>
                    <Typography variant="body2">
                      Win Probability: {user.winProbability.toFixed(2)}%
                    </Typography>
                    <Typography variant="body2">
                      Expected Score: {user.expectedScore.toFixed(0)} points
                    </Typography>
                  </Box>
                ))}
                
                {lastPlace && (
                  <Box sx={{ mt: 2, pt: 2, borderTop: '1px dashed' }}>
                    <Typography variant="subtitle1">
                      Last Place: {lastPlace.username} 🥴
                    </Typography>
                    <Typography variant="body2">
                      Win Probability: {lastPlace.winProbability.toFixed(2)}%
                    </Typography>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>
        )}
        
        {/* Bracket Visualization with Sidebar Leaderboard */}
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            {/* Left side: South (Auburn) and West (Florida) */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
              {renderRegion('SOUTH', regions.SOUTH)}
              {renderRegion('EAST', regions.EAST)}
            </Grid>
            
            {/* Right side: East (Duke) and Midwest (Houston) */}
            <Grid container spacing={2}>
              {renderRegion('WEST', regions.WEST)}
              {renderRegion('MIDWEST', regions.MIDWEST)}
            </Grid>
            
            {/* Final Four and Championship */}
            {renderFinalFour()}
          </Grid>
          
          {/* Leaderboard */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, mb: 2, maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
              <Typography variant="h6" gutterBottom>
                Projected Leaderboard
              </Typography>
              
              <TableContainer component={Paper} sx={{ maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Rank</TableCell>
                      <TableCell>User</TableCell>
                      <TableCell align="right">Score</TableCell>
                      {probabilityMode && (
                        <TableCell align="right">Win%</TableCell>
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(probabilityMode && probabilityScores.length > 0 ? probabilityScores : initialUserScores)
                      .slice(0, 25)
                      .map((user, index) => (
                        <TableRow key={user.username}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell 
                            sx={{ 
                              maxWidth: 120, 
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {user.username}
                          </TableCell>
                          <TableCell align="right">{user.score || 0}</TableCell>
                          {probabilityMode && (
                            <TableCell align="right">
                              {((user as ProbabilityScore).winProbability || 0).toFixed(1)}%
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>
      
      <TabPanel value={tabValue} index={1}>
        <Typography variant="h6" gutterBottom>
          Projected Leaderboard
        </Typography>
        
        <Box sx={{ height: 400, mb: 4 }}>
          <Bar
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: {
                  beginAtZero: true,
                  title: {
                    display: true,
                    text: 'Points'
                  }
                }
              },
              plugins: {
                legend: {
                  position: 'top',
                },
                title: {
                  display: true,
                  text: 'Current vs Projected Scores'
                }
              }
            }}
          />
        </Box>
        
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Rank</TableCell>
                <TableCell>Username</TableCell>
                <TableCell align="right">Current Score</TableCell>
                <TableCell align="right">Projected Score</TableCell>
                <TableCell align="right">Max Possible</TableCell>
                {probabilityMode && (
                  <TableCell align="right">Win Probability</TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {(probabilityMode && probabilityScores.length > 0 ? probabilityScores : initialUserScores)
                .slice(0, 25)
                .map((user, index) => (
                  <TableRow key={user.username}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{user.username}</TableCell>
                    <TableCell align="right">{user.actualScore || 0}</TableCell>
                    <TableCell align="right">{user.score || 0}</TableCell>
                    <TableCell align="right">
                      {(user as UserScore).maxPossibleScore || user.score || 0}
                    </TableCell>
                    {probabilityMode && (
                      <TableCell align="right">
                        {((user as ProbabilityScore).winProbability || 0).toFixed(2)}%
                      </TableCell>
                    )}
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>
    </Box>
  );
};

export default BracketMachine; 