import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Grid,
  CircularProgress,
  Stack,
  Table,
  TableContainer,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Paper,
  Chip,
  Button,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Link
} from '@mui/material';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useTheme } from '@mui/material/styles';
import { ROUNDS } from '../types';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface RouteParams {
  roundId: string;
}

// Helper to ensure round ID is valid
function getValidRoundId(roundId: string): string {
  const validRounds = Object.keys(ROUNDS);
  return validRounds.includes(roundId) ? roundId : 'ROUND_64';
}

const RoundPage = () => {
  const { roundId } = useParams<keyof RouteParams>() as RouteParams;
  const navigate = useNavigate();
  const { bracketData, gameWinners, gameResults, roundAccuracy, loading, error } = useData();
  const theme = useTheme();
  
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [sortByAccuracy, setSortByAccuracy] = useState<boolean>(true);
  
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
  
  // Format round name for display
  const displayRoundName = (roundKey: string) => {
    switch (roundKey) {
      case 'ROUND_64': return 'Round of 64';
      case 'ROUND_32': return 'Round of 32';
      case 'SWEET_16': return 'Sweet 16';
      case 'ELITE_8': return 'Elite 8';
      case 'FINAL_FOUR': return 'Final Four';
      case 'CHAMPIONSHIP': return 'Championship';
      default: return roundKey.replace('_', ' ');
    }
  };
  
  // Ensure we have a valid round ID
  const currentRoundId = getValidRoundId(roundId);
  
  // Get the games for this round
  const currentRoundGames = ROUNDS[currentRoundId as keyof typeof ROUNDS] || [];
  
  // Check which games have been completed
  const completedGames = currentRoundGames.filter(gameId => 
    gameWinners.some(winner => winner.gameId === gameId)
  );
  
  // Get game details for the round
  const gameDetails = currentRoundGames.map(gameId => {
    const game = bracketData.games[gameId];
    if (!game) return null;
    
    const gameWinner = gameWinners.find(winner => winner.gameId === gameId);
    const winnerTeam = gameWinner?.winner || '';
    
    const teams = Object.keys(game.stats.pick_distribution);
    
    // Get game result with loser
    const gameResult = gameResults.find(result => result.gameId === gameId);
    
    // Calculate user accuracy for this game
    let correctPicks = 0;
    let totalPicks = 0;
    let accuracy = 0;
    
    if (winnerTeam) {
      correctPicks = Object.values(game.picks).filter(pick => pick === winnerTeam).length;
      totalPicks = Object.values(game.picks).length;
      accuracy = (correctPicks / totalPicks) * 100;
    }
    
    return {
      gameId,
      teams,
      completed: !!gameWinner,
      winner: winnerTeam,
      loser: gameResult?.loser || '',
      winnerSeed: gameResult?.winnerSeed || null,
      loserSeed: gameResult?.loserSeed || null,
      correctPicks,
      totalPicks,
      accuracy,
      pickDistribution: game.stats.pick_distribution
    };
  }).filter(Boolean);
  
  // Sort games by accuracy or by gameId
  const sortedGames = [...gameDetails].sort((a, b) => 
    sortByAccuracy 
      ? b.accuracy - a.accuracy // Sort by accuracy (descending)
      : parseInt(a.gameId) - parseInt(b.gameId) // Sort by game ID (ascending)
  );
  
  // Calculate average accuracy for this round
  const roundStats = roundAccuracy[currentRoundId] || { accuracy: 0, correct: 0, total: 0 };
  const avgAccuracy = roundStats.accuracy;
  
  // Format data for bar chart
  const chartData = {
    labels: sortedGames.map(game => {
      const winner = game?.winner ? `${game.winner}${game.winnerSeed ? ` (#${game.winnerSeed})` : ''}` : '';
      const loser = game?.loser ? `${game.loser}${game.loserSeed ? ` (#${game.loserSeed})` : ''}` : '';
      
      if (winner && loser) {
        return `${winner} vs ${loser}`;
      }
      
      // For games 1, 9, 17, 25 and any others with missing teams, check the gameResults
      const gameId = game?.gameId;
      if (gameId) {
        const gameResult = gameResults.find(r => r.gameId === gameId);
        if (gameResult?.winner && gameResult?.loser) {
          const winnerSeed = gameResult.winnerSeed ? ` (#${gameResult.winnerSeed})` : '';
          const loserSeed = gameResult.loserSeed ? ` (#${gameResult.loserSeed})` : '';
          return `${gameResult.winner}${winnerSeed} vs ${gameResult.loser}${loserSeed}`;
        }
      }
      
      return `Game ${game?.gameId}`;
    }),
    datasets: [
      {
        label: 'User Accuracy (%)',
        data: sortedGames.map(game => game?.accuracy || 0),
        backgroundColor: sortedGames.map(game => 
          (game?.accuracy || 0) >= 50 
            ? theme.palette.success.light 
            : theme.palette.error.light
        ),
        borderColor: sortedGames.map(game => 
          (game?.accuracy || 0) >= 50 
            ? theme.palette.success.main 
            : theme.palette.error.main
        ),
        borderWidth: 1,
      }
    ],
  };
  
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: `${displayRoundName(currentRoundId)} Pick Accuracy`,
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const game = sortedGames[context.dataIndex];
            return [
              `Accuracy: ${game.accuracy.toFixed(1)}%`,
              `Correct Picks: ${game.correctPicks}/${game.totalPicks}`
            ];
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        title: {
          display: true,
          text: 'Accuracy (%)'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Games'
        }
      }
    },
    onClick: (_, elements) => {
      if (elements && elements.length > 0) {
        const clickedIndex = elements[0].index;
        const gameId = sortedGames[clickedIndex].gameId;
        setSelectedGame(gameId);
      }
    }
  };
  
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        {displayRoundName(currentRoundId)} Analysis
      </Typography>
      
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="body1">Select Round:</Typography>
        <Select 
          value={currentRoundId}
          onChange={(e) => navigate(`/rounds/${e.target.value}`)}
          size="small"
          sx={{ minWidth: 120 }}
        >
          {Object.keys(ROUNDS).map(round => (
            <MenuItem key={round} value={round}>{displayRoundName(round)}</MenuItem>
          ))}
        </Select>
        
        <FormControlLabel
          control={
            <Switch
              checked={sortByAccuracy}
              onChange={() => setSortByAccuracy(!sortByAccuracy)}
              color="primary"
            />
          }
          label={sortByAccuracy ? "Sorting by Accuracy" : "Sorting by Game Order"}
        />
      </Stack>
      
      <Grid container spacing={3}>
        {/* Round Stats Summary */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader title="Round Statistics" />
            <CardContent>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle1">Average Accuracy</Typography>
                  <Typography variant="h4">{avgAccuracy.toFixed(1)}%</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {roundStats.correct} correct picks out of {roundStats.total} total
                  </Typography>
                </Box>
                
                <Box>
                  <Typography variant="subtitle1">Completed Games</Typography>
                  <Typography variant="h4">
                    {completedGames.length} / {currentRoundGames.length}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Game Accuracy Chart */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardHeader 
              title="Game Pick Accuracy" 
              subheader={`Click on a bar to see detailed pick distribution for that game`}
            />
            <CardContent>
              <Box sx={{ height: 300 }}>
                <Bar
                  data={chartData}
                  options={chartOptions}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Selected Game Details */}
        {selectedGame && (
          <Grid item xs={12}>
            <Card>
              <CardHeader 
                title={`Game ${selectedGame} Pick Distribution`}
                action={
                  <Button
                    size="small"
                    component={RouterLink}
                    to={`/games/${selectedGame}`}
                  >
                    View Game Page
                  </Button>
                }
              />
              <CardContent>
                {(() => {
                  const game = gameDetails.find(g => g.gameId === selectedGame);
                  if (!game) return null;
                  
                  const totalPicks = Object.values(game.pickDistribution).reduce((sum, count) => sum + count, 0);
                  
                  return (
                    <Grid container spacing={2}>
                      {Object.entries(game.pickDistribution).map(([team, picks]) => {
                        const percentage = (picks / totalPicks) * 100;
                        const teamResult = game.winner === team ? "winner" : (game.loser === team ? "loser" : "");
                        const seed = team === game.winner ? game.winnerSeed : (team === game.loser ? game.loserSeed : null);
                        
                        return (
                          <Grid item xs={12} sm={6} key={team}>
                            <Paper sx={{ p: 2 }}>
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Box>
                                  <Stack direction="row" spacing={1} alignItems="center">
                                    <Link component={RouterLink} to={`/teams/${team}`}>
                                      <Typography variant="h6">{team}</Typography>
                                    </Link>
                                    {seed && (
                                      <Chip label={`#${seed} Seed`} size="small" />
                                    )}
                                    {teamResult && (
                                      <Chip 
                                        label={teamResult === "winner" ? "Winner" : "Loser"} 
                                        color={teamResult === "winner" ? "success" : "error"}
                                        size="small"
                                      />
                                    )}
                                  </Stack>
                                  <Typography variant="body2">
                                    {picks} picks ({percentage.toFixed(1)}%)
                                  </Typography>
                                </Box>
                              </Stack>
                            </Paper>
                          </Grid>
                        );
                      })}
                    </Grid>
                  );
                })()}
              </CardContent>
            </Card>
          </Grid>
        )}
        
        {/* List of Games */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title={`${displayRoundName(currentRoundId)} Games`} />
            <CardContent>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Game</TableCell>
                      <TableCell>Teams</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Result</TableCell>
                      <TableCell align="right">Correct Picks</TableCell>
                      <TableCell align="right">Accuracy</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedGames.map(game => {
                      if (!game) return null;
                      
                      return (
                        <TableRow key={game.gameId}>
                          <TableCell>
                            <Button
                              size="small"
                              color="primary"
                              component={RouterLink}
                              to={`/games/${game.gameId}`}
                            >
                              Game {game.gameId}
                            </Button>
                          </TableCell>
                          <TableCell>
                            {(
                              <Stack direction="row" spacing={1}>
                                <Link component={RouterLink} to={`/teams/${game.completed ? game.winner : game.teams[0]}`}>
                                {game.completed ? game.winner : game.teams[0]}
                                </Link>
                                <Typography>vs</Typography>
                                <Link component={RouterLink} to={`/teams/${game.completed ? game.loser : game.teams[1]}`}>
                                {game.completed ? game.loser : game.teams[1]}
                                </Link>
                              </Stack>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip 
                              color={game.completed ? 'success' : 'warning'} 
                              label={game.completed ? 'Completed' : 'Pending'} 
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            {game.completed ? (
                              <Stack direction="row" spacing={1}>
                                <Chip 
                                  color="success" 
                                  label={`${game.winner}${game.winnerSeed ? ` (#${game.winnerSeed})` : ''}`} 
                                  size="small"
                                  component={RouterLink}
                                  to={`/teams/${game.winner}`}
                                  clickable
                                />
                                <Typography>beat</Typography>
                                <Chip 
                                  color="error" 
                                  label={`${game.loser}${game.loserSeed ? ` (#${game.loserSeed})` : ''}`} 
                                  size="small"
                                  component={RouterLink}
                                  to={`/teams/${game.loser}`}
                                  clickable
                                />
                              </Stack>
                            ) : (
                              <Typography>-</Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            {game.completed ? `${game.correctPicks}/${game.totalPicks}` : '-'}
                          </TableCell>
                          <TableCell align="right">
                            {game.completed ? `${game.accuracy.toFixed(1)}%` : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default RoundPage; 