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
  Tooltip
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
  const [pathsToVictoryUser, setPathsToVictoryUser] = useState<string>('');
  
  // Variables for the Paths to Victory tab
  const [pathsToVictory, setPathsToVictory] = useState<{
    username: string;
    paths: number;
    pathPercentage: number;
    criticalGames: string[];
  }[]>([]);
  
  const [analyzingPaths, setAnalyzingPaths] = useState(false);
  const [selectedPathUser, setSelectedPathUser] = useState<string>('');
  const [pathDetails, setPathDetails] = useState<{
    gameId: string;
    team1: string;
    team2: string;
    needsWinner: string;
  }[]>([]);
  
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
  
  // Calculate scores based on current state
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
  
  // Create chart data for projected leaderboard
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
  
  // Update predicted winner
  const updatePredictedWinner = (gameId: string, winner: string) => {
    const newPredictions = [...predictedWinners.filter(g => g.gameId !== gameId)];
    
    if (winner) {
      newPredictions.push({ gameId, winner });
    }
    
    setPredictedWinners(newPredictions);
    setHypotheticalWinners(newPredictions);
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
  
  // Run simulation based on probabilities
  const runSimulation = () => {
    if (!bracketData || !probabilityMode) return;
    
    // Create a simulated outcome based on probabilities
    const simulatedWinners: GameWinner[] = [];
    
    Object.entries(gameProbabilities).forEach(([gameId, probs]) => {
      // Get teams for this game
      const teams = Object.keys(probs);
      if (teams.length !== 2) return;
      
      // Generate a random number between 0 and 1
      const random = Math.random();
      
      // Pick winner based on probability
      const team1 = teams[0];
      const team1Prob = probs[team1];
      const winner = random < team1Prob ? team1 : teams[1];
      
      simulatedWinners.push({ gameId, winner });
    });
    
    // Update predictions with simulation results
    setPredictedWinners(simulatedWinners);
    setHypotheticalWinners(simulatedWinners);
    setSimulationRun(true);
  };
  
  // Calculate paths to victory for a user
  const calculatePathsToVictory = (username: string): PathToVictory | null => {
    if (!bracketData || !username) return null;
    
    // Get all incomplete games
    const remainingGames = Object.entries(bracketData.games)
      .filter(([gameId]) => !completedGameIds.has(gameId));
    
    if (remainingGames.length === 0) return null;
    
    // Calculate total possible outcomes (2^n where n is number of remaining games)
    const totalPossibleOutcomes = Math.pow(2, remainingGames.length);
    
    // We need to find outcomes where the user wins
    // For a simple heuristic, identify critical games where user's pick matters most
    const criticalGames: CriticalGame[] = [];
    
    remainingGames.forEach(([gameId, game]) => {
      const teams = Object.keys(game.stats.pick_distribution);
      if (teams.length !== 2) return;
      
      const userPick = game.picks[username];
      if (!userPick) return;
      
      // Calculate how many points this game is worth
      const roundName = getRoundNameFromGameId(gameId);
      const points = roundName === 'ROUND_64' ? 10 :
                    roundName === 'ROUND_32' ? 20 :
                    roundName === 'SWEET_16' ? 40 :
                    roundName === 'ELITE_8' ? 80 :
                    roundName === 'FINAL_FOUR' ? 160 : 320;
      
      // Calculate popularity of each team
      const team1 = teams[0];
      const team2 = teams[1];
      const team1Pct = game.stats.pick_distribution[team1] / game.stats.total_picks;
      const team2Pct = game.stats.pick_distribution[team2] / game.stats.total_picks;
      
      // If user picked the less popular team, this is potentially more impactful
      const impact = userPick === team1 ? 
        points * (1 - team1Pct) : 
        points * (1 - team2Pct);
      
      criticalGames.push({
        gameId,
        teams,
        impact
      });
    });
    
    // Sort by impact (highest first)
    criticalGames.sort((a, b) => b.impact - a.impact);
    
    // Estimate how many winning paths (simplified)
    // For each critical game, if user's pick is correct, they gain advantage
    const topUserScore = initialUserScores[0]?.score || 0;
    const userScore = initialUserScores.find(u => u.username === username)?.score || 0;
    const scoreDifference = topUserScore - userScore;
    
    // Roughly estimate how many paths lead to victory
    // This is a gross simplification but gives a sense of magnitude
    let possiblePaths = totalPossibleOutcomes;
    if (scoreDifference > 0) {
      // Reduce possible paths based on score gap
      const reductionFactor = 1 - (scoreDifference / 1000); // arbitrary scaling
      possiblePaths = Math.max(1, Math.floor(totalPossibleOutcomes * reductionFactor));
    }
    
    return {
      username,
      possiblePaths,
      criticalGames: criticalGames.slice(0, 5) // Top 5 most impactful games
    };
  };
  
  // Get paths to victory data for selected user
  const pathsToVictoryData = useMemo(() => {
    if (!pathsToVictoryUser) return null;
    return calculatePathsToVictory(pathsToVictoryUser);
  }, [pathsToVictoryUser, bracketData, completedGameIds, initialUserScores]);
  
  // Set all favorite teams to win (based on seed)
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
      
      // Lower seed number is better
      const winner = seed1 < seed2 ? team1 : team2;
      favPredictions.push({ gameId, winner });
    });
    
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
        round64: ["1", "8", "5", "4", "6", "3", "7", "2"],   // 1/16, 8/9, 5/12, 4/13, 6/11, 3/14, 7/10, 2/15
        round32: ["33", "34", "35", "36"],                   // Winners advance
        sweet16: ["49", "50"],                              // Winners advance
        elite8: ["57"]                                      // Winner advances to final four
      },
      EAST: { // Duke region (Top Right)
        name: "East",
        round64: ["9", "16", "13", "12", "14", "11", "10", "15"],
        round32: ["37", "38", "39", "40"],
        sweet16: ["51", "52"],
        elite8: ["58"]
      },
      MIDWEST: { // Houston region (Bottom Right)
        name: "Midwest",
        round64: ["17", "24", "21", "20", "22", "19", "18", "23"],
        round32: ["41", "42", "43", "44"],
        sweet16: ["53", "54"],
        elite8: ["59"]
      },
      WEST: { // Florida region (Bottom Left)
        name: "West",
        round64: ["25", "32", "29", "28", "30", "27", "26", "31"],
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
    
    // For first round games, just return the teams listed in the bracket
    const roundName = getRoundNameFromGameId(gameId);
    if (roundName === "ROUND_64") {
      return Object.keys(game.stats.pick_distribution);
    }
    
    // For later rounds, the teams should be determined by winners of previous games
    // Map from game ID to the two previous games that feed into it
    const gameToFeederGames: Record<string, string[]> = {
      // Round of 32
      "33": ["1", "8"], "34": ["5", "4"], "35": ["6", "3"], "36": ["7", "2"],
      "37": ["9", "16"], "38": ["13", "12"], "39": ["14", "11"], "40": ["10", "15"],
      "41": ["17", "24"], "42": ["21", "20"], "43": ["22", "19"], "44": ["18", "23"],
      "45": ["25", "32"], "46": ["29", "28"], "47": ["30", "27"], "48": ["26", "31"],
      
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
    
    // Get seeds for teams
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
          bgcolor: actualWinner ? 'grey.100' : 'background.paper'
        }}
      >
        <Typography variant="caption" sx={{ position: 'absolute', top: 2, right: 5 }}>
          Game {gameId}
        </Typography>
        
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
            const seedText = teamSeeds[index] || '';
            
            return (
              <Box 
                key={team}
                onClick={() => {
                  if (!actualWinner && !probabilityMode) {
                    updatePredictedWinner(gameId, team);
                  }
                }}
                sx={{ 
                  p: 1, 
                  borderRadius: 1,
                  cursor: actualWinner ? 'default' : 'pointer',
                  bgcolor: isWinner ? 'primary.light' : 'background.paper',
                  border: '1px solid',
                  borderColor: isWinner ? 'primary.main' : 'divider',
                  '&:hover': {
                    bgcolor: actualWinner ? (isWinner ? 'primary.light' : 'background.paper') : 'action.hover'
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
                    <CheckIcon fontSize="small" color="primary" />
                  )}
                </Stack>
              </Box>
            );
          })}
        </Stack>
        
        {probabilityMode && (
          <Box sx={{ mt: 2 }}>
            <Divider sx={{ mb: 1 }} />
            <Typography variant="caption">Set Win Probability:</Typography>
            {teams.filter(t => t !== "TBD").map((team) => (
              <Box key={team} sx={{ mt: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="caption" sx={{ minWidth: 60 }}>{team}</Typography>
                  <Slider
                    size="small"
                    value={gameProbabilities[gameId]?.[team] || 0.5}
                    onChange={(_, val) => updateGameProbability(gameId, team, val as number)}
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
            {/* First Round (Round of 64) */}
            <Grid item xs={3} sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <Typography variant="subtitle2" gutterBottom align={isRightRegion ? "right" : "left"}>
                Round of 64
              </Typography>
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: isRightRegion ? 'flex-end' : 'flex-start' 
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
              <Typography variant="subtitle2" gutterBottom align={isRightRegion ? "right" : "left"}>
                Round of 32
              </Typography>
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: isRightRegion ? 'flex-end' : 'flex-start',
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
              <Typography variant="subtitle2" gutterBottom align={isRightRegion ? "right" : "left"}>
                Sweet 16
              </Typography>
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: isRightRegion ? 'flex-end' : 'flex-start',
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
              <Typography variant="subtitle2" gutterBottom align={isRightRegion ? "right" : "left"}>
                Elite 8
              </Typography>
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: isRightRegion ? 'flex-end' : 'flex-start',
                my: 7
              }}>
                {regionData.elite8?.map((gameId: string) => 
                  <Box key={gameId} sx={{ width: '100%' }}>
                    {renderBracketGame(gameId, 'ELITE_8')}
                  </Box>
                )}
              </Box>
            </Grid>
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
  
  // Analyze paths to victory
  const analyzePathsToVictory = () => {
    if (!bracketData || !initialUserScores.length) return;
    
    setAnalyzingPaths(true);
    
    // Get remaining games that haven't been played yet
    const unplayedGames = Object.entries(bracketData.games)
      .filter(([gameId, game]) => !gameWinners.some(w => w.gameId === gameId))
      .map(([gameId, game]) => ({
        gameId,
        teams: Object.keys(game.stats.pick_distribution)
      }))
      .filter(game => game.teams.length > 0);
    
    if (unplayedGames.length === 0) {
      // All games are played - no more paths
      setPathsToVictory([]);
      setAnalyzingPaths(false);
      return;
    }
    
    // Function to compute scores for all users given a set of game outcomes
    const computeAllScores = (outcomes: Record<string, string>): Record<string, number> => {
      const scores: Record<string, number> = {};
      
      // Initialize with current scores
      initialUserScores.forEach(user => {
        scores[user.username] = user.score;
      });
      
      // Add points for predicted winners that match outcomes
      Object.entries(outcomes).forEach(([gameId, winner]) => {
        if (!winner) return; // Skip games with no winner
        
        // Get game data
        const game = bracketData.games[gameId];
        if (!game) return;
        
        // Get point value for this game
        const roundName = getRoundNameFromGameId(gameId);
        const pointValue = 
          roundName === 'ROUND_64' ? 10 :
          roundName === 'ROUND_32' ? 20 :
          roundName === 'SWEET_16' ? 40 :
          roundName === 'ELITE_8' ? 80 :
          roundName === 'FINAL_FOUR' ? 160 : 320;
        
        // Award points to users who picked this winner
        Object.entries(game.picks).forEach(([username, pick]) => {
          if (pick === winner) {
            scores[username] = (scores[username] || 0) + pointValue;
          }
        });
      });
      
      return scores;
    };
    
    // Use current winners as base outcomes
    const baseOutcomes: Record<string, string> = {};
    gameWinners.forEach(game => {
      baseOutcomes[game.gameId] = game.winner;
    });
    
    // Add predicted winners for simulation
    unplayedGames.forEach(game => {
      const predictedWinner = predictedWinners.find(w => w.gameId === game.gameId)?.winner;
      if (predictedWinner) {
        baseOutcomes[game.gameId] = predictedWinner;
      }
    });
    
    // If no unplayed games, return current leader
    if (unplayedGames.length === 0) {
      const currentScores = computeAllScores(baseOutcomes);
      const sortedUsers = Object.entries(currentScores)
        .sort((a, b) => b[1] - a[1])
        .map(([username, score]) => username);
      
      setPathsToVictory([
        {
          username: sortedUsers[0],
          paths: 1,
          pathPercentage: 100,
          criticalGames: []
        }
      ]);
      setAnalyzingPaths(false);
      return;
    }
    
    // For reasonable performance, limit analysis to 10 remaining games
    const gamesToAnalyze = unplayedGames.slice(0, 10);
    
    // Generate all possible combinations of outcomes
    const generateOutcomes = (gameIndex: number, currentOutcomes: Record<string, string>, results: Record<string, number>) => {
      if (gameIndex >= gamesToAnalyze.length) {
        // We've assigned outcomes to all games, compute scores
        const scores = computeAllScores(currentOutcomes);
        
        // Find the winner (highest score)
        let maxScore = -1;
        let winner = '';
        
        Object.entries(scores).forEach(([username, score]) => {
          if (score > maxScore) {
            maxScore = score;
            winner = username;
          } else if (score === maxScore) {
            // Tiebreaker: alphabetical order
            if (username < winner) {
              winner = username;
            }
          }
        });
        
        // Count path for this winner
        results[winner] = (results[winner] || 0) + 1;
        return;
      }
      
      const game = gamesToAnalyze[gameIndex];
      
      // Try each possible team as the winner
      game.teams.forEach(team => {
        const newOutcomes = { ...currentOutcomes };
        newOutcomes[game.gameId] = team;
        generateOutcomes(gameIndex + 1, newOutcomes, results);
      });
    };
    
    // Count wins for each user
    const pathResults: Record<string, number> = {};
    generateOutcomes(0, baseOutcomes, pathResults);
    
    // Calculate total paths
    const totalPaths = Object.values(pathResults).reduce((sum, count) => sum + count, 0);
    
    // Find critical games for each user
    const findCriticalGames = (username: string) => {
      const criticalGames: string[] = [];
      
      // For each unplayed game, check if outcome affects user's victory
      gamesToAnalyze.forEach(game => {
        // Try each team as winner and see if it changes victory chances
        const teamOutcomes = game.teams.map(team => {
          const testOutcomes = { ...baseOutcomes, [game.gameId]: team };
          
          // Test if this user can win with this outcome
          let pathsWithOutcome = 0;
          let totalPathsWithOutcome = 0;
          
          // Modified generateOutcomes that excludes the current game
          const testPaths = (testGameIndex: number, testCurrentOutcomes: Record<string, string>) => {
            if (testGameIndex >= gamesToAnalyze.length) {
              totalPathsWithOutcome++;
              
              const scores = computeAllScores(testCurrentOutcomes);
              
              // Find the winner
              let maxScore = -1;
              let winner = '';
              
              Object.entries(scores).forEach(([user, score]) => {
                if (score > maxScore) {
                  maxScore = score;
                  winner = user;
                } else if (score === maxScore && user < winner) {
                  winner = user;
                }
              });
              
              if (winner === username) {
                pathsWithOutcome++;
              }
              
              return;
            }
            
            const testGame = gamesToAnalyze[testGameIndex];
            if (testGame.gameId === game.gameId) {
              // Skip the game we're testing - we already set its outcome
              testPaths(testGameIndex + 1, testCurrentOutcomes);
              return;
            }
            
            // Try each possible outcome for other games
            testGame.teams.forEach(team => {
              const newTestOutcomes = { ...testCurrentOutcomes };
              newTestOutcomes[testGame.gameId] = team;
              testPaths(testGameIndex + 1, newTestOutcomes);
            });
          };
          
          testPaths(0, testOutcomes);
          
          return {
            team,
            winPercentage: totalPathsWithOutcome > 0 ? (pathsWithOutcome / totalPathsWithOutcome) * 100 : 0
          };
        });
        
        // If win percentages differ significantly, this is a critical game
        const percentages = teamOutcomes.map(o => o.winPercentage);
        const maxPercentage = Math.max(...percentages);
        const minPercentage = Math.min(...percentages);
        
        if (maxPercentage - minPercentage > 20) {
          // This game is critical - has significant impact on chances
          criticalGames.push(game.gameId);
        }
      });
      
      return criticalGames;
    };
    
    // Create paths to victory data
    const paths = Object.entries(pathResults)
      .map(([username, count]) => ({
        username,
        paths: count,
        pathPercentage: (count / totalPaths) * 100,
        criticalGames: findCriticalGames(username)
      }))
      .sort((a, b) => b.paths - a.paths);
    
    setPathsToVictory(paths);
    setAnalyzingPaths(false);
  };
  
  // Get detailed path analysis for a specific user
  const getPathDetails = (username: string) => {
    if (!bracketData) return;
    
    setSelectedPathUser(username);
    
    // Find unplayed games
    const unplayedGames = Object.entries(bracketData.games)
      .filter(([gameId, game]) => !gameWinners.some(w => w.gameId === gameId))
      .map(([gameId, game]) => ({
        gameId,
        teams: Object.keys(game.stats.pick_distribution)
      }))
      .filter(game => game.teams.length >= 2);
    
    // Find critical games for this user from pathsToVictory
    const userPath = pathsToVictory.find(p => p.username === username);
    const criticalGames = userPath?.criticalGames || [];
    
    // Generate details for critical games
    const details = unplayedGames
      .filter(game => criticalGames.includes(game.gameId))
      .map(game => {
        // For each critical game, determine which team the user needs to win
        const gameData = bracketData.games[game.gameId];
        const userPick = gameData.picks[username];
        
        return {
          gameId: game.gameId,
          team1: game.teams[0],
          team2: game.teams.length > 1 ? game.teams[1] : "TBD",
          needsWinner: userPick || "Unknown" // If user picked this game, they need that team to win
        };
      });
    
    setPathDetails(details);
  };
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', height: '300px', alignItems: 'center' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (error || !bracketData) {
    return (
      <Box sx={{ textAlign: 'center', py: 5, px: 3 }}>
        <Typography variant="h2" color="error" gutterBottom>
          Error
        </Typography>
        <Typography variant="body1" sx={{ mt: 2, mb: 4 }}>
          {error || "Failed to load bracket data"}
        </Typography>
      </Box>
    );
  }
  
  // Get most likely top 3 finishers in probability mode
  const topContenders = [...probabilityScores]
    .sort((a, b) => b.winProbability - a.winProbability)
    .slice(0, 3);
    
  // Get the user with the lowest probability score (last place)
  const lastPlace = [...probabilityScores]
    .sort((a, b) => a.winProbability - b.winProbability)[0];
  
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Bracket Machine
      </Typography>
      
      <Typography variant="body1" paragraph>
        Simulate different tournament outcomes to see how they would affect the leaderboard.
      </Typography>
      
      <Tabs value={tabValue} onChange={handleTabChange} sx={{ mb: 3 }}>
        <Tab label="Bracket" id="bracket-tab-0" aria-controls="bracket-tabpanel-0" />
        <Tab label="Leaderboard" id="bracket-tab-1" aria-controls="bracket-tabpanel-1" />
        <Tab label="Paths to Victory" id="bracket-tab-2" aria-controls="bracket-tabpanel-2" />
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
                onClick={setFavoriteWinners}
                color="primary"
              >
                Set Favorites to Win
              </Button>
              
              <Button 
                variant="contained" 
                onClick={runSimulation}
                color="primary"
              >
                Run Simulation
              </Button>
            </>
          )}
          
          {!probabilityMode && (
            <Button 
              variant="outlined" 
              onClick={setFavoriteWinners}
              color="primary"
            >
              Set Favorites to Win
            </Button>
          )}
          
          <Tooltip title="Create a shareable link to your current bracket predictions">
            <Button
              variant="outlined"
              onClick={() => {
                const baseUrl = window.location.origin + window.location.pathname;
                const predictionsParam = encodeURIComponent(JSON.stringify(predictedWinners));
                const shareableLink = `${baseUrl}?predictions=${predictionsParam}`;
                navigator.clipboard.writeText(shareableLink);
                alert("Link copied to clipboard! Share it to show others your bracket predictions.");
              }}
              color="primary"
            >
              Share Bracket
            </Button>
          </Tooltip>
        </Stack>
        
        {/* Current Score Display */}
        <Box sx={{ mb: 3 }}>
          <Paper elevation={1} sx={{ p: 2, bgcolor: 'info.light' }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Typography variant="h6" color="info.contrastText">Current Score: {currentScore}</Typography>
                <Typography variant="body2" color="info.contrastText">
                  Your score based on completed games
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="h6" color="info.contrastText">Projected Score: {projectedScore}</Typography>
                <Typography variant="body2" color="info.contrastText">
                  Score if all your predictions are correct
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="h6" color="info.contrastText">Max Possible: {maxPossibleScore}</Typography>
                <Typography variant="body2" color="info.contrastText">
                  Maximum score you can still achieve
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </Box>
        
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
        
        {/* Bracket Visualization */}
        <Box sx={{ mt: 2 }}>
          {/* Top half: South (Auburn) and East (Duke) */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {renderRegion('SOUTH', regions.SOUTH)}
            {renderRegion('EAST', regions.EAST)}
          </Grid>
          
          {/* Bottom half: West (Florida) and Midwest (Houston) */}
          <Grid container spacing={2}>
            {renderRegion('WEST', regions.WEST)}
            {renderRegion('MIDWEST', regions.MIDWEST)}
          </Grid>
          
          {/* Final Four and Championship */}
          {renderFinalFour()}
        </Box>
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
                    <TableCell align="right">{user.actualScore}</TableCell>
                    <TableCell align="right">{user.score}</TableCell>
                    <TableCell align="right">
                      {(user as UserScore).maxPossibleScore || '-'}
                    </TableCell>
                    {probabilityMode && (
                      <TableCell align="right">
                        {(user as ProbabilityScore).winProbability?.toFixed(2)}%
                      </TableCell>
                    )}
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>
      
      <TabPanel value={tabValue} index={2}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Paths to Victory Analysis
            </Typography>
            
            <Typography variant="body1" paragraph>
              This analysis calculates all possible remaining tournament outcomes and determines each user's chances of winning.
            </Typography>
            
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button
                variant="contained"
                onClick={analyzePathsToVictory}
                disabled={analyzingPaths}
                startIcon={analyzingPaths ? <CircularProgress size={20} /> : null}
              >
                {analyzingPaths ? 'Analyzing...' : 'Analyze Victory Paths'}
              </Button>
              
              <Typography variant="body2" color="text.secondary">
                Note: For performance reasons, analysis is limited to the next 10 unplayed games.
              </Typography>
            </Box>
            
            {pathsToVictory.length > 0 ? (
              <Box>
                <TableContainer component={Paper} sx={{ mb: 3 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>User</TableCell>
                        <TableCell align="right">Possible Victory Paths</TableCell>
                        <TableCell align="right">Chance of Victory</TableCell>
                        <TableCell align="right">Critical Games</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pathsToVictory.map(path => (
                        <TableRow key={path.username}>
                          <TableCell>{path.username}</TableCell>
                          <TableCell align="right">{path.paths.toLocaleString()}</TableCell>
                          <TableCell align="right">{path.pathPercentage.toFixed(2)}%</TableCell>
                          <TableCell align="right">{path.criticalGames.length}</TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              onClick={() => getPathDetails(path.username)}
                              disabled={path.criticalGames.length === 0}
                            >
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                
                {/* Show details for selected user */}
                {selectedPathUser && pathDetails.length > 0 && (
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Critical Games for {selectedPathUser}
                    </Typography>
                    
                    <Typography variant="body2" paragraph>
                      These games have a significant impact on {selectedPathUser}'s chances of winning.
                      {selectedPathUser === initialUserScores[0]?.username 
                        ? " They're currently in first place and need these results to maintain their lead."
                        : " They need specific outcomes in these games to have a chance at victory."}
                    </Typography>
                    
                    <TableContainer component={Paper}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Game</TableCell>
                            <TableCell>Matchup</TableCell>
                            <TableCell>Needs Winner</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {pathDetails.map(detail => (
                            <TableRow key={detail.gameId}>
                              <TableCell>Game {detail.gameId}</TableCell>
                              <TableCell>{detail.team1} vs {detail.team2}</TableCell>
                              <TableCell>
                                <Chip 
                                  label={detail.needsWinner} 
                                  color={detail.needsWinner === detail.team1 || detail.needsWinner === detail.team2 
                                    ? "primary" : "default"} 
                                  size="small" 
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                )}
              </Box>
            ) : analyzingPaths ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography>
                  Click "Analyze Victory Paths" to calculate each user's possible paths to victory.
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      </TabPanel>
    </Box>
  );
};

export default BracketMachine; 