import React, { useState, useMemo } from 'react';
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
  Select,
  MenuItem,
  TextField,
  Slider,
  Stack,
  Paper,
  Link,
  Tooltip,
  Divider
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
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

interface UserSimilarity {
  username: string;
  similarity: number;
  score: number;
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
  
  const [tabValue, setTabValue] = useState(0);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [clusterCount, setClusterCount] = useState<number>(3);
  
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  // Calculate user similarity
  const userSimilarities = useMemo(() => {
    if (!bracketData || !selectedUser) return [];
    
    const userPicks = new Map<string, Set<string>>();
    
    // Collect all picks for each user
    Object.entries(bracketData.games).forEach(([gameId, game]) => {
      Object.entries(game.picks).forEach(([username, pick]) => {
        if (!userPicks.has(username)) {
          userPicks.set(username, new Set());
        }
        userPicks.get(username)?.add(`${gameId}:${pick}`);
      });
    });
    
    // Calculate Jaccard similarity between selected user and all others
    const selectedUserPicks = userPicks.get(selectedUser);
    if (!selectedUserPicks) return [];
    
    const similarities: UserSimilarity[] = [];
    
    userPicks.forEach((picks, username) => {
      if (username === selectedUser) return;
      
      // Calculate intersection
      const intersection = new Set(
        Array.from(selectedUserPicks).filter(pick => picks.has(pick))
      );
      
      // Calculate union
      const union = new Set([...selectedUserPicks, ...picks]);
      
      // Jaccard similarity: size of intersection / size of union
      const similarity = intersection.size / union.size;
      
      const userScore = userScores.find(score => score.username === username)?.score || 0;
      
      similarities.push({
        username,
        similarity,
        score: userScore
      });
    });
    
    return similarities.sort((a, b) => b.similarity - a.similarity);
  }, [bracketData, selectedUser, userScores]);
  
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
  
