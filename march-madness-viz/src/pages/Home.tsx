import { useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Box,
  CircularProgress,
  Link,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useData } from '../context/DataContext';
import { useYearPath } from '../utils/yearRouting';
import { getMostRecentRound } from '../utils/mostRecentRound';
import { ROUND_LABELS, ROUND_ORDER, Standing, usePoolStandings } from '../hooks/usePoolStandings';
import InitialsAvatar from '../components/ui/InitialsAvatar';
import ChangeIndicator from '../components/ui/ChangeIndicator';
import Sparkline from '../components/ui/Sparkline';
import { tokens } from '../theme';

const LOOKBACK_OPTIONS = [
  { value: 1, label: 'Last game' },
  { value: 4, label: 'Last 4 games' },
  { value: 8, label: 'Last 8 games' },
];

const LEADERBOARD_ROWS = 10;
const MOVEMENT_ROWS = 5;
const SPARKLINE_POINTS = 24;

const SectionTitle = ({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 2 }}>
    <Typography component="h2" sx={{ fontSize: { xs: '1.2rem', md: '1.3rem' }, fontWeight: 700, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
      {children}
    </Typography>
    {action}
  </Box>
);

const Stat = ({ value, label }: { value: string; label: string }) => (
  <Box sx={{ px: { xs: 1.5, sm: 2 }, borderLeft: `1px solid ${tokens.border}`, '&:first-of-type': { pl: 0, borderLeft: 'none' } }}>
    <Typography sx={{ fontSize: { xs: '1.15rem', sm: '1.3rem' }, fontWeight: 700, whiteSpace: 'nowrap' }}>{value}</Typography>
    <Typography sx={{ fontSize: '0.75rem', color: tokens.muted, whiteSpace: 'nowrap' }}>{label}</Typography>
  </Box>
);

const fmt = (n: number) => n.toLocaleString();

const Home = () => {
  const { loading, error, roundAccuracy, gameResults } = useData();
  const { yearPath } = useYearPath();
  const navigate = useNavigate();
  const [lookback, setLookback] = useState(1);
  const { standings, summary } = usePoolStandings(lookback);
  const mostRecentRound = useMemo(() => getMostRecentRound(gameResults), [gameResults]);

  const movers = useMemo(
    () =>
      standings
        .filter((s) => s.rankChange !== 0)
        .sort((a, b) => Math.abs(b.rankChange) - Math.abs(a.rankChange) || a.rank - b.rank)
        .slice(0, MOVEMENT_ROWS)
        .sort((a, b) => b.rankChange - a.rankChange),
    [standings]
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 320 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !summary) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h5" color="error" gutterBottom>
          Something went wrong
        </Typography>
        <Typography color="text.secondary">{error}</Typography>
      </Box>
    );
  }

  const lookbackLabel = LOOKBACK_OPTIONS.find((o) => o.value === lookback)?.label.toLowerCase() ?? 'last game';
  const userPath = (s: Standing) => yearPath(`/users/${encodeURIComponent(s.username)}`);

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 380px', xl: 'minmax(0, 1fr) 440px' },
        columnGap: { lg: 5 },
        rowGap: 4,
      }}
    >
      {/* Main column */}
      <Box sx={{ minWidth: 0 }}>
        <Typography
          component="h1"
          sx={{ fontSize: { xs: '2rem', md: '2.6rem' }, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.1 }}
        >
          Pool Overview
        </Typography>
        <Typography sx={{ color: tokens.muted, mt: 1, mb: { xs: 3, md: 4 }, fontSize: { xs: '0.95rem', md: '1rem' } }}>
          See how your pool is tracking, explore the standings, and dive into the numbers.
        </Typography>

        <SectionTitle
          action={
            <Select
              size="small"
              variant="standard"
              disableUnderline
              value={lookback}
              onChange={(e) => setLookback(Number(e.target.value))}
              sx={{ fontSize: '0.875rem', color: tokens.body, fontWeight: 500 }}
            >
              {LOOKBACK_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          }
        >
          Leaderboard
        </SectionTitle>

        <Table size="small" sx={{ '& td, & th': { px: { xs: 0.75, sm: 1.5 } }, '& td:first-of-type, & th:first-of-type': { pl: 0 } }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 36 }}>#</TableCell>
              <TableCell>Person</TableCell>
              <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Bracket</TableCell>
              <TableCell align="right">Score</TableCell>
              <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' } }}>Max Possible</TableCell>
              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                {lookback === 1 ? 'Last Game' : `Last ${lookback}`}
              </TableCell>
              <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Trend</TableCell>
              <TableCell sx={{ width: 20, p: 0 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {standings.slice(0, LEADERBOARD_ROWS).map((s) => (
              <TableRow
                key={s.username}
                hover
                onClick={() => navigate(userPath(s))}
                sx={{ cursor: 'pointer', '& td': { py: { xs: 1.25, md: 1.4 } }, '&:hover .row-chevron': { color: tokens.primary, transform: 'translateX(2px)' } }}
              >
                <TableCell sx={{ color: tokens.body }}>{s.rank}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                    <InitialsAvatar name={s.fullName} seed={s.username} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: '0.9rem', fontWeight: 500, color: tokens.ink }}>
                        {s.fullName}
                      </Typography>
                      <Typography noWrap sx={{ display: { sm: 'none' }, fontSize: '0.8rem', color: tokens.muted }}>
                        {s.bracketName}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' }, color: tokens.body, maxWidth: 200 }}>
                  <Typography noWrap sx={{ fontSize: '0.875rem' }}>{s.bracketName}</Typography>
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{fmt(s.score)}</TableCell>
                <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' }, color: tokens.muted }}>
                  {fmt(s.maxPossible)}
                </TableCell>
                <TableCell align="right">
                  <ChangeIndicator value={s.delta} />
                </TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, lineHeight: 0 }}>
                  <Sparkline values={s.history.slice(-SPARKLINE_POINTS)} />
                </TableCell>
                <TableCell sx={{ width: 20, p: 0, lineHeight: 0 }}>
                  <ChevronRightIcon className="row-chevron" sx={{ fontSize: 18, color: tokens.subtle, transition: 'transform 120ms, color 120ms' }} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Link
          component={RouterLink}
          to={yearPath('/leaderboard')}
          underline="hover"
          sx={{ display: 'inline-block', mt: 2, fontSize: '0.875rem', fontWeight: 600 }}
        >
          View full leaderboard ({fmt(standings.length)}) →
        </Link>
      </Box>

      {/* Side column */}
      <Box
        component="aside"
        sx={{
          minWidth: 0,
          pl: { lg: 4 },
          borderLeft: { lg: `1px solid ${tokens.border}` },
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        <Box>
          <SectionTitle
            action={<Typography sx={{ fontSize: '0.85rem', color: tokens.muted }}>{fmt(summary.totalBrackets)} brackets</Typography>}
          >
            Pool Summary
          </SectionTitle>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, auto)', lg: 'repeat(2, minmax(0, 1fr))' },
              justifyContent: 'start',
              rowGap: 2,
              pb: 3,
              borderBottom: `1px solid ${tokens.border}`,
              '& > :nth-of-type(odd)': { pl: { xs: 0, sm: 2, lg: 0 }, borderLeft: { xs: 'none', sm: `1px solid ${tokens.border}`, lg: 'none' } },
              '& > :first-of-type': { pl: 0, borderLeft: 'none' },
            }}
          >
            <Stat value={fmt(summary.average)} label="Average Score" />
            <Stat value={fmt(summary.median)} label="Median Score" />
            <Stat value={fmt(summary.highestPossible)} label="Highest Possible" />
            <Stat value={`${fmt(summary.low)}–${fmt(summary.high)}`} label="Current Range" />
          </Box>
        </Box>

        <Box sx={{ pb: 3, borderBottom: `1px solid ${tokens.border}` }}>
          <SectionTitle
            action={
              <Link
                component={RouterLink}
                to={yearPath(`/rounds/${mostRecentRound}`)}
                underline="hover"
                sx={{ fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap' }}
              >
                View round analysis →
              </Link>
            }
          >
            Round Accuracy
          </SectionTitle>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', alignItems: 'center', columnGap: 2, rowGap: 1.5 }}>
            {ROUND_ORDER.map((round) => {
              const acc = roundAccuracy[round];
              const played = !!acc && acc.total > 0;
              return (
                <Box key={round} sx={{ display: 'contents' }}>
                  <Typography sx={{ fontSize: '0.825rem', color: tokens.body, whiteSpace: 'nowrap' }}>
                    {ROUND_LABELS[round].long}
                  </Typography>
                  <Box sx={{ height: 10, borderRadius: 5, bgcolor: tokens.surfaceAlt, overflow: 'hidden' }}>
                    <Box sx={{ height: '100%', width: `${played ? acc.accuracy : 0}%`, bgcolor: tokens.primary, opacity: 0.55 + (played ? acc.accuracy / 220 : 0), borderRadius: 5 }} />
                  </Box>
                  <Typography sx={{ fontSize: '0.825rem', fontWeight: 600, textAlign: 'right' }}>
                    {played ? `${Math.round(acc.accuracy)}%` : '—'}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: tokens.muted, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {played ? `${fmt(acc.correct)} / ${fmt(acc.total)}` : 'not started'}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>

        <Box>
          <SectionTitle action={<Typography sx={{ fontSize: '0.85rem', color: tokens.muted }}>From {lookbackLabel}</Typography>}>
            Notable Movement
          </SectionTitle>
          {movers.length === 0 ? (
            <Typography sx={{ fontSize: '0.875rem', color: tokens.muted }}>No rank changes yet.</Typography>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: '56px 1fr auto', rowGap: 1.75, alignItems: 'center' }}>
              {movers.map((s) => (
                <Box key={s.username} sx={{ display: 'contents' }}>
                  <ChangeIndicator value={s.rankChange} />
                  <Link
                    component={RouterLink}
                    to={userPath(s)}
                    underline="hover"
                    color="inherit"
                    noWrap
                    sx={{ fontSize: '0.875rem', color: tokens.ink, minWidth: 0 }}
                  >
                    {s.fullName}
                  </Link>
                  <Typography sx={{ fontSize: '0.825rem', color: tokens.muted, whiteSpace: 'nowrap', pl: 2 }}>
                    {fmt(s.score)} pts ({s.delta >= 0 ? `+${s.delta}` : `−${Math.abs(s.delta)}`})
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default Home;
