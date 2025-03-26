import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Divider,
  Slider
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { GameWinner } from '../../types';
import { GameProbabilities } from '../../utils/bracketLogic';

interface BracketGameProps {
  gameId: string;
  teams: string[];
  seeds: (string | number)[];
  round: string;
  actualWinner: string;
  predictedWinner: string;
  probabilityMode: boolean;
  gameProbabilities: GameProbabilities;
  updatePredictedWinner: (gameId: string, winner: string) => void;
  updateGameProbability: (gameId: string, team: string, probability: number) => void;
}

function BracketGame({
  gameId,
  teams,
  seeds,
  round,
  actualWinner,
  predictedWinner,
  probabilityMode,
  gameProbabilities,
  updatePredictedWinner,
  updateGameProbability
}: BracketGameProps) {
  const isCompletedGame = !!actualWinner;
  
  return (
    <Paper 
      elevation={1}
      sx={{ 
        p: 1, 
        mb: 1, 
        position: 'relative',
        bgcolor: 'background.paper',
        transition: 'background-color 0.3s ease'
      }}
    >
      <Stack spacing={1}>
        {teams.map((team, index) => {
          if (team === "TBD") {
            return (
              <Box 
                key={index}
                sx={{ 
                  p: 1, 
                  borderRadius: 1,
                  border: '1px dashed',
                  borderColor: 'divider',
                  opacity: 0.7
                }}
              >
                <Typography variant="body2">TBD</Typography>
              </Box>
            );
          }
          
          const isWinner = actualWinner === team || (!actualWinner && predictedWinner === team);
          const isLoser = isCompletedGame && actualWinner !== team;
          const seedText = seeds[index] ? `(${seeds[index]})` : '';
          
          return (
            <Box 
              key={team}
              onClick={() => {
                if (!isCompletedGame && !probabilityMode) {
                  updatePredictedWinner(gameId, team);
                }
              }}
              sx={{ 
                p: 1, 
                borderRadius: 1,
                cursor: isCompletedGame ? 'default' : 'pointer',
                bgcolor: isWinner 
                  ? (isCompletedGame ? 'rgba(144, 238, 144, 0.8)' : 'primary.light') 
                  : (isLoser ? 'rgba(255, 200, 200, 0.5)' : 'background.paper'),
                border: '1px solid',
                borderColor: isWinner 
                  ? (isCompletedGame ? 'success.dark' : 'primary.main') 
                  : (isLoser ? 'error.light' : 'divider'),
                '&:hover': {
                  bgcolor: isCompletedGame 
                    ? (isWinner ? 'success.main' : isLoser ? 'error.light' : 'background.paper') 
                    : 'action.hover'
                }
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="body2">
                  {seedText && (
                    <Typography component="span" variant="caption" sx={{ mr: 1, fontWeight: 'bold' }}>
                      {seedText}
                    </Typography>
                  )}
                  {team}
                </Typography>
                
                {isWinner && (
                  <CheckIcon fontSize="small" color={isCompletedGame ? "success" : "primary"} />
                )}
              </Stack>
            </Box>
          );
        })}
      </Stack>
      
      {probabilityMode && !isCompletedGame && (
        <Box sx={{ mt: 2 }}>
          <Divider sx={{ mb: 1 }} />
          <Typography variant="caption">Set Win Probability:</Typography>
          {teams.filter(t => t !== "TBD").map((team) => (
            <Box key={team} sx={{ mt: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="caption" sx={{ 
                  minWidth: 60,
                  maxWidth: 80, 
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {team}
                </Typography>
                <Slider
                  size="small"
                  value={gameProbabilities[gameId]?.[team] || 0.5}
                  onChange={(_, val) => {
                    // Ensure value is between 0 and 1
                    const limitedVal = Math.min(Math.max(val as number, 0), 1);
                    updateGameProbability(gameId, team, limitedVal);
                  }}
                  min={0}
                  max={1}
                  step={0.05}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
                  marks={[
                    { value: 0, label: '0%' },
                    { value: 0.5, label: '50%' },
                    { value: 1, label: '100%' }
                  ]}
                />
                <Typography variant="caption" sx={{ minWidth: 36 }}>
                  {((gameProbabilities[gameId]?.[team] || 0.5) * 100).toFixed(0)}%
                </Typography>
              </Stack>
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
}

export default BracketGame; 