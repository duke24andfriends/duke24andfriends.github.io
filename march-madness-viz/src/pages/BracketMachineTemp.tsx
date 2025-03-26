import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

function BracketMachineTemp() {
  return (
    <Box sx={{ p: 3 }}>
      <Paper 
        elevation={3} 
        sx={{ 
          p: 4, 
          textAlign: 'center',
          bgcolor: 'primary.light',
          color: 'primary.contrastText'
        }}
      >
        <Typography variant="h3" gutterBottom>
          Bracket Machine
        </Typography>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Coming Soon!
        </Typography>
        <Typography variant="body1">
          We're working on an exciting new feature that will let you run simulations and explore different bracket scenarios
          to see how they affect the leaderboard. Stay tuned!
        </Typography>
      </Paper>
    </Box>
  );
}

export default BracketMachineTemp; 