import { useCallback, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  Drawer,
  InputAdornment,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { useData } from '../context/DataContext';
import RegionBracket, { BracketColumn } from '../components/bracket/RegionBracket';
import InitialsAvatar from '../components/ui/InitialsAvatar';
import ChangeIndicator from '../components/ui/ChangeIndicator';
import {
  getBracketRegions,
  getGameTeamsConsistent,
  updatePredictedWinner as mergePredictedWinner,
} from '../utils/bracketLogic';
import { calculateHypotheticalScores } from '../utils/dataProcessing';
import { GameWinner } from '../types';
import { useYearPath } from '../utils/yearRouting';
import { displayNames } from '../hooks/usePoolStandings';
import { MOBILE_NAV_HEIGHT, tokens } from '../theme';

type RegionKey = 'SOUTH' | 'EAST' | 'WEST' | 'MIDWEST';
type TabKey = RegionKey | 'FINAL_FOUR';
type FillStrategy = 'favorites' | 'popular' | 'random';

/** Data keys don't match the displayed region names for this year's bracket. */
const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'SOUTH', label: 'East' },
  { key: 'EAST', label: 'West' },
  { key: 'WEST', label: 'South' },
  { key: 'MIDWEST', label: 'Midwest' },
  { key: 'FINAL_FOUR', label: 'Final Four' },
];

const ROUND_META = {
  round64: { label: 'Round of 64', date: 'Mar 19–20', points: '10 pts' },
  round32: { label: 'Round of 32', date: 'Mar 21–22', points: '20 pts' },
  sweet16: { label: 'Sweet 16', date: 'Mar 26–27', points: '40 pts' },
  elite8: { label: 'Elite 8', date: 'Mar 28–29', points: '80 pts' },
  finalFour: { label: 'Final Four', date: 'Apr 4', points: '160 pts' },
  championship: { label: 'Championship', date: 'Apr 6', points: '320 pts' },
};

const FILL_OPTIONS: Array<{ key: FillStrategy; label: string; hint: string }> = [
  { key: 'favorites', label: 'Favorites', hint: 'Better seed wins every game' },
  { key: 'popular', label: 'Pool favorites', hint: 'Team the pool picked more often wins' },
  { key: 'random', label: 'Random', hint: 'Weighted by how often the pool picked each team' },
];

const ALL_GAME_IDS = Array.from({ length: 63 }, (_, i) => String(i + 1));
const STANDINGS_PAGE = 50;

interface ScenarioRow {
  username: string;
  fullName: string;
  bracketName: string;
  score: number;
  current: number;
  rank: number;
  rankChange: number;
}

function competitionRanks(rows: Array<{ username: string; score: number }>): Map<string, number> {
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  const ranks = new Map<string, number>();
  sorted.forEach((row, i) => {
    const prev = sorted[i - 1];
    ranks.set(row.username, prev && prev.score === row.score ? ranks.get(prev.username)! : i + 1);
  });
  return ranks;
}

const ScenarioStandings = ({ rows, hasPicks }: { rows: ScenarioRow[]; hasPicks: boolean }) => {
  const { yearPath } = useYearPath();
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState(STANDINGS_PAGE);
  const q = search.trim().toLowerCase();
  const filtered = q
    ? rows.filter((r) => r.fullName.toLowerCase().includes(q) || r.bracketName.toLowerCase().includes(q) || r.username.toLowerCase().includes(q))
    : rows;

  return (
    <Box>
      <TextField
        fullWidth
        size="small"
        placeholder="Search people or brackets"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setVisible(STANDINGS_PAGE);
        }}
        sx={{ mb: 1, '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ color: tokens.subtle }} />
            </InputAdornment>
          ),
        }}
      />
      {filtered.slice(0, visible).map((r) => (
        <Box
          key={r.username}
          component={RouterLink}
          to={yearPath(`/users/${encodeURIComponent(r.username)}`)}
          sx={{
            display: 'grid',
            gridTemplateColumns: '28px 32px minmax(0,1fr) auto',
            alignItems: 'center',
            columnGap: 1.25,
            py: 1.1,
            borderBottom: `1px solid ${tokens.divider}`,
            color: 'inherit',
            textDecoration: 'none',
            '&:hover': { bgcolor: tokens.surfaceAlt },
          }}
        >
          <Typography sx={{ fontWeight: 700, textAlign: 'center', fontSize: '0.9rem' }}>{r.rank}</Typography>
          <InitialsAvatar name={r.fullName} seed={r.username} size={32} highlight={r.rank === 1} />
          <Box sx={{ minWidth: 0 }}>
            <Typography noWrap sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{r.fullName}</Typography>
            <Typography noWrap sx={{ color: tokens.muted, fontSize: '0.75rem' }}>{r.bracketName}</Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>{r.score.toLocaleString()}</Typography>
            <Box sx={{ minHeight: 18 }}>
              {hasPicks && r.rankChange !== 0 && (
                <ChangeIndicator value={r.rankChange} label={String(Math.abs(r.rankChange))} fontSize="0.75rem" />
              )}
            </Box>
          </Box>
        </Box>
      ))}
      {filtered.length > visible && (
        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Button size="small" variant="outlined" onClick={() => setVisible((v) => v + STANDINGS_PAGE)}>
            Show more
          </Button>
        </Box>
      )}
      {filtered.length === 0 && (
        <Typography sx={{ color: tokens.muted, fontSize: '0.875rem', textAlign: 'center', py: 3 }}>No matches.</Typography>
      )}
    </Box>
  );
};

