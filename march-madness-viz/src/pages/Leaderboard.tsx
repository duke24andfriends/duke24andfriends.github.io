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

type SortKey = 'score' | 'maxPossible' | 'movers' | 'name';

const SORT_LABELS: Record<SortKey, string> = {
  score: 'Total points',
  maxPossible: 'Max possible',
  movers: 'Biggest movers',
  name: 'Name',
};

const PAGE_SIZE = 50;

const fmt = (n: number) => n.toLocaleString();

/* ---------- small pieces ---------- */

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
      gap: { xs: 0.25, sm: 0.5 },
      px: { xs: 1, sm: 1.5 },
      py: { xs: 0.75, sm: 0.9 },
      borderRadius: 2.5,
      border: `1px solid ${active ? tokens.primary : tokens.border}`,
      bgcolor: active ? tokens.primarySoft : tokens.surface,
      color: active ? tokens.primary : tokens.ink,
      fontSize: { xs: '0.825rem', sm: '0.875rem' },
      fontWeight: 500,
      whiteSpace: 'nowrap',
      '& svg': { fontSize: { xs: 16, sm: 18 } },
    }}
  >
    {icon}
    {label}
    <KeyboardArrowDownIcon />
  </ButtonBase>
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
  const [showRounds, setShowRounds] = useState(false);
  const primary = round ? s.roundScores[round] : s.score;

  return (
    <Box sx={{ borderBottom: `1px solid ${tokens.border}` }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: '28px minmax(0,1fr) auto 36px', alignItems: 'center', columnGap: 1, py: 1.25, px: { xs: 0, sm: 1 } }}>
        <Typography sx={{ fontSize: '1.05rem', fontWeight: 700, textAlign: 'center' }}>{s.rank}</Typography>
        <Box
          component={RouterLink}
          to={userPath}
          sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0, color: 'inherit', textDecoration: 'none', borderRadius: 2, py: 0.25, '&:hover .name': { color: tokens.primary } }}
        >
          <InitialsAvatar name={s.fullName} seed={s.username} size={36} highlight={s.rank === 1} />
          <Box sx={{ minWidth: 0 }}>
            <Typography className="name" noWrap sx={{ fontWeight: 700, fontSize: '0.975rem' }}>
              {s.fullName}
            </Typography>
            <Typography noWrap sx={{ color: tokens.muted, fontSize: '0.825rem' }}>
              {s.bracketName}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.75 }}>
            <Typography sx={{ fontSize: '1.05rem', fontWeight: 700 }}>{fmt(primary)}</Typography>
            {!round && s.rankChange !== 0 && (
              <ChangeIndicator value={s.rankChange} label={String(Math.abs(s.rankChange))} fontSize="0.8rem" />
            )}
          </Box>
          <Typography sx={{ color: tokens.muted, fontSize: '0.775rem' }}>
            {round ? `of ${ROUND_MAX_POINTS} in ${ROUND_LABELS[round].short}` : `${fmt(s.maxPossible)} max`}
          </Typography>
        </Box>
        <ButtonBase
          onClick={onToggleExpand}
          aria-expanded={expanded}
          aria-label={expanded ? 'Hide details' : 'Show details'}
          sx={{ width: 36, height: 36, borderRadius: '50%', color: tokens.muted, '&:hover': { bgcolor: tokens.surfaceAlt, color: tokens.ink } }}
        >
          {expanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
        </ButtonBase>
      </Box>

      <Collapse in={expanded} unmountOnExit>
        <Box sx={{ pb: 1.5, pl: { xs: '36px', sm: '44px' }, pr: { xs: 0, sm: 1 } }}>
          {s.champion && (
            <Typography sx={{ fontSize: '0.85rem', color: tokens.muted, mb: 0.75 }}>
              Champion pick: <Box component="span" sx={{ color: tokens.ink, fontWeight: 600 }}>{s.champion}</Box>
            </Typography>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', columnGap: 1 }}>
            <ButtonBase
              onClick={() => setShowRounds((v) => !v)}
              aria-expanded={showRounds}
              sx={{ py: 0.5, gap: 0.25, fontSize: '0.825rem', fontWeight: 600, color: tokens.primary, borderRadius: 1, whiteSpace: 'nowrap' }}
            >
              Round breakdown
              <KeyboardArrowDownIcon sx={{ fontSize: 18, transform: showRounds ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
            </ButtonBase>
            <Box sx={{ flex: 1 }} />
            <Button
              size="small"
              variant={inGroup ? 'contained' : 'outlined'}
              startIcon={inGroup ? <PersonRemoveOutlinedIcon /> : <PersonAddAltIcon />}
              onClick={onToggleGroup}
              sx={{ whiteSpace: 'nowrap' }}
            >
              {inGroup ? 'In group' : 'Add to group'}
            </Button>
            <Button size="small" component={RouterLink} to={userPath} sx={{ display: { xs: 'none', sm: 'inline-flex' }, whiteSpace: 'nowrap' }}>
              View bracket →
            </Button>
          </Box>
          <Collapse in={showRounds} unmountOnExit>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', bgcolor: tokens.surfaceAlt, borderRadius: 2, py: 1, mt: 0.5 }}>
              {ROUND_ORDER.map((r, i) => (
                <Box key={r} sx={{ px: { xs: 0.5, sm: 1.5 }, borderLeft: i ? `1px solid ${tokens.border}` : 'none', minWidth: 0, textAlign: 'center' }}>
                  <Typography sx={{ color: tokens.muted, fontSize: '0.72rem' }}>{ROUND_LABELS[r].short}</Typography>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 700 }}>{s.roundScores[r]}</Typography>
                </Box>
              ))}
            </Box>
          </Collapse>
        </Box>
      </Collapse>
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
      <Typography component="h1" sx={{ fontSize: { xs: '1.8rem', md: '2.6rem' }, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.1, mb: { xs: 1.5, md: 2.5 } }}>
        Leaderboard
      </Typography>

      <TextField
        fullWidth
        size="small"
        placeholder="Search people or brackets"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ color: tokens.subtle }} />
            </InputAdornment>
          ),
        }}
      />

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mt: 1.25,
          mb: 1,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
          mx: { xs: -2, sm: 0 },
          px: { xs: 2, sm: 0 },
          '& > *': { flexShrink: 0 },
        }}
      >
        <FilterChip label={membersLabel} active={groupOnly && group.length > 0} onClick={(e) => setMenu({ type: 'members', anchor: e.currentTarget })} />
        <FilterChip label={round ? ROUND_LABELS[round].long : 'All rounds'} active={!!round} onClick={(e) => setMenu({ type: 'rounds', anchor: e.currentTarget })} />
        <Box sx={{ flexGrow: 1, minWidth: 0 }} />
        <FilterChip label={round ? 'Round points' : SORT_LABELS[sortKey]} icon={<SwapVertIcon />} onClick={(e) => setMenu({ type: 'sort', anchor: e.currentTarget })} />
      </Box>

      <>

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
