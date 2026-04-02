import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Grid,
  IconButton,
  Paper,
  Stack,
  Typography
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

type MobileRoundKey =
  | 'ROUND_64'
  | 'ROUND_32'
  | 'SWEET_16'
  | 'ELITE_8'
  | 'FINAL_FOUR'
  | 'CHAMPIONSHIP';

const MOBILE_ROUNDS: Array<{
  key: MobileRoundKey;
  label: string;
  date: string;
  points: string;
}> = [
  { key: 'ROUND_64', label: 'Round of 64', date: 'Mar 19-20', points: '10 pts' },
  { key: 'ROUND_32', label: 'Round of 32', date: 'Mar 21-22', points: '20 pts' },
  { key: 'SWEET_16', label: 'Sweet 16', date: 'Mar 26-27', points: '40 pts' },
  { key: 'ELITE_8', label: 'Elite 8', date: 'Mar 28-29', points: '80 pts' },
  { key: 'FINAL_FOUR', label: 'Final Four', date: 'Apr 4', points: '160 pts' },
  { key: 'CHAMPIONSHIP', label: 'Championship', date: 'Apr 6', points: '320 pts' }
];
const AUTO_ADVANCED_BASE_ROUNDS: MobileRoundKey[] = ['ROUND_64', 'ROUND_32', 'SWEET_16', 'ELITE_8'];

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
  const [mobileRoundIndex, setMobileRoundIndex] = useState(4);
  const [touchStartX, setTouchStartX] = useState(null as number | null);
  const [mobileSlideDirection, setMobileSlideDirection] = useState('next' as 'next' | 'prev');
  const [autoAdvancedRounds, setAutoAdvancedRounds] = useState(
    new Set(AUTO_ADVANCED_BASE_ROUNDS) as Set<MobileRoundKey>
  );

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
    setMobileRoundIndex(4);
    setAutoAdvancedRounds(new Set(AUTO_ADVANCED_BASE_ROUNDS) as Set<MobileRoundKey>);
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

  const currentScoreByUser = useMemo(
    () =>
      baselineScores.reduce((acc: Record<string, number>, row: UserScore) => {
        acc[row.username] = row.score;
        return acc;
      }, {}),
    [baselineScores]
  );
  const rankDeltaByUser = useMemo(() => {
    const baseRank = buildCompetitionRanks(baselineScores);
    const scenRank = buildCompetitionRanks(scenarioScores);
    return scenarioScores.reduce((acc: Record<string, number>, u: UserScore) => {
      const br = baseRank.get(u.username) ?? 999;
      const sr = scenRank.get(u.username) ?? 999;
      acc[u.username] = br - sr;
      return acc;
    }, {});
  }, [baselineScores, scenarioScores]);

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

  const mobileRound = MOBILE_ROUNDS[mobileRoundIndex];

  const regionKeyOrder = [
    regionLayout.topLeft.key,
    regionLayout.topRight.key,
    regionLayout.bottomLeft.key,
    regionLayout.bottomRight.key
  ] as const;
  const regionTitleByKey: Record<string, string> = {
    [regionLayout.topLeft.key]: regionLayout.topLeft.title,
    [regionLayout.topRight.key]: regionLayout.topRight.title,
    [regionLayout.bottomLeft.key]: regionLayout.bottomLeft.title,
    [regionLayout.bottomRight.key]: regionLayout.bottomRight.title
  };

  const mobileRoundGroups = useMemo(() => {
    if (mobileRound.key === 'FINAL_FOUR') {
      return [{ title: 'Final Four', gameIds: finalFour.games }];
    }
    if (mobileRound.key === 'CHAMPIONSHIP') {
      return [{ title: 'Championship', gameIds: finalFour.championship }];
    }

    const roundKeyMap: Record<'ROUND_64' | 'ROUND_32' | 'SWEET_16' | 'ELITE_8', 'round64' | 'round32' | 'sweet16' | 'elite8'> = {
      ROUND_64: 'round64',
      ROUND_32: 'round32',
      SWEET_16: 'sweet16',
      ELITE_8: 'elite8'
    };
    const k = roundKeyMap[mobileRound.key as 'ROUND_64' | 'ROUND_32' | 'SWEET_16' | 'ELITE_8'];
    return regionKeyOrder.map((rk) => ({
      title: `${regionTitleByKey[rk]} Region`,
      gameIds: regions[rk][k]
    }));
  }, [mobileRound.key, finalFour.games, finalFour.championship, regionKeyOrder, regionTitleByKey, regions]);

  const goMobilePrev = () => {
    setMobileSlideDirection('prev');
    setMobileRoundIndex((i: number) => Math.max(0, i - 1));
  };
  const goMobileNext = () => {
    setMobileSlideDirection('next');
    setMobileRoundIndex((i: number) => Math.min(MOBILE_ROUNDS.length - 1, i + 1));
  };
  const onMobileTouchStart = (x: number) => setTouchStartX(x);
  const onMobileTouchEnd = (x: number) => {
    if (touchStartX === null) return;
    const delta = x - touchStartX;
    if (Math.abs(delta) < 40) {
      setTouchStartX(null);
      return;
    }
    if (delta > 0) {
      goMobilePrev();
    } else {
      goMobileNext();
    }
    setTouchStartX(null);
  };

  const getRoundGameIds = useCallback((roundKey: MobileRoundKey): string[] => {
    if (roundKey === 'FINAL_FOUR') return finalFour.games;
    if (roundKey === 'CHAMPIONSHIP') return finalFour.championship;
    if (roundKey === 'ROUND_64') {
      return [
        ...regions[regionLayout.topLeft.key].round64,
        ...regions[regionLayout.topRight.key].round64,
        ...regions[regionLayout.bottomLeft.key].round64,
        ...regions[regionLayout.bottomRight.key].round64
      ];
    }
    if (roundKey === 'ROUND_32') {
      return [
        ...regions[regionLayout.topLeft.key].round32,
        ...regions[regionLayout.topRight.key].round32,
        ...regions[regionLayout.bottomLeft.key].round32,
        ...regions[regionLayout.bottomRight.key].round32
      ];
    }
    if (roundKey === 'SWEET_16') {
      return [
        ...regions[regionLayout.topLeft.key].sweet16,
        ...regions[regionLayout.topRight.key].sweet16,
        ...regions[regionLayout.bottomLeft.key].sweet16,
        ...regions[regionLayout.bottomRight.key].sweet16
      ];
    }
    return [
      ...regions[regionLayout.topLeft.key].elite8,
      ...regions[regionLayout.topRight.key].elite8,
      ...regions[regionLayout.bottomLeft.key].elite8,
      ...regions[regionLayout.bottomRight.key].elite8
    ];
  }, [finalFour.games, finalFour.championship, regions, regionLayout]);

  useEffect(() => {
    const currentRound = MOBILE_ROUNDS[mobileRoundIndex]?.key;
    if (!currentRound || currentRound === 'CHAMPIONSHIP') return;
    if (autoAdvancedRounds.has(currentRound)) return;

    const actualWinnerByGame = new Map(gameWinners.map((g: GameWinner) => [g.gameId, g.winner]));
    const predictedWinnerByGame = new Map(predictedWinners.map((g: GameWinner) => [g.gameId, g.winner]));
    const gameIds = getRoundGameIds(currentRound);
    const isRoundComplete = gameIds.every(
      (gameId: string) => !!actualWinnerByGame.get(gameId) || !!predictedWinnerByGame.get(gameId)
    );
    if (!isRoundComplete) return;

    setAutoAdvancedRounds((prev: Set<MobileRoundKey>) => {
      const next = new Set(prev);
      next.add(currentRound);
      return next;
    });
    setMobileSlideDirection('next');
    setMobileRoundIndex((idx: number) => Math.min(MOBILE_ROUNDS.length - 1, idx + 1));
  }, [mobileRoundIndex, autoAdvancedRounds, gameWinners, predictedWinners, getRoundGameIds]);

  if (loading || error || !bracketData) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        {loading ? <CircularProgress /> : <Alert severity="error">{error || 'No data'}</Alert>}
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: 0.2 }} gutterBottom>
        Bracket Machine
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 920 }}>
        Explore bracket outcomes by tapping winners and immediately see how standings shift.
      </Typography>

      <Stack spacing={2.5}>
        <BracketLeaderboard
          userScores={scenarioScores}
          probabilityMode={false}
          title="Leaderboard"
          maxHeight={230}
          currentScoreByUser={currentScoreByUser}
          rankDeltaByUser={rankDeltaByUser}
          scoreLabel="Scenario"
          showCurrentColumn={false}
          showDeltaColumn={false}
        />
        <BracketControls
          resetPredictions={resetPredictions}
        />

      <Grid container spacing={{ xs: 0, md: 2.5 }} sx={{ width: '100%', mx: 0 }}>
        <Grid item xs={12}>
          <Stack spacing={2.5}>
            <Box
              sx={{ display: { xs: 'block', md: 'none' } }}
              onTouchStart={(e: any) => onMobileTouchStart(e.touches[0].clientX)}
              onTouchEnd={(e: any) => onMobileTouchEnd(e.changedTouches[0].clientX)}
            >
              <Box
                key={`mobile-round-${mobileRoundIndex}`}
                sx={{
                  animation: `${mobileSlideDirection === 'next' ? 'mobileSlideLeft' : 'mobileSlideRight'} 240ms cubic-bezier(0.22, 1, 0.36, 1)`,
                  '@keyframes mobileSlideLeft': {
                    from: { opacity: 0.7, transform: 'translateX(16px)' },
                    to: { opacity: 1, transform: 'translateX(0)' }
                  },
                  '@keyframes mobileSlideRight': {
                    from: { opacity: 0.7, transform: 'translateX(-16px)' },
                    to: { opacity: 1, transform: 'translateX(0)' }
                  }
                }}
              >
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.25,
                    mb: 1.25,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'rgba(15, 23, 42, 0.10)',
                    bgcolor: 'rgba(248, 250, 252, 0.7)'
                  }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <IconButton size="small" onClick={goMobilePrev} disabled={mobileRoundIndex === 0}>
                      <ChevronLeftIcon fontSize="small" />
                    </IconButton>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {mobileRound.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {mobileRound.date}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {mobileRound.points}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={goMobileNext}
                      disabled={mobileRoundIndex === MOBILE_ROUNDS.length - 1}
                    >
                      <ChevronRightIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Paper>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, px: 0.25 }}>
                  Swipe left or right to move between rounds.
                </Typography>
                <Stack spacing={1.25}>
                  {mobileRoundGroups.map((group: { title: string; gameIds: string[] }) => (
                    <Paper
                      key={group.title}
                      elevation={0}
                      sx={{
                        p: 1.25,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'rgba(15, 23, 42, 0.10)'
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                        {group.title}
                      </Typography>
                      <Stack spacing={1}>
                        {group.gameIds.map((gameId: string) => (
                          <BracketGame
                            key={`mobile-${group.title}-${gameId}`}
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
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              </Box>
            </Box>

            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
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
            </Box>
          </Stack>
        </Grid>

      </Grid>
      </Stack>
    </Box>
  );
}

export default BracketMachine;
