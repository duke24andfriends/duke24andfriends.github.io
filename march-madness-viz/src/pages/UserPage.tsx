import { useMemo, useState, ReactNode } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useData } from '../context/DataContext';
import { useYearPath } from '../utils/yearRouting';
import { getPointsForGame, getRoundNameFromGameId } from '../types';
import { ROUND_LABELS, ROUND_ORDER, RoundKey, usePoolStandings } from '../hooks/usePoolStandings';
import { getRoundPageMatchupSlots, formatMatchupSlotLabel } from '../utils/bracketLogic';
import { computeStrategyMetrics, strategyPercentiles } from '../utils/pickStrategy';
import { SectionHeading } from '../components/ui/PageTitle';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import Meter from '../components/ui/Meter';
import { tokens } from '../theme';

const ROUND_WEIGHTS: Record<RoundKey, number> = {
  ROUND_64: 10,
  ROUND_32: 20,
  SWEET_16: 40,
  ELITE_8: 80,
  FINAL_FOUR: 160,
  CHAMPIONSHIP: 320,
};
const SIMILAR_COUNT = 5;
const CHAMPION_ROWS = 6;

const fmt = (n: number) => n.toLocaleString();
const pct = (n: number, digits = 1) => `${n.toFixed(digits)}%`;

const StripStat = ({ value, label, detail }: { value: ReactNode; label: string; detail?: string }) => (
  <Box
    sx={{
      pr: { sm: 3, md: 4 },
      mr: { sm: 3, md: 4 },
      borderRight: { sm: `1px solid ${tokens.border}` },
      '&:last-of-type': { borderRight: 'none', mr: 0, pr: 0 },
      py: 0.5,
      minWidth: 0,
    }}
  >
    <Typography sx={{ fontSize: { xs: '1.6rem', md: '2rem' }, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{value}</Typography>
    <Typography sx={{ fontSize: '0.9rem', color: tokens.body }}>{label}</Typography>
    {detail && <Typography sx={{ fontSize: '0.8rem', color: tokens.muted }}>{detail}</Typography>}
  </Box>
);

const StrategyCard = ({ title, value, left, right, caption }: { title: string; value: number; left: string; right: string; caption: string }) => (
  <Box sx={{ border: `1px solid ${tokens.border}`, borderRadius: 2.5, p: 2 }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.25 }}>
      <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>{title}</Typography>
      <Typography sx={{ fontSize: '0.9rem' }}>
        <Box component="span" sx={{ fontWeight: 700 }}>{Math.round(value)}</Box>
        <Box component="span" sx={{ color: tokens.muted }}> / 100</Box>
      </Typography>
    </Box>
    <Meter value={value} height={8} />
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.75, fontSize: '0.75rem', color: tokens.muted }}>
      <span>{left}</span>
      <span>{right}</span>
    </Box>
    <Typography sx={{ fontSize: '0.75rem', color: tokens.body, mt: 1 }}>{caption}</Typography>
  </Box>
);

const UserPage = () => {
  const { username = '' } = useParams();
  const { yearPath } = useYearPath();
  const navigate = useNavigate();
  const { bracketData, gameWinners, gameResults, loading, error } = useData();
  const { standings } = usePoolStandings(1);
  const [roundFilter, setRoundFilter] = useState<RoundKey | 'ALL'>('ALL');

  const me = standings.find((s) => s.username === username);
  const standingByUser = useMemo(() => new Map(standings.map((s) => [s.username, s])), [standings]);
  const actualByGame = useMemo(() => new Map(gameWinners.map((g) => [g.gameId, g.winner])), [gameWinners]);
  const resultByGame = useMemo(() => new Map(gameResults.map((r) => [r.gameId, r])), [gameResults]);
  const eliminated = useMemo(() => new Set(gameResults.map((r) => r.loser)), [gameResults]);
  const seedByTeam = useMemo(() => {
    const m: Record<string, number> = {};
    gameResults.forEach((r) => {
      m[r.winner] = r.winnerSeed;
      m[r.loser] = r.loserSeed;
    });
    return m;
  }, [gameResults]);

  const accuracyOf = useMemo(() => {
    const map = new Map<string, { correct: number; total: number }>();
    if (!bracketData) return map;
    actualByGame.forEach((winner, gameId) => {
      Object.entries(bracketData.games[gameId]?.picks ?? {}).forEach(([u, p]) => {
        const a = map.get(u) ?? { correct: 0, total: 0 };
        a.total += 1;
        if (p === winner) a.correct += 1;
        map.set(u, a);
      });
    });
    return map;
  }, [bracketData, actualByGame]);

  const picks = useMemo(() => {
    if (!bracketData) return [];
    return Object.keys(bracketData.games)
      .filter((id) => bracketData.games[id].picks[username])
      .sort((a, b) => Number(a) - Number(b))
      .map((gameId) => {
        const pick = bracketData.games[gameId].picks[username];
        const winner = actualByGame.get(gameId) ?? '';
        const result = resultByGame.get(gameId);
        let matchup: string;
        if (result) {
          const [a, b] = [
            { t: result.winner, s: result.winnerSeed },
            { t: result.loser, s: result.loserSeed },
          ].sort((x, y) => x.s - y.s);
          matchup = `(${a.s}) ${a.t} vs (${b.s}) ${b.t}`;
        } else {
          const slots = getRoundPageMatchupSlots(gameId, bracketData, gameResults, gameWinners);
          matchup = slots ? `${formatMatchupSlotLabel(slots[0])} vs ${formatMatchupSlotLabel(slots[1])}` : `Game ${gameId}`;
        }
        return {
          gameId,
          round: getRoundNameFromGameId(gameId) as RoundKey,
          pick,
          matchup,
          winner,
          completed: !!winner,
          correct: !!winner && winner === pick,
          dead: !winner && eliminated.has(pick),
          points: winner === pick ? getPointsForGame(gameId) : 0,
        };
      });
  }, [bracketData, username, actualByGame, resultByGame, gameResults, gameWinners, eliminated]);

  const byRound = useMemo(
    () =>
      ROUND_ORDER.map((round) => {
        const done = picks.filter((p) => p.round === round && p.completed);
        return { round, correct: done.filter((p) => p.correct).length, total: done.length };
      }),
    [picks]
  );

  const strategy = useMemo(() => {
    if (!bracketData) return null;
    const all = computeStrategyMetrics(bracketData, gameResults);
    const mine = all.get(username);
    const ranks = strategyPercentiles(all, username);
    return mine && ranks ? { mine, ranks } : null;
  }, [bracketData, gameResults, username]);

  const similar = useMemo(() => {
    if (!bracketData) return [];
    const mine = new Map<string, number>();
    const others = new Map<string, Map<string, number>>();
    Object.entries(bracketData.games).forEach(([gameId, game]) => {
      const w = ROUND_WEIGHTS[getRoundNameFromGameId(gameId) as RoundKey];
      Object.entries(game.picks).forEach(([u, p]) => {
        const key = `${gameId}:${p}`;
        if (u === username) mine.set(key, w);
        else {
          if (!others.has(u)) others.set(u, new Map());
          others.get(u)!.set(key, w);
        }
      });
    });
    const result: Array<{ username: string; similarity: number }> = [];
    others.forEach((theirs, u) => {
      let inter = 0;
      let union = 0;
      new Set([...mine.keys(), ...theirs.keys()]).forEach((k) => {
        const a = mine.get(k) ?? 0;
        const b = theirs.get(k) ?? 0;
        if (a && b) inter += Math.min(a, b);
        union += Math.max(a, b);
      });
      result.push({ username: u, similarity: union ? inter / union : 0 });
    });
    return result.sort((a, b) => b.similarity - a.similarity).slice(0, SIMILAR_COUNT);
  }, [bracketData, username]);

  const championRows = useMemo(() => {
    if (!bracketData || !me?.champion) return [];
    const dist = bracketData.games['63']?.stats.pick_distribution ?? {};
    const total = bracketData.metadata.total_brackets || 1;
    const rows = Object.entries(dist)
      .sort((a, b) => b[1] - a[1])
      .map(([team, n]) => ({ team, pct: (n / total) * 100 }));
    const top = rows.slice(0, CHAMPION_ROWS);
    const mineRow = rows.find((r) => r.team === me.champion);
    if (mineRow && !top.includes(mineRow)) top.push(mineRow);
    return top;
  }, [bracketData, me?.champion]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 320 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error || !me || !bracketData) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h5" gutterBottom>{error ? 'Something went wrong' : 'Bracket not found'}</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>{error || `No bracket for “${username}” this year.`}</Typography>
        <Button component={RouterLink} to={yearPath('/leaderboard')} variant="contained">Back to leaderboard</Button>
      </Box>
    );
  }

  const acc = accuracyOf.get(username) ?? { correct: 0, total: 0 };
  const accuracy = acc.total ? (acc.correct / acc.total) * 100 : 0;
  const champDist = bracketData.games['63']?.stats.pick_distribution ?? {};
  const champShare = me.champion ? ((champDist[me.champion] ?? 0) / (bracketData.metadata.total_brackets || 1)) * 100 : 0;
  const champStatus = me.champion ? (actualByGame.get('63') === me.champion ? 'won' : eliminated.has(me.champion) ? 'out' : 'alive') : null;

  const similarRows = [...similar.map((s) => ({ ...s, self: false })), { username, similarity: 1, self: true }]
    .map((s) => ({ ...s, standing: standingByUser.get(s.username) }))
    .sort((a, b) => (a.standing?.rank ?? 1e9) - (b.standing?.rank ?? 1e9));
  const maxRoundPct = 100;
  const shownPicks = roundFilter === 'ALL' ? picks : picks.filter((p) => p.round === roundFilter);

  return (
    <Box>
      <Breadcrumbs crumbs={[{ label: 'Leaderboard', to: yearPath('/leaderboard') }, { label: me.fullName }]} />
      {/* Identity + accuracy by round */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 7fr) minmax(0, 5fr)' }, columnGap: 6, rowGap: 4, pb: 4, borderBottom: `1px solid ${tokens.border}` }}>
        <Box>
          <Typography component="h1" sx={{ fontSize: { xs: '2.1rem', md: '2.8rem' }, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.05 }}>
            {me.fullName}
          </Typography>
          {me.bracketName !== me.fullName && (
            <Typography sx={{ fontSize: { xs: '1.3rem', md: '1.6rem' }, fontWeight: 600, color: tokens.body, lineHeight: 1.3 }}>{me.bracketName}</Typography>
          )}
          {username && username !== me.fullName && <Typography sx={{ color: tokens.muted, mt: 0.5 }}>@{username}</Typography>}

          <Box
            sx={{
              display: { xs: 'grid', sm: 'flex' },
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              flexWrap: 'wrap',
              gap: { xs: 2, sm: 0 },
              rowGap: 2,
              mt: 3,
              pt: 3,
              borderTop: `1px solid ${tokens.border}`,
            }}
          >
            <StripStat value={`#${me.rank}`} label="Leaderboard rank" detail={`of ${fmt(standings.length)}`} />
            <StripStat value={fmt(me.score)} label="Total score" detail={`${fmt(me.maxPossible)} max possible`} />
            <StripStat value={acc.total ? pct(accuracy) : '—'} label="Accuracy" detail={`${acc.correct} of ${acc.total} picks`} />
            {me.champion && (
              <StripStat
                value={
                  <Link component={RouterLink} to={yearPath(`/teams/${me.champion}`)} underline="hover" color="inherit">
                    {me.champion}
                  </Link>
                }
                label="Championship pick"
                detail={`${pct(champShare)} of pool · ${champStatus === 'won' ? 'won it all' : champStatus === 'out' ? 'eliminated' : 'still alive'}`}
              />
            )}
          </Box>
        </Box>

        <Box>
          <Typography sx={{ fontWeight: 700, mb: 2 }}>Accuracy by round</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', columnGap: { xs: 1, sm: 2 }, alignItems: 'end', height: 170, borderBottom: `1px solid ${tokens.border}` }}>
            {byRound.map((r, i) => {
              const value = r.total ? (r.correct / r.total) * 100 : 0;
              return (
                <Box key={r.round} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, mb: 0.5 }}>{r.total ? `${Math.round(value)}%` : '—'}</Typography>
                  <Box sx={{ width: '100%', maxWidth: 56, height: `${Math.max(r.total ? 3 : 0, (value / maxRoundPct) * 120)}px`, bgcolor: tokens.primary, opacity: 1 - i * 0.12, borderRadius: '4px 4px 0 0' }} />
                </Box>
              );
            })}
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', columnGap: { xs: 1, sm: 2 }, mt: 0.75 }}>
            {byRound.map((r) => (
              <Box key={r.round} sx={{ textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.8rem' }}>{ROUND_LABELS[r.round].short}</Typography>
                <Typography sx={{ fontSize: '0.7rem', color: tokens.muted }}>{r.correct} / {r.total}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* Strategy */}
      {strategy && (
        <Box sx={{ py: 4, borderBottom: `1px solid ${tokens.border}` }}>
          <SectionHeading
            action={
              <Link component={RouterLink} to={yearPath('/pool-analysis')} underline="hover" sx={{ fontSize: '0.85rem' }}>
                Pool analysis →
              </Link>
            }
          >
            Strategy scores
          </SectionHeading>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
            <StrategyCard
              title="Chalk score"
              value={strategy.mine.chalk}
              left="More upsets"
              right="More favorites"
              caption={`Picked the better seed more often than ${Math.round(strategy.ranks.chalk)}% of the pool.`}
            />
            <StrategyCard
              title="Herding score"
              value={strategy.mine.herding}
              left="More independent"
              right="Follows the crowd"
              caption={`Went with the pool's most popular pick more than ${Math.round(strategy.ranks.herding)}% of brackets.`}
            />
            <StrategyCard
              title="Deviation score"
              value={strategy.ranks.deviation}
              left="Lower deviation"
              right="Higher deviation"
              caption={`More contrarian than ${Math.round(strategy.ranks.deviation)}% of the pool (raw ${strategy.mine.deviation.toFixed(1)}).`}
            />
          </Box>
        </Box>
      )}

      {/* Bottom analytical area */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 5fr) minmax(0, 7fr)' }, columnGap: 5, rowGap: 4, pt: 4 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <Box>
            <SectionHeading>Similar brackets</SectionHeading>
            <Box sx={{ display: { xs: 'block', md: 'none' }, borderTop: `1px solid ${tokens.border}` }}>
              {similarRows.map((s) => (
                <ButtonBase
                  key={s.username}
                  disabled={s.self}
                  onClick={() => navigate(yearPath(`/users/${encodeURIComponent(s.username)}`))}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '44px minmax(0, 1fr) auto',
                    alignItems: 'center',
                    columnGap: 1,
                    width: '100%',
                    textAlign: 'left',
                    py: 1.25,
                    px: s.self ? 1 : 0,
                    borderRadius: s.self ? 1.5 : 0,
                    bgcolor: s.self ? tokens.primarySoft : undefined,
                    borderBottom: `1px solid ${tokens.divider}`,
                  }}
                >
                  <Typography sx={{ fontSize: '0.85rem', color: tokens.body }}>#{s.standing?.rank ?? '–'}</Typography>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: '0.9rem', fontWeight: s.self ? 700 : 600, color: tokens.primary }}>
                      {s.self ? `${me.fullName} (this bracket)` : s.standing?.fullName ?? s.username}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: tokens.muted }}>{fmt(s.standing?.score ?? 0)} pts</Typography>
                  </Box>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>{s.self ? '—' : `${Math.round(s.similarity * 100)}%`}</Typography>
                </ButtonBase>
              ))}
            </Box>
            <TableContainer sx={{ display: { xs: 'none', md: 'block' }, border: `1px solid ${tokens.border}`, borderRadius: 2.5 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { bgcolor: tokens.surfaceAlt } }}>
                    <TableCell>Rank</TableCell>
                    <TableCell>Person</TableCell>
                    <TableCell align="right">Score</TableCell>
                    <TableCell align="right">Accuracy</TableCell>
                    <TableCell align="right">Similarity</TableCell>
                    <TableCell sx={{ width: 28, px: 0 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {similarRows.map((s) => {
                    const a = accuracyOf.get(s.username);
                    return (
                      <TableRow
                        key={s.username}
                        hover={!s.self}
                        onClick={s.self ? undefined : () => navigate(yearPath(`/users/${encodeURIComponent(s.username)}`))}
                        sx={{ bgcolor: s.self ? tokens.primarySoft : undefined, cursor: s.self ? 'default' : 'pointer', '&:hover .row-chevron': { color: tokens.primary } }}
                      >
                        <TableCell sx={{ color: tokens.body }}>#{s.standing?.rank ?? '–'}</TableCell>
                        <TableCell sx={{ maxWidth: 180 }}>
                          <Typography noWrap sx={{ fontSize: '0.875rem', fontWeight: s.self ? 700 : 500, color: tokens.primary }}>
                            {s.self ? `${me.fullName} (this bracket)` : s.standing?.fullName ?? s.username}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{fmt(s.standing?.score ?? 0)}</TableCell>
                        <TableCell align="right">{a?.total ? pct((a.correct / a.total) * 100) : '—'}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>{s.self ? '—' : `${Math.round(s.similarity * 100)}%`}</TableCell>
                        <TableCell sx={{ width: 28, px: 0, lineHeight: 0 }}>
                          {!s.self && <ChevronRightIcon className="row-chevron" sx={{ fontSize: 18, color: tokens.subtle }} />}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <Link component={RouterLink} to={yearPath(`/pool-analysis?user=${encodeURIComponent(username)}`)} underline="hover" sx={{ display: 'inline-block', mt: 1.5, fontSize: '0.85rem' }}>
              Find more similar brackets →
            </Link>
          </Box>

          {championRows.length > 0 && (
            <Box>
              <SectionHeading>Championship pick distribution</SectionHeading>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(90px, auto) 1fr 56px', alignItems: 'center', columnGap: 2, rowGap: 1.25 }}>
                {championRows.map((r) => {
                  const mine = r.team === me.champion;
                  return (
                    <Box key={r.team} sx={{ display: 'contents' }}>
                      <Link component={RouterLink} to={yearPath(`/teams/${r.team}`)} underline="hover" color={mine ? 'primary' : 'inherit'} sx={{ fontSize: '0.875rem', fontWeight: mine ? 700 : 400, whiteSpace: 'nowrap' }}>
                        {r.team}
                        {mine && ' (their pick)'}
                      </Link>
                      <Meter value={(r.pct / (championRows[0]?.pct || 1)) * 100} color={mine ? tokens.primary : '#c3cad4'} height={10} />
                      <Typography sx={{ fontSize: '0.825rem', fontWeight: mine ? 700 : 400, textAlign: 'right' }}>{pct(r.pct)}</Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <SectionHeading
            action={
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                {(['ALL', ...ROUND_ORDER] as const).map((r) => {
                  const active = roundFilter === r;
                  return (
                    <ButtonBase
                      key={r}
                      onClick={() => setRoundFilter(r)}
                      sx={{
                        px: 1.25,
                        py: 0.5,
                        borderRadius: 2,
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        border: `1px solid ${active ? tokens.primary : tokens.border}`,
                        bgcolor: active ? tokens.primary : tokens.surface,
                        color: active ? '#fff' : tokens.body,
                      }}
                    >
                      {r === 'ALL' ? 'All rounds' : ROUND_LABELS[r].short}
                    </ButtonBase>
                  );
                })}
              </Box>
            }
          >
            All picks
          </SectionHeading>
          <Box sx={{ display: { xs: 'block', md: 'none' }, borderTop: `1px solid ${tokens.border}` }}>
            {shownPicks.map((p, i) => {
              const roundBreak = i > 0 && shownPicks[i - 1].round !== p.round;
              return (
                <ButtonBase
                  key={p.gameId}
                  onClick={() => navigate(yearPath(`/games/${p.gameId}`))}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '44px minmax(0, 1fr) auto',
                    alignItems: 'center',
                    columnGap: 1,
                    width: '100%',
                    textAlign: 'left',
                    py: 1.1,
                    borderBottom: `1px solid ${tokens.divider}`,
                    borderTop: roundBreak ? `6px solid ${tokens.surfaceAlt}` : undefined,
                  }}
                >
                  <Typography sx={{ fontSize: '0.75rem', color: tokens.muted }}>{ROUND_LABELS[p.round].short}</Typography>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: '0.9rem', fontWeight: 600, color: p.dead ? tokens.subtle : tokens.ink, textDecoration: p.dead ? 'line-through' : 'none' }}>
                      {seedByTeam[p.pick] ? `(${seedByTeam[p.pick]}) ` : ''}
                      {p.pick}
                    </Typography>
                    <Typography noWrap sx={{ fontSize: '0.75rem', color: tokens.muted }}>
                      {p.matchup} · {p.completed ? `${p.winner} won` : p.dead ? 'pick eliminated' : 'pending'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: p.points ? 700 : 400, color: p.points ? tokens.ink : tokens.muted }}>
                      {p.completed ? `+${p.points}` : '–'}
                    </Typography>
                    {p.completed &&
                      (p.correct ? <CheckCircleIcon sx={{ fontSize: 18, color: tokens.success }} /> : <CancelIcon sx={{ fontSize: 18, color: tokens.down }} />)}
                  </Box>
                </ButtonBase>
              );
            })}
          </Box>
          <TableContainer sx={{ display: { xs: 'none', md: 'block' }, border: `1px solid ${tokens.border}`, borderRadius: 2.5, maxHeight: 640 }}>
            <Table size="small" stickyHeader sx={{ minWidth: 560 }}>
              <TableHead>
                <TableRow sx={{ '& th': { bgcolor: tokens.surfaceAlt } }}>
                  <TableCell>Round</TableCell>
                  <TableCell>Matchup</TableCell>
                  <TableCell>Their pick</TableCell>
                  <TableCell>Result</TableCell>
                  <TableCell align="center">Correct</TableCell>
                  <TableCell align="right">Points</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {shownPicks.map((p, i) => {
                  const roundBreak = i > 0 && shownPicks[i - 1].round !== p.round;
                  return (
                    <TableRow key={p.gameId} hover sx={{ '& td': { borderTop: roundBreak ? `8px solid ${tokens.surfaceAlt}` : undefined } }}>
                      <TableCell sx={{ color: tokens.muted }}>{ROUND_LABELS[p.round].short}</TableCell>
                      <TableCell>
                        <Link component={RouterLink} to={yearPath(`/games/${p.gameId}`)} underline="hover" color="inherit" sx={{ fontSize: '0.85rem' }}>
                          {p.matchup}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          component={RouterLink}
                          to={yearPath(`/teams/${p.pick}`)}
                          underline="hover"
                          sx={{ fontSize: '0.85rem', fontWeight: 500, color: p.dead ? tokens.subtle : tokens.ink, textDecoration: p.dead ? 'line-through' : 'none' }}
                        >
                          {seedByTeam[p.pick] ? `(${seedByTeam[p.pick]}) ` : ''}
                          {p.pick}
                        </Link>
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.85rem', color: p.completed ? tokens.body : tokens.muted }}>
                        {p.completed ? `${p.winner} won` : p.dead ? 'Pick eliminated' : 'Pending'}
                      </TableCell>
                      <TableCell align="center" sx={{ lineHeight: 0 }}>
                        {p.completed ? (
                          p.correct ? <CheckCircleIcon sx={{ fontSize: 18, color: tokens.success }} /> : <CancelIcon sx={{ fontSize: 18, color: tokens.down }} />
                        ) : (
                          <Box component="span" sx={{ color: tokens.subtle }}>–</Box>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: p.points ? 700 : 400, color: p.points ? tokens.ink : tokens.muted }}>
                        {p.completed ? p.points : '–'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Box>
    </Box>
  );
};

export default UserPage;
