import { useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  CircularProgress,
  Link,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useData } from '../context/DataContext';
import { ROUNDS } from '../types';
import { useYearPath } from '../utils/yearRouting';
import { getRoundPageMatchupSlots, type MatchupSlot } from '../utils/bracketLogic';
import { ROUND_LABELS, ROUND_ORDER, RoundKey } from '../hooks/usePoolStandings';
import PageTitle, { SectionHeading } from '../components/ui/PageTitle';
import SegmentedControl from '../components/ui/SegmentedControl';
import Meter from '../components/ui/Meter';
import { tokens } from '../theme';

type View = 'games' | 'users';
type SortKey = 'game' | 'winner' | 'correct' | 'accuracy';

interface GameRow {
  gameId: string;
  slots: [MatchupSlot, MatchupSlot] | null;
  completed: boolean;
  winner: string;
  loser: string;
  winnerSeed: number | null;
  loserSeed: number | null;
  correct: number;
  total: number;
  accuracy: number;
  distribution: Record<string, number>;
}

const HIGHLIGHT_COUNT = 5;
const fmt = (n: number) => n.toLocaleString();

const TeamLabel = ({ code, seed, bold }: { code: string; seed?: number | null; bold?: boolean }) => (
  <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
    {seed ? (
      <Box component="span" sx={{ color: tokens.muted, fontSize: '0.8em', mr: 0.75 }}>
        {seed}
      </Box>
    ) : null}
    <Box component="span" sx={{ fontWeight: bold ? 600 : 400 }}>{code}</Box>
  </Box>
);

const Slot = ({ slot, seedByTeam }: { slot: MatchupSlot; seedByTeam: Record<string, number> }) =>
  slot.type === 'team' ? (
    <TeamLabel code={slot.code} seed={seedByTeam[slot.code]} />
  ) : (
    <Box component="span" sx={{ color: tokens.muted }}>TBD</Box>
  );

const Stat = ({ value, label, detail }: { value: string; label: string; detail: string }) => (
  <Box sx={{ pr: { xs: 2, sm: 4 }, mr: { xs: 2, sm: 4 }, borderRight: `1px solid ${tokens.border}`, '&:last-of-type': { borderRight: 'none', mr: 0, pr: 0 } }}>
    <Typography sx={{ fontSize: { xs: '1.6rem', md: '2rem' }, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{value}</Typography>
    <Typography sx={{ fontSize: '0.95rem', color: tokens.ink }}>{label}</Typography>
    <Typography sx={{ fontSize: '0.8rem', color: tokens.muted }}>{detail}</Typography>
  </Box>
);

const RoundPage = () => {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const { yearPath } = useYearPath();
  const { bracketData, gameWinners, gameResults, loading, error } = useData();
  const [view, setView] = useState<View>('games');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'accuracy', dir: 'desc' });

  const round: RoundKey = ROUND_ORDER.includes(roundId as RoundKey) ? (roundId as RoundKey) : 'ROUND_64';
  const roundGames = ROUNDS[round];

  const rows = useMemo<GameRow[]>(() => {
    if (!bracketData) return [];
    return roundGames
      .filter((id) => bracketData.games[id])
      .map((gameId) => {
        const game = bracketData.games[gameId];
        const winner = gameWinners.find((w) => w.gameId === gameId)?.winner ?? '';
        const result = gameResults.find((r) => r.gameId === gameId);
        const picks = Object.values(game.picks);
        const correct = winner ? picks.filter((p) => p === winner).length : 0;
        return {
          gameId,
          slots: getRoundPageMatchupSlots(gameId, bracketData, gameResults, gameWinners),
          completed: !!winner,
          winner,
          loser: result?.loser ?? '',
          winnerSeed: result?.winnerSeed ?? null,
          loserSeed: result?.loserSeed ?? null,
          correct,
          total: picks.length,
          accuracy: winner && picks.length ? (correct / picks.length) * 100 : 0,
          distribution: game.stats.pick_distribution,
        };
      });
  }, [bracketData, gameWinners, gameResults, roundGames]);

  const seedByTeam = useMemo(() => {
    const m: Record<string, number> = {};
    gameResults.forEach((r) => {
      m[r.winner] = r.winnerSeed;
      m[r.loser] = r.loserSeed;
    });
    return m;
  }, [gameResults]);

  const completed = rows.filter((r) => r.completed);
  const correctTotal = completed.reduce((s, r) => s + r.correct, 0);
  const picksTotal = completed.reduce((s, r) => s + r.total, 0);
  const roundAccuracy = picksTotal ? (correctTotal / picksTotal) * 100 : 0;

  const byAccuracy = [...completed].sort((a, b) => b.accuracy - a.accuracy);
  const topCount = Math.min(HIGHLIGHT_COUNT, Math.ceil(byAccuracy.length / 2));
  const expected = byAccuracy.slice(0, topCount);
  const surprising = byAccuracy.slice(topCount).reverse().slice(0, HIGHLIGHT_COUNT);

  const distribution = useMemo(() => {
    if (!bracketData) return [];
    const done = rows.filter((r) => r.completed);
    const perUser = new Map<string, number>();
    done.forEach((r) => {
      Object.entries(bracketData.games[r.gameId].picks).forEach(([u, p]) => {
        perUser.set(u, (perUser.get(u) ?? 0) + (p === r.winner ? 1 : 0));
      });
    });
    const counts = Array.from({ length: done.length + 1 }, () => 0);
    perUser.forEach((n) => (counts[n] += 1));
    return counts.map((users, correct) => ({ correct, users })).reverse();
  }, [bracketData, rows]);
  const maxUsers = Math.max(1, ...distribution.map((d) => d.users));

  const sorted = useMemo(() => {
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (a.completed !== b.completed && sort.key !== 'game') return a.completed ? -1 : 1;
      let diff = 0;
      if (sort.key === 'game') diff = Number(a.gameId) - Number(b.gameId);
      else if (sort.key === 'winner') diff = a.winner.localeCompare(b.winner);
      else if (sort.key === 'correct') diff = a.correct - b.correct;
      else diff = a.accuracy - b.accuracy;
      return diff * dir || Number(a.gameId) - Number(b.gameId);
    });
  }, [rows, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'game' || key === 'winner' ? 'asc' : 'desc' }));

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 320 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error || !bracketData) {
    return <Typography color="error" sx={{ py: 8, textAlign: 'center' }}>{error || 'Failed to load bracket data'}</Typography>;
  }

  const matchupLabel = (r: GameRow) => (
    <>
      <TeamLabel code={r.winner} seed={r.winnerSeed} />
      <Box component="span" sx={{ color: tokens.subtle, mx: 1 }}>vs</Box>
      <TeamLabel code={r.loser} seed={r.loserSeed} />
    </>
  );

  const highlightList = (title: string, items: GameRow[], color: string) => (
    <Box>
      <Typography sx={{ fontSize: '0.8rem', color: tokens.muted, mb: 1 }}>{title}</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 210px) 1fr 44px', alignItems: 'center', columnGap: 2, rowGap: 1 }}>
        {items.map((r) => (
          <Box key={r.gameId} sx={{ display: 'contents' }}>
            <Link
              component={RouterLink}
              to={yearPath(`/games/${r.gameId}`)}
              underline="hover"
              color="inherit"
              noWrap
              sx={{ fontSize: '0.85rem', minWidth: 0 }}
            >
              <Box component="span" sx={{ color: tokens.muted, mr: 0.75 }}>{r.winnerSeed}</Box>
              {r.winner}
              <Box component="span" sx={{ color: tokens.muted }}> vs </Box>
              <Box component="span" sx={{ color: tokens.muted, mr: 0.5 }}>{r.loserSeed}</Box>
              {r.loser}
            </Link>
            <Meter value={r.accuracy} color={color} height={12} />
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, textAlign: 'right' }}>
              {Math.round(r.accuracy)}%
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );

  return (
    <Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 5fr) minmax(0, 6fr)' }, columnGap: 6, rowGap: 4, mb: 5 }}>
        <Box>
          <PageTitle>Round analysis</PageTitle>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: { xs: 3, lg: 6 } }}>
            <Select
              size="small"
              value={round}
              onChange={(e) => navigate(yearPath(`/rounds/${e.target.value}`))}
              sx={{ minWidth: 160, fontWeight: 600, borderRadius: 2.5, '& .MuiSelect-select': { py: 1.1 } }}
            >
              {ROUND_ORDER.map((r) => (
                <MenuItem key={r} value={r}>
                  {ROUND_LABELS[r].long}
                </MenuItem>
              ))}
            </Select>
            <SegmentedControl
              value={view}
              onChange={setView}
              options={[
                { value: 'games', label: 'Game accuracy' },
                { value: 'users', label: 'User distribution' },
              ]}
            />
          </Box>
          <Box sx={{ display: 'flex' }}>
            <Stat value={completed.length ? `${Math.round(roundAccuracy)}%` : '—'} label="Accuracy" detail={`${fmt(correctTotal)} / ${fmt(picksTotal)} correct picks`} />
            <Stat value={fmt(correctTotal)} label="Correct picks" detail={`of ${fmt(picksTotal)} total`} />
            <Stat value={String(completed.length)} label="Games completed" detail={`of ${rows.length} in this round`} />
          </Box>
        </Box>

        <Box>
          {view === 'games' ? (
            <>
              <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', mb: 1.5 }}>
                Game accuracy{' '}
                <Box component="span" sx={{ fontWeight: 400, color: tokens.muted, fontSize: '0.9rem' }}>(share of brackets that picked the winner)</Box>
              </Typography>
              {completed.length === 0 ? (
                <Typography sx={{ color: tokens.muted, py: 4 }}>No games in this round have been played yet.</Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                  {highlightList(`Top ${expected.length} most expected`, expected, '#22a35a')}
                  {surprising.length > 0 && (
                    <Box sx={{ pt: 2.5, borderTop: `1px solid ${tokens.border}` }}>
                      {highlightList(`Bottom ${surprising.length} most surprising`, surprising, '#f08a8a')}
                    </Box>
                  )}
                </Box>
              )}
            </>
          ) : (
            <>
              <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', mb: 1.5 }}>
                User distribution{' '}
                <Box component="span" sx={{ fontWeight: 400, color: tokens.muted, fontSize: '0.9rem' }}>(brackets by games picked correctly)</Box>
              </Typography>
              {completed.length === 0 ? (
                <Typography sx={{ color: tokens.muted, py: 4 }}>No games in this round have been played yet.</Typography>
              ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: '90px 1fr 56px', alignItems: 'center', columnGap: 2, rowGap: 0.75 }}>
                  {distribution.map((d) => (
                    <Box key={d.correct} sx={{ display: 'contents' }}>
                      <Typography sx={{ fontSize: '0.8rem', color: tokens.body, whiteSpace: 'nowrap' }}>
                        {d.correct} of {completed.length}
                      </Typography>
                      <Meter value={(d.users / maxUsers) * 100} height={10} />
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, textAlign: 'right' }}>{fmt(d.users)}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </>
          )}
        </Box>
      </Box>

      {view === 'games' && (
      <>
      <SectionHeading>Game details</SectionHeading>
      <TableContainer sx={{ border: `1px solid ${tokens.border}`, borderRadius: 2.5, maxHeight: { md: 720 } }}>
        <Table size="small" stickyHeader sx={{ minWidth: 640, '& td, & th': { py: 1.25 } }}>
          <TableHead>
            <TableRow sx={{ '& th': { bgcolor: tokens.surfaceAlt } }}>
              <TableCell sortDirection={sort.key === 'game' ? sort.dir : false}>
                <TableSortLabel active={sort.key === 'game'} direction={sort.dir} onClick={() => toggleSort('game')}>
                  Matchup
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel active={sort.key === 'winner'} direction={sort.dir} onClick={() => toggleSort('winner')}>
                  Winner
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <TableSortLabel active={sort.key === 'correct'} direction={sort.dir} onClick={() => toggleSort('correct')}>
                  Correct picks
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <TableSortLabel active={sort.key === 'accuracy'} direction={sort.dir} onClick={() => toggleSort('accuracy')}>
                  Accuracy
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ width: 32 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.map((r) => {
              const pending = Object.entries(r.distribution).sort((a, b) => b[1] - a[1]);
              const pendingTotal = pending.reduce((s, [, n]) => s + n, 0) || 1;
              return (
                <TableRow
                  key={r.gameId}
                  hover
                  onClick={() => navigate(yearPath(`/games/${r.gameId}`))}
                  sx={{ cursor: 'pointer', '&:hover .row-chevron': { color: tokens.primary } }}
                >
                  <TableCell>
                    {r.completed ? (
                      matchupLabel(r)
                    ) : r.slots ? (
                      <>
                        <Slot slot={r.slots[0]} seedByTeam={seedByTeam} />
                        <Box component="span" sx={{ color: tokens.subtle, mx: 1 }}>vs</Box>
                        <Slot slot={r.slots[1]} seedByTeam={seedByTeam} />
                      </>
                    ) : (
                      'TBD'
                    )}
                  </TableCell>
                  <TableCell>
                    {r.completed ? (
                      <TeamLabel code={r.winner} seed={r.winnerSeed} bold />
                    ) : (
                      <Typography sx={{ fontSize: '0.8rem', color: tokens.muted }}>
                        Pending · most picked {pending[0]?.[0]} ({Math.round(((pending[0]?.[1] ?? 0) / pendingTotal) * 100)}%)
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ color: tokens.body, whiteSpace: 'nowrap' }}>
                    {r.completed ? `${fmt(r.correct)} / ${fmt(r.total)}` : '—'}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: !r.completed ? tokens.muted : r.accuracy >= 50 ? tokens.up : tokens.down }}>
                    {r.completed ? `${Math.round(r.accuracy)}%` : '—'}
                  </TableCell>
                  <TableCell sx={{ width: 32, pl: 0, lineHeight: 0 }}>
                    <ChevronRightIcon className="row-chevron" sx={{ fontSize: 18, color: tokens.subtle }} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      </>
      )}
    </Box>
  );
};

export default RoundPage;
