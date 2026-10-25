import { useEffect, useMemo, useState, MouseEvent, ReactNode } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  Collapse,
  InputAdornment,
  Link,
  ListItemIcon,
  Menu,
  MenuItem,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import SearchIcon from '@mui/icons-material/Search';
import CheckIcon from '@mui/icons-material/Check';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt';
import PersonRemoveOutlinedIcon from '@mui/icons-material/PersonRemoveOutlined';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { useData } from '../context/DataContext';
import { useYearPath } from '../utils/yearRouting';
import {
  ROUND_LABELS,
  ROUND_MAX_POINTS,
  ROUND_ORDER,
  RoundKey,
  Standing,
  usePoolStandings,
} from '../hooks/usePoolStandings';
import InitialsAvatar from '../components/ui/InitialsAvatar';
import ChangeIndicator from '../components/ui/ChangeIndicator';
import { tokens } from '../theme';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

type SortKey = 'score' | 'maxPossible' | 'movers' | 'name';
type View = 'standings' | 'trend';

const SORT_LABELS: Record<SortKey, string> = {
  score: 'Total points',
  maxPossible: 'Max possible',
  movers: 'Biggest movers',
  name: 'Name',
};

const PAGE_SIZE = 50;
const TREND_DEFAULT_COUNT = 10;
const TREND_COLORS = ['#1565d8', '#16a34a', '#dc2626', '#9333ea', '#ea580c', '#0891b2', '#ca8a04', '#db2777', '#4f46e5', '#65a30d', '#0f766e', '#b91c1c'];

const fmt = (n: number) => n.toLocaleString();

/* ---------- small pieces ---------- */

const Segmented = ({ value, onChange }: { value: View; onChange: (v: View) => void }) => (
  <Box sx={{ display: 'flex', p: 0.5, bgcolor: tokens.surfaceAlt, borderRadius: 999, maxWidth: 520 }}>
    {(['standings', 'trend'] as View[]).map((v) => {
      const active = v === value;
      return (
        <ButtonBase
          key={v}
          onClick={() => onChange(v)}
          sx={{
            flex: 1,
            py: 1,
            borderRadius: 999,
            fontSize: '0.95rem',
            fontWeight: active ? 600 : 500,
            color: active ? '#fff' : tokens.ink,
            bgcolor: active ? tokens.primary : 'transparent',
            transition: 'background-color 150ms',
          }}
        >
          {v === 'standings' ? 'Standings' : 'Score trend'}
        </ButtonBase>
      );
    })}
  </Box>
);

const FilterChip = ({
  label,
  icon,
  onClick,
  active,
}: {
  label: string;
  icon?: ReactNode;
  onClick: (e: MouseEvent<HTMLElement>) => void;
  active?: boolean;
}) => (
  <ButtonBase
    onClick={onClick}
    sx={{
      gap: 0.5,
      px: { xs: 1.25, sm: 1.5 },
      py: 0.9,
      borderRadius: 2.5,
      border: `1px solid ${active ? tokens.primary : tokens.border}`,
      bgcolor: active ? tokens.primarySoft : tokens.surface,
      color: active ? tokens.primary : tokens.ink,
      fontSize: '0.875rem',
      fontWeight: 500,
      whiteSpace: 'nowrap',
      '& svg': { fontSize: 18 },
    }}
  >
    {icon}
    {label}
    <KeyboardArrowDownIcon />
  </ButtonBase>
);

const ProgressBar = ({ value }: { value: number }) => (
  <Box sx={{ height: 8, borderRadius: 4, bgcolor: '#e9edf2', overflow: 'hidden', flex: 1 }}>
    <Box sx={{ height: '100%', width: `${Math.min(100, Math.max(0, value))}%`, bgcolor: tokens.primary, borderRadius: 4 }} />
  </Box>
);

/* ---------- row ---------- */

interface RowProps {
  standing: Standing;
  round: RoundKey | null;
  expanded: boolean;
  inGroup: boolean;
  onToggleExpand: () => void;
  onToggleGroup: () => void;
  userPath: string;
}

