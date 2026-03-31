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
  const connectorLine = 'rgba(148, 163, 184, 0.42)';

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

  const getAnchorX = (
    round: 'ROUND_64' | 'ROUND_32' | 'SWEET_16' | 'ELITE_8',
    anchor: 'in' | 'out'
  ): number => {
    if (!isRightSide) {
      if (round === 'ROUND_64') return anchor === 'out' ? 16 : 8;
      if (round === 'ROUND_32') return anchor === 'in' ? 35 : 40;
      if (round === 'SWEET_16') return anchor === 'in' ? 60 : 65;
      return anchor === 'in' ? 85 : 90;
    }

    if (round === 'ROUND_64') return anchor === 'out' ? 84 : 92;
    if (round === 'ROUND_32') return anchor === 'in' ? 65 : 60;
    if (round === 'SWEET_16') return anchor === 'in' ? 40 : 35;
    return anchor === 'in' ? 15 : 10;
  };

  const buildConnectorPaths = () => {
    const paths: Array<{ id: string; d: string; color: string }> = [];

    const connectRounds = (
      childRound: 'ROUND_64' | 'ROUND_32' | 'SWEET_16',
      parentRound: 'ROUND_32' | 'SWEET_16' | 'ELITE_8',
      childGameIds: string[],
      parentGameIds: string[]
    ) => {
      parentGameIds.forEach((parentGameId, parentIdx) => {
        const childAIdx = parentIdx * 2;
        const childBIdx = childAIdx + 1;
        const childA = childGameIds[childAIdx];
        const childB = childGameIds[childBIdx];
        if (!childA || !childB) return;

        const parentY = getGameTop(parentRound, parentIdx) + gameHeightPx / 2;
        const childAY = getGameTop(childRound, childAIdx) + gameHeightPx / 2;
        const childBY = getGameTop(childRound, childBIdx) + gameHeightPx / 2;

        const childX = getAnchorX(childRound, 'out');
        const parentX = getAnchorX(parentRound, 'in');
        const jointX = (childX + parentX) / 2;

        const radius = 5.8;
        const verticalDirA = parentY >= childAY ? 1 : -1;
        const verticalDirB = parentY >= childBY ? 1 : -1;
        const horizontalDir = parentX >= jointX ? 1 : -1;

        paths.push({
          id: `${parentGameId}-a`,
          color: connectorLine,
          d: `M ${childX} ${childAY} H ${jointX - horizontalDir * radius} Q ${jointX} ${childAY} ${jointX} ${childAY + verticalDirA * radius} V ${parentY - verticalDirA * radius} Q ${jointX} ${parentY} ${jointX + horizontalDir * radius} ${parentY} H ${parentX}`
        });
        paths.push({
          id: `${parentGameId}-b`,
          color: connectorLine,
          d: `M ${childX} ${childBY} H ${jointX - horizontalDir * radius} Q ${jointX} ${childBY} ${jointX} ${childBY + verticalDirB * radius} V ${parentY - verticalDirB * radius} Q ${jointX} ${parentY} ${jointX + horizontalDir * radius} ${parentY} H ${parentX}`
        });
      });
    };

    connectRounds('ROUND_64', 'ROUND_32', regionData.round64, regionData.round32);
    connectRounds('ROUND_32', 'SWEET_16', regionData.round32, regionData.sweet16);
    connectRounds('SWEET_16', 'ELITE_8', regionData.sweet16, regionData.elite8);

    return paths;
  };

  const connectorPaths = buildConnectorPaths();

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
              zIndex: 2,
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
        
        <Grid container spacing={1} sx={{ position: 'relative' }}>
          <Box
            component="svg"
            viewBox={`0 0 100 ${regionHeightPx}`}
            preserveAspectRatio="none"
            sx={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: `${regionHeightPx}px`,
              pointerEvents: 'none',
              zIndex: 3,
              display: { xs: 'none', md: 'block' }
            }}
          >
            {connectorPaths.map((p) => (
              <path
                key={p.id}
                d={p.d}
                fill="none"
                stroke={p.color}
                strokeWidth={0.65}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </Box>
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