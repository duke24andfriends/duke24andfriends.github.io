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
  title: string;
  isRightSide: boolean;
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
  title,
  isRightSide,
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
  const renderRoundColumn = (
    gameIds: string[],
    round: 'ROUND_64' | 'ROUND_32' | 'SWEET_16' | 'ELITE_8',
    marginY: number,
    gapTop: number
  ) => (
    <Grid item xs={3} sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isRightSide ? 'flex-end' : 'flex-start',
          my: marginY
        }}
      >
        {gameIds.map((gameId, index) => (
          <Box
            key={gameId}
            sx={{
              width: '100%',
              mt: index > 0 ? gapTop : 0
            }}
          >
            <BracketGame
              gameId={gameId}
              teams={getGameTeams(gameId)}
              seeds={getTeamSeeds(getGameTeams(gameId))}
              round={round}
              actualWinner={getActualWinner(gameId)}
              predictedWinner={getPredictedWinner(gameId)}
              probabilityMode={probabilityMode}
              gameProbabilities={gameProbabilities}
              updatePredictedWinner={updatePredictedWinner}
              updateGameProbability={updateGameProbability}
            />
          </Box>
        ))}
      </Box>
    </Grid>
  );

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
        <Typography variant="h6" gutterBottom>{title} Region</Typography>
        
        <Grid container spacing={1}>
          {isRightSide ? (
            <>
              {renderRoundColumn(regionData.elite8, 'ELITE_8', 7, 0)}
              {renderRoundColumn(regionData.sweet16, 'SWEET_16', 5, 15)}
              {renderRoundColumn(regionData.round32, 'ROUND_32', 3, 7)}
              {renderRoundColumn(regionData.round64, 'ROUND_64', 0, 0)}
            </>
          ) : (
            <>
              {renderRoundColumn(regionData.round64, 'ROUND_64', 0, 0)}
              {renderRoundColumn(regionData.round32, 'ROUND_32', 3, 7)}
              {renderRoundColumn(regionData.sweet16, 'SWEET_16', 5, 15)}
              {renderRoundColumn(regionData.elite8, 'ELITE_8', 7, 0)}
            </>
          )}
        </Grid>
      </Paper>
    </Grid>
  );
}

export default BracketRegion; 