const StandingRow = ({ standing: s, round, expanded, inGroup, onToggleExpand, onToggleGroup, userPath }: RowProps) => {
  const primary = round ? s.roundScores[round] : s.score;
  const outOf = round ? ROUND_MAX_POINTS : s.maxPossible;
  const pct = outOf > 0 ? Math.round((primary / outOf) * 100) : 0;

  return (
    <Box sx={{ borderBottom: `1px solid ${tokens.border}` }}>
      <ButtonBase
        onClick={onToggleExpand}
        aria-expanded={expanded}
        sx={{ width: '100%', display: 'block', textAlign: 'left', py: 2, px: { xs: 0, sm: 1 }, '&:hover': { bgcolor: { md: tokens.surfaceAlt } } }}
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: '32px 48px minmax(0,1fr) auto 28px', alignItems: 'center', columnGap: 1.5 }}>
          <Typography sx={{ fontSize: '1.3rem', fontWeight: 700, textAlign: 'center' }}>{s.rank}</Typography>
          <InitialsAvatar name={s.fullName} seed={s.username} size={48} highlight={s.rank === 1} />
          <Box sx={{ minWidth: 0 }}>
            <Typography noWrap sx={{ fontWeight: 700, fontSize: '1.05rem' }}>
              {s.fullName}
            </Typography>
            <Typography noWrap sx={{ color: tokens.muted, fontSize: '0.9rem' }}>
              {s.bracketName}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
              <Typography sx={{ fontSize: '1.2rem', fontWeight: 700 }}>{fmt(primary)}</Typography>
              {!round && s.rankChange !== 0 && (
                <ChangeIndicator value={s.rankChange} label={String(Math.abs(s.rankChange))} fontSize="0.85rem" />
              )}
            </Box>
            <Typography sx={{ color: tokens.muted, fontSize: '0.85rem' }}>
              {round ? `of ${ROUND_MAX_POINTS} in ${ROUND_LABELS[round].short}` : `${fmt(s.maxPossible)} max`}
            </Typography>
          </Box>
          <Box sx={{ color: tokens.ink, display: 'flex', justifyContent: 'center' }}>
            {expanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1.25, ml: { xs: 0, sm: '44px' } }}>
          <ProgressBar value={pct} />
          <Typography sx={{ color: tokens.muted, fontSize: '0.8rem', whiteSpace: 'nowrap', minWidth: 78, textAlign: 'right' }}>
            {pct}% of max
          </Typography>
        </Box>
      </ButtonBase>

      <Collapse in={expanded} unmountOnExit>
        <Box sx={{ pb: 2, px: { xs: 0, sm: 1 } }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
              bgcolor: tokens.surfaceAlt,
              borderRadius: 2,
              py: 1.5,
            }}
          >
            {ROUND_ORDER.map((r, i) => (
              <Box key={r} sx={{ px: { xs: 0.75, sm: 2 }, borderLeft: i ? `1px solid ${tokens.border}` : 'none', minWidth: 0 }}>
                <Typography sx={{ color: tokens.muted, fontSize: '0.8rem', mb: 0.5 }}>{ROUND_LABELS[r].short}</Typography>
                <Typography sx={{ fontSize: { xs: '0.8rem', sm: '0.9rem' }, lineHeight: 1.3 }}>
                  <Box component="span" sx={{ fontWeight: 700 }}>{s.roundScores[r]}</Box>{' '}
                  <Box component="span" sx={{ color: tokens.muted, fontSize: { xs: '0.72rem', sm: 'inherit' }, whiteSpace: 'nowrap' }}>/ {ROUND_MAX_POINTS}</Box>
                </Typography>
              </Box>
            ))}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mt: 1.5 }}>
            {s.champion && (
              <Typography sx={{ fontSize: '0.875rem', color: tokens.muted, mr: 'auto' }}>
                Champion pick: <Box component="span" sx={{ color: tokens.ink, fontWeight: 600 }}>{s.champion}</Box>
              </Typography>
            )}
            <Button
              size="small"
              variant={inGroup ? 'contained' : 'outlined'}
              startIcon={inGroup ? <PersonRemoveOutlinedIcon /> : <PersonAddAltIcon />}
              onClick={onToggleGroup}
            >
              {inGroup ? 'In group' : 'Add to group'}
            </Button>
            <Button size="small" component={RouterLink} to={userPath}>
              View bracket →
            </Button>
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
};

/* ---------- trend ---------- */

const ScoreTrend = ({ standings, group }: { standings: Standing[]; group: Standing[] }) => {
  const { gameResults } = useData();
  const shown = group.length ? group : standings.slice(0, TREND_DEFAULT_COUNT);
  const ordered = useMemo(() => [...gameResults].sort((a, b) => a.order - b.order), [gameResults]);

  if (!ordered.length) {
    return <Typography sx={{ color: tokens.muted, py: 6, textAlign: 'center' }}>No games played yet.</Typography>;
  }

  const data = {
    labels: ordered.map((g) => `${g.winner} over ${g.loser}`),
    datasets: shown.map((s, i) => {
      const color = TREND_COLORS[i % TREND_COLORS.length];
      return {
        label: s.fullName,
        data: s.history,
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.25,
      };
    }),
  };

  return (
    <Box>
      <Typography sx={{ color: tokens.muted, fontSize: '0.875rem', mb: 2 }}>
        {group.length ? `Your group of ${group.length}` : `Top ${shown.length}`} · cumulative points after each game
      </Typography>
      <Box sx={{ height: { xs: 360, md: 480 } }}>
        <Line
          data={data}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: {
                position: 'bottom',
                labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, padding: 14, font: { family: 'Inter' } },
              },
              tooltip: {
                itemSort: (a, b) => (b.parsed.y ?? 0) - (a.parsed.y ?? 0),
                titleFont: { family: 'Inter' },
                bodyFont: { family: 'Inter' },
              },
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: {
                  font: { family: 'Inter', size: 11 },
                  color: tokens.muted,
                  maxRotation: 0,
                  autoSkip: true,
                  maxTicksLimit: 8,
                  callback: (_, index) => `G${index + 1}`,
                },
              },
              y: {
                grid: { color: tokens.divider },
                border: { display: false },
                ticks: { font: { family: 'Inter', size: 11 }, color: tokens.muted },
              },
            },
          }}
        />
      </Box>
    </Box>
  );
};

/* ---------- page ---------- */

const Leaderboard = () => {
  const { loading, error } = useData();
  const { yearPath } = useYearPath();
  const location = useLocation();
  const navigate = useNavigate();
  const { standings } = usePoolStandings(1);

  const [view, setView] = useState<View>('standings');
  const [search, setSearch] = useState('');
  const [round, setRound] = useState<RoundKey | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [group, setGroup] = useState<string[]>(() => {
    const param = new URLSearchParams(location.search).get('users');
    return param ? param.split(',').filter(Boolean) : [];
  });
  const [groupOnly, setGroupOnly] = useState(() => new URLSearchParams(location.search).has('users'));
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [copied, setCopied] = useState(false);
  const [menu, setMenu] = useState<{ type: 'members' | 'rounds' | 'sort'; anchor: HTMLElement } | null>(null);

  useEffect(() => {
    if (standings[0] && expanded.size === 0) setExpanded(new Set([standings[0].username]));
    // Only seed the default expansion once data arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standings.length]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (groupOnly && group.length) params.set('users', group.join(','));
    else params.delete('users');
    const next = params.toString();
    if (next !== location.search.replace(/^\?/, '')) {
      navigate({ search: next ? `?${next}` : '' }, { replace: true });
    }
  }, [group, groupOnly, location.search, navigate]);

  useEffect(() => setVisible(PAGE_SIZE), [search, round, sortKey, groupOnly]);

  const groupSet = useMemo(() => new Set(group), [group]);
  const groupStandings = useMemo(() => standings.filter((s) => groupSet.has(s.username)), [standings, groupSet]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = groupOnly && group.length ? groupStandings : standings;
    if (q) {
      list = list.filter(
        (s) => s.fullName.toLowerCase().includes(q) || s.bracketName.toLowerCase().includes(q) || s.username.toLowerCase().includes(q)
      );
    }
    const sorted = [...list];
    if (round) {
      sorted.sort((a, b) => b.roundScores[round] - a.roundScores[round] || a.rank - b.rank);
    } else if (sortKey === 'maxPossible') {
      sorted.sort((a, b) => b.maxPossible - a.maxPossible || a.rank - b.rank);
    } else if (sortKey === 'movers') {
      sorted.sort((a, b) => b.rankChange - a.rankChange || a.rank - b.rank);
    } else if (sortKey === 'name') {
      sorted.sort((a, b) => a.fullName.localeCompare(b.fullName));
    }
    return sorted;
  }, [standings, groupStandings, groupOnly, group.length, search, round, sortKey]);

  const toggleExpanded = (username: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username);
      else next.add(username);
      return next;
    });

  const toggleGroup = (username: string) =>
    setGroup((prev) => (prev.includes(username) ? prev.filter((u) => u !== username) : [...prev, username]));

  const copyGroupLink = () => {
    const url = `${window.location.origin}${location.pathname}?users=${group.map(encodeURIComponent).join(',')}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 320 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h5" color="error" gutterBottom>
          Something went wrong
        </Typography>
        <Typography color="text.secondary">{error}</Typography>
      </Box>
    );
  }

  const membersLabel = groupOnly && group.length ? `My group (${group.length})` : 'All members';
  const closeMenu = () => setMenu(null);

  return (
    <Box sx={{ maxWidth: 960 }}>
      <Typography component="h1" sx={{ fontSize: { xs: '2rem', md: '2.6rem' }, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.1, mb: 2.5 }}>
        Leaderboard
      </Typography>

      <Segmented value={view} onChange={setView} />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2.5, mb: 1, flexWrap: 'wrap' }}>
        <FilterChip label={membersLabel} active={groupOnly && group.length > 0} onClick={(e) => setMenu({ type: 'members', anchor: e.currentTarget })} />
        {view === 'standings' && (
          <>
            <FilterChip label={round ? ROUND_LABELS[round].long : 'All rounds'} active={!!round} onClick={(e) => setMenu({ type: 'rounds', anchor: e.currentTarget })} />
            <Box sx={{ flexGrow: 1, minWidth: 8 }} />
            <FilterChip label={round ? 'Round points' : SORT_LABELS[sortKey]} icon={<SwapVertIcon />} onClick={(e) => setMenu({ type: 'sort', anchor: e.currentTarget })} />
          </>
        )}
      </Box>

      {view === 'standings' ? (
        <>
          <TextField
            fullWidth
            size="small"
            placeholder="Search people or brackets"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ mt: 1, mb: 1, '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: tokens.subtle }} />
                </InputAdornment>
              ),
            }}
          />

          {group.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: '0.875rem', color: tokens.muted, mr: 'auto' }}>
                {group.length} {group.length === 1 ? 'person' : 'people'} in your group
              </Typography>
              <Button size="small" onClick={() => setGroupOnly((v) => !v)}>
                {groupOnly ? 'Show everyone' : 'Show group only'}
              </Button>
              <Button size="small" startIcon={<ContentCopyIcon />} onClick={copyGroupLink}>
                Copy link
              </Button>
              <Button size="small" color="inherit" onClick={() => { setGroup([]); setGroupOnly(false); }}>
                Clear
              </Button>
            </Box>
          )}

          <Box sx={{ borderTop: `1px solid ${tokens.border}` }}>
            {rows.slice(0, visible).map((s) => (
              <StandingRow
                key={s.username}
                standing={s}
                round={round}
                expanded={expanded.has(s.username)}
                inGroup={groupSet.has(s.username)}
                onToggleExpand={() => toggleExpanded(s.username)}
                onToggleGroup={() => toggleGroup(s.username)}
                userPath={yearPath(`/users/${encodeURIComponent(s.username)}`)}
              />
            ))}
          </Box>

          {rows.length === 0 && (
            <Typography sx={{ color: tokens.muted, textAlign: 'center', py: 6 }}>No brackets match “{search}”.</Typography>
          )}
          {rows.length > visible && (
            <Box sx={{ textAlign: 'center', mt: 3 }}>
              <Button variant="outlined" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                Show more ({fmt(rows.length - visible)} left)
              </Button>
            </Box>
          )}
        </>
      ) : (
        <Box sx={{ mt: 2 }}>
          <ScoreTrend standings={standings} group={groupStandings} />
          {!group.length && (
            <Typography sx={{ color: tokens.muted, fontSize: '0.85rem', mt: 2 }}>
              Tip: open anyone in{' '}
              <Link component="button" onClick={() => setView('standings')} sx={{ fontSize: 'inherit', verticalAlign: 'baseline' }}>
                Standings
              </Link>{' '}
              and tap “Add to group” to chart your own comparison.
            </Typography>
          )}
        </Box>
      )}

      <Menu anchorEl={menu?.anchor} open={!!menu} onClose={closeMenu} PaperProps={{ variant: 'outlined', sx: { mt: 0.5, minWidth: 200 } }}>
        {menu?.type === 'members' && [
          <MenuItem key="all" onClick={() => { setGroupOnly(false); closeMenu(); }}>
            <ListItemIcon>{!(groupOnly && group.length) && <CheckIcon fontSize="small" />}</ListItemIcon>
            All members
          </MenuItem>,
          <MenuItem key="group" disabled={!group.length} onClick={() => { setGroupOnly(true); closeMenu(); }}>
            <ListItemIcon>{groupOnly && group.length > 0 && <CheckIcon fontSize="small" />}</ListItemIcon>
            My group {group.length ? `(${group.length})` : '(add people first)'}
          </MenuItem>,
        ]}
        {menu?.type === 'rounds' &&
          [null, ...ROUND_ORDER].map((r) => (
            <MenuItem key={r ?? 'all'} onClick={() => { setRound(r); closeMenu(); }}>
              <ListItemIcon>{round === r && <CheckIcon fontSize="small" />}</ListItemIcon>
              {r ? ROUND_LABELS[r].long : 'All rounds'}
            </MenuItem>
          ))}
        {menu?.type === 'sort' &&
          (Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <MenuItem key={k} disabled={!!round} onClick={() => { setSortKey(k); closeMenu(); }}>
              <ListItemIcon>{!round && sortKey === k && <CheckIcon fontSize="small" />}</ListItemIcon>
              {SORT_LABELS[k]}
            </MenuItem>
          ))}
      </Menu>

      <Snackbar open={copied} autoHideDuration={2500} onClose={() => setCopied(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} sx={{ bottom: { xs: 88, md: 24 } }}>
        <Alert severity="success" variant="filled" onClose={() => setCopied(false)}>
          Group link copied
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Leaderboard;