function BracketMachine() {
  const { bracketData, gameWinners, gameResults, userNameMapping, loading, error } = useData();
  const [tab, setTab] = useState<TabKey>('SOUTH');
  const [predicted, setPredicted] = useState<GameWinner[]>([]);
  const [standingsOpen, setStandingsOpen] = useState(false);
  const [fillAnchor, setFillAnchor] = useState<HTMLElement | null>(null);

  const regions = useMemo(() => getBracketRegions(), []);

  const seedByTeam = useMemo(() => {
    const map: Record<string, number> = {};
    gameResults.forEach((r) => {
      map[r.winner] = r.winnerSeed;
      map[r.loser] = r.loserSeed;
    });
    return map;
  }, [gameResults]);

  const actualByGame = useMemo(() => new Map(gameWinners.map((g) => [g.gameId, g.winner])), [gameWinners]);
  const predictedByGame = useMemo(() => new Map(predicted.map((g) => [g.gameId, g.winner])), [predicted]);

  const teamsFor = useCallback(
    (gameId: string, picks: GameWinner[] = predicted) =>
      bracketData ? getGameTeamsConsistent(gameId, bracketData, gameResults, gameWinners, picks) : [],
    [bracketData, gameResults, gameWinners, predicted]
  );

  const handlePick = useCallback(
    (gameId: string, team: string) => {
      if (!bracketData) return;
      setPredicted((prev) =>
        mergePredictedWinner(gameId, team, prev, (gid, pending) =>
          getGameTeamsConsistent(gid, bracketData, gameResults, gameWinners, pending)
        )
      );
    },
    [bracketData, gameResults, gameWinners]
  );

  const autoFill = (strategy: FillStrategy) => {
    if (!bracketData) return;
    const picks = [...predicted];
    const picked = new Set(picks.map((p) => p.gameId));
    for (const gameId of ALL_GAME_IDS) {
      if (actualByGame.has(gameId) || picked.has(gameId)) continue;
      const teams = getGameTeamsConsistent(gameId, bracketData, gameResults, gameWinners, picks);
      if (teams.length !== 2 || teams.includes('TBD')) continue;
      const [a, b] = teams;
      const dist = bracketData.games[gameId]?.stats.pick_distribution ?? {};
      const pa = dist[a] ?? 0;
      const pb = dist[b] ?? 0;
      let winner: string;
      if (strategy === 'favorites') {
        const sa = seedByTeam[a] ?? 99;
        const sb = seedByTeam[b] ?? 99;
        winner = sa === sb ? (pa >= pb ? a : b) : sa < sb ? a : b;
      } else if (strategy === 'popular') {
        winner = pa >= pb ? a : b;
      } else {
        const share = pa + pb > 0 ? pa / (pa + pb) : 0.5;
        winner = Math.random() < share ? a : b;
      }
      picks.push({ gameId, winner });
    }
    setPredicted(picks);
    setFillAnchor(null);
  };

  const rows = useMemo<ScenarioRow[]>(() => {
    if (!bracketData) return [];
    const base = calculateHypotheticalScores(bracketData, gameWinners, []);
    const scen = calculateHypotheticalScores(bracketData, gameWinners, predicted);
    const baseRanks = competitionRanks(base);
    const scenRanks = competitionRanks(scen);
    const currentByUser = new Map(base.map((s) => [s.username, s.score]));
    return scen
      .map((s) => {
        const rank = scenRanks.get(s.username)!;
        return {
          username: s.username,
          ...displayNames(s.username, userNameMapping[s.username]),
          score: s.score,
          current: currentByUser.get(s.username) ?? 0,
          rank,
          rankChange: (baseRanks.get(s.username) ?? rank) - rank,
        };
      })
      .sort((a, b) => a.rank - b.rank || a.fullName.localeCompare(b.fullName));
  }, [bracketData, gameWinners, predicted, userNameMapping]);

  if (loading || error || !bracketData) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        {loading ? <CircularProgress /> : <Alert severity="error">{error || 'No data'}</Alert>}
      </Box>
    );
  }

  const columns: BracketColumn[] =
    tab === 'FINAL_FOUR'
      ? [
          { ...ROUND_META.finalFour, gameIds: regions.FINAL_FOUR.games },
          { ...ROUND_META.championship, gameIds: regions.FINAL_FOUR.championship },
        ]
      : (['round64', 'round32', 'sweet16', 'elite8'] as const).map((k) => ({ ...ROUND_META[k], gameIds: regions[tab][k] }));

  const tabLabel = TABS.find((t) => t.key === tab)!.label;
  const remaining = ALL_GAME_IDS.filter((g) => !actualByGame.has(g)).length;
  const picksMade = predicted.length;
  const tournamentOver = remaining === 0;
  const leader = rows[0];
  const tiedLeaders = rows.filter((r) => r.rank === 1).length;

  const summary = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 2, sm: 3 } }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ color: tokens.muted, fontSize: '0.8rem' }}>Picks made</Typography>
        <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.5rem', md: '1.6rem' }, lineHeight: 1.2 }}>
          {picksMade}
          <Box component="span" sx={{ color: tokens.muted, fontWeight: 500, fontSize: '0.9rem' }}> / {remaining}</Box>
        </Typography>
      </Box>
      <Box sx={{ width: '1px', alignSelf: 'stretch', bgcolor: tokens.border }} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ color: tokens.muted, fontSize: '0.8rem' }}>{picksMade ? 'Projected leader' : 'Current leader'}</Typography>
        <Typography noWrap sx={{ fontWeight: 800, fontSize: { xs: '1.05rem', md: '1.1rem' }, lineHeight: 1.3 }}>
          {leader ? leader.fullName : '—'}
          {tiedLeaders > 1 && <Box component="span" sx={{ color: tokens.muted, fontWeight: 500 }}> +{tiedLeaders - 1}</Box>}
        </Typography>
        <Typography sx={{ color: tokens.muted, fontSize: '0.8rem' }}>{leader ? `${leader.score.toLocaleString()} pts` : ''}</Typography>
      </Box>
    </Box>
  );

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 360px' },
        columnGap: { lg: 5 },
        alignItems: 'start',
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2 }}>
          <Typography component="h1" sx={{ fontSize: { xs: '1.75rem', md: '2.6rem' }, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.1 }}>
            Bracket Machine
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0, '& .MuiButton-root': { whiteSpace: 'nowrap', minWidth: 0 } }}>
            <Button
              size="small"
              startIcon={<AutoFixHighIcon />}
              disabled={tournamentOver}
              onClick={(e) => setFillAnchor(e.currentTarget)}
              sx={{ '& .MuiButton-startIcon': { display: { xs: 'none', sm: 'inherit' } } }}
            >
              Auto-fill
            </Button>
            <Button size="small" disabled={!picksMade} onClick={() => setPredicted([])}>
              Reset
            </Button>
          </Box>
        </Box>

        <Box
          role="tablist"
          sx={{
            display: 'flex',
            p: 0.5,
            bgcolor: tokens.surfaceAlt,
            borderRadius: 3,
            overflowX: 'auto',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
            mb: 3,
            maxWidth: 720,
          }}
        >
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <ButtonBase
                key={t.key}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                sx={{
                  flex: '1 0 auto',
                  px: { xs: 1.25, sm: 2 },
                  py: 1.1,
                  borderRadius: 2.5,
                  fontSize: '0.95rem',
                  fontWeight: active ? 600 : 500,
                  whiteSpace: 'nowrap',
                  color: active ? '#fff' : tokens.ink,
                  bgcolor: active ? tokens.primary : 'transparent',
                }}
              >
                {t.label}
              </ButtonBase>
            );
          })}
        </Box>

        <Typography component="h2" sx={{ fontSize: { xs: '1.5rem', md: '1.75rem' }, fontWeight: 800, letterSpacing: '-0.02em' }}>
          {tab === 'FINAL_FOUR' ? 'Final Four' : `${tabLabel} Region`}
        </Typography>
        <Typography sx={{ color: tokens.muted, mb: 3 }}>
          {tournamentOver
            ? 'Every game has been played. Green shows the actual winners.'
            : 'Tap a team to pick a winner. See how it changes the standings.'}
        </Typography>

        <RegionBracket
          columns={columns}
          getTeams={(id) => teamsFor(id)}
          getSeed={(team) => seedByTeam[team]}
          getActualWinner={(id) => actualByGame.get(id) ?? ''}
          getPredictedWinner={(id) => predictedByGame.get(id) ?? ''}
          onPick={handlePick}
          championGameId={tab === 'FINAL_FOUR' ? '63' : undefined}
        />

        <Box sx={{ display: 'flex', gap: 2.5, mt: 2, color: tokens.muted, fontSize: '0.8rem', flexWrap: 'wrap' }}>
          {[
            { color: tokens.success, label: 'Actual result' },
            { color: tokens.primary, label: 'Your pick' },
          ].map((l) => (
            <Box key={l.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: l.color }} />
              {l.label}
            </Box>
          ))}
        </Box>

        {/* Leaves room for the fixed scenario bar on mobile */}
        <Box sx={{ display: { xs: 'block', lg: 'none' }, height: 120 }} />
      </Box>

      {/* Desktop sidebar */}
      <Box
        component="aside"
        sx={{
          display: { xs: 'none', lg: 'block' },
          position: 'sticky',
          top: 88,
          pl: 4,
          borderLeft: `1px solid ${tokens.border}`,
          maxHeight: 'calc(100vh - 112px)',
          overflowY: 'auto',
        }}
      >
        <Typography sx={{ fontWeight: 700, fontSize: '1.3rem', mb: 2 }}>Your scenario</Typography>
        <Box sx={{ pb: 2, mb: 2, borderBottom: `1px solid ${tokens.border}` }}>{summary}</Box>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', mb: 1.5 }}>Scenario standings</Typography>
        <ScenarioStandings rows={rows} hasPicks={picksMade > 0} />
      </Box>

      {/* Mobile scenario bar */}
      <Box
        sx={{
          display: { xs: 'block', lg: 'none' },
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: { xs: `calc(${MOBILE_NAV_HEIGHT}px + env(safe-area-inset-bottom))`, md: 0 },
          zIndex: (t) => t.zIndex.appBar - 1,
          bgcolor: tokens.surface,
          borderTop: `1px solid ${tokens.border}`,
          boxShadow: '0 -8px 24px rgba(15, 23, 42, 0.08)',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          px: 2.5,
          pt: 1,
          pb: 1.75,
        }}
      >
        <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: tokens.border, mx: 'auto', mb: 1.25 }} />
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', mb: 0.75 }}>Your scenario</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>{summary}</Box>
          <Button variant="contained" size="large" onClick={() => setStandingsOpen(true)} sx={{ whiteSpace: 'nowrap', px: 2.5, py: 1.4 }}>
            Standings →
          </Button>
        </Box>
      </Box>

      <Drawer
        anchor="bottom"
        open={standingsOpen}
        onClose={() => setStandingsOpen(false)}
        PaperProps={{ sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '85vh', px: 2, pb: 'calc(16px + env(safe-area-inset-bottom))' } }}
      >
        <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: tokens.border, mx: 'auto', mt: 1.25, mb: 2 }} />
        <Typography sx={{ fontWeight: 700, fontSize: '1.2rem', mb: 1.5 }}>Scenario standings</Typography>
        <ScenarioStandings rows={rows} hasPicks={picksMade > 0} />
      </Drawer>

      <Menu anchorEl={fillAnchor} open={!!fillAnchor} onClose={() => setFillAnchor(null)} PaperProps={{ variant: 'outlined', sx: { mt: 0.5 } }}>
        <Typography sx={{ px: 2, py: 1, color: tokens.muted, fontSize: '0.8rem' }}>Fill remaining games with…</Typography>
        {FILL_OPTIONS.map((o) => (
          <MenuItem key={o.key} onClick={() => autoFill(o.key)}>
            <ListItemText primary={o.label} secondary={o.hint} primaryTypographyProps={{ fontWeight: 600 }} />
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}

export default BracketMachine;
