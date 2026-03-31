import { useMemo, useState, useCallback } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import { useData } from '../context/DataContext';
import BracketRegion from '../components/bracket/BracketRegion';
import BracketGame from '../components/bracket/BracketGame';
import BracketControls from '../components/bracket/BracketControls';
import BracketLeaderboard from '../components/bracket/BracketLeaderboard';
import {
  getBracketRegions,
  getGameTeamsConsistent,
  GameProbabilities,
  updatePredictedWinner as mergePredictedWinner,
  updateGameProbability as applyGameProbability
} from '../utils/bracketLogic';
import {
  calculateHypotheticalScores,
  UserNameMapping
} from '../utils/dataProcessing';
import { GameResult, GameWinner, UserScore } from '../types';

type RankChangeRow = {
  username: string;
  bracketName: string;
  baseRank: number;
  scenRank: number;
  delta: number;
  baseScore: number;
  scenScore: number;
};

function buildCompetitionRanks(scores: UserScore[]): Map<string, number> {
  const rankByUser = new Map<string, number>();
  let currentRank = 1;

  for (let i = 0; i < scores.length; i += 1) {
    if (i > 0 && scores[i].score < scores[i - 1].score) {
      currentRank = i + 1;
    }
    rankByUser.set(scores[i].username, currentRank);
  }

  return rankByUser;
}

function buildTeamSeedMap(gameResults: GameResult[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const r of gameResults) {
    map[r.winner] = r.winnerSeed;
    map[r.loser] = r.loserSeed;
  }
  return map;
}

function enrichScores(
  scores: UserScore[],
  bracketNameByUser: Record<string, string | undefined>
): UserScore[] {
  return scores.map((s) => {
    const fromMap = bracketNameByUser[s.username];
    return {
      ...s,
      bracketName: fromMap !== undefined && fromMap !== '' ? fromMap : s.bracketName
    };
  });
}

function BracketMachine() {
  const {
    bracketData,
    gameWinners,
    gameResults,
    userNameMapping,
    loading,
    error
  } = useData();

  const [predictedWinners, setPredictedWinners] = useState([] as GameWinner[]);
  const [gameProbabilities, setGameProbabilities] = useState({} as GameProbabilities);

  const teamSeedMap = useMemo(() => buildTeamSeedMap(gameResults), [gameResults]);

  const bracketNameByUser = useMemo(() => {
    const m: Record<string, string | undefined> = {};
    (Object.keys(userNameMapping) as string[]).forEach((u) => {
      const row: UserNameMapping | undefined = userNameMapping[u];
      m[u] = row?.bracketName;
    });
    return m;
  }, [userNameMapping]);

  const getGameTeams = useCallback(
    (gameId: string) =>
      bracketData
        ? getGameTeamsConsistent(gameId, bracketData, gameResults, gameWinners, predictedWinners)
        : [],
    [bracketData, gameResults, gameWinners, predictedWinners]
  );

  const getTeamSeeds = useCallback(
    (teams: string[]) => teams.map((t) => (t === 'TBD' ? '' : teamSeedMap[t] ?? '')),
    [teamSeedMap]
  );

  const getActualWinner = useCallback(
    (gameId: string) => gameWinners.find((w: GameWinner) => w.gameId === gameId)?.winner || '',
    [gameWinners]
  );

  const getPredictedWinner = useCallback(
    (gameId: string) => predictedWinners.find((w: GameWinner) => w.gameId === gameId)?.winner || '',
    [predictedWinners]
  );

  const handlePredictedWinner = useCallback(
    (gameId: string, winner: string) => {
      if (!bracketData) return;
      setPredictedWinners((prev: GameWinner[]) =>
        mergePredictedWinner(gameId, winner, prev, (gid, pending) =>
          getGameTeamsConsistent(gid, bracketData, gameResults, gameWinners, pending)
        )
      );
    },
    [bracketData, gameResults, gameWinners]
  );

  const handleGameProbability = useCallback(
    (gameId: string, team: string, probability: number) => {
      setGameProbabilities((prev: GameProbabilities) =>
        applyGameProbability(gameId, team, probability, prev, getGameTeams)
      );
    },
    [getGameTeams]
  );

  const resetPredictions = useCallback(() => {
    setPredictedWinners([]);
    setGameProbabilities({});
  }, []);

  const baselineScores = useMemo(() => {
    if (!bracketData) return [];
    return enrichScores(calculateHypotheticalScores(bracketData, gameWinners, []), bracketNameByUser);
  }, [bracketData, gameWinners, bracketNameByUser]);

  const scenarioScores = useMemo(() => {
    if (!bracketData) return [];
    return enrichScores(
      calculateHypotheticalScores(bracketData, gameWinners, predictedWinners),
      bracketNameByUser
    );
  }, [bracketData, gameWinners, predictedWinners, bracketNameByUser]);

  const rankChanges = useMemo((): RankChangeRow[] => {
    if (predictedWinners.length === 0) return [];
    const baseRank = buildCompetitionRanks(baselineScores);
    const scenRank = buildCompetitionRanks(scenarioScores);
    return scenarioScores.slice(0, 40).map((u: UserScore): RankChangeRow => {
      const br = baseRank.get(u.username) ?? 999;
      const sr = scenRank.get(u.username) ?? 999;
      return {
        username: u.username,
        bracketName: u.bracketName || u.username,
        baseRank: br,
        scenRank: sr,
        delta: br - sr,
        baseScore: baselineScores.find((b: UserScore) => b.username === u.username)?.score ?? 0,
        scenScore: u.score
      };
    });
  }, [baselineScores, scenarioScores, predictedWinners.length]);

  if (loading || error || !bracketData) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        {loading ? <CircularProgress /> : <Alert severity="error">{error || 'No data'}</Alert>}
      </Box>
    );
  }

  const regions = getBracketRegions();
  const finalFour = regions.FINAL_FOUR;
  const regionLayout = {
    topLeft: { key: 'SOUTH', title: 'East', isRightSide: false },
    topRight: { key: 'EAST', title: 'West', isRightSide: true },
    bottomLeft: { key: 'WEST', title: 'South', isRightSide: false },
    bottomRight: { key: 'MIDWEST', title: 'Midwest', isRightSide: true }
  } as const;

  const regionProps = {
    getGameTeams,
    getTeamSeeds,
    getPredictedWinner,
    getActualWinner,
    probabilityMode: false,
    gameProbabilities,
    updatePredictedWinner: handlePredictedWinner,
    updateGameProbability: handleGameProbability
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Bracket machine
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Completed games follow your CSV results. Click a team on any unfinished game to try a winner;
        the leaderboards compare live scores to your scenario. Reset clears only your picks.
      </Typography>

      <BracketControls
        resetPredictions={resetPredictions}
      />

      <Grid container spacing={2}>
        <Grid item xs={12} lg={8}>
          <Stack spacing={2}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Grid container spacing={1} sx={{ px: 1.5 }}>
                  <Grid item xs={6}>
                    <Grid container>
                      <Grid item xs={3}><Typography variant="caption" color="text.secondary">Round of 64</Typography></Grid>
                      <Grid item xs={3}><Typography variant="caption" color="text.secondary">Round of 32</Typography></Grid>
                      <Grid item xs={3}><Typography variant="caption" color="text.secondary">Sweet 16</Typography></Grid>
                      <Grid item xs={3}><Typography variant="caption" color="text.secondary">Elite 8</Typography></Grid>
                    </Grid>
                  </Grid>
                  <Grid item xs={6}>
                    <Grid container>
                      <Grid item xs={3}><Typography variant="caption" color="text.secondary" align="right" display="block">Elite 8</Typography></Grid>
                      <Grid item xs={3}><Typography variant="caption" color="text.secondary" align="right" display="block">Sweet 16</Typography></Grid>
                      <Grid item xs={3}><Typography variant="caption" color="text.secondary" align="right" display="block">Round of 32</Typography></Grid>
                      <Grid item xs={3}><Typography variant="caption" color="text.secondary" align="right" display="block">Round of 64</Typography></Grid>
                    </Grid>
                  </Grid>
                </Grid>
              </Grid>
              <BracketRegion
                regionKey={regionLayout.topLeft.key}
                title={regionLayout.topLeft.title}
                isRightSide={regionLayout.topLeft.isRightSide}
                regionData={regions[regionLayout.topLeft.key]}
                {...regionProps}
              />
              <BracketRegion
                regionKey={regionLayout.topRight.key}
                title={regionLayout.topRight.title}
                isRightSide={regionLayout.topRight.isRightSide}
                regionData={regions[regionLayout.topRight.key]}
                {...regionProps}
              />
            </Grid>

            <Paper elevation={1} sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom align="center">
                {finalFour.name}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center" alignItems="stretch">
                {finalFour.games.map((gameId) => (
                  <Box key={gameId} sx={{ flex: 1, maxWidth: { sm: 220 }, mx: 'auto', width: '100%' }}>
                    <BracketGame
                      gameId={gameId}
                      teams={getGameTeams(gameId)}
                      seeds={getTeamSeeds(getGameTeams(gameId))}
                      round="FINAL_FOUR"
                      actualWinner={getActualWinner(gameId)}
                      predictedWinner={getPredictedWinner(gameId)}
                      probabilityMode={false}
                      gameProbabilities={gameProbabilities}
                      updatePredictedWinner={handlePredictedWinner}
                      updateGameProbability={handleGameProbability}
                    />
                  </Box>
                ))}
              </Stack>
              <Box sx={{ maxWidth: 240, mx: 'auto', mt: 2 }}>
                {finalFour.championship.map((gameId) => (
                  <BracketGame
                    key={gameId}
                    gameId={gameId}
                    teams={getGameTeams(gameId)}
                    seeds={getTeamSeeds(getGameTeams(gameId))}
                    round="CHAMPIONSHIP"
                    actualWinner={getActualWinner(gameId)}
                    predictedWinner={getPredictedWinner(gameId)}
                    probabilityMode={false}
                    gameProbabilities={gameProbabilities}
                    updatePredictedWinner={handlePredictedWinner}
                    updateGameProbability={handleGameProbability}
                  />
                ))}
              </Box>
            </Paper>

            <Grid container spacing={2}>
              <BracketRegion
                regionKey={regionLayout.bottomLeft.key}
                title={regionLayout.bottomLeft.title}
                isRightSide={regionLayout.bottomLeft.isRightSide}
                regionData={regions[regionLayout.bottomLeft.key]}
                {...regionProps}
              />
              <BracketRegion
                regionKey={regionLayout.bottomRight.key}
                title={regionLayout.bottomRight.title}
                isRightSide={regionLayout.bottomRight.isRightSide}
                regionData={regions[regionLayout.bottomRight.key]}
                {...regionProps}
              />
            </Grid>
          </Stack>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Stack spacing={2}>
            <BracketLeaderboard
              userScores={baselineScores}
              probabilityMode={false}
              title="Current (from results)"
              maxHeight="min(340px, 40vh)"
            />
            <BracketLeaderboard
              userScores={scenarioScores}
              probabilityMode={false}
              title={
                predictedWinners.length
                  ? 'With your picks'
                  : 'With your picks (same as current)'
              }
              maxHeight="min(340px, 40vh)"
            />
            {predictedWinners.length > 0 && (
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Rank vs current
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" paragraph>
                  Ties share the same rank. Δ rank is positive when you move up.
                </Typography>
                <TableContainer sx={{ maxHeight: 280 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Bracket</TableCell>
                        <TableCell align="right">Was</TableCell>
                        <TableCell align="right">Now</TableCell>
                        <TableCell align="right">Δ</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rankChanges
                        .filter((r: RankChangeRow) => r.delta !== 0)
                        .sort((a: RankChangeRow, b: RankChangeRow) => b.delta - a.delta)
                        .slice(0, 12)
                        .map((r: RankChangeRow) => (
                          <TableRow key={r.username}>
                            <TableCell
                              sx={{
                                maxWidth: 140,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {r.bracketName}
                            </TableCell>
                            <TableCell align="right">{r.baseRank}</TableCell>
                            <TableCell align="right">{r.scenRank}</TableCell>
                            <TableCell align="right">{r.delta > 0 ? `+${r.delta}` : r.delta}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            )}
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}

export default BracketMachine;
