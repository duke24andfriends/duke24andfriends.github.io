import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack
} from '@mui/material';
import { ProbabilityScore } from '../../utils/bracketLogic';

interface SimulationResultsProps {
  topContenders: ProbabilityScore[];
  lastPlace?: ProbabilityScore;
}

function SimulationResults({
  topContenders,
  lastPlace
}: SimulationResultsProps) {
  if (topContenders.length === 0) return null;
  
  return (
    <Card sx={{ mb: 3, bgcolor: 'success.light' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Simulation Results
        </Typography>
        
        <Typography variant="body1">
          Based on your current probability settings, here are the top contenders:
        </Typography>
        
        <Stack spacing={2} sx={{ mt: 2 }}>
          {topContenders.map((user, index) => (
            <Box key={user.username}>
              <Typography variant="subtitle1">
                {index + 1}. {user.username}
              </Typography>
              <Typography variant="body2">
                Win Probability: {user.winProbability.toFixed(2)}%
              </Typography>
              <Typography variant="body2">
                Expected Score: {user.expectedScore.toFixed(0)} points
              </Typography>
            </Box>
          ))}
          
          {lastPlace && (
            <Box sx={{ mt: 2, pt: 2, borderTop: '1px dashed' }}>
              <Typography variant="subtitle1">
                Last Place: {lastPlace.username} 🥴
              </Typography>
              <Typography variant="body2">
                Win Probability: {lastPlace.winProbability.toFixed(2)}%
              </Typography>
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

export default SimulationResults; 