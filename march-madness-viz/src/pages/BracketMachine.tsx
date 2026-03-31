import { useMemo, useState, useCallback } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Grid,
  IconButton,
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
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
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
import {
  GameResult,
  GameWinner,
  UserScore
} from '../types';

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
  bracketNameByUser: Record<string, string | undefined>,
  fullNameByUser: Record<string, string | undefined>
): UserScore[] {
  return scores.map((s) => {
    const bracketFromMap = bracketNameByUser[s.username];
    const fullNameFromMap = fullNameByUser[s.username];
    return {
      ...s,
      bracketName:
        bracketFromMap !== undefined && bracketFromMap !== ''
          ? bracketFromMap
          : s.bracketName,
      fullName:
        fullNameFromMap !== undefined && fullNameFromMap !== ''
          ? fullNameFromMap
          : s.fullName
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
  const [deltaPage, setDeltaPage] = useState(1);

  const teamSeedMap = useMemo(() => buildTeamSeedMap(gameResults), [gameResults]);

  const bracketNameByUser = useMemo(() => {
    const m: Record<string, string | undefined> = {};
    (Object.keys(userNameMapping) as string[]).forEach((u) => {
      const row: UserNameMapping | undefined = userNameMapping[u];
      m[u] = row?.bracketName;
    });
    return m;
  }, [userNameMapping]);

  const fullNameByUser = useMemo(() => {
    const m: Record<string, string | undefined> = {};
    (Object.keys(userNameMapping) as string[]).forEach((u) => {
      const row: UserNameMapping | undefined = userNameMapping[u];
      m[u] = row?.fullName;
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
    return enrichScores(
      calculateHypotheticalScores(bracketData, gameWinners, []),
      bracketNameByUser,
      fullNameByUser
    );
  }, [bracketData, gameWinners, bracketNameByUser, fullNameByUser]);

  const scenarioScores = useMemo(() => {
    if (!bracketData) return [];
    return enrichScores(
      calculateHypotheticalScores(bracketData, gameWinners, predictedWinners),
      bracketNameByUser,
      fullNameByUser
    );
  }, [bracketData, gameWinners, predictedWinners, bracketNameByUser, fullNameByUser]);

  const rankChanges = useMemo((): RankChangeRow[] => {
    if (predictedWinners.length === 0) return [];
    const baseRank = buildCompetitionRanks(baselineScores);
    const scenRank = buildCompetitionRanks(scenarioScores);
    return scenarioScores.map((u: UserScore): RankChangeRow => {
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

  const deltaRows = useMemo(
    () =>
      rankChanges
        .filter((r: RankChangeRow) => r.delta !== 0)
        .sort((a: RankChangeRow, b: RankChangeRow) => b.delta - a.delta),
    [rankChanges]
  );
  const deltaPageSize = 25;
  const deltaTotalPages = Math.max(1, Math.ceil(deltaRows.length / deltaPageSize));
  const deltaStart = (deltaPage - 1) * deltaPageSize;
  const pagedDeltaRows = deltaRows.slice(deltaStart, deltaStart + deltaPageSize);
  const deltaPagesToShow = useMemo(() => {
    if (deltaTotalPages <= 7) {
      return Array.from({ length: deltaTotalPages }, (_, i) => i + 1);
    }
    if (deltaPage <= 4) {
      return [1, 2, 3, 4, 5, -1, deltaTotalPages];
    }
    if (deltaPage >= deltaTotalPages - 3) {
      return [1, -1, deltaTotalPages - 4, deltaTotalPages - 3, deltaTotalPages - 2, deltaTotalPages - 1, deltaTotalPages];
    }
    return [1, -1, deltaPage - 1, deltaPage, deltaPage + 1, -1, deltaTotalPages];
  }, [deltaPage, deltaTotalPages]);

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
      <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: 0.2 }} gutterBottom>
        Bracket Machine
      </Typography>

      <BracketControls
        resetPredictions={resetPredictions}
      />

      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={8}>
          <Stack spacing={2.5}>
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'rgba(15, 23, 42, 0.10)',
                bgcolor: 'rgba(248, 250, 252, 0.7)'
              }}
            >
              <Grid container spacing={1} sx={{ px: 1 }}>
                  <Grid item xs={6}>
                    <Grid container>
                      <Grid item xs={3}>
                        <Box sx={{ textAlign: 'center', minHeight: 42 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block', lineHeight: 1.2 }}>Round of 64</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', display: 'block', lineHeight: 1.15 }}>Mar 19-20</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', display: 'block', lineHeight: 1.15 }}>10 pts</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={3}>
                        <Box sx={{ textAlign: 'center', minHeight: 42 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block', lineHeight: 1.2 }}>Round of 32</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', display: 'block', lineHeight: 1.15 }}>Mar 21-22</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', display: 'block', lineHeight: 1.15 }}>20 pts</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={3}>
                        <Box sx={{ textAlign: 'center', minHeight: 42 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block', lineHeight: 1.2 }}>Sweet 16</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', display: 'block', lineHeight: 1.15 }}>Mar 26-27</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', display: 'block', lineHeight: 1.15 }}>40 pts</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={3}>
                        <Box sx={{ textAlign: 'center', minHeight: 42 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block', lineHeight: 1.2 }}>Elite 8</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', display: 'block', lineHeight: 1.15 }}>Mar 28-29</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', display: 'block', lineHeight: 1.15 }}>80 pts</Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Grid>
                  <Grid item xs={6}>
                    <Grid container>
                      <Grid item xs={3}>
                        <Box sx={{ textAlign: 'center', minHeight: 42 }}>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ fontWeight: 700, lineHeight: 1.2 }}>Elite 8</Typography>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.65rem', lineHeight: 1.15 }}>Mar 28-29</Typography>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.65rem', lineHeight: 1.15 }}>80 pts</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={3}>
                        <Box sx={{ textAlign: 'center', minHeight: 42 }}>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ fontWeight: 700, lineHeight: 1.2 }}>Sweet 16</Typography>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.65rem', lineHeight: 1.15 }}>Mar 26-27</Typography>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.65rem', lineHeight: 1.15 }}>40 pts</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={3}>
                        <Box sx={{ textAlign: 'center', minHeight: 42 }}>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ fontWeight: 700, lineHeight: 1.2 }}>Round of 32</Typography>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.65rem', lineHeight: 1.15 }}>Mar 21-22</Typography>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.65rem', lineHeight: 1.15 }}>20 pts</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={3}>
                        <Box sx={{ textAlign: 'center', minHeight: 42 }}>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ fontWeight: 700, lineHeight: 1.2 }}>Round of 64</Typography>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.65rem', lineHeight: 1.15 }}>Mar 19-20</Typography>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.65rem', lineHeight: 1.15 }}>10 pts</Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Grid>
              </Grid>
            </Paper>
            <Grid container spacing={2}>
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

            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'rgba(15, 23, 42, 0.10)',
                boxShadow: '0 12px 28px rgba(15, 23, 42, 0.06)',
                background:
                  'radial-gradient(ellipse at top, rgba(0, 153, 255, 0.05) 0%, rgba(255, 255, 255, 1) 52%)'
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom align="center">
                {finalFour.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" align="center" sx={{ display: 'block', mb: 2 }}>
                Apr 4 • 160 pts each semifinal
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center" alignItems="stretch">
                {finalFour.games.map((gameId) => (
                  <Box key={gameId} sx={{ flex: 1, maxWidth: { sm: 260 }, mx: 'auto', width: '100%' }}>
                    <BracketGame
                      gameId={gameId}
                      teams={getGameTeams(gameId)}
                      seeds={getTeamSeeds(getGameTeams(gameId))}
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
              <Typography variant="caption" color="text.secondary" align="center" sx={{ display: 'block', mt: 1, fontWeight: 600 }}>
                Championship • Apr 6 • 320 pts
              </Typography>
              <Box sx={{ maxWidth: 280, mx: 'auto', mt: 1 }}>
                {finalFour.championship.map((gameId) => (
                  <BracketGame
                    key={gameId}
                    gameId={gameId}
                    teams={getGameTeams(gameId)}
                    seeds={getTeamSeeds(getGameTeams(gameId))}
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
              userScores={scenarioScores}
              probabilityMode={false}
              title={
                predictedWinners.length
                  ? 'Scenario Leaderboard'
                  : 'Scenario Leaderboard (same as current)'
              }
              maxHeight="min(340px, 40vh)"
            />
            <BracketLeaderboard
              userScores={baselineScores}
              probabilityMode={false}
              title="Official Leaderboard"
              maxHeight="min(340px, 40vh)"
            />
            {predictedWinners.length > 0 && (
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Biggest Movers vs Official
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
                      {pagedDeltaRows.map((r: RankChangeRow) => (
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
                {deltaTotalPages > 1 && (
                  <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center" sx={{ mt: 1 }}>
                    <IconButton
                      size="small"
                      onClick={() => setDeltaPage((p: number) => Math.max(1, p - 1))}
                      disabled={deltaPage === 1}
                    >
                      <ChevronLeftIcon fontSize="small" />
                    </IconButton>
                    {deltaPagesToShow.map((p: number, idx: number) =>
                      p === -1 ? (
                        <Box key={`delta-ellipsis-${idx}`} sx={{ px: 0.75, color: 'text.secondary', fontSize: 14 }}>
                          ...
                        </Box>
                      ) : (
                        <Box
                          key={`delta-page-${p}`}
                          onClick={() => setDeltaPage(p)}
                          sx={{
                            px: 1.25,
                            py: 0.25,
                            borderRadius: 1,
                            cursor: 'pointer',
                            fontSize: 13,
                            fontWeight: deltaPage === p ? 700 : 500,
                            color: deltaPage === p ? 'primary.main' : 'text.secondary',
                            border: '1px solid',
                            borderColor: deltaPage === p ? 'primary.main' : 'transparent',
                            '&:hover': { bgcolor: 'action.hover' }
                          }}
                        >
                          {p}
                        </Box>
                      )
                    )}
                    <IconButton
                      size="small"
                      onClick={() => setDeltaPage((p: number) => Math.min(deltaTotalPages, p + 1))}
                      disabled={deltaPage === deltaTotalPages}
                    >
                      <ChevronRightIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                )}
              </Paper>
            )}
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}

export default BracketMachine;
