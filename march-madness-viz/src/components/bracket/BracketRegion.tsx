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
  const gameHeightPx = 108;
  const gameGapPx = 8;
  const unit = gameHeightPx + gameGapPx;
  const regionHeightPx = gameHeightPx * 8 + gameGapPx * 7;

  const getGameTop = (round: 'ROUND_64' | 'ROUND_32' | 'SWEET_16' | 'ELITE_8', index: number): number => {
    switch (round) {
      case 'ROUND_64':
        return index * unit;
      case 'ROUND_32':
        return (2 * index + 0.5) * unit;
      case 'SWEET_16':
        return (4 * index + 1.5) * unit;
      case 'ELITE_8':
        return 3.5 * unit;
      default:
        return 0;
    }
  };

  const renderRoundColumn = (
    gameIds: string[],
    round: 'ROUND_64' | 'ROUND_32' | 'SWEET_16' | 'ELITE_8'
  ) => (
    <Grid item xs={3}>
      <Box
        sx={{
          position: 'relative',
          height: `${regionHeightPx}px`
        }}
      >
        {gameIds.map((gameId, index) => (
          <Box
            key={gameId}
            sx={{
              width: '100%',
              position: 'absolute',
              top: `${getGameTop(round, index)}px`,
              ...(isRightSide ? { right: 0 } : { left: 0 })
            }}
          >
            <BracketGame
              gameId={gameId}
              teams={getGameTeams(gameId)}
              seeds={getTeamSeeds(getGameTeams(gameId))}
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
        elevation={0}
        sx={{ 
          p: 2,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'rgba(15, 23, 42, 0.10)',
          boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)',
          background:
            'linear-gradient(180deg, rgba(248, 250, 252, 0.75) 0%, rgba(255, 255, 255, 1) 18%)'
        }}
      >
        <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 700, letterSpacing: 0.2 }}>
          {title} Region
        </Typography>
        
        <Grid container spacing={1}>
          {isRightSide ? (
            <>
              {renderRoundColumn(regionData.elite8, 'ELITE_8')}
              {renderRoundColumn(regionData.sweet16, 'SWEET_16')}
              {renderRoundColumn(regionData.round32, 'ROUND_32')}
              {renderRoundColumn(regionData.round64, 'ROUND_64')}
            </>
          ) : (
            <>
              {renderRoundColumn(regionData.round64, 'ROUND_64')}
              {renderRoundColumn(regionData.round32, 'ROUND_32')}
              {renderRoundColumn(regionData.sweet16, 'SWEET_16')}
              {renderRoundColumn(regionData.elite8, 'ELITE_8')}
            </>
          )}
        </Grid>
      </Paper>
    </Grid>
  );
}

export default BracketRegion; 