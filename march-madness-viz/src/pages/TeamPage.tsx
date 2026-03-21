import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  MenuItem,
  Select,
  Card,
  CardHeader,
  CardContent,
  Grid,
  CircularProgress,
  Stack,
  Divider,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  FormControl,
  Chip,
  Button,
  FormControlLabel,
  Switch,
  Link,
  Paper
} from '@mui/material';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { Bar, Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  RadialLinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { useData } from '../context/DataContext';
import { ROUNDS } from '../types';
import { getOpponent } from '../utils/dataProcessing';
import { useYearPath } from '../utils/yearRouting';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  RadialLinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface RouteParams {
  teamCode: string;
}

const TeamPage = () => {
  const { teamCode } = useParams<keyof RouteParams>() as RouteParams;
  const navigate = useNavigate();
  const { yearPath } = useYearPath();
  const { teamConfidence, gameWinners, gameResults, bracketData, userScores, loading, error } = useData();
  
  // State for toggling between percentage and count
  const [showCounts, setShowCounts] = useState(false);
  
  // Get all team codes for the dropdown
  const allTeams = useMemo(() => 
    teamConfidence.map(team => team.team).sort(),
    [teamConfidence]
  );
  
  // Ensure valid team code
  const validTeamCode = allTeams.includes(teamCode) ? teamCode : (allTeams[0] || '');
  
  // Get team confidence data - direct approach like the old version
  const teamData = useMemo(() => {
    const found = teamConfidence.find(team => team.team === validTeamCode);
    if (!found) {
      // Create a default object with zeros if not found
      return {
        team: validTeamCode,
        round64: 0,
        round32: 0,
        sweet16: 0,
        elite8: 0,
        finalFour: 0,
        championship: 0
      };
    }
    return found;
  }, [teamConfidence, validTeamCode]);
  
  // Find team seed
  const teamSeed = useMemo(() => {
    const gameWithTeam = gameResults.find(
      game => game.winner === validTeamCode || game.loser === validTeamCode
    );
    
    if (gameWithTeam) {
      return gameWithTeam.winner === validTeamCode 
        ? gameWithTeam.winnerSeed 
        : gameWithTeam.loserSeed;
    }
    
    return null;
  }, [gameResults, validTeamCode]);
  
  // Get chart data
  const roundLabels = [
    'Round of 64', 
    'Round of 32', 
    'Sweet 16', 
    'Elite 8', 
    'Final Four', 
    'Championship'
  ];
  
  const roundKeys = ['round64', 'round32', 'sweet16', 'elite8', 'finalFour', 'championship'];
  
  // Chart data for current team
  const teamChartData = {
    labels: roundLabels,
    datasets: [
      {
        label: validTeamCode,
        data: roundKeys.map(key => {
          if (showCounts) {
            // Use the _count version when showing counts
            const countKey = `${key}_count` as keyof typeof teamData;
            const countValue = teamData[countKey];
            return typeof countValue === 'number' ? countValue : 0;
          } else {
            // Use percentage as before
            const value = teamData[key as keyof typeof teamData];
            return typeof value === 'number' ? value : 0;
          }
        }),
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
        pointBackgroundColor: 'rgba(54, 162, 235, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(54, 162, 235, 1)',
        fill: true,
      },
    ],
  };
  
  // Get actual results
  const teamResults = useMemo(() => {
    if (!bracketData) return { wins: [], eliminated: false, eliminationRound: null };
    
    const wins = gameWinners.filter(game => game.winner === validTeamCode);
    // Check if eliminated
    let eliminated = false;
    let eliminationRound = null;
    
    // Check if team lost in a completed game
    for (const game of gameWinners) {
      const gameData = bracketData.games[game.gameId];
      if (gameData && Object.values(gameData.picks).includes(validTeamCode) && game.winner !== validTeamCode) {
        eliminated = true;
        eliminationRound = getRoundFromGameId(game.gameId);
        break;
      }
    }
    
    return { wins, eliminated, eliminationRound };
  }, [bracketData, gameWinners, validTeamCode]);
  
  // Bar chart for comparison with other teams
  const comparisonTeams = useMemo(() => {
    // Get top 5 teams by championship confidence
    return [...teamConfidence]
      .sort((a, b) => {
        const aVal = typeof a.championship === 'number' ? a.championship : 0;
        const bVal = typeof b.championship === 'number' ? b.championship : 0;
        return bVal - aVal;
      })
      .slice(0, 5)
      .map(team => team.team);
  }, [teamConfidence]);
  
  const comparisonChartData = {
    labels: roundLabels,
    datasets: comparisonTeams.map((team, index) => {
      const teamData = teamConfidence.find(t => t.team === team);
      const isCurrentTeam = team === validTeamCode;
      const hue = isCurrentTeam ? 210 : (index * 70) % 360;
      
      return {
        label: team,
        data: roundKeys.map(key => {
          if (!teamData) return 0;
          
          if (showCounts) {
            // Use the _count version when showing counts
            const countKey = `${key}_count` as keyof typeof teamData;
            const countValue = teamData[countKey];
            return typeof countValue === 'number' ? countValue : 0;
          } else {
            // Use percentage as before
            const value = teamData[key as keyof typeof teamData];
            return typeof value === 'number' ? value : 0;
          }
        }),
        backgroundColor: `hsla(${hue}, 70%, 50%, 0.4)`,
        borderColor: `hsla(${hue}, 70%, 60%, 1)`,
        borderWidth: isCurrentTeam ? 2 : 1,
      };
    }),
  };

  const getDisplayName = (username: string) => {
    const scoreData = userScores.find((user: { username: string; fullName?: string }) => user.username === username);
    return scoreData?.fullName || username;
  };

  const teamPickDepthByRound: Array<{ roundName: string; users: string[] }> = useMemo(() => {
    if (!bracketData) return [];

    const roundBuckets = [
      'Round of 64',
      'Round of 32',
      'Sweet 16',
      'Elite 8',
      'Final Four',
      'Championship',
      'Champion'
    ];

    const gameToDepth = (gameId: string) => {
      const id = Number(gameId);
      if (id >= 1 && id <= 32) return 1; // picked to reach Round of 32
      if (id >= 33 && id <= 48) return 2; // picked to reach Sweet 16
      if (id >= 49 && id <= 56) return 3; // picked to reach Elite 8
      if (id >= 57 && id <= 60) return 4; // picked to reach Final Four
      if (id === 61 || id === 62) return 5; // picked to reach Championship
      if (id === 63) return 6; // picked as Champion
      return 0;
    };

    const allUsernames = userScores.length > 0
      ? userScores.map((user: { username: string }) => user.username)
      : Object.keys(bracketData.games['1']?.picks || {});

    const maxDepthByUser = new Map<string, number>();
    allUsernames.forEach((username: string) => maxDepthByUser.set(username, 0));

    Object.entries(bracketData.games as Record<string, { picks: Record<string, string> }>).forEach(([gameId, game]) => {
      Object.entries(game.picks).forEach(([username, pick]: [string, string]) => {
        if (pick !== validTeamCode) return;
        const depth = gameToDepth(gameId);
        const current = maxDepthByUser.get(username) ?? 0;
        if (depth > current) {
          maxDepthByUser.set(username, depth);
        }
      });
    });

    return roundBuckets.map((roundName, depth): { roundName: string; users: string[] } => {
      const users = Array.from(maxDepthByUser.entries())
        .filter(([_, maxDepth]) => maxDepth === depth)
        .map(([username]) => username)
        .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)));

      return { roundName, users };
    });
  }, [bracketData, userScores, validTeamCode]);
  
  // Helper to find round name from game ID - same as in old version
  function getRoundFromGameId(gameId: string): string {
    const id = parseInt(gameId);
    if (id >= 1 && id <= 32) return 'Round of 64';
    if (id >= 33 && id <= 48) return 'Round of 32';
    if (id >= 49 && id <= 56) return 'Sweet 16';
    if (id >= 57 && id <= 60) return 'Elite 8';
    if (id === 61 || id === 62) return 'Final Four';
    if (id === 63) return 'Championship';
    return '';
  }
  
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
          {error || "Failed to load team data"}
        </Typography>
      </Box>
    );
  }
  
  // Safely get championship value with fallback to 0
  const championshipValue = typeof teamData.championship === 'number' ? teamData.championship : 0;
  
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Team Analysis: {validTeamCode}
        {teamSeed && (
          <Chip 
            label={`#${teamSeed} Seed`} 
            color="primary" 
            size="small" 
            sx={{ ml: 2, fontSize: '0.7em', height: '24px' }}
          />
        )}
      </Typography>
      
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="body1">Select Team:</Typography>
        <FormControl sx={{ minWidth: 180 }}>
          <Select 
            value={validTeamCode}
            onChange={(e) => navigate(yearPath(`/teams/${e.target.value}`))}
            size="small"
          >
            {allTeams.map(team => (
              <MenuItem key={team} value={team}>
                {team}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl sx={{ ml: 'auto' }}>
          <FormControlLabel
            control={
              <Switch
                checked={showCounts}
                onChange={() => setShowCounts(!showCounts)}
                color="primary"
              />
            }
            label="Show Counts"
          />
        </FormControl>
      </Stack>
      
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Team Confidence Distribution" />
            <CardContent>
              <Box sx={{ height: 300 }}>
                <Radar data={teamChartData} options={{ 
                  maintainAspectRatio: false,
                  scales: {
                    r: {
                      beginAtZero: true,
                      max: showCounts ? undefined : 100,
                      ticks: {
                        stepSize: showCounts ? undefined : 20
                      }
                    }
                  }
                }} />
              </Box>
              <Typography variant="body2" sx={{ mt: 2, textAlign: 'center' }}>
                {showCounts 
                  ? "Number of users who picked " + validTeamCode + " to reach each round"
                  : "Percentage of users who picked " + validTeamCode + " to reach each round"}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Team Status" />
            <CardContent>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle1">Championship Confidence</Typography>
                  <Typography variant="h4">
                    {showCounts 
                      ? teamData.championship_count 
                      : championshipValue.toFixed(1) + "%"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {showCounts 
                      ? teamData.championship_count + " users picked " + validTeamCode + " to win it all"
                      : championshipValue.toFixed(1) + "% of users picked " + validTeamCode + " to win it all"}
                  </Typography>
                </Box>
                
                <Divider />
                
                <Box>
                  <Typography variant="subtitle1">Tournament Status</Typography>
                  <Typography variant="h5">
                    {teamResults.eliminated 
                      ? `Eliminated in ${teamResults.eliminationRound}` 
                      : teamResults.wins.length > 0 
                        ? `Still Alive (${teamResults.wins.length} win${teamResults.wins.length !== 1 ? 's' : ''})` 
                        : "Not Yet Played"}
                  </Typography>
                </Box>
                
                {teamResults.wins.length > 0 && (
                  <>
                    <Typography variant="subtitle1" sx={{ mt: 1 }}>Win History</Typography>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Game</TableCell>
                          <TableCell>Opponent</TableCell>
                          <TableCell>Round</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {teamResults.wins.map(win => {
                          const opponent = getOpponent(gameResults, win.gameId, validTeamCode);
                          const gameResult = gameResults.find(g => g.gameId === win.gameId);
                          const opponentSeed = gameResult?.loser === opponent ? gameResult?.loserSeed : 
                                               gameResult?.winner === opponent ? gameResult?.winnerSeed : null;
                          return (
                            <TableRow key={win.gameId}>
                              <TableCell>
                                <Button
                                  size="small"
                                  color="primary"
                                  component={RouterLink}
                                  to={yearPath(`/games/${win.gameId}`)}
                                >
                                  Game {win.gameId}
                                </Button>
                              </TableCell>
                              <TableCell>
                                <Link component={RouterLink} to={yearPath(`/teams/${opponent}`)}>
                                  {opponent}
                                </Link>
                                {opponentSeed && (
                                  <Typography component="span" variant="caption" sx={{ ml: 1 }}>
                                    (#{opponentSeed})
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell>{getRoundFromGameId(win.gameId)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      <Card>
        <CardHeader title="Top Teams Comparison" />
        <CardContent>
          <Box sx={{ height: 400 }}>
            <Bar data={comparisonChartData} options={{
              maintainAspectRatio: false,
              scales: {
                y: {
                  beginAtZero: true,
                  title: {
                    display: true,
                    text: showCounts ? 'Number of Brackets' : 'Percentage of Brackets'
                  },
                  max: showCounts ? undefined : 100
                }
              },
              plugins: {
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      return `${context.dataset.label}: ${showCounts ? Math.round(context.raw) : context.raw.toFixed(1)}${showCounts ? '' : '%'}`;
                    }
                  }
                }
              }
            }} />
          </Box>
          <Typography variant="body2" sx={{ mt: 2, textAlign: 'center' }}>
            Comparing {validTeamCode} with other top teams by pick {showCounts ? 'count' : 'percentage'} at each round
          </Typography>
        </CardContent>
      </Card>

      <Card sx={{ mt: 3 }}>
        <CardHeader title={`How Far Brackets Picked ${validTeamCode}`} />
        <CardContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Grouped by the furthest round each bracket picked {validTeamCode} to reach.
          </Typography>
          <Grid container spacing={2}>
            {teamPickDepthByRound.map(({ roundName, users }) => (
              <Grid item xs={12} md={6} key={roundName}>
                <Paper sx={{ p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="h6">{roundName}</Typography>
                    <Chip label={`${users.length} user${users.length === 1 ? '' : 's'}`} size="small" />
                  </Stack>
                  <Divider sx={{ mb: 1.5 }} />
                  {users.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No brackets in this bucket.
                    </Typography>
                  ) : (
                    <Stack spacing={0.5}>
                      {users.map(username => (
                        <Link
                          key={username}
                          component={RouterLink}
                          to={yearPath(`/users/${username}`)}
                          sx={{ textDecoration: 'none' }}
                        >
                          {getDisplayName(username)}
                        </Link>
                      ))}
                    </Stack>
                  )}
                </Paper>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default TeamPage; 