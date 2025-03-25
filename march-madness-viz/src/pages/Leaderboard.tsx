import React, { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Stack,
  Grid,
  Card,
  CardContent,
  Button,
  CircularProgress,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  FormControlLabel,
  Switch,
  Tabs,
  Tab,
  Chip,
  Snackbar,
  Alert,
  IconButton,
  Paper,
  Table,
  TableContainer,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Tooltip as TooltipComponent,
  Avatar,
  Collapse
} from '@mui/material';
import { 
  Search as SearchIcon, 
  ContentCopy as ContentCopyIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon 
} from '@mui/icons-material';
import { useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { useData } from '../context/DataContext';
import { ROUNDS, UserScore } from '../types';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
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
      id={`leaderboard-tabpanel-${index}`}
      aria-labelledby={`leaderboard-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function getRoundDisplayName(roundKey: string): string {
  switch (roundKey) {
    case 'ROUND_64': return 'Round of 64';
    case 'ROUND_32': return 'Round of 32';
    case 'SWEET_16': return 'Sweet 16';
    case 'ELITE_8': return 'Elite 8';
    case 'FINAL_FOUR': return 'Final Four';
    case 'CHAMPIONSHIP': return 'Championship';
    default: return roundKey;
  }
}

const Leaderboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userScores, filteredUsernames, setFilteredUsernames, leaderboardTrend, bracketData, loading, error, gameResults } = useData();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isFilterActive, setIsFilterActive] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [alertOpen, setAlertOpen] = useState(false);
  const [expandedUsers, setExpandedUsers] = useState<string[]>([]);
  
  // Initialize selectedUsers from filteredUsernames when component mounts or filteredUsernames changes
  useEffect(() => {
    if (filteredUsernames.length > 0) {
      setSelectedUsers(filteredUsernames);
      setIsFilterActive(true);
    }
  }, [filteredUsernames]);
  
  // Effect to handle URL parameters for filtered users
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const userParam = urlParams.get('users');
    
    if (userParam) {
      const usernames = userParam.split(',');
      setSelectedUsers(usernames);
      setFilteredUsernames(usernames);
      setIsFilterActive(true);
    }
  }, [location.search, setFilteredUsernames]);
  
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  const handleToggleFilter = () => {
    const newFilterState = !isFilterActive;
    setIsFilterActive(newFilterState);
    
    if (!newFilterState) {
      // Clear filter
      setFilteredUsernames([]);
      
      // Update URL to remove the filter
      navigate('/leaderboard', { replace: true });
    } else if (selectedUsers.length > 0) {
      // Apply filter
      setFilteredUsernames(selectedUsers);
      
      // Update URL with filtered users
      const queryParams = new URLSearchParams();
      queryParams.set('users', selectedUsers.join(','));
      navigate(`/leaderboard?${queryParams.toString()}`, { replace: true });
    }
  };
  
  const toggleUserSelection = (username: string) => {
    setSelectedUsers(prev => {
      if (prev.includes(username)) {
        return prev.filter(u => u !== username);
      } else {
        return [...prev, username];
      }
    });
  };
  
  const toggleUserExpanded = (username: string) => {
    setExpandedUsers(prev => {
      if (prev.includes(username)) {
        return prev.filter(u => u !== username);
      } else {
        return [...prev, username];
      }
    });
  };
  
  const createShareableLink = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    const userParams = selectedUsers.length > 0 ? `?users=${selectedUsers.join(',')}` : '';
    const shareableLink = baseUrl + userParams;
    
    // Copy to clipboard
    navigator.clipboard.writeText(shareableLink);
    setAlertOpen(true);
  };
  
  const handleAlertClose = () => {
    setAlertOpen(false);
  };
  
  // Filter users based on search term
  const filteredUsers = useMemo(() => {
    return userScores.filter(user => 
      user.username.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [userScores, searchTerm]);
  
  // Get current users to display based on filter status
  const currentUsers = useMemo(() => {
    if (isFilterActive && selectedUsers.length > 0) {
      return userScores.filter(user => selectedUsers.includes(user.username));
    }
    return filteredUsers;
  }, [filteredUsers, isFilterActive, selectedUsers, userScores]);
  
  // Extract champion picks and calculate max possible scores
  const enhancedUserScores = useMemo(() => {
    if (!bracketData || !bracketData.games || !gameResults) {
      return currentUsers;
    }

    // Get championship game data (game ID 63)
    const championshipGame = bracketData.games["63"];
    
    // Map from gameId to round
    const gameIdToRound = new Map();
    // Round of 64: games 1-32
    for (let i = 1; i <= 32; i++) {
      gameIdToRound.set(i.toString(), "ROUND_64");
    }
    // Round of 32: games 33-48
    for (let i = 33; i <= 48; i++) {
      gameIdToRound.set(i.toString(), "ROUND_32");
    }
    // Sweet 16: games 49-56
    for (let i = 49; i <= 56; i++) {
      gameIdToRound.set(i.toString(), "SWEET_16");
    }
    // Elite 8: games 57-60
    for (let i = 57; i <= 60; i++) {
      gameIdToRound.set(i.toString(), "ELITE_8");
    }
    // Final Four: games 61-62
    for (let i = 61; i <= 62; i++) {
      gameIdToRound.set(i.toString(), "FINAL_FOUR");
    }
    // Championship: game 63
    gameIdToRound.set("63", "CHAMPIONSHIP");
    
    // Get completed games
    const completedGameIds = new Set(gameResults.map(game => game.gameId));
    
    // Get teams still in the tournament
    const eliminatedTeams = new Set<string>();
    gameResults.forEach(game => {
      if (game.loser) {
        eliminatedTeams.add(game.loser);
      }
    });
    
    return currentUsers.map(user => {
      // Extract champion pick
      let champion = '';
      if (championshipGame && championshipGame.picks && championshipGame.picks[user.username]) {
        champion = championshipGame.picks[user.username];
      }
      
      // Calculate round scores
      const roundScores: Record<string, number> = {
        ROUND_64: 0,
        ROUND_32: 0,
        SWEET_16: 0,
        ELITE_8: 0,
        FINAL_FOUR: 0,
        CHAMPIONSHIP: 0
      };
      
      // Calculate max possible score
      let maxPossibleScore = user.score;
      
      // Go through each game in bracket data
      Object.entries(bracketData.games).forEach(([gameId, game]) => {
        const round = gameIdToRound.get(gameId);
        if (!round) return;
        
        const userPick = game.picks[user.username];
        if (!userPick) return;
        
        // If game is completed and user picked correctly, add to round score
        const gameResult = gameResults.find(g => g.gameId === gameId);
        if (gameResult && gameResult.winner === userPick) {
          const pointValue = 
            round === "ROUND_64" ? 10 :
            round === "ROUND_32" ? 20 :
            round === "SWEET_16" ? 40 :
            round === "ELITE_8" ? 80 :
            round === "FINAL_FOUR" ? 160 : 320;
          
          roundScores[round] += pointValue;
        }
        
        // If game is not completed and user's pick is still in tournament
        if (!completedGameIds.has(gameId) && !eliminatedTeams.has(userPick)) {
          const pointValue = 
            round === "ROUND_64" ? 10 :
            round === "ROUND_32" ? 20 :
            round === "SWEET_16" ? 40 :
            round === "ELITE_8" ? 80 :
            round === "FINAL_FOUR" ? 160 : 320;
          
          maxPossibleScore += pointValue;
        }
      });
      
      return {
        ...user,
        champion,
        roundScores,
        maxPossibleScore
      };
    });
  }, [currentUsers, bracketData, gameResults]);
  
  // Chart data for leaderboard trend
  const orderedGames = useMemo(() => {
    if (!gameResults.length) return [];
    
    // Sort games by their order value
    return [...gameResults].sort((a, b) => a.order - b.order);
  }, [gameResults]);
  
  const chartData = useMemo(() => {
    if (!leaderboardTrend || leaderboardTrend.length === 0) return null;
    
    // Find ordered games
    const orderedGames = [...gameResults].sort((a, b) => a.order - b.order);
    
    // Map order to gameId for x-axis labeling
    const orderToGameIdMap = new Map(
      orderedGames.map(game => [game.order, game.gameId])
    );
    
    // Create datasets for each selected user (or top 10 if no selection)
    const usersToShow = isFilterActive && selectedUsers.length > 0
      ? selectedUsers
      : leaderboardTrend[leaderboardTrend.length - 1].scores.slice(0, 10).map(user => user.username);
    
    // Create color map for consistent user colors
    const colorMap = new Map();
    usersToShow.forEach((username, index) => {
      const hue = (index * 30) % 360;
      colorMap.set(username, `hsl(${hue}, 70%, 50%)`);
    });
    
    // Sort trend data by game order
    const sortedTrend = [...leaderboardTrend].sort((a, b) => {
      // Find the order for each gameId
      const orderA = orderedGames.find(g => g.gameId === a.gameId)?.order || 0;
      const orderB = orderedGames.find(g => g.gameId === b.gameId)?.order || 0;
      return orderA - orderB;
    });
    
    // Get scores at each point for selected users
    const datasets = usersToShow.map(username => {
      const userData = sortedTrend.map(point => {
        const userScore = point.scores.find(s => s.username === username);
        return userScore ? userScore.score : null;
      });
      
      // Use solid colors with 70% saturation and 50% lightness
      const color = colorMap.get(username);
      
      return {
        label: username,
        data: userData,
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: color,
        pointBorderColor: 'white',
        pointHoverRadius: 6,
        tension: 0.1,
        fill: false
      };
    });
    
    // Create labels from game results
    const labels = sortedTrend.map(point => {
      const gameId = point.gameId;
      const game = gameResults.find(g => g.gameId === gameId);
      
      if (game) {
        return `${game.winner} vs ${game.loser}`;
      }
      return `Game ${gameId}`;
    });
    
    return {
      labels,
      datasets
    };
  }, [leaderboardTrend, gameResults, selectedUsers, isFilterActive]);
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', height: '300px', alignItems: 'center' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ textAlign: 'center', py: 5, px: 3 }}>
        <Typography variant="h2" color="error" gutterBottom>
          Error
        </Typography>
        <Typography variant="body1" sx={{ mt: 2, mb: 4 }}>
          {error}
        </Typography>
      </Box>
    );
  }
  
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        March Madness Leaderboard
      </Typography>
      
      <Tabs value={tabValue} onChange={handleTabChange} sx={{ mb: 2 }}>
        <Tab label="Leaderboard" id="leaderboard-tab-0" aria-controls="leaderboard-tabpanel-0" />
        <Tab label="Leaderboard Trend" id="leaderboard-tab-1" aria-controls="leaderboard-tabpanel-1" />
      </Tabs>
      
      <TabPanel value={tabValue} index={0}>
        <Box sx={{ mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Stack direction="row" spacing={2} justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={isFilterActive}
                      onChange={handleToggleFilter}
                      color="primary"
                    />
                  }
                  label={isFilterActive ? "Filtered View" : "All Users"}
                />
                
                <Button
                  variant="outlined"
                  onClick={createShareableLink}
                  startIcon={<ContentCopyIcon />}
                  disabled={selectedUsers.length === 0}
                  sx={{ mt: 2 }}
                >
                  Create Shareable Group Link
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Box>
        
        <TableContainer component={Paper}>
          <Table aria-label="leaderboard table">
            <TableHead>
              <TableRow>
                <TableCell>Rank</TableCell>
                <TableCell>Username</TableCell>
                <TableCell align="right">Score</TableCell>
                <TableCell align="right">Max Possible</TableCell>
                <TableCell align="right">Champion</TableCell>
                <TableCell align="right">Select</TableCell>
                <TableCell align="right">Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {enhancedUserScores.map((user, index) => {
                const isExpanded = expandedUsers.includes(user.username);
                const rankChip = index === 152 ? 
                  <Chip label="🥴" size="small" color="default" /> : null;
                
                return (
                  <React.Fragment key={user.username}>
                    <TableRow
                      hover
                      sx={{
                        backgroundColor: selectedUsers.includes(user.username) 
                          ? 'rgba(25, 118, 210, 0.08)' 
                          : 'inherit'
                      }}
                    >
                      <TableCell>
                        {index === 0 ? (
                          <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'gold' }}>
                            🥇 1
                          </Typography>
                        ) : index === 1 ? (
                          <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'silver' }}>
                            🥈 2
                          </Typography>
                        ) : index === 2 ? (
                          <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#CD7F32' }}>
                            🥉 3
                          </Typography>
                        ) : (
                          index + 1
                        )}
                        {rankChip}
                      </TableCell>
                      <TableCell>
                        <Button 
                          component={RouterLink} 
                          to={`/users/${user.username}`}
                          size="small" 
                          sx={{ textTransform: 'none' }}
                        >
                          {user.username}
                        </Button>
                      </TableCell>
                      <TableCell align="right">{user.score}</TableCell>
                      <TableCell align="right">
                        {user.maxPossibleScore !== undefined ? user.maxPossibleScore : '-'}
                      </TableCell>
                      <TableCell align="right">
                        {user.champion ? (
                          <TooltipComponent title={`${user.username}'s champion pick`}>
                            <Button 
                              component={RouterLink} 
                              to={`/teams/${user.champion}`}
                              size="small" 
                              variant="text"
                            >
                              {user.champion}
                            </Button>
                          </TooltipComponent>
                        ) : '-'}
                      </TableCell>
                      <TableCell align="right">
                        <Switch
                          size="small"
                          checked={selectedUsers.includes(user.username)}
                          onChange={() => toggleUserSelection(user.username)}
                          color="primary"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => toggleUserExpanded(user.username)}
                          aria-expanded={isExpanded}
                          aria-label="show details"
                        >
                          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </TableCell>
                    </TableRow>
                    
                    <TableRow>
                      <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ margin: 1 }}>
                            <Typography variant="subtitle2" gutterBottom component="div">
                              Round Scores for {user.username}
                            </Typography>
                            <Table size="small" aria-label="round scores">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Round</TableCell>
                                  <TableCell align="right">Score</TableCell>
                                  <TableCell align="right">Points Possible</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {user.roundScores && Object.entries(user.roundScores).map(([round, score]) => (
                                  <TableRow key={round}>
                                    <TableCell component="th" scope="row">
                                      {getRoundDisplayName(round)}
                                    </TableCell>
                                    <TableCell align="right">{score}</TableCell>
                                    <TableCell align="right">
                                      {ROUNDS[round as keyof typeof ROUNDS]?.length * 
                                       (round === 'ROUND_64' ? 10 : 
                                        round === 'ROUND_32' ? 20 :
                                        round === 'SWEET_16' ? 40 :
                                        round === 'ELITE_8' ? 80 :
                                        round === 'FINAL_FOUR' ? 160 : 320)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>
      
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Score Progression Over Games
                </Typography>
                
                {chartData ? (
                  <Box sx={{ height: 500 }}>
                    <Line
                      data={chartData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          tooltip: {
                            callbacks: {
                              title: function(tooltipItems) {
                                const gameIndex = tooltipItems[0].dataIndex;
                                return chartData.labels[gameIndex];
                              }
                            }
                          },
                          legend: {
                            position: 'top',
                          },
                        },
                        scales: {
                          x: {
                            title: {
                              display: true,
                              text: 'Games in Order Played'
                            }
                          },
                          y: {
                            title: {
                              display: true,
                              text: 'Score'
                            },
                            beginAtZero: true
                          }
                        }
                      }}
                    />
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', height: 300, alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body1">No trend data available</Typography>
                  </Box>
                )}
                
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  {isFilterActive && selectedUsers.length > 0 
                    ? `Showing score progression for ${selectedUsers.length} selected users.` 
                    : "Showing score progression for top 10 users. Select specific users from the leaderboard to compare them."}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>
      
      <Snackbar
        open={alertOpen}
        autoHideDuration={4000}
        onClose={handleAlertClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleAlertClose} severity="success" sx={{ width: '100%' }}>
          Link copied to clipboard!
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Leaderboard; 