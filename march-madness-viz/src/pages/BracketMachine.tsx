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
  InputLabel
} from '@mui/material';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { useData } from '../context/DataContext';
import { 
  calculateHypotheticalScores, 
  calculateWinProbability, 
} from '../utils/dataProcessing';
import { GameWinner, GameResult, getRoundNameFromGameId } from '../types';

// Register chart components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
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
  
  // Get actual scores and hypothetical scores
  const { userScores, probabilityScores } = useMemo(() => {
    if (!bracketData) return { userScores: [] as UserScore[], probabilityScores: [] as ProbabilityScore[] };
    
    const userScores = calculateHypotheticalScores(bracketData, gameWinners, predictedWinners);
    
    const probabilityScores = probabilityMode && Object.keys(gameProbabilities).length > 0
      ? calculateWinProbability(bracketData, gameWinners, gameProbabilities)
      : [];
    
    return { userScores, probabilityScores };
  }, [bracketData, gameWinners, predictedWinners, probabilityMode, gameProbabilities]);
  
  // Prepare data for trend chart
  const topUsers = useMemo(() => {
    return [...userScores]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [userScores]);
  
  const chartData = useMemo(() => {
    return {
      labels: topUsers.map(user => user.username),
      datasets: [
        {
          label: 'Current Score',
          data: topUsers.map(user => user.actualScore),
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
        },
        {
          label: 'Projected Score',
          data: topUsers.map(user => user.score),
          backgroundColor: 'rgba(255, 99, 132, 0.5)',
        }
      ]
    };
  }, [topUsers]);
  
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
    const topUserScore = userScores[0]?.score || 0;
    const userScore = userScores.find(u => u.username === username)?.score || 0;
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
  }, [pathsToVictoryUser, bracketData, completedGameIds, userScores]);
  
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
        <Tab label="Game Picker" id="bracket-tab-0" aria-controls="bracket-tabpanel-0" />
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
        
        {Object.entries(gamesByRound).map(([roundName, games]) => (
          <Box key={roundName} sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              {roundName.replace('_', ' ')}
            </Typography>
            
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Game ID</TableCell>
                    <TableCell>Matchup</TableCell>
                    <TableCell>{probabilityMode ? "Win Probability" : "Predicted Winner"}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {games.map(([gameId, game]) => {
                    const teams = Object.keys(game.stats.pick_distribution);
                    if (teams.length < 2) return null;
                    
                    const predictedWinner = predictedWinners.find(w => w.gameId === gameId)?.winner || '';
                    
                    return (
                      <TableRow key={gameId}>
                        <TableCell>Game {gameId}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            {teams.map(team => {
                              const seed = teamSeedMap.get(team);
                              return (
                                <Box key={team} sx={{ display: 'flex', alignItems: 'center' }}>
                                  <Typography>
                                    {team}
                                    {seed && (
                                      <Typography component="span" variant="caption" sx={{ ml: 0.5 }}>
                                        (#{seed})
                                      </Typography>
                                    )}
                                  </Typography>
                                  {teams.indexOf(team) < teams.length - 1 && (
                                    <Typography sx={{ mx: 1 }}>vs</Typography>
                                  )}
                                </Box>
                              );
                            })}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          {probabilityMode ? (
                            <Stack spacing={2}>
                              {teams.map(team => (
                                <FormControl key={team} fullWidth>
                                  <FormLabel>{team}</FormLabel>
                                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Slider
                                      value={gameProbabilities[gameId]?.[team] || 0}
                                      onChange={(_, val) => updateGameProbability(gameId, team, val as number)}
                                      sx={{ mx: 2, flex: 1 }}
                                      size="small"
                                    />
                                    <Typography variant="body2" sx={{ minWidth: 40 }}>
                                      {((gameProbabilities[gameId]?.[team] || 0) * 100).toFixed(0)}%
                                    </Typography>
                                  </Box>
                                </FormControl>
                              ))}
                            </Stack>
                          ) : (
                            <FormControl size="small" fullWidth>
                              <Select
                                value={predictedWinner}
                                onChange={(e) => updatePredictedWinner(gameId, e.target.value)}
                                displayEmpty
                              >
                                <MenuItem value="">-- Select Winner --</MenuItem>
                                {teams.map(team => (
                                  <MenuItem key={team} value={team}>
                                    {team}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        ))}
        
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <FormControlLabel
            control={
              <Switch
                checked={probabilityMode}
                onChange={() => setProbabilityMode(!probabilityMode)}
                color="primary"
              />
            }
            label={probabilityMode ? "Switch to Winner Mode" : "Switch to Probability Mode"}
          />
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
              {(probabilityMode && probabilityScores.length > 0 ? probabilityScores : userScores)
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
        <Typography variant="h6" gutterBottom>
          Analyze Paths to Victory
        </Typography>
        
        <Typography variant="body1" paragraph>
          Select a user to analyze their potential paths to victory based on remaining games.
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth sx={{ mb: 4 }}>
              <InputLabel id="user-select-label">Select User</InputLabel>
              <Select
                labelId="user-select-label"
                value={pathsToVictoryUser}
                label="Select User"
                onChange={(e) => setPathsToVictoryUser(e.target.value as string)}
              >
                <MenuItem value="">-- Select User --</MenuItem>
                {userScores.slice(0, 50).map(user => (
                  <MenuItem key={user.username} value={user.username}>
                    {user.username}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            {pathsToVictoryData && (
              <Card>
                <CardHeader 
                  title={`Analysis for ${pathsToVictoryData.username}`}
                  subheader={`${incompleteGames.length} games remaining`}
                />
                <CardContent>
                  <Typography variant="body1" gutterBottom>
                    Current Rank: #{userScores.findIndex(u => u.username === pathsToVictoryData.username) + 1}
                  </Typography>
                  
                  <Typography variant="body1" gutterBottom>
                    Potential winning outcomes: {pathsToVictoryData.possiblePaths.toLocaleString()} out of {Math.pow(2, incompleteGames.length).toLocaleString()} possible combinations
                  </Typography>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Typography variant="subtitle1" gutterBottom>
                    Most Critical Games:
                  </Typography>
                  
                  <Stack spacing={2}>
                    {pathsToVictoryData.criticalGames.map(game => {
                      const userPick = bracketData.games[game.gameId]?.picks[pathsToVictoryData.username];
                      return (
                        <Paper key={game.gameId} sx={{ p: 2 }}>
                          <Typography variant="subtitle2">
                            Game {game.gameId}: {game.teams.join(' vs ')}
                          </Typography>
                          <Typography variant="body2" color="primary">
                            Your pick: {userPick}
                          </Typography>
                          <Typography variant="body2">
                            Impact score: {game.impact.toFixed(1)}
                          </Typography>
                        </Paper>
                      );
                    })}
                  </Stack>
                </CardContent>
              </Card>
            )}
          </Grid>
          
          <Grid item xs={12} md={8}>
            {pathsToVictoryData ? (
              <Card>
                <CardHeader title="Victory Strategy" />
                <CardContent>
                  <Typography variant="body1" paragraph>
                    Based on analysis of {incompleteGames.length} remaining games, here's what needs to happen for {pathsToVictoryData.username} to win:
                  </Typography>
                  
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" color="primary" gutterBottom>
                      Critical Games to Watch:
                    </Typography>
                    
                    <TableContainer component={Paper}>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Game</TableCell>
                            <TableCell>Matchup</TableCell>
                            <TableCell>Needed Outcome</TableCell>
                            <TableCell>Impact</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {pathsToVictoryData.criticalGames.map(game => {
                            const gameData = bracketData.games[game.gameId];
                            const userPick = gameData?.picks[pathsToVictoryData.username];
                            return (
                              <TableRow key={game.gameId}>
                                <TableCell>Game {game.gameId}</TableCell>
                                <TableCell>{game.teams.join(' vs ')}</TableCell>
                                <TableCell>
                                  <Chip 
                                    label={userPick || '?'} 
                                    color="primary" 
                                    size="small"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Chip 
                                    label={`${Math.round(game.impact)}`}
                                    color={game.impact > 100 ? "error" : "warning"}
                                    size="small"
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                  
                  <Box>
                    <Typography variant="subtitle1" gutterBottom>
                      Strategy Explanation:
                    </Typography>
                    
                    <Typography variant="body2" paragraph>
                      For {pathsToVictoryData.username} to win, they need their picks to be correct in the most critical games shown above.
                      These games have been identified as having the highest impact on their potential final score.
                    </Typography>
                    
                    <Typography variant="body2" paragraph>
                      Impact score is calculated based on the points at stake and how unique the pick is compared to other users.
                      Higher impact games are those where the user's pick is less popular but worth more points.
                    </Typography>
                    
                    <Typography variant="body2">
                      Based on current standings and remaining games, 
                      {pathsToVictoryData.possiblePaths > 1000 
                        ? ' there are multiple scenarios where this user could win.'
                        : pathsToVictoryData.possiblePaths > 100
                          ? ' there are some scenarios where this user could win, but they need most critical games to go their way.'
                          : ' winning scenarios are limited and would require almost all critical games to go their way.'}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            ) : (
              <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="body1">
                  Select a user to view potential paths to victory
                </Typography>
              </Box>
            )}
          </Grid>
        </Grid>
      </TabPanel>
    </Box>
  );
};

export default BracketMachine; 