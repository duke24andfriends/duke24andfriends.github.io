import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid
} from '@mui/material';
import BracketGame from './BracketGame';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { GameProbabilities } from '../../utils/bracketLogic';

interface FinalFourProps {
  finalFourGames: string[];
  championshipGame: string;
  getGameTeams: (gameId: string) => string[];
  getTeamSeeds: (teams: string[]) => (string | number)[];
  getPredictedWinner: (gameId: string) => string;
  getActualWinner: (gameId: string) => string;
  probabilityMode: boolean;
  gameProbabilities: GameProbabilities;
  updatePredictedWinner: (gameId: string, winner: string) => void;
  updateGameProbability: (gameId: string, team: string, probability: number) => void;
}

function FinalFour({
  finalFourGames,
  championshipGame,
  getGameTeams,
  getTeamSeeds,
  getPredictedWinner,
  getActualWinner,
  probabilityMode,
  gameProbabilities,
  updatePredictedWinner,
  updateGameProbability
}: FinalFourProps) {
  return (
    <Grid container spacing={2} sx={{ mt: 3 }}>
      <Grid item xs={12}>
        <Paper elevation={2} sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom align="center">Final Four & Championship</Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={5}>
              <Typography variant="subtitle2" gutterBottom align="center">
                Final Four
              </Typography>
              <Grid container spacing={1}>
                {finalFourGames.map(gameId => (
                  <Grid item xs={6} key={gameId}>
                    <BracketGame 
                      gameId={gameId}
                      teams={getGameTeams(gameId)}
                      seeds={getTeamSeeds(getGameTeams(gameId))}
                      round="FINAL_FOUR"
                      actualWinner={getActualWinner(gameId)}
                      predictedWinner={getPredictedWinner(gameId)}
                      probabilityMode={probabilityMode}
                      gameProbabilities={gameProbabilities}
                      updatePredictedWinner={updatePredictedWinner}
                      updateGameProbability={updateGameProbability}
                    />
                  </Grid>
                ))}
              </Grid>
            </Grid>
            
            <Grid item xs={12} md={2} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowForwardIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
            </Grid>
            
            <Grid item xs={12} md={5}>
              <Typography variant="subtitle2" gutterBottom align="center">
                Championship
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <Box sx={{ width: '60%' }}>
                  <BracketGame 
                    gameId={championshipGame}
                    teams={getGameTeams(championshipGame)}
                    seeds={getTeamSeeds(getGameTeams(championshipGame))}
                    round="CHAMPIONSHIP"
                    actualWinner={getActualWinner(championshipGame)}
                    predictedWinner={getPredictedWinner(championshipGame)}
                    probabilityMode={probabilityMode}
                    gameProbabilities={gameProbabilities}
                    updatePredictedWinner={updatePredictedWinner}
                    updateGameProbability={updateGameProbability}
                  />
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </Grid>
    </Grid>
  );
}

export default FinalFour; 