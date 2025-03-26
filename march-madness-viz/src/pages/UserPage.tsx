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
  Paper,
  Link as RouterLink
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
import UserSimilarityTable, { UserSimilarity } from '../components/UserSimilarityTable';

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
    error,
    users, 
    brackets, 
    teams
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
  
  // Calculate similar users
  const userSimilarities = useMemo(() => {
    if (!bracketData || !username) return [];
    
    const userPicks = new Map<string, Set<string>>();
    const userPicksWithWeights = new Map<string, Map<string, number>>();
    
    // Round weights for scoring
    const roundWeights: Record<string, number> = {
      'ROUND_64': 10,
      'ROUND_32': 20,
      'SWEET_16': 40,
      'ELITE_8': 80,
      'FINAL_FOUR': 160,
      'CHAMPIONSHIP': 320
    };
    
    // Function to get round name from game ID
    const getRoundNameFromGameId = (gameId: string): string => {
      const id = parseInt(gameId);
      if (id >= 1 && id <= 32) return 'ROUND_64';
      if (id >= 33 && id <= 48) return 'ROUND_32';
      if (id >= 49 && id <= 56) return 'SWEET_16';
      if (id >= 57 && id <= 60) return 'ELITE_8';
      if (id >= 61 && id <= 62) return 'FINAL_FOUR';
      return 'CHAMPIONSHIP';
    };
    
    // Collect all picks for each user
    Object.entries(bracketData.games).forEach(([gameId, game]) => {
      // Get the round weight for this game
      const roundName = getRoundNameFromGameId(gameId);
      const weight = roundWeights[roundName];
      
      Object.entries(game.picks).forEach(([user, pick]) => {
        // Regular similarity - just the picks
        if (!userPicks.has(user)) {
          userPicks.set(user, new Set());
        }
        userPicks.get(user)?.add(`${gameId}:${pick}`);
        
        // Weighted similarity - with round weights
        if (!userPicksWithWeights.has(user)) {
          userPicksWithWeights.set(user, new Map());
        }
        userPicksWithWeights.get(user)?.set(`${gameId}:${pick}`, weight);
      });
    });
    
    // Calculate Jaccard similarity between current user and all others
    const selectedUserPicks = userPicks.get(username);
    const selectedUserWeightedPicks = userPicksWithWeights.get(username);
    
    if (!selectedUserPicks || !selectedUserWeightedPicks) return [];
    
    const similarities: UserSimilarity[] = [];
    
    userPicks.forEach((picks, user) => {
      if (user === username) return;
      
      // Calculate regular similarity (Jaccard index)
      const intersection = new Set(
        Array.from(selectedUserPicks).filter(pick => picks.has(pick))
      );
      
      const union = new Set([...selectedUserPicks, ...picks]);
      
      // Jaccard similarity: size of intersection / size of union
      const similarity = intersection.size / union.size;
      
      // Calculate weighted similarity
      const userWeightedPicks = userPicksWithWeights.get(user);
      if (!userWeightedPicks) return;
      
      let weightedIntersectionSum = 0;
      let weightedUnionSum = 0;
      let sharedPoints = 0;
      
      // Get all unique picks between both users
      const allPickKeys = new Set([
        ...Array.from(selectedUserWeightedPicks.keys()),
        ...Array.from(userWeightedPicks.keys())
      ]);
      
      // Calculate weighted sums
      allPickKeys.forEach(pickKey => {
        const selectedUserWeight = selectedUserWeightedPicks.get(pickKey) || 0;
        const otherUserWeight = userWeightedPicks.get(pickKey) || 0;
        
        // For intersection, take the minimum weight (only if both users picked it)
        if (selectedUserWeight > 0 && otherUserWeight > 0) {
          weightedIntersectionSum += Math.min(selectedUserWeight, otherUserWeight);
          
          // If both users picked the same team for this game, add the points to sharedPoints
          sharedPoints += selectedUserWeight;
        }
        
        // For union, take the maximum weight
        weightedUnionSum += Math.max(selectedUserWeight, otherUserWeight);
      });
      
      // Weighted Jaccard similarity
      const weightedSimilarity = weightedUnionSum > 0 ? 
        weightedIntersectionSum / weightedUnionSum : 0;
      
      const userScore = userScores.find(score => score.username === user)?.score || 0;
      
      similarities.push({
        username: user,
        similarity,
        weightedSimilarity,
        sharedPoints,
        score: userScore
      });
    });
    
    return similarities.sort((a, b) => b.weightedSimilarity - a.weightedSimilarity);
  }, [bracketData, username, userScores]);

  // Calculate user pick strategy metrics
  const userPickMetrics = useMemo(() => {
    if (!bracketData || !gameResults || !username) return null;
    
    let chalkPicks = 0;
    let totalPicks = 0;
    let herdingScore = 0;
    let deviationScore = 0;
    
    // Create a seed map for calculating chalk score
    const seedMap = new Map<string, number>();
    gameResults.forEach(result => {
      seedMap.set(result.winner, result.winnerSeed);
      seedMap.set(result.loser, result.loserSeed);
    });
    
    // For each game, analyze pick strategies
    Object.entries(bracketData.games).forEach(([gameId, game]) => {
      if (!game.picks[username]) return;
      
      const teamPicks: Record<string, number> = {};
      
      // Count picks for each team
      Object.values(game.picks).forEach(pick => {
        teamPicks[pick] = (teamPicks[pick] || 0) + 1;
      });
      
      // Find chalk pick (team with lowest seed) and most popular pick
      let chalkPick = '';
      let lowestSeed = Number.MAX_SAFE_INTEGER;
      
      let mostPopularPick = '';
      let maxPicks = 0;
      
      // Find both chalk (lowest seed) and popular (most picked) teams
      Object.keys(teamPicks).forEach(team => {
        const seed = seedMap.get(team);
        const pickCount = teamPicks[team];
        
        // Update chalk pick (lowest seed)
        if (seed !== undefined && seed < lowestSeed) {
          lowestSeed = seed;
          chalkPick = team;
        }
        
        // Update most popular pick
        if (pickCount > maxPicks) {
          maxPicks = pickCount;
          mostPopularPick = team;
        }
      });
      
      const userPick = game.picks[username];
      totalPicks++;
      
      // Calculate chalk score (did they pick the lowest seed)
      if (userPick === chalkPick) {
        chalkPicks++;
      }
      
      // Calculate herding score (did they pick the most popular team)
      if (userPick === mostPopularPick) {
        herdingScore++;
      } else {
        // Calculate deviation based on how unpopular the pick was
        const pickCount = teamPicks[userPick] || 0;
        const deviation = 1 - (pickCount / maxPicks);
        deviationScore += deviation;
      }
    });
    
    const chalkScore = totalPicks > 0 ? (chalkPicks / totalPicks) * 100 : 0;
    const herdingPercent = totalPicks > 0 ? (herdingScore / totalPicks) * 100 : 0;
    
    // Get all usernames that have picks - more reliable than bracketData.users
    const allUsers = new Set<string>();
    Object.values(bracketData.games).forEach(game => {
      Object.keys(game.picks).forEach(user => allUsers.add(user));
    });
    
    const allUsersArray = Array.from(allUsers);
    
    // Calculate metrics for all users
    const allMetrics = allUsersArray.map(user => {
      let userChalkPicks = 0;
      let userTotalPicks = 0;
      let userHerdingScore = 0;
      let userDeviationScore = 0;
      
      Object.entries(bracketData.games).forEach(([gameId, game]) => {
        if (!game.picks[user]) return;
        
        const teamPicks: Record<string, number> = {};
        Object.values(game.picks).forEach(pick => {
          teamPicks[pick] = (teamPicks[pick] || 0) + 1;
        });
        
        let chalkPick = '';
        let lowestSeed = Number.MAX_SAFE_INTEGER;
        let mostPopularPick = '';
        let maxPicks = 0;
        
        Object.keys(teamPicks).forEach(team => {
          const seed = seedMap.get(team);
          const pickCount = teamPicks[team];
          
          if (seed !== undefined && seed < lowestSeed) {
            lowestSeed = seed;
            chalkPick = team;
          }
          
          if (pickCount > maxPicks) {
            maxPicks = pickCount;
            mostPopularPick = team;
          }
        });
        
        const userPick = game.picks[user];
        userTotalPicks++;
        
        if (userPick === chalkPick) {
          userChalkPicks++;
        }
        
        if (userPick === mostPopularPick) {
          userHerdingScore++;
        } else {
          const pickCount = teamPicks[userPick] || 0;
          const deviation = 1 - (pickCount / maxPicks);
          userDeviationScore += deviation;
        }
      });
      
      return {
        username: user,
        chalkScore: userTotalPicks > 0 ? (userChalkPicks / userTotalPicks) * 100 : 0,
        herdingScore: userTotalPicks > 0 ? (userHerdingScore / userTotalPicks) * 100 : 0,
        deviationScore: userDeviationScore
      };
    });
    
    // Filter out any entries with invalid scores (might happen if a user has no picks)
    const validMetrics = allMetrics.filter(m => 
      !isNaN(m.chalkScore) && 
      !isNaN(m.herdingScore) && 
      !isNaN(m.deviationScore)
    );
    
    // Sort to find ranks
    const sortedChalk = [...validMetrics].sort((a, b) => b.chalkScore - a.chalkScore);
    const sortedHerding = [...validMetrics].sort((a, b) => b.herdingScore - a.herdingScore);
    const sortedDeviation = [...validMetrics].sort((a, b) => b.deviationScore - a.deviationScore);
    
    // Find the user in each sorted array
    const chalkRank = sortedChalk.findIndex(u => u.username === username) + 1;
    const herdingRank = sortedHerding.findIndex(u => u.username === username) + 1;
    const deviationRank = sortedDeviation.findIndex(u => u.username === username) + 1;
    
    // Ensure we have valid ranks (if user is not found, rank will be 0)
    const totalUsers = validMetrics.length;
    const validChalkRank = chalkRank > 0 ? chalkRank : totalUsers;
    const validHerdingRank = herdingRank > 0 ? herdingRank : totalUsers;
    const validDeviationRank = deviationRank > 0 ? deviationRank : totalUsers;
    
    return {
      chalkScore,
      herdingScore: herdingPercent,
      deviationScore,
      chalkRank: validChalkRank,
      herdingRank: validHerdingRank,
      deviationRank: validDeviationRank,
      totalUsers
    };
  }, [bracketData, gameResults, username]);
  
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
      
      <Card sx={{ mb: 3 }}>
        <CardHeader 
          title="Pick Strategy Analysis" 
          titleTypography={{ variant: 'h6' }}
        />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, textAlign: 'center', height: '100%' }}>
                <Typography variant="subtitle1" gutterBottom>Chalk Score</Typography>
                <Typography variant="h4">{userPickMetrics?.chalkScore.toFixed(1)}%</Typography>
                <Typography variant="body2" color="text.secondary">
                  Rank: {userPickMetrics?.chalkRank} of {userPickMetrics?.totalUsers}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  How often you pick favorites based on seed
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, textAlign: 'center', height: '100%' }}>
                <Typography variant="subtitle1" gutterBottom>Herding Score</Typography>
                <Typography variant="h4">{userPickMetrics?.herdingScore.toFixed(1)}%</Typography>
                <Typography variant="body2" color="text.secondary">
                  Rank: {userPickMetrics?.herdingRank} of {userPickMetrics?.totalUsers}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  How often you pick the same teams as the majority
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, textAlign: 'center', height: '100%' }}>
                <Typography variant="subtitle1" gutterBottom>Deviation Score</Typography>
                <Typography variant="h4">{userPickMetrics?.deviationScore.toFixed(1)}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Rank: {userPickMetrics?.deviationRank} of {userPickMetrics?.totalUsers}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  How contrarian your picks are compared to others
                </Typography>
              </Paper>
            </Grid>
          </Grid>
          <Box sx={{ mt: 2, textAlign: 'right' }}>
            <Button 
              component={RouterLink}
              to="/pool-analysis"
              size="small"
              color="primary"
            >
              View Full Pool Analysis
            </Button>
          </Box>
        </CardContent>
      </Card>
      
      <Card sx={{ mb: 3 }}>
        <CardHeader 
          title="Similar Users" 
          titleTypography={{ variant: 'h6' }}
        />
        <CardContent>
          <UserSimilarityTable 
            similarities={userSimilarities}
            selectedUser={username || ''}
            limit={5}
            showDescription={false}
          />
          <Box sx={{ mt: 2, textAlign: 'right' }}>
            <Button 
              component={RouterLink}
              to={`/pool-analysis?user=${username}`}
              size="small"
              color="primary"
            >
              Find More Similar Users
            </Button>
          </Box>
        </CardContent>
      </Card>
      
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