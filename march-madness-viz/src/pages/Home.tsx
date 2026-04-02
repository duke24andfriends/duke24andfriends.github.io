import { 
  Box, 
  Typography, 
  Grid, 
  Card, 
  CardHeader, 
  CardContent, 
  CardActions,
  Button,
  CircularProgress,
  Stack
} from '@mui/material';
import { useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useYearPath } from '../utils/yearRouting';
import { getMostRecentRound } from '../utils/mostRecentRound';

const Home = () => {
  const { loading, error, bracketData, gameResults } = useData();
  const { yearPath, activeYear } = useYearPath();
  const mostRecentRound = useMemo(() => getMostRecentRound(gameResults), [gameResults]);

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
    <Stack spacing={{ xs: 3, sm: 4 }} sx={{ width: '100%', overflowX: 'hidden' }}>
      <Box sx={{ textAlign: 'center', width: '100%', py: { xs: 1, sm: 3 } }}>
        <Typography
          variant="h2"
          component="h1"
          gutterBottom
          sx={{ fontSize: { xs: '2.1rem', sm: '3rem', md: '3.75rem' }, lineHeight: 1.1 }}
        >
          <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
            March Madness Bracket Viz
          </Box>
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            March Madness Bracket Visualization
          </Box>
        </Typography>
        <Typography variant="h6" sx={{ mt: 2, fontSize: { xs: '1.2rem', sm: '1.4rem' } }}>
          <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
            Interactive tools for the Duke24 March Madness pool
          </Box>
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            Interactive tools for analyzing the Duke24 March Madness Bracket Pool
          </Box>
        </Typography>
        <Typography variant="body1" sx={{ fontSize: { xs: '1rem', sm: '1rem' } }}>
          Total Brackets: {bracketData?.metadata.total_brackets}
        </Typography>
      </Box>

      <Grid container spacing={{ xs: 2, md: 3 }} sx={{ width: '100%', m: 0 }}>
        <Grid item xs={12} md={6} lg={4}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardHeader title="Round Analysis" />
            <CardContent sx={{ flexGrow: 1 }}>
              <Typography variant="body1">
                Analyze pick accuracy by round and view detailed statistics for each game in the tournament.
              </Typography>
            </CardContent>
            <CardActions>
              <Button 
                component={RouterLink} 
                  to={yearPath(`/rounds/${mostRecentRound}`)}
                variant="contained" 
                color="primary"
              >
                View Round Analysis
              </Button>
            </CardActions>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6} lg={4}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardHeader title="Team Analysis" />
            <CardContent sx={{ flexGrow: 1 }}>
              <Typography variant="body1">
                See the percentage of users who picked each team to advance to each round of the tournament.
              </Typography>
            </CardContent>
            <CardActions>
              <Button 
                component={RouterLink} 
                  to={yearPath('/teams/DUKE')}
                variant="contained" 
                color="primary"
              >
                View Team Analysis
              </Button>
            </CardActions>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6} lg={4}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardHeader title="Pool Analysis" />
            <CardContent sx={{ flexGrow: 1 }}>
              <Typography variant="body1">
                Compare bracket similarity and pick strategy trends across the pool.
              </Typography>
            </CardContent>
            <CardActions>
              <Button 
                component={RouterLink} 
                  to={yearPath('/pool-analysis')}
                variant="contained" 
                color="primary"
              >
                View Pool Analysis
              </Button>
            </CardActions>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardHeader title="Leaderboard" />
            <CardContent sx={{ flexGrow: 1 }}>
              <Typography variant="body1">
                View the current standings and see how scores have changed over time. Filter users and generate shareable links.
              </Typography>
            </CardContent>
            <CardActions>
              <Button 
                component={RouterLink} 
                to={yearPath('/leaderboard')}
                variant="contained" 
                color="primary"
              >
                View Leaderboard
              </Button>
            </CardActions>
          </Card>
        </Grid>

        {activeYear === '2026' && (
          <Grid item xs={12} md={6} lg={4}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardHeader title="Bracket Machine" />
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="body1">
                  Walk the bracket round by round, set hypothetical winners, and see how pool scores and standings would shift.
                </Typography>
              </CardContent>
              <CardActions>
                <Button
                  component={RouterLink}
                  to={yearPath('/bracket-machine')}
                  variant="contained"
                  color="primary"
                >
                  View Bracket Machine
                </Button>
              </CardActions>
            </Card>
          </Grid>
        )}
      </Grid>
    </Stack>
  );
};

export default Home; 