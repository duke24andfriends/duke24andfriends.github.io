import React, { useMemo, useState } from 'react';
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
  TextField,
  InputAdornment,
  Paper,
  Link,
  FormControlLabel,
  Switch
} from '@mui/material';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { Pie, Bar } from 'react-chartjs-2';
import SearchIcon from '@mui/icons-material/Search';
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
  gameId: string;
}

const GamePage = () => {
  const { gameId } = useParams<keyof RouteParams>() as RouteParams;
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [showAllTeams, setShowAllTeams] = useState(false);
  const { 
    bracketData, 
    gameWinners, 
    gameResults,
    userScores, 
    loading, 
    error 
  } = useData();
  
  // Helper function to get the feeding games
  const getFeedingGames = (gameIdNum: number) => {
    let feedingGames: number[] = [];
    
    // Elite 8 (57-60) is fed by Sweet 16 (49-56)
    if (gameIdNum >= 57 && gameIdNum <= 60) {
      const base = 48;
      feedingGames = [
        (gameIdNum - 57) * 2 + base + 1,
        (gameIdNum - 57) * 2 + base + 2
      ];
    }
    // Final Four (61-62) is fed by Elite 8 (57-60)
    else if (gameIdNum >= 61 && gameIdNum <= 62) {
      const base = 56;
      feedingGames = [
        (gameIdNum - 61) * 2 + base + 1,
        (gameIdNum - 61) * 2 + base + 2
      ];
    }
    // Championship (63) is fed by Final Four (61-62)
    else if (gameIdNum === 63) {
      feedingGames = [61, 62];
    }
    
    return feedingGames;
  };
  
  // Get game data
  const gameData = useMemo(() => {
    if (!bracketData || !gameId) return null;
    
    const game = bracketData.games[gameId];
    if (!game) return null;
    
    const gameWinner = gameWinners.find(winner => winner.gameId === gameId);
    const round = getRoundNameFromGameId(gameId);
    const points = getPointsForGame(gameId);
    const allTeams = Object.keys(game.stats.pick_distribution);
    
    // Get actual teams from game result if available
    const gameResult = gameResults?.find(result => result.gameId === gameId);
    
    let actualTeams: string[] = [];
    
    if (gameResult && gameResult.winner && gameResult.loser) {
      // Game has been played, we know exactly which teams
      actualTeams = [gameResult.winner, gameResult.loser];
    } else {
      // Check if this game's teams can be determined from feeding games
      const gameIdNum = parseInt(gameId);
      const feedingGames = getFeedingGames(gameIdNum);
      
      if (feedingGames.length === 2) {
        // Try to get winners from feeding games
        const team1 = gameWinners.find(w => w.gameId === feedingGames[0].toString())?.winner;
        const team2 = gameWinners.find(w => w.gameId === feedingGames[1].toString())?.winner;
        
        if (team1 && team2) {
          actualTeams = [team1, team2];
        }
      }
    }
    
    // If we couldn't determine actual teams, use all teams
    if (actualTeams.length === 0) {
      actualTeams = allTeams;
    }
    
    return {
      game,
      gameId,
      round,
      points,
      allTeams,
      actualTeams,
      winner: gameWinner?.winner || '',
      loser: gameResult?.loser || '',
      completed: !!gameWinner,
      gameResult,
      feedingGames: getFeedingGames(parseInt(gameId))
    };
  }, [bracketData, gameId, gameWinners, gameResults]);
  
  // Get user picks for this game
  const userPicks = useMemo(() => {
    if (!gameData || !bracketData) return { teams: {}, total: 0 };
    
    const teams: Record<string, { count: number, users: string[], percentage: number }> = {};
    let totalPicks = 0;
    
    // Initialize team data - use all teams if showAllTeams is true, otherwise only actualTeams
    const teamsToShow = showAllTeams ? gameData.allTeams : gameData.actualTeams;
    teamsToShow.forEach(team => {
      teams[team] = { count: 0, users: [], percentage: 0 };
    });
    
    // Count picks for each team
    Object.entries(gameData.game.picks).forEach(([username, pick]) => {
      if (teams[pick] || showAllTeams) {
        if (!teams[pick] && showAllTeams) {
          teams[pick] = { count: 0, users: [], percentage: 0 };
        }
        teams[pick].count++;
        teams[pick].users.push(username);
        totalPicks++;
      }
    });
    
    // Calculate percentages
    Object.keys(teams).forEach(team => {
      teams[team].percentage = (teams[team].count / totalPicks) * 100;
    });
    
    return { teams, total: totalPicks };
  }, [gameData, bracketData, showAllTeams]);
  
  // Filter users by search term
  const filteredUserPicks = useMemo(() => {
    if (!userPicks || !searchTerm) return userPicks;
    
    const filteredTeams: Record<string, { count: number, users: string[], percentage: number }> = {};
    
    Object.entries(userPicks.teams).forEach(([team, data]) => {
      const filteredUsers = data.users.filter(user => 
        user.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      filteredTeams[team] = {
        ...data,
        users: filteredUsers
      };
    });
    
    return { teams: filteredTeams, total: userPicks.total };
  }, [userPicks, searchTerm]);
  
  // Create chart data
  const chartData = useMemo(() => {
    if (!gameData || !userPicks) return null;
    
    const teamsToShow = Object.keys(userPicks.teams);
    
    return {
      labels: teamsToShow,
      datasets: [
        {
          data: teamsToShow.map(team => userPicks.teams[team].count),
          backgroundColor: teamsToShow.map(team => {
            if (team === gameData.winner) return 'rgba(75, 192, 192, 0.7)';
            if (team === gameData.loser) return 'rgba(255, 99, 132, 0.7)';
            return 'rgba(54, 162, 235, 0.7)';
          }),
          borderColor: teamsToShow.map(team => {
            if (team === gameData.winner) return 'rgba(75, 192, 192, 1)';
            if (team === gameData.loser) return 'rgba(255, 99, 132, 1)';
            return 'rgba(54, 162, 235, 1)';
          }),
          borderWidth: 1,
        },
      ],
    };
  }, [gameData, userPicks]);
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', height: '300px', alignItems: 'center' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (error || !gameData) {
    return (
      <Box sx={{ textAlign: 'center', py: 5, px: 3 }}>
        <Typography variant="h2" color="error" gutterBottom>
          {!gameData ? "Game Not Found" : "Error"}
        </Typography>
        <Typography variant="body1" sx={{ mt: 2, mb: 4 }}>
          {error || `Game ${gameId} could not be found.`}
        </Typography>
        <Button component={RouterLink} to="/" variant="contained">
          Return to Home
        </Button>
      </Box>
    );
  }
  
  // Helper function to display game teams properly
  const getGameTeamsDisplay = () => {
    if (gameData.completed && gameData.winner && gameData.loser) {
      return `${gameData.winner} vs ${gameData.loser}`;
    }
    
    if (gameData.actualTeams.length === 2) {
      return gameData.actualTeams.join(' vs ');
    }
    
    // If we have feeding games, show "Winner of Game X vs Winner of Game Y"
    if (gameData.feedingGames.length === 2) {
      const team1 = gameWinners.find(w => w.gameId === gameData.feedingGames[0].toString())?.winner || `Game ${gameData.feedingGames[0]} Winner`;
      const team2 = gameWinners.find(w => w.gameId === gameData.feedingGames[1].toString())?.winner || `Game ${gameData.feedingGames[1]} Winner`;
      return `${team1} vs ${team2}`;
    }
    
    return gameData.actualTeams.join(' vs ');
  };
  
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Game {gameId}: {getGameTeamsDisplay()}
      </Typography>
      
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Game Information" />
            <CardContent>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle1">Round</Typography>
                  <Typography variant="h5">{gameData.round.replace('_', ' ')}</Typography>
                </Box>
                
                <Box>
                  <Typography variant="subtitle1">Status</Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="h5">
                      {gameData.completed ? 'Completed' : 'Pending'}
                    </Typography>
                    <Chip 
                      color={gameData.completed ? 'success' : 'warning'} 
                      label={gameData.completed ? 'Completed' : 'Pending'} 
                      size="small"
                    />
                  </Stack>
                </Box>
                
                {gameData.completed && (
                  <Box>
                    <Typography variant="subtitle1">Winner</Typography>
                    <Typography variant="h5">{gameData.winner}</Typography>
                  </Box>
                )}
                
                <Box>
                  <Typography variant="subtitle1">Points</Typography>
                  <Typography variant="h5">{gameData.points} points</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Correct picks in this round are worth {gameData.points} points
                  </Typography>
                </Box>
                
                {gameData.gameResult && (
                  <Box>
                    <Typography variant="subtitle1">Game Result</Typography>
                    <Typography variant="h6">
                      {gameData.gameResult.winner} defeated {gameData.gameResult.loser}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader 
              title="Pick Distribution" 
              action={
                <FormControlLabel
                  control={
                    <Switch
                      checked={showAllTeams}
                      onChange={() => setShowAllTeams(prev => !prev)}
                      color="primary"
                      size="small"
                    />
                  }
                  label={showAllTeams ? "Showing All Teams" : "Showing Actual Teams"}
                />
              }
            />
            <CardContent>
              {chartData && (
                <Box sx={{ height: 250 }}>
                  <Pie 
                    data={chartData} 
                    options={{ 
                      maintainAspectRatio: false,
                      plugins: {
                        tooltip: {
                          callbacks: {
                            label: function(context) {
                              const label = context.label || '';
                              const value = context.raw as number;
                              const percentage = (value / userPicks.total) * 100;
                              return `${label}: ${value} users (${percentage.toFixed(1)}%)`;
                            }
                          }
                        },
                        legend: {
                          position: 'bottom',
                        }
                      }
                    }} 
                  />
                </Box>
              )}
              
              <Stack direction="row" spacing={2} sx={{ mt: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                {Object.keys(userPicks.teams).map(team => (
                  <Stack key={team} direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Box 
                      sx={{ 
                        width: 12, 
                        height: 12, 
                        backgroundColor: team === gameData.winner 
                          ? 'rgba(75, 192, 192, 1)' 
                          : team === gameData.loser
                            ? 'rgba(255, 99, 132, 1)'
                            : 'rgba(54, 162, 235, 1)',
                        borderRadius: '50%' 
                      }} 
                    />
                    <Typography variant="body2">
                      {team}: {userPicks.teams[team].count} users ({userPicks.teams[team].percentage.toFixed(1)}%)
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      <Card>
        <CardHeader 
          title="User Picks" 
          action={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={showAllTeams}
                    onChange={() => setShowAllTeams(prev => !prev)}
                    color="primary"
                    size="small"
                  />
                }
                label={showAllTeams ? "All Teams" : "Actual Teams"}
              />
              <TextField
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                size="small"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
          }
        />
        <CardContent>
          <Grid container spacing={3}>
            {/* First render winner and loser if they exist */}
            {gameData.winner && filteredUserPicks.teams[gameData.winner] && (
              <Grid item xs={12} md={6} key={gameData.winner}>
                <Paper sx={{ p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Typography variant="h6">
                      {gameData.winner}
                      <Chip 
                        label="Winner" 
                        color="success" 
                        size="small" 
                        sx={{ ml: 1 }} 
                      />
                    </Typography>
                    <Typography variant="subtitle1">
                      {filteredUserPicks.teams[gameData.winner].users.length} users
                    </Typography>
                  </Stack>
                  
                  <Divider sx={{ mb: 2 }} />
                  
                  <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Username</TableCell>
                          <TableCell align="right">Current Score</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredUserPicks.teams[gameData.winner].users.map(username => {
                          const userData = userScores.find(user => user.username === username);
                          return (
                            <TableRow key={username}>
                              <TableCell>
                                <Link 
                                  component={RouterLink} 
                                  to={`/users/${username}`}
                                  sx={{ textDecoration: 'none' }}
                                >
                                  {username}
                                </Link>
                              </TableCell>
                              <TableCell align="right">{userData?.score || 0}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </Box>
                </Paper>
              </Grid>
            )}
            
            {gameData.loser && filteredUserPicks.teams[gameData.loser] && (
              <Grid item xs={12} md={6} key={gameData.loser}>
                <Paper sx={{ p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Typography variant="h6">
                      {gameData.loser}
                      <Chip 
                        label="Loser" 
                        color="error" 
                        size="small" 
                        sx={{ ml: 1 }} 
                      />
                    </Typography>
                    <Typography variant="subtitle1">
                      {filteredUserPicks.teams[gameData.loser].users.length} users
                    </Typography>
                  </Stack>
                  
                  <Divider sx={{ mb: 2 }} />
                  
                  <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Username</TableCell>
                          <TableCell align="right">Current Score</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredUserPicks.teams[gameData.loser].users.map(username => {
                          const userData = userScores.find(user => user.username === username);
                          return (
                            <TableRow key={username}>
                              <TableCell>
                                <Link 
                                  component={RouterLink} 
                                  to={`/users/${username}`}
                                  sx={{ textDecoration: 'none' }}
                                >
                                  {username}
                                </Link>
                              </TableCell>
                              <TableCell align="right">{userData?.score || 0}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </Box>
                </Paper>
              </Grid>
            )}
            
            {/* Then render the rest of the teams */}
            {Object.keys(filteredUserPicks.teams)
              .filter(team => team !== gameData.winner && team !== gameData.loser)
              .map(team => (
                <Grid item xs={12} md={6} key={team}>
                  <Paper sx={{ p: 2 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                      <Typography variant="h6">
                        {team}
                      </Typography>
                      <Typography variant="subtitle1">
                        {filteredUserPicks.teams[team].users.length} users
                      </Typography>
                    </Stack>
                    
                    <Divider sx={{ mb: 2 }} />
                    
                    <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Username</TableCell>
                            <TableCell align="right">Current Score</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {filteredUserPicks.teams[team].users.map(username => {
                            const userData = userScores.find(user => user.username === username);
                            return (
                              <TableRow key={username}>
                                <TableCell>
                                  <Link 
                                    component={RouterLink} 
                                    to={`/users/${username}`}
                                    sx={{ textDecoration: 'none' }}
                                  >
                                    {username}
                                  </Link>
                                </TableCell>
                                <TableCell align="right">{userData?.score || 0}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </Box>
                  </Paper>
                </Grid>
              ))}
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default GamePage; 