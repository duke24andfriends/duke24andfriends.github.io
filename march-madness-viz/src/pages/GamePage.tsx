import { useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  Link,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useData } from '../context/DataContext';
import { getPointsForGame, getRoundNameFromGameId } from '../types';
import { useYearPath } from '../utils/yearRouting';
import { getRoundPageMatchupSlots, MatchupSlot } from '../utils/bracketLogic';
import { ROUND_LABELS, RoundKey, Standing, usePoolStandings } from '../hooks/usePoolStandings';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import SegmentedControl from '../components/ui/SegmentedControl';
import { tokens } from '../theme';

const PAGE_SIZE = 10;
const MOVER_COUNT = 3;
const OTHER_COLOR = '#c3cad4';

const fmt = (n: number) => n.toLocaleString();
const pct = (n: number) => `${n.toFixed(1)}%`;

type Tone = 'win' | 'loss' | 'neutral';
const toneColor: Record<Tone, string> = { win: tokens.success, loss: tokens.down, neutral: tokens.ink };
const barColor: Record<Tone, string> = { win: '#22a35a', loss: '#f08a8a', neutral: tokens.primary };

function ranksOf(scores: Array<[string, number]>) {
  const sorted = [...scores].sort((a, b) => b[1] - a[1]);
  const ranks = new Map<string, number>();
  sorted.forEach(([u, s], i) => {
    const prev = sorted[i - 1];
    ranks.set(u, prev && prev[1] === s ? ranks.get(prev[0])! : i + 1);
  });
  return ranks;
}

const TeamSide = ({ code, seed, tone, align, yearPath }: { code?: string; seed?: number; tone: Tone; align: 'left' | 'right'; yearPath: (p: string) => string }) => (
  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, justifyContent: { xs: 'flex-start', md: align === 'left' ? 'flex-start' : 'flex-end' }, minWidth: 0 }}>
    {seed !== undefined && <Typography sx={{ fontSize: { xs: '1rem', md: '1.25rem' }, color: tokens.muted, fontWeight: 500 }}>{seed}</Typography>}
    {code ? (
      <Link
        component={RouterLink}
        to={yearPath(`/teams/${code}`)}
        underline="hover"
        sx={{ fontSize: { xs: '1.9rem', md: '2.6rem' }, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.1, color: tone === 'loss' ? tokens.muted : tokens.ink }}
      >
        {code}
      </Link>
    ) : (
      <Typography sx={{ fontSize: { xs: '1.9rem', md: '2.6rem' }, fontWeight: 800, color: tokens.subtle }}>TBD</Typography>
    )}
  </Box>
);

const Fact = ({ value, label, color }: { value: string; label: string; color?: string }) => (
  <Box sx={{ textAlign: 'center', px: 2, borderLeft: `1px solid ${tokens.border}`, '&:first-of-type': { borderLeft: 'none' } }}>
    <Typography sx={{ fontSize: { xs: '1.6rem', md: '2rem' }, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15, color: color ?? tokens.ink }}>{value}</Typography>
    <Typography sx={{ fontSize: '0.85rem', color: tokens.body }}>{label}</Typography>
  </Box>
);

interface Group {
  team: string;
  tone: Tone;
  users: Standing[];
}

const PickGroup = ({ group, onOpen }: { group: Group; onOpen: (u: string) => void }) => {
  const { yearPath } = useYearPath();
  const [query, setQuery] = useState('');
  const [asc, setAsc] = useState(false);
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? group.users.filter((s) => [s.username, s.fullName, s.bracketName].some((v) => v.toLowerCase().includes(q)))
      : group.users;
    return [...filtered].sort((a, b) => (asc ? a.score - b.score : b.score - a.score) || a.rank - b.rank);
  }, [group.users, query, asc]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const start = rows.length ? (current - 1) * PAGE_SIZE + 1 : 0;

  return (
    <Box sx={{ border: `1px solid ${tokens.border}`, borderRadius: 3, overflow: 'hidden', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', px: 2.5, py: 1.75 }}>
        <Typography component="h2" sx={{ fontSize: '1.15rem', fontWeight: 700 }}>
          Picked{' '}
          <Link component={RouterLink} to={yearPath(`/teams/${group.team}`)} underline="hover" sx={{ color: toneColor[group.tone] }}>
            {group.team}
          </Link>{' '}
          <Box component="span" sx={{ color: tokens.muted, fontWeight: 500 }}>({fmt(group.users.length)})</Box>
        </Typography>
        <TextField
          size="small"
          placeholder="Search users…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          sx={{ width: { xs: '100%', sm: 200 } }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: tokens.muted }} /></InputAdornment> }}
        />
      </Box>
      <TableContainer sx={{ flex: 1 }}>
        <Table size="small" sx={{ '& td': { py: 1 } }}>
          <TableHead>
            <TableRow sx={{ '& th': { bgcolor: tokens.surfaceAlt, color: tokens.body, fontWeight: 600, fontSize: '0.8rem' } }}>
              <TableCell sx={{ width: 56, pl: 2.5 }}>Rank</TableCell>
              <TableCell>User</TableCell>
              <TableCell align="right">
                <TableSortLabel active direction={asc ? 'asc' : 'desc'} onClick={() => setAsc((a) => !a)}>
                  Current score
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ width: 28, px: 0 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {shown.map((s) => (
              <TableRow key={s.username} hover onClick={() => onOpen(s.username)} sx={{ cursor: 'pointer', '&:hover .row-chevron': { color: tokens.primary } }}>
                <TableCell sx={{ pl: 2.5, color: tokens.muted }}>#{s.rank}</TableCell>
                <TableCell sx={{ maxWidth: 220 }}>
                  <Typography noWrap sx={{ fontSize: '0.875rem', color: tokens.primary, fontWeight: 500 }}>{s.fullName}</Typography>
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>{fmt(s.score)}</TableCell>
                <TableCell sx={{ width: 28, px: 0, lineHeight: 0 }}>
                  <ChevronRightIcon className="row-chevron" sx={{ fontSize: 18, color: tokens.subtle }} />
                </TableCell>
              </TableRow>
            ))}
            {shown.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} sx={{ py: 3, textAlign: 'center', color: tokens.muted }}>
                  {query ? `No one matches “${query}”.` : 'Nobody picked this team.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', px: 2.5, py: 1.25, borderTop: `1px solid ${tokens.border}` }}>
        <Typography sx={{ fontSize: '0.8rem', color: tokens.muted }}>
          Showing {start}–{start ? start + shown.length - 1 : 0} of {fmt(rows.length)}
        </Typography>
        {pages > 1 && <Pagination size="small" shape="rounded" color="primary" count={pages} page={current} onChange={(_, p) => setPage(p)} siblingCount={0} />}
      </Box>
    </Box>
  );
};

const GamePage = () => {
  const { gameId = '' } = useParams();
  const navigate = useNavigate();
  const { yearPath } = useYearPath();
  const { bracketData, gameWinners, gameResults, loading, error } = useData();
  const { standings } = usePoolStandings(1);
  const [scope, setScope] = useState<'actual' | 'all'>('actual');

  const game = bracketData?.games[gameId];
  const result = gameResults.find((r) => r.gameId === gameId);
  const round = getRoundNameFromGameId(gameId) as RoundKey;
  const points = getPointsForGame(gameId);
  const total = game ? Object.keys(game.picks).length : 0;

  const seedByTeam = useMemo(() => {
    const m: Record<string, number> = {};
    gameResults.forEach((r) => {
      m[r.winner] = r.winnerSeed;
      m[r.loser] = r.loserSeed;
    });
    return m;
  }, [gameResults]);

  const slots = useMemo<[MatchupSlot, MatchupSlot] | null>(
    () => getRoundPageMatchupSlots(gameId, bracketData, gameResults, gameWinners),
    [gameId, bracketData, gameResults, gameWinners]
  );
  const sides = (slots ?? []).map((s) => (s.type === 'team' ? s.code : undefined));
  const matchup = sides.filter(Boolean) as string[];

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    Object.values(game?.picks ?? {}).forEach((p) => (c[p] = (c[p] ?? 0) + 1));
    return c;
  }, [game]);

  const standingByUser = useMemo(() => new Map(standings.map((s) => [s.username, s])), [standings]);

  const groups = useMemo<Group[]>(() => {
    if (!game) return [];
    const byTeam = new Map<string, Standing[]>();
    Object.entries(game.picks).forEach(([u, team]) => {
      const s = standingByUser.get(u);
      if (!s) return;
      if (!byTeam.has(team)) byTeam.set(team, []);
      byTeam.get(team)!.push(s);
    });
    const tone = (team: string): Tone => (result ? (team === result.winner ? 'win' : 'loss') : 'neutral');
    const ordered = matchup.length === 2 ? matchup : [];
    const primary = ordered.map((team) => ({ team, tone: tone(team), users: byTeam.get(team) ?? [] }));
    const rest = [...byTeam.entries()]
      .filter(([team]) => !ordered.includes(team))
      .sort((a, b) => b[1].length - a[1].length)
      .map(([team, users]) => ({ team, tone: (result ? 'loss' : 'neutral') as Tone, users }));
    return scope === 'all' || primary.length === 0 ? [...primary, ...rest] : primary;
  }, [game, standingByUser, matchup.join(), result, scope]);

  /* Rank movement caused by this game: compare standings right before and right after it was played. */
  const movers = useMemo(() => {
    if (!result) return null;
    const ordered = [...gameResults].sort((a, b) => a.order - b.order);
    const idx = ordered.findIndex((r) => r.gameId === gameId);
    if (idx < 0) return null;
    const before = ranksOf(standings.map((s) => [s.username, idx > 0 ? s.history[idx - 1] : 0]));
    const after = ranksOf(standings.map((s) => [s.username, s.history[idx]]));
    const moves = standings.map((s) => ({ s, change: before.get(s.username)! - after.get(s.username)!, rank: after.get(s.username)! }));
    return {
      up: moves.filter((m) => m.change > 0).sort((a, b) => b.change - a.change || a.rank - b.rank).slice(0, MOVER_COUNT),
      down: moves.filter((m) => m.change < 0).sort((a, b) => a.change - b.change || a.rank - b.rank).slice(0, MOVER_COUNT),
    };
  }, [result, gameResults, gameId, standings]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 320 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error || !game) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h5" gutterBottom>{error ? 'Something went wrong' : 'Game not found'}</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>{error || `There’s no game ${gameId} this year.`}</Typography>
        <Button component={RouterLink} to={yearPath('/rounds/ROUND_64')} variant="contained">Back to round analysis</Button>
      </Box>
    );
  }

  const [left, right] = result ? [result.winner, result.loser] : [sides[0], sides[1]];
  const leftTone: Tone = result ? 'win' : 'neutral';
  const rightTone: Tone = result ? 'loss' : 'neutral';
  const leftCount = left ? counts[left] ?? 0 : 0;
  const rightCount = right ? counts[right] ?? 0 : 0;
  const otherCount = total - leftCount - rightCount;
  const share = (n: number) => (total ? (n / total) * 100 : 0);
  const openProfile = (u: string) => navigate(yearPath(`/users/${encodeURIComponent(u)}`));

  const segments = [
    { key: 'l', team: left, n: leftCount, color: barColor[leftTone] },
    { key: 'o', team: 'Other teams', n: otherCount, color: OTHER_COLOR },
    { key: 'r', team: right, n: rightCount, color: result ? barColor.loss : '#9fb9e8' },
  ].filter((s) => s.n > 0);

  return (
    <Box>
      <Breadcrumbs crumbs={[{ label: 'Round analysis', to: yearPath(`/rounds/${round}`) }, { label: ROUND_LABELS[round].long }]} />

      {/* Result */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto minmax(0, 1fr)' },
          alignItems: 'center',
          gap: { xs: 1.5, md: 4 },
          py: { xs: 2, md: 3 },
          borderTop: `1px solid ${tokens.border}`,
          borderBottom: `1px solid ${tokens.border}`,
        }}
      >
        <TeamSide code={left} seed={left ? seedByTeam[left] : undefined} tone={leftTone} align="left" yearPath={yearPath} />
        <Box sx={{ textAlign: { xs: 'left', md: 'center' }, order: { xs: 3, md: 0 } }}>
          <Box
            sx={{
              display: 'inline-block',
              px: 1.5,
              py: 0.4,
              borderRadius: 5,
              fontSize: '0.75rem',
              fontWeight: 600,
              bgcolor: result ? '#e7f6ec' : tokens.surfaceAlt,
              color: result ? tokens.up : tokens.muted,
            }}
          >
            {result ? 'Completed' : 'Not played yet'}
          </Box>
          <Typography sx={{ mt: 0.75, fontWeight: 600, color: result ? tokens.up : tokens.muted, fontSize: '0.95rem' }}>
            {result ? (
              <>
                <Link component={RouterLink} to={yearPath(`/teams/${result.winner}`)} underline="hover" color="inherit">
                  {result.winner}
                </Link>{' '}
                advanced
              </>
            ) : (
              `${ROUND_LABELS[round].long} · ${points} pts`
            )}
          </Typography>
        </Box>
        <TeamSide code={right} seed={right ? seedByTeam[right] : undefined} tone={rightTone} align="right" yearPath={yearPath} />
      </Box>

      {/* Pool facts + distribution */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 6fr) minmax(0, 5fr)' },
          alignItems: 'center',
          gap: { xs: 3, lg: 5 },
          py: 3,
          borderBottom: `1px solid ${tokens.border}`,
        }}
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          {result ? (
            <>
              <Fact value={pct(share(leftCount))} label={`picked ${result.winner}`} color={tokens.up} />
              <Fact value={fmt(total - leftCount)} label="brackets missed" color={tokens.down} />
            </>
          ) : (
            <>
              <Fact value={left ? pct(share(leftCount)) : '—'} label={left ? `picked ${left}` : 'TBD'} />
              <Fact value={right ? pct(share(rightCount)) : '—'} label={right ? `picked ${right}` : 'TBD'} />
            </>
          )}
          <Fact value={String(points)} label="points at stake" />
        </Box>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>Pick distribution</Typography>
            <Tooltip title="Share of all brackets that picked each team to win this game. “Other teams” picked a team that didn’t reach this game.">
              <InfoOutlinedIcon sx={{ fontSize: 15, color: tokens.muted }} />
            </Tooltip>
          </Box>
          <Box sx={{ display: 'flex', height: 26, borderRadius: 5, overflow: 'hidden', gap: '2px' }}>
            {segments.map((s) => (
              <Tooltip key={s.key} title={`${s.team}: ${fmt(s.n)} (${pct(share(s.n))})`}>
                <Box
                  sx={{
                    width: `${share(s.n)}%`,
                    minWidth: 8,
                    bgcolor: s.color,
                    color: '#fff',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: s.key === 'r' ? 'flex-end' : 'flex-start',
                    px: 1.25,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {share(s.n) >= 9 ? pct(share(s.n)) : ''}
                </Box>
              </Tooltip>
            ))}
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.75, fontSize: '0.8rem', color: tokens.body }}>
            <span>{left ?? 'TBD'} ({fmt(leftCount)})</span>
            {otherCount > 0 && <span style={{ color: tokens.muted }}>Other teams ({fmt(otherCount)})</span>}
            <span>{right ?? 'TBD'} ({fmt(rightCount)})</span>
          </Box>
        </Box>
      </Box>

      {/* Rank movement from this game */}
      {movers && (movers.up.length > 0 || movers.down.length > 0) && (
        <Box sx={{ py: 2.5, borderBottom: `1px solid ${tokens.border}` }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: { xs: 2, md: 5 } }}>
          {(
            [
              ['Biggest climbers after this game', movers.up, tokens.up, '▲'],
              ['Biggest drops after this game', movers.down, tokens.down, '▼'],
            ] as const
          ).map(([title, list, color, arrow]) => (
            <Box key={title}>
              <Typography sx={{ fontSize: '0.8rem', color: tokens.muted, mb: 0.75 }}>{title}</Typography>
              {list.length === 0 ? (
                <Typography sx={{ fontSize: '0.85rem', color: tokens.subtle }}>None</Typography>
              ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 3, rowGap: 0.5 }}>
                  {list.map((m) => (
                    <Link key={m.s.username} component={RouterLink} to={yearPath(`/users/${encodeURIComponent(m.s.username)}`)} underline="hover" sx={{ fontSize: '0.875rem', color: tokens.ink }}>
                      {m.s.fullName}{' '}
                      <Box component="span" sx={{ color, fontWeight: 700, fontSize: '0.8rem' }}>
                        {arrow} {Math.abs(m.change)}
                      </Box>
                    </Link>
                  ))}
                </Box>
              )}
            </Box>
          ))}
        </Box>
        <Typography sx={{ fontSize: '0.75rem', color: tokens.subtle, mt: 1.5 }}>Rank change caused by this result.</Typography>
        </Box>
      )}

      {/* Who picked whom */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3, mb: 2 }}>
        <SegmentedControl
          size="small"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'actual', label: 'Teams in this game' },
            { value: 'all', label: 'All picks' },
          ]}
        />
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2.5, alignItems: 'stretch' }}>
        {groups.map((g) => (
          <PickGroup key={g.team} group={g} onOpen={openProfile} />
        ))}
      </Box>
    </Box>
  );
};

export default GamePage;