  // Perform k-means clustering on user picks
  const userClusters = useMemo(() => {
    if (!userPickStrategies.length) return [];
    
    // Create feature vectors from picks
    // We'll use a simplified approach for k-means with just two dimensions: chalk and herding
    
    // Simple k-means implementation for our 2D case
    const maxIterations = 10;
    
    // Initialize clusters with random centroids
    const clusters: UserCluster[] = Array(clusterCount).fill(null).map((_, i) => ({
      id: i + 1, // Sequential IDs
      users: [],
      centroid: [
        Math.random() * 100, // Random chalkScore
        Math.random() * 100  // Random herdingScore
      ]
    }));
    
    // Perform k-means iterations
    for (let iter = 0; iter < maxIterations; iter++) {
      // Reset clusters
      clusters.forEach(cluster => {
        cluster.users = [];
      });
      
      // Assign users to clusters
      userPickStrategies.forEach(user => {
        const features = [user.chalkScore, user.herdingScore];
        
        // Find closest centroid
        let minDistance = Number.MAX_VALUE;
        let closestCluster = 0;
        
        clusters.forEach((cluster, index) => {
          // Euclidean distance
          const distance = Math.sqrt(
            Math.pow(features[0] - cluster.centroid[0], 2) +
            Math.pow(features[1] - cluster.centroid[1], 2)
          );
          
          if (distance < minDistance) {
            minDistance = distance;
            closestCluster = index;
          }
        });
        
        // Assign to closest cluster
        clusters[closestCluster].users.push(user.username);
      });
      
      // Update centroids
      clusters.forEach(cluster => {
        if (cluster.users.length === 0) return;
        
        // Calculate new centroid as average of all users in cluster
        const sum = [0, 0];
        
        cluster.users.forEach(username => {
          const user = userPickStrategies.find(u => u.username === username);
          if (user) {
            sum[0] += user.chalkScore;
            sum[1] += user.herdingScore;
          }
        });
        
        cluster.centroid = [
          sum[0] / cluster.users.length,
          sum[1] / cluster.users.length
        ];
      });
    }
    
    return clusters;
  }, [userPickStrategies, clusterCount]);
  
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
          score: user?.score ?? 0
        };
      });
      
      return {
        label: `Cluster ${cluster.id}`,
        data: userData,
        backgroundColor: `hsla(${hue}, 70%, 60%, 0.7)`,
        borderColor: `hsla(${hue}, 70%, 60%, 1)`,
      };
    });
    
    return {
      datasets
    };
  }, [userPickStrategies, userClusters]);
  
  // Create cluster descriptions
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
      
      // Characterize the cluster
      if (avgChalkScore > 75) {
        description += "Strong chalk pickers. ";
      } else if (avgChalkScore < 40) {
        description += "Upset pickers. ";
      }
      
      if (avgHerdingScore > 75) {
        description += "Follows the crowd. ";
      } else if (avgHerdingScore < 40) {
        description += "Contrarian strategy. ";
      }
      
      description += `Average score: ${avgScore.toFixed(0)}`;
      
      return {
        id: cluster.id,
        size: cluster.users.length,
        avgChalkScore,
        avgHerdingScore,
        avgScore,
        description
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
                  <InputLabel id="user-select-label">Select User</InputLabel>
                  <Select
                    labelId="user-select-label"
                    value={selectedUser}
                    label="Select User"
                    onChange={(e) => setSelectedUser(e.target.value as string)}
                  >
                    {userScores.slice(0, 50).map(user => (
                      <MenuItem key={user.username} value={user.username}>
                        {user.username}
                      </MenuItem>
                    ))}
                  </Select>
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
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Username</TableCell>
                        <TableCell align="right">Similarity</TableCell>
                        <TableCell align="right">Score</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {userSimilarities.slice(0, 15).map(user => (
                        <TableRow key={user.username}>
                          <TableCell>
                            <Link component={RouterLink} to={`/users/${user.username}`}>
                              {user.username}
                            </Link>
                          </TableCell>
                          <TableCell align="right">{(user.similarity * 100).toFixed(1)}%</TableCell>
                          <TableCell align="right">{user.score}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
          <Grid item xs={12} md={3}>
            <Card>
              <CardHeader title="User Clustering" />
              <CardContent>
                <Typography variant="body1" paragraph>
                  This visualization groups users into clusters based on their pick strategies.
                </Typography>
                
                <Box sx={{ mb: 3 }}>
                  <Typography id="cluster-slider" gutterBottom>
                    Number of Clusters: {clusterCount}
                  </Typography>
                  <Slider
                    aria-labelledby="cluster-slider"
                    value={clusterCount}
                    onChange={(_, newValue) => setClusterCount(newValue as number)}
                    step={1}
                    marks
                    min={2}
                    max={5}
                    valueLabelDisplay="auto"
                  />
                </Box>
                
                <Typography variant="subtitle2">
                  X-Axis: Chalk Score %
                </Typography>
                <Typography variant="subtitle2">
                  Y-Axis: Herding Score %
                </Typography>
                
                <Box sx={{ bgcolor: 'info.light', p: 2, borderRadius: 1, mt: 2 }}>
                  <Typography variant="subtitle2" color="info.contrastText" gutterBottom>
                    About Clustering
                  </Typography>
                  <Typography variant="body2" color="info.contrastText">
                    We use k-means clustering to group users based on their pick strategies.
                    Users in the same cluster have similar approaches to making their picks.
                  </Typography>
                </Box>
              </CardContent>
            </Card>
            
            <Card sx={{ mt: 3 }}>
              <CardHeader title="Cluster Characteristics" />
              <CardContent>
                <Stack spacing={2} divider={<Divider />}>
                  {clusterDescriptions.map(cluster => (
                    <Box key={cluster.id}>
                      <Typography variant="subtitle1" color="primary" gutterBottom>
                        Cluster {cluster.id} ({cluster.size} users)
                      </Typography>
                      <Typography variant="body2" gutterBottom>
                        {cluster.description}
                      </Typography>
                      <Typography variant="body2">
                        Avg Chalk: {cluster.avgChalkScore.toFixed(1)}%
                      </Typography>
                      <Typography variant="body2">
                        Avg Herding: {cluster.avgHerdingScore.toFixed(1)}%
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={9}>
            <Card>
              <CardHeader title="Bracket Strategy Clusters" />
              <CardContent>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Users clustered by their pick strategies (chalk vs. herding).
                </Typography>
                
                <Paper sx={{ p: 2, height: 500 }}>
                  {scatterData ? (
                    <Scatter
                      data={scatterData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                          x: {
                            title: {
                              display: true,
                              text: 'Chalk Score % (Lower Seed Picks)'
                            },
                            min: 0,
                            max: 100
                          },
                          y: {
                            title: {
                              display: true,
                              text: 'Herding Score % (Popular Picks)'
                            },
                            beginAtZero: true,
                            max: 100
                          }
                        },
                        plugins: {
                          tooltip: {
                            callbacks: {
                              label: function(context) {
                                const user = context.raw;
                                return [
                                  `${user.username}`,
                                  `Score: ${user.score}`,
                                  `Chalk: ${user.x.toFixed(1)}%`,
                                  `Herding: ${user.y.toFixed(1)}%`
                                ];
                              }
                            }
                          }
                        }
                      }}
                    />
                  ) : (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                      <Typography>No data available</Typography>
                    </Box>
                  )}
                </Paper>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>
    </Box>
  );
};

export default PoolAnalysisPage; 