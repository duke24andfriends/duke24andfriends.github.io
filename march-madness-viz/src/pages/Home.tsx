import React from 'react';
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
  Stack,
  Container
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useData } from '../context/DataContext';

const Home = () => {
  const { loading, error, bracketData } = useData();

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
    <Stack spacing={4}>
      <Box sx={{ textAlign: 'center', width: '100%', py: 3 }}>
        <Typography variant="h2" component="h1" gutterBottom>
          March Madness Bracket Visualization
        </Typography>
        <Typography variant="h6" sx={{ mt: 2 }}>
          Interactive tools for analyzing the Duke24 March Madness Bracket Pool
        </Typography>
        <Typography variant="body1">
          Total Brackets: {bracketData?.metadata.total_brackets}
        </Typography>
      </Box>

      <Grid container spacing={3}>
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
                to="/leaderboard" 
                variant="contained" 
                color="primary"
              >
                View Leaderboard
              </Button>
            </CardActions>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardHeader title="Bracket Machine" />
            <CardContent sx={{ flexGrow: 1 }}>
              <Typography variant="body1">
                Predict future game outcomes and see how they would affect the standings. Set probabilities for each game.
              </Typography>
            </CardContent>
            <CardActions>
              <Button 
                component={RouterLink} 
                to="/bracket-machine" 
                variant="contained" 
                color="primary"
              >
                Use Bracket Machine
              </Button>
            </CardActions>
          </Card>
        </Grid>
        
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
                to="/rounds/ROUND_64" 
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
                to="/teams/DUKE" 
                variant="contained" 
                color="primary"
              >
                View Team Analysis
              </Button>
            </CardActions>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
};

export default Home; 