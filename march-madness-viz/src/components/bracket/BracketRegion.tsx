import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid
} from '@mui/material';
import BracketGame from './BracketGame';
import { GameProbabilities } from '../../utils/bracketLogic';

interface BracketRegionProps {
  regionKey: string;
  regionData: {
    name: string;
    round64: string[];
    round32: string[];
    sweet16: string[];
    elite8: string[];
  };
  getGameTeams: (gameId: string) => string[];
  getTeamSeeds: (teams: string[]) => (string | number)[];
  getPredictedWinner: (gameId: string) => string;
  getActualWinner: (gameId: string) => string;
  probabilityMode: boolean;
  gameProbabilities: GameProbabilities;
  updatePredictedWinner: (gameId: string, winner: string) => void;
  updateGameProbability: (gameId: string, team: string, probability: number) => void;
}

function BracketRegion({
  regionKey,
  regionData,
  getGameTeams,
  getTeamSeeds,
  getPredictedWinner,
  getActualWinner,
  probabilityMode,
  gameProbabilities,
  updatePredictedWinner,
  updateGameProbability
}: BracketRegionProps) {
  // Determine if this is a right-side region (East or Midwest)
  const isRightRegion = regionKey === 'EAST' || regionKey === 'MIDWEST';
  
  return (
    <Grid item xs={12} md={6} key={regionKey}>
      <Paper 
        elevation={2} 
        sx={{ 
          p: 2, 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column'
        }}
      >
        <Typography variant="h6" gutterBottom>{regionData.name} Region</Typography>
        
        <Grid container spacing={1}>
          {isRightRegion ? (
            // For East and Midwest, reverse the order (right to left)
            <>
              {/* Elite 8 (rightmost for East/Midwest) */}
              <Grid item xs={3} sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="subtitle2" gutterBottom align="right">
                  Elite 8
                </Typography>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  my: 7
                }}>
                  {regionData.elite8?.map((gameId) => 
                    <Box key={gameId} sx={{ width: '100%' }}>
                      <BracketGame 
                        gameId={gameId}
                        teams={getGameTeams(gameId)}
                        seeds={getTeamSeeds(getGameTeams(gameId))}
                        round="ELITE_8"
                        actualWinner={getActualWinner(gameId)}
                        predictedWinner={getPredictedWinner(gameId)}
                        probabilityMode={probabilityMode}
                        gameProbabilities={gameProbabilities}
                        updatePredictedWinner={updatePredictedWinner}
                        updateGameProbability={updateGameProbability}
                      />
                    </Box>
                  )}
                </Box>
              </Grid>
              
              {/* Sweet 16 */}
              <Grid item xs={3} sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="subtitle2" gutterBottom align="right">
                  Sweet 16
                </Typography>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  my: 5 
                }}>
                  {regionData.sweet16?.map((gameId, index) => 
                    <Box key={gameId} sx={{ 
                      width: '100%', 
                      mt: index > 0 ? 15 : 0
                    }}>
                      <BracketGame 
                        gameId={gameId}
                        teams={getGameTeams(gameId)}
                        seeds={getTeamSeeds(getGameTeams(gameId))}
                        round="SWEET_16"
                        actualWinner={getActualWinner(gameId)}
                        predictedWinner={getPredictedWinner(gameId)}
                        probabilityMode={probabilityMode}
                        gameProbabilities={gameProbabilities}
                        updatePredictedWinner={updatePredictedWinner}
                        updateGameProbability={updateGameProbability}
                      />
                    </Box>
                  )}
                </Box>
              </Grid>
              
              {/* Round of 32 */}
              <Grid item xs={3} sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="subtitle2" gutterBottom align="right">
                  Round of 32
                </Typography>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  my: 3
                }}>
                  {regionData.round32?.map((gameId, index) => 
                    <Box key={gameId} sx={{ 
                      width: '100%', 
                      mt: index > 0 ? 7 : 0
                    }}>
                      <BracketGame 
                        gameId={gameId}
                        teams={getGameTeams(gameId)}
                        seeds={getTeamSeeds(getGameTeams(gameId))}
                        round="ROUND_32"
                        actualWinner={getActualWinner(gameId)}
                        predictedWinner={getPredictedWinner(gameId)}
                        probabilityMode={probabilityMode}
                        gameProbabilities={gameProbabilities}
                        updatePredictedWinner={updatePredictedWinner}
                        updateGameProbability={updateGameProbability}
                      />
                    </Box>
                  )}
                </Box>
              </Grid>
              
              {/* Round of 64 (leftmost for East/Midwest) */}
              <Grid item xs={3} sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="subtitle2" gutterBottom align="right">
                  Round of 64
                </Typography>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'flex-end' 
                }}>
                  {regionData.round64?.map((gameId) => 
                    <Box key={gameId} sx={{ width: '100%' }}>
                      <BracketGame 
                        gameId={gameId}
                        teams={getGameTeams(gameId)}
                        seeds={getTeamSeeds(getGameTeams(gameId))}
                        round="ROUND_64"
                        actualWinner={getActualWinner(gameId)}
                        predictedWinner={getPredictedWinner(gameId)}
                        probabilityMode={probabilityMode}
                        gameProbabilities={gameProbabilities}
                        updatePredictedWinner={updatePredictedWinner}
                        updateGameProbability={updateGameProbability}
                      />
                    </Box>
                  )}
                </Box>
              </Grid>
            </>
          ) : (
            // For South and West, keep original order (left to right)
            <>
              {/* First Round (Round of 64) */}
              <Grid item xs={3} sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="subtitle2" gutterBottom align="left">
                  Round of 64
                </Typography>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'flex-start' 
                }}>
                  {regionData.round64?.map((gameId) => 
                    <Box key={gameId} sx={{ width: '100%' }}>
                      <BracketGame 
                        gameId={gameId}
                        teams={getGameTeams(gameId)}
                        seeds={getTeamSeeds(getGameTeams(gameId))}
                        round="ROUND_64"
                        actualWinner={getActualWinner(gameId)}
                        predictedWinner={getPredictedWinner(gameId)}
                        probabilityMode={probabilityMode}
                        gameProbabilities={gameProbabilities}
                        updatePredictedWinner={updatePredictedWinner}
                        updateGameProbability={updateGameProbability}
                      />
                    </Box>
                  )}
                </Box>
              </Grid>
              
              {/* Second Round (Round of 32) */}
              <Grid item xs={3} sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="subtitle2" gutterBottom align="left">
                  Round of 32
                </Typography>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  my: 3
                }}>
                  {regionData.round32?.map((gameId, index) => 
                    <Box key={gameId} sx={{ 
                      width: '100%', 
                      mt: index > 0 ? 7 : 0
                    }}>
                      <BracketGame 
                        gameId={gameId}
                        teams={getGameTeams(gameId)}
                        seeds={getTeamSeeds(getGameTeams(gameId))}
                        round="ROUND_32"
                        actualWinner={getActualWinner(gameId)}
                        predictedWinner={getPredictedWinner(gameId)}
                        probabilityMode={probabilityMode}
                        gameProbabilities={gameProbabilities}
                        updatePredictedWinner={updatePredictedWinner}
                        updateGameProbability={updateGameProbability}
                      />
                    </Box>
                  )}
                </Box>
              </Grid>
              
              {/* Sweet 16 */}
              <Grid item xs={3} sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="subtitle2" gutterBottom align="left">
                  Sweet 16
                </Typography>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  my: 5 
                }}>
                  {regionData.sweet16?.map((gameId, index) => 
                    <Box key={gameId} sx={{ 
                      width: '100%', 
                      mt: index > 0 ? 15 : 0
                    }}>
                      <BracketGame 
                        gameId={gameId}
                        teams={getGameTeams(gameId)}
                        seeds={getTeamSeeds(getGameTeams(gameId))}
                        round="SWEET_16"
                        actualWinner={getActualWinner(gameId)}
                        predictedWinner={getPredictedWinner(gameId)}
                        probabilityMode={probabilityMode}
                        gameProbabilities={gameProbabilities}
                        updatePredictedWinner={updatePredictedWinner}
                        updateGameProbability={updateGameProbability}
                      />
                    </Box>
                  )}
                </Box>
              </Grid>
              
              {/* Elite 8 */}
              <Grid item xs={3} sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="subtitle2" gutterBottom align="left">
                  Elite 8
                </Typography>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  my: 7
                }}>
                  {regionData.elite8?.map((gameId) => 
                    <Box key={gameId} sx={{ width: '100%' }}>
                      <BracketGame 
                        gameId={gameId}
                        teams={getGameTeams(gameId)}
                        seeds={getTeamSeeds(getGameTeams(gameId))}
                        round="ELITE_8"
                        actualWinner={getActualWinner(gameId)}
                        predictedWinner={getPredictedWinner(gameId)}
                        probabilityMode={probabilityMode}
                        gameProbabilities={gameProbabilities}
                        updatePredictedWinner={updatePredictedWinner}
                        updateGameProbability={updateGameProbability}
                      />
                    </Box>
                  )}
                </Box>
              </Grid>
            </>
          )}
        </Grid>
      </Paper>
    </Grid>
  );
}

export default BracketRegion; 