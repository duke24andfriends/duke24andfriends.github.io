import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardHeader,
  CardContent,
  Grid,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  CircularProgress,
  Stack,
  Divider,
  Button,
  Paper
} from '@mui/material';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { useData } from '../context/DataContext';
import { ROUNDS, getRoundNameFromGameId, getPointsForGame } from '../types';
import { getOpponent } from '../utils/dataProcessing';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface RouteParams {
  username: string;
}

const UserPage = () => {
  const { username } = useParams<keyof RouteParams>() as RouteParams;
  const navigate = useNavigate();
  const { 
    bracketData, 
    gameWinners, 
    gameResults,
    userScores, 
    loading, 
    error 
  } = useData();
  
  // Find user data
  const userData = useMemo(() => 
    userScores.find(user => user.username === username),
    [userScores, username]
  );
  
  // Get user rank
  const userRank = useMemo(() => {
    if (!userData) return 0;
    return userScores.findIndex(user => user.username === username) + 1;
  }, [userScores, username, userData]);
  
  // Get all user picks
  const userPicks = useMemo(() => {
    if (!bracketData || !userData) return [];
    
    const picks = [];
    // Keep track of eliminated teams (teams that have lost in any game)
    const eliminatedTeams = new Set(
      gameResults.filter(result => result.loser).map(result => result.loser)
    );
    
    for (const [gameId, game] of Object.entries(bracketData.games)) {
      if (game.picks[username]) {
        const pick = game.picks[username];
        const actualWinner = gameWinners.find(w => w.gameId === gameId)?.winner || '';
        const isCorrect = actualWinner === pick;
        const isCompleted = gameWinners.some(w => w.gameId === gameId);
        const round = getRoundNameFromGameId(gameId);
        const points = isCorrect ? getPointsForGame(gameId) : 0;
        const isEliminated = eliminatedTeams.has(pick);
        
        picks.push({
          gameId,
          round,
          pick,
          opponent: gameResults && gameResults.length > 0 ? 
            getOpponent(gameResults, gameId, pick) : '',
          actualWinner,
          isCorrect,
          isCompleted,
          points,
          isEliminated
        });
      }
    }
    
    // Sort by game ID (chronological)
    return picks.sort((a, b) => parseInt(a.gameId) - parseInt(b.gameId));
  }, [bracketData, userData, gameWinners, username, gameResults]);
  
  // Picks by round
  const picksByRound = useMemo(() => {
    const rounds: Record<string, {correct: number, total: number, points: number}> = {};
    
    userPicks.forEach(pick => {
      if (!rounds[pick.round]) {
        rounds[pick.round] = { correct: 0, total: 0, points: 0 };
      }
      
      if (pick.isCompleted) {
        rounds[pick.round].total++;
        if (pick.isCorrect) {
          rounds[pick.round].correct++;
          rounds[pick.round].points += pick.points;
        }
      }
    });
    
    return rounds;
  }, [userPicks]);
  
  // Round performance chart data
  const roundChartData = {
    labels: Object.keys(picksByRound).map(round => round.replace('_', ' ')),
    datasets: [
      {
        label: 'Accuracy (%)',
        data: Object.values(picksByRound).map(round => 
          round.total > 0 ? (round.correct / round.total) * 100 : 0
        ),
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
    ],
  };
  
  // Champion distribution chart
  const championPick = useMemo(() => {
    if (!bracketData) return null;
    
    const championGameId = '63'; // Championship game
    const game = bracketData.games[championGameId];
    if (!game) return null;
    
    const userPick = game.picks[username];
    if (!userPick) return null;
    
    const totalUsers = bracketData.metadata.total_brackets;
    const pickCount = game.stats.pick_distribution[userPick] || 0;
    const percentage = (pickCount / totalUsers) * 100;
    
    return {
      team: userPick,
      count: pickCount,
      percentage
    };
  }, [bracketData, username]);
  
  // Champion distribution pie chart
  const championDistributionData = useMemo(() => {
    if (!championPick || !bracketData) return null;
    
    const championGameId = '63'; // Championship game
    const game = bracketData.games[championGameId];
    if (!game) return null;
    
    // Get all teams with more than 1% of picks
    const teams = Object.entries(game.stats.pick_distribution)
      .filter(([_, count]) => (count / bracketData.metadata.total_brackets) * 100 >= 1)
      .sort((a, b) => b[1] - a[1]);
    
    // Highlight user's pick
    const data = {
      labels: teams.map(([team]) => team),
      datasets: [
        {
          data: teams.map(([team, count]) => count),
          backgroundColor: teams.map(([team]) => 
            team === championPick.team 
              ? 'rgba(255, 99, 132, 0.8)' 
              : 'rgba(54, 162, 235, 0.6)'
          ),
          borderColor: teams.map(([team]) => 
            team === championPick.team 
              ? 'rgba(255, 99, 132, 1)' 
              : 'rgba(54, 162, 235, 1)'
          ),
          borderWidth: 1,
        },
      ],
    };
    
    return data;
  }, [championPick, bracketData]);
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', height: '300px', alignItems: 'center' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (error || !userData) {
    return (
      <Box sx={{ textAlign: 'center', py: 5, px: 3 }}>
        <Typography variant="h2" color="error" gutterBottom>
          {!userData ? "User Not Found" : "Error"}
        </Typography>
        <Typography variant="body1" sx={{ mt: 2, mb: 4 }}>
          {error || `The user "${username}" could not be found.`}
        </Typography>
        <Button component={Link} to="/leaderboard" variant="contained">
          Return to Leaderboard
        </Button>
      </Box>
    );
  }
  
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        User Profile: {username}
      </Typography>
      
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="User Statistics" />
            <CardContent>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle1">Leaderboard Rank</Typography>
                  <Typography variant="h4">
                    #{userRank}
                    {userRank <= 3 && (
                      <Chip
                        label={userRank === 1 ? "🥇" : userRank === 2 ? "🥈" : "🥉"}
                        size="small"
                        color={userRank === 1 ? "warning" : userRank === 2 ? "default" : "error"}
                        variant="outlined"
                        sx={{ ml: 1 }}
                      />
                    )}
                    {userRank === userScores.length && (
                      <Chip
                        label="🥴"
                        size="small"
                        color="default"
                        variant="outlined"
                        sx={{ ml: 1 }}
                      />
                    )}
                  </Typography>
                </Box>
                
                <Box>
                  <Typography variant="subtitle1">Total Score</Typography>
                  <Typography variant="h4">{userData.score} points</Typography>
                </Box>
                
                <Box>
                  <Typography variant="subtitle1">Accuracy</Typography>
                  <Typography variant="h4">
                    {userData.totalPicks > 0 
                      ? ((userData.correctPicks / userData.totalPicks) * 100).toFixed(1) 
                      : 0}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {userData.correctPicks} correct picks out of {userData.totalPicks} completed games
                  </Typography>
                </Box>
                
                {championPick && (
                  <Box>
                    <Typography variant="subtitle1">Championship Pick</Typography>
                    <Typography variant="h5">{championPick.team}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {championPick.percentage.toFixed(1)}% of brackets picked this team 
                      ({championPick.count} users)
                    </Typography>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Round Performance" />
            <CardContent>
              <Box sx={{ height: 250 }}>
                <Bar 
                  data={roundChartData} 
                  options={{ 
                    maintainAspectRatio: false,
                    scales: {
                      y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                          display: true,
                          text: 'Accuracy (%)'
                        }
                      }
                    }
                  }} 
                />
              </Box>
              
              <Table size="small" sx={{ mt: 2 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Round</TableCell>
                    <TableCell align="right">Correct</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell align="right">Points</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(picksByRound).map(([round, stats]) => (
                    <TableRow key={round}>
                      <TableCell>{round.replace('_', ' ')}</TableCell>
                      <TableCell align="right">{stats.correct}</TableCell>
                      <TableCell align="right">{stats.total}</TableCell>
                      <TableCell align="right">{stats.points}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {championDistributionData && (
        <Card sx={{ mb: 3 }}>
          <CardHeader title="Championship Pick Distribution" />
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Box sx={{ height: 300 }}>
                  <Pie 
                    data={championDistributionData} 
                    options={{ 
                      maintainAspectRatio: false,
                      plugins: {
                        tooltip: {
                          callbacks: {
                            label: function(context) {
                              const label = context.label || '';
                              const value = context.raw;
                              const total = bracketData?.metadata.total_brackets || 0;
                              const percentage = total > 0 ? (value / total) * 100 : 0;
                              return `${label}: ${value} users (${percentage.toFixed(1)}%)`;
                            }
                          }
                        }
                      }
                    }} 
                  />
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body1" paragraph>
                  This chart shows how {username}'s championship pick compares to other popular picks.
                </Typography>
                <Typography variant="body1" paragraph>
                  <strong>{championPick.team}</strong> was picked by {championPick.count} users 
                  ({championPick.percentage.toFixed(1)}% of all brackets).
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  The highlighted section (in red) represents {username}'s pick.
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}
      
      <Card>
        <CardHeader title="All Picks" />
        <CardContent>
          <Paper sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Game</TableCell>
                  <TableCell>Round</TableCell>
                  <TableCell>Pick</TableCell>
                  <TableCell>Opponent</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Points</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {userPicks.map((pick, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Button
                        size="small"
                        component={Link}
                        to={`/games/${pick.gameId}`}
                      >
                        Game {pick.gameId}
                      </Button>
                    </TableCell>
                    <TableCell>{pick.round.replace('_', ' ')}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Button
                          size="small"
                          component={Link}
                          to={`/teams/${pick.pick}`}
                          color={pick.isEliminated ? "error" : "primary"}
                          sx={{
                            textDecoration: pick.isEliminated && !pick.isCompleted ? 'line-through' : 'none',
                          }}
                        >
                          {pick.pick}
                        </Button>
                        {pick.isEliminated && !pick.isCompleted && (
                          <Chip size="small" label="Eliminated" color="error" />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {pick.opponent && (
                        <Button
                          size="small"
                          component={Link}
                          to={`/teams/${pick.opponent}`}
                        >
                          {pick.opponent}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      {pick.isCompleted ? (
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip 
                            label={pick.isCorrect ? "Correct" : "Incorrect"} 
                            color={pick.isCorrect ? "success" : "error"} 
                            size="small" 
                          />
                          {pick.isCorrect && (
                            <Typography variant="body2">+{pick.points} pts</Typography>
                          )}
                        </Stack>
                      ) : (
                        <Chip label="Pending" color="default" size="small" />
                      )}
                    </TableCell>
                    <TableCell align="right">{pick.points}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </CardContent>
      </Card>
    </Box>
  );
};

export default UserPage; 