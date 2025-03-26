import React, { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardHeader,
  CardContent,
  Grid,
  CircularProgress,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Tabs,
  Tab,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  TextField,
  Slider,
  Stack,
  Paper,
  Link,
  Tooltip,
  Divider,
  Autocomplete
} from '@mui/material';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Scatter } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip as ChartTooltip,
  Legend
} from 'chart.js';
import UserSimilarityTable, { UserSimilarity } from '../components/UserSimilarityTable';

// Register Chart.js components
ChartJS.register(
  LinearScale,
  PointElement,
  LineElement,
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
      id={`analysis-tabpanel-${index}`}
      aria-labelledby={`analysis-tab-${index}`}
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

interface UserPickStrategy {
  username: string;
  chalkScore: number;  // Based on seed (lower seed = more chalk)
  herdingScore: number; // Based on popular picks (higher = more herding)
  deviationScore: number; // How much they deviate from consensus (higher = more contrarian)
  score: number;
}

interface UserCluster {
  id: number;
  users: string[];
  centroid: number[];
}

const PoolAnalysisPage = () => {
  const { 
    bracketData, 
    gameWinners, 
    gameResults,
    userScores, 
    loading, 
    error 
  } = useData();
  
  const location = useLocation();
  const [tabValue, setTabValue] = useState(0);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [clusterCount, setClusterCount] = useState<number>(3);
  
  // Check for user parameter in URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const userParam = params.get('user');
    if (userParam && userScores.some(user => user.username === userParam)) {
      setSelectedUser(userParam);
    }
  }, [location.search, userScores]);
  
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  // Calculate user similarity
  const userSimilarities = useMemo(() => {
    if (!bracketData || !selectedUser) return [];
    
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
      
      Object.entries(game.picks).forEach(([username, pick]) => {
        // Regular similarity - just the picks
        if (!userPicks.has(username)) {
          userPicks.set(username, new Set());
        }
        userPicks.get(username)?.add(`${gameId}:${pick}`);
        
        // Weighted similarity - with round weights
        if (!userPicksWithWeights.has(username)) {
          userPicksWithWeights.set(username, new Map());
        }
        userPicksWithWeights.get(username)?.set(`${gameId}:${pick}`, weight);
      });
    });
    
    // Calculate Jaccard similarity between selected user and all others
    const selectedUserPicks = userPicks.get(selectedUser);
    const selectedUserWeightedPicks = userPicksWithWeights.get(selectedUser);
    
    if (!selectedUserPicks || !selectedUserWeightedPicks) return [];
    
    const similarities: UserSimilarity[] = [];
    
    userPicks.forEach((picks, username) => {
      if (username === selectedUser) return;
      
      // Calculate regular similarity (Jaccard index)
      const intersection = new Set(
        Array.from(selectedUserPicks).filter(pick => picks.has(pick))
      );
      
      const union = new Set([...selectedUserPicks, ...picks]);
      
      // Jaccard similarity: size of intersection / size of union
      const similarity = intersection.size / union.size;
      
      // Calculate weighted similarity
      const userWeightedPicks = userPicksWithWeights.get(username);
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
      
      const userScore = userScores.find(score => score.username === username)?.score || 0;
      
      similarities.push({
        username,
        similarity,
        weightedSimilarity,
        sharedPoints,
        score: userScore
      });
    });
    
    return similarities.sort((a, b) => b.weightedSimilarity - a.weightedSimilarity);
  }, [bracketData, selectedUser, userScores]);
  
  // State for managing sorting
  const [sortConfig, setSortConfig] = useState<{
    key: 'similarity' | 'weightedSimilarity' | 'sharedPoints' | 'score';
    direction: 'ascending' | 'descending';
  }>({
    key: 'weightedSimilarity',
    direction: 'descending'
  });

  // Function to handle sorting
  const requestSort = (key: 'similarity' | 'weightedSimilarity' | 'sharedPoints' | 'score') => {
    let direction: 'ascending' | 'descending' = 'descending';
    if (sortConfig.key === key && sortConfig.direction === 'descending') {
      direction = 'ascending';
    }
    setSortConfig({ key, direction });
  };

  // Get sorted data
  const sortedSimilarities = useMemo(() => {
    if (!userSimilarities.length) return [];
    const sortableItems = [...userSimilarities];
    
    sortableItems.sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'ascending' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'ascending' ? 1 : -1;
      }
      return 0;
    });
    
    return sortableItems;
  }, [userSimilarities, sortConfig]);
  
  // Calculate user chalk and herding scores
  const userPickStrategies = useMemo(() => {
    if (!bracketData || !gameResults) return [];
    
    const userStats: Record<string, { 
      chalkPicks: number, 
      totalPicks: number,
      herdingScore: number,
      deviationScore: number,
      // Track picks for clustering
      picksVector: Record<string, number>
    }> = {};
    
    // Get all usernames
    const usernames = new Set<string>();
    Object.values(bracketData.games).forEach(game => {
      Object.keys(game.picks).forEach(username => usernames.add(username));
    });
    
    // Initialize user stats
    usernames.forEach(username => {
      userStats[username] = { 
        chalkPicks: 0, 
        totalPicks: 0,
        herdingScore: 0,
        deviationScore: 0,
        picksVector: {}
      };
    });
    
    // Create a seed map for calculating chalk score
    const seedMap = new Map<string, number>();
    gameResults.forEach(result => {
      seedMap.set(result.winner, result.winnerSeed);
      seedMap.set(result.loser, result.loserSeed);
    });
    
    // For each game, analyze pick strategies
    Object.entries(bracketData.games).forEach(([gameId, game]) => {
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
      
      // Calculate how much each user's strategy matches chalk vs consensus
      Object.entries(game.picks).forEach(([username, pick]) => {
        userStats[username].totalPicks++;
        
        // Store pick for clustering vector (1 for picked team, 0 for others)
        Object.keys(teamPicks).forEach(team => {
          const pickKey = `${gameId}:${team}`;
          userStats[username].picksVector[pickKey] = team === pick ? 1 : 0;
        });
        
        // Calculate chalk score (did they pick the lowest seed)
        if (pick === chalkPick) {
          userStats[username].chalkPicks++;
        }
        
        // Calculate herding score (did they pick the most popular team)
        if (pick === mostPopularPick) {
          userStats[username].herdingScore++;
        } else {
          // Calculate deviation based on how unpopular the pick was
          const pickCount = teamPicks[pick] || 0;
          const deviation = 1 - (pickCount / maxPicks);
          userStats[username].deviationScore += deviation;
        }
      });
    });
    
    // Convert to array with percentages
    return Array.from(usernames).map(username => {
      const stats = userStats[username];
      const chalkScore = (stats.chalkPicks / stats.totalPicks) * 100;
      const herdingScore = (stats.herdingScore / stats.totalPicks) * 100;
      const userScore = userScores.find(score => score.username === username)?.score || 0;
      
      return {
        username,
        chalkScore,
        herdingScore,
        deviationScore: stats.deviationScore,
        score: userScore,
        // Keep track of pick vector for clustering
        picksVector: stats.picksVector
      };
    });
  }, [bracketData, gameResults, userScores]);
  
  // Perform k-means clustering on user picks for championship game (game 63)
  const userClusters = useMemo(() => {
    if (!userPickStrategies.length || !bracketData) return [];
    
    // Get all unique championship picks (game 63)
    const championshipGame = bracketData.games['63'];
    if (!championshipGame) return [];
    
    const championPicks: Record<string, string[]> = {};
    
    // Group users by their championship pick
    Object.entries(championshipGame.picks).forEach(([username, team]) => {
      if (!championPicks[team]) {
        championPicks[team] = [];
      }
      championPicks[team].push(username);
    });
    
    // Convert to clusters (using sequential IDs)
    let clusterId = 1;
    const clusters: UserCluster[] = Object.entries(championPicks)
      .sort((a, b) => b[1].length - a[1].length) // Sort by popularity
      .map(([team, users]) => {
        // Find average chalk and herding score for visualization purposes
        const usersWithStats = users.map(username => 
          userPickStrategies.find(u => u.username === username)
        ).filter(Boolean);
        
        const avgChalkScore = usersWithStats.reduce((sum, user) => sum + (user?.chalkScore || 0), 0) / usersWithStats.length;
        const avgHerdingScore = usersWithStats.reduce((sum, user) => sum + (user?.herdingScore || 0), 0) / usersWithStats.length;
        
        return {
          id: clusterId++,
          team,
          users,
          centroid: [avgChalkScore, avgHerdingScore]
        };
    });
    
    return clusters;
  }, [userPickStrategies, bracketData, clusterCount]);
  
  // Scatter plot data for user clustering
  const scatterData = useMemo(() => {
    if (!userPickStrategies.length || !userClusters.length) return null;
    
    // Create scatter datasets for each cluster
    const datasets = userClusters.map(cluster => {
      // Get colors based on cluster ID
      const hue = (cluster.id * 120) % 360;
      
      // Get user data for this cluster
      const userData = cluster.users.map(username => {
        const user = userPickStrategies.find(u => u.username === username);
        return {
          x: user?.chalkScore ?? 0,
          y: user?.herdingScore ?? 0,
          username,
          score: user?.score ?? 0,
          team: cluster.team
        };
      });
      
      return {
        label: `Cluster ${cluster.id}: ${cluster.team} (${cluster.users.length} users)`,
        data: userData,
        backgroundColor: `hsla(${hue}, 70%, 50%, 0.6)`,
        borderColor: `hsla(${hue}, 70%, 50%, 1)`,
        borderWidth: 1,
        pointRadius: 5,
        pointHoverRadius: 8,
      };
    });
    
    return {
      datasets
    };
  }, [userPickStrategies, userClusters]);
  
  // Generate cluster descriptions
  const clusterDescriptions = useMemo(() => {
    if (!userClusters.length) return [];
    
    return userClusters.map(cluster => {
      const users = cluster.users.map(username => 
        userPickStrategies.find(u => u.username === username)
      ).filter(Boolean);
      
      // Calculate average scores for this cluster
      const avgChalkScore = users.reduce((sum, user) => sum + (user?.chalkScore ?? 0), 0) / users.length;
      const avgHerdingScore = users.reduce((sum, user) => sum + (user?.herdingScore ?? 0), 0) / users.length;
      const avgScore = users.reduce((sum, user) => sum + (user?.score ?? 0), 0) / users.length;
      
      let description = "";
      
      if (avgChalkScore > 75) {
        description = "These users heavily favor chalk picks (lower seeds).";
      } else if (avgHerdingScore > 75) {
        description = "These users tend to follow the crowd with popular picks.";
      } else if (avgChalkScore < 40 && avgHerdingScore < 40) {
        description = "These users make contrarian picks, avoiding both chalk and popular teams.";
      } else {
        description = "These users have a balanced picking strategy.";
      }
      
      return {
        id: cluster.id,
        team: cluster.team,
        size: cluster.users.length,
        avgScore: avgScore,
        description: description,
        topUsers: users.sort((a, b) => (b?.score || 0) - (a?.score || 0)).slice(0, 5)
      };
    });
  }, [userClusters, userPickStrategies]);
  
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
  
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Pool Analysis
      </Typography>
      
      <Typography variant="body1" paragraph>
        Analyze bracket similarity, user clusters, and pick strategies.
      </Typography>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="pool analysis tabs">
          <Tab label="Bracket Similarity" id="analysis-tab-0" aria-controls="analysis-tabpanel-0" />
          <Tab label="Pick Strategy" id="analysis-tab-1" aria-controls="analysis-tabpanel-1" />
          <Tab label="User Clusters" id="analysis-tab-2" aria-controls="analysis-tabpanel-2" />
        </Tabs>
      </Box>
      
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardHeader title="Find Similar Brackets" />
              <CardContent>
                <FormControl fullWidth sx={{ mb: 4 }}>
                  <Autocomplete
                    id="user-select"
                    options={userScores}
                    getOptionLabel={(option) => {
                      const nameMapping = option.bracketName && option.fullName ? 
                        `${option.username} (${option.bracketName} - ${option.fullName})` : 
                        option.username;
                      return nameMapping;
                    }}
                    isOptionEqualToValue={(option, value) => option.username === value.username}
                    value={userScores.find(user => user.username === selectedUser) || null}
                    onChange={(_, newValue) => setSelectedUser(newValue ? newValue.username : '')}
                    renderInput={(params) => (
                      <TextField 
                        {...params} 
                        label="Search for a User" 
                        variant="outlined"
                        placeholder="Search by username, bracket name, or full name"
                      />
                    )}
                    filterOptions={(options, { inputValue }) => {
                      const filterValue = inputValue.toLowerCase();
                      return options.filter(option => 
                        option.username.toLowerCase().includes(filterValue) ||
                        (option.bracketName && option.bracketName.toLowerCase().includes(filterValue)) ||
                        (option.fullName && option.fullName.toLowerCase().includes(filterValue))
                      );
                    }}
                  />
                </FormControl>
                
                <Typography variant="body2" paragraph>
                  This tool calculates how similar other users' brackets are to the selected user's bracket.
                  Similarity is based on the Jaccard index of matching picks across all games.
                </Typography>
                
                <Box sx={{ bgcolor: 'info.light', p: 2, borderRadius: 1 }}>
                  <Typography variant="subtitle2" color="info.contrastText" gutterBottom>
                    How is Similarity Calculated?
                  </Typography>
                  <Typography variant="body2" color="info.contrastText">
                    The Jaccard similarity index measures the overlap between two sets of picks.
                    It's calculated as the size of the intersection divided by the size of the union.
                    A score of 1.0 means identical brackets, while 0.0 means completely different picks.
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={8}>
            <Card>
              <CardHeader title={selectedUser ? `Users Most Similar to ${selectedUser}` : "Select a User"} />
              <CardContent>
                {!selectedUser ? (
                  <Typography variant="body1">
                    Please select a user from the dropdown to see similar brackets.
                  </Typography>
                ) : (
                  <>
                    <Typography variant="body2" paragraph>
                      Three similarity metrics are shown:
                      <ul>
                        <li><strong>Regular:</strong> Standard Jaccard similarity (all picks weighted equally)</li>
                        <li><strong>Weighted:</strong> Picks weighted by round value (10, 20, 40, 80, 160, 320)</li>
                        <li><strong>Shared Points:</strong> Total points from picks that both users have in common</li>
                      </ul>
                      Click column headers to sort. Weighted metrics emphasize matches in later rounds, which are worth more points.
                    </Typography>
                    
                    <Tabs value={0} aria-label="similarity tabs">
                      <Tab label="All Users" />
                    </Tabs>
                    
                    <UserSimilarityTable 
                      similarities={userSimilarities}
                      selectedUser={selectedUser}
                      limit={15}
                      showDescription={false}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>
      
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardHeader title="Pick Strategy Analysis" />
              <CardContent>
                <Typography variant="body1" gutterBottom>
                  We analyze two distinct aspects of pick strategy:
                </Typography>
                
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" gutterBottom>Chalk Score</Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Measures how often users pick the team with the lower seed (favorites).
                    Higher scores mean the user consistently picks favorites.
                  </Typography>
                  
                  <Typography variant="subtitle1" gutterBottom>Herding Score</Typography>
                  <Typography variant="body2">
                    Measures how often users pick the same teams as the majority of the pool.
                    Higher scores mean the user tends to follow the crowd.
                  </Typography>
                  
                  <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>Deviation Score</Typography>
                  <Typography variant="body2">
                    Measures how much users deviate from the consensus picks.
                    Higher scores mean the user makes more contrarian picks.
                  </Typography>
                </Box>
                
                <Box sx={{ bgcolor: 'info.light', p: 2, borderRadius: 1 }}>
                  <Typography variant="subtitle2" color="info.contrastText" gutterBottom>
                    How are these scores calculated?
                  </Typography>
                  <Typography variant="body2" color="info.contrastText">
                    <strong>Chalk Score:</strong> Percentage of games where the user picked the team with the lower seed number.
                    <br /><br />
                    <strong>Herding Score:</strong> Percentage of games where the user picked the same team as the majority of other users.
                    <br /><br />
                    <strong>Deviation Score:</strong> Sum of deviation values across all games, where each deviation is calculated as (1 - [picks for team / max picks for any team]).
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={8}>
            <Card sx={{ mb: 3 }}>
              <CardHeader title="Most Chalky Brackets (Picked by Seed)" />
              <CardContent>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Username</TableCell>
                      <TableCell align="right">Chalk Score</TableCell>
                      <TableCell align="right">Score</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {userPickStrategies
                      .sort((a, b) => b.chalkScore - a.chalkScore)
                      .slice(0, 10)
                      .map(user => (
                        <TableRow key={user.username}>
                          <TableCell>
                            <Link component={RouterLink} to={`/users/${user.username}`}>
                              {user.username}
                            </Link>
                          </TableCell>
                          <TableCell align="right">{user.chalkScore.toFixed(1)}%</TableCell>
                          <TableCell align="right">{user.score}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            
            <Card sx={{ mb: 3 }}>
              <CardHeader title="Most Popular Opinion Followers (Herding)" />
              <CardContent>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Username</TableCell>
                      <TableCell align="right">Herding Score</TableCell>
                      <TableCell align="right">Score</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {userPickStrategies
                      .sort((a, b) => b.herdingScore - a.herdingScore)
                      .slice(0, 10)
                      .map(user => (
                        <TableRow key={user.username}>
                          <TableCell>
                            <Link component={RouterLink} to={`/users/${user.username}`}>
                              {user.username}
                            </Link>
                          </TableCell>
                          <TableCell align="right">{user.herdingScore.toFixed(1)}%</TableCell>
                          <TableCell align="right">{user.score}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader title="Most Contrarian Brackets" />
              <CardContent>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Username</TableCell>
                      <TableCell align="right">Deviation Score</TableCell>
                      <TableCell align="right">Score</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {userPickStrategies
                      .sort((a, b) => b.deviationScore - a.deviationScore)
                      .slice(0, 10)
                      .map(user => (
                        <TableRow key={user.username}>
                          <TableCell>
                            <Link component={RouterLink} to={`/users/${user.username}`}>
                              {user.username}
                            </Link>
                          </TableCell>
                          <TableCell align="right">{user.deviationScore.toFixed(1)}</TableCell>
                          <TableCell align="right">{user.score}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>
      
      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 8 }}>
                <Typography variant="h4" gutterBottom>
                  Coming Soon!
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  We're working on an exciting new feature to analyze user clusters and pick strategies.
                  Stay tuned for updates!
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>
    </Box>
  );
};

export default PoolAnalysisPage; 