import { useCallback, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Autocomplete,
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
  useMediaQuery,
  useTheme,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { useData } from '../context/DataContext';
import RegionBracket, { BracketColumn } from '../components/bracket/RegionBracket';
import FullBracket, { RegionLayout } from '../components/bracket/FullBracket';
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
type TabKey = 'FULL' | RegionKey | 'FINAL_FOUR';
type FillStrategy = 'favorites' | 'popular' | 'random';

/** Data keys don't match the displayed region names for this year's bracket. */
const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'FULL', label: 'Full bracket' },
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
const ROOT_FOR_LIMIT = 5;

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

const ScenarioStandings = ({ rows, hasPicks, highlight }: { rows: ScenarioRow[]; hasPicks: boolean; highlight?: string | null }) => {
  const { yearPath } = useYearPath();
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState(STANDINGS_PAGE);
  const q = search.trim().toLowerCase();
  const filtered = q
    ? rows.filter((r) => r.fullName.toLowerCase().includes(q) || r.bracketName.toLowerCase().includes(q) || r.username.toLowerCase().includes(q))
    : rows;
  const highlighted = highlight ? filtered.find((r) => r.username === highlight) : undefined;
  const shownRows = filtered.slice(0, visible);
  if (highlighted && !shownRows.includes(highlighted)) shownRows.push(highlighted);

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
      {shownRows.map((r) => {
        const isHighlight = r.username === highlight;
        return (
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
            px: isHighlight ? 1 : 0,
            mx: isHighlight ? -1 : 0,
            borderRadius: isHighlight ? 2 : 0,
            borderBottom: `1px solid ${tokens.divider}`,
            bgcolor: isHighlight ? tokens.primarySoft : 'transparent',
            boxShadow: isHighlight ? `inset 3px 0 0 ${tokens.primary}` : 'none',
            color: 'inherit',
            textDecoration: 'none',
            '&:hover': { bgcolor: isHighlight ? tokens.primarySoft : tokens.surfaceAlt },
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
        );
      })}
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
  const isDesktop = useMediaQuery(useTheme().breakpoints.up('md'), { noSsr: true });
  const [tab, setTab] = useState<TabKey>(isDesktop ? 'FULL' : 'SOUTH');
  const [predicted, setPredicted] = useState<GameWinner[]>([]);
  const [standingsOpen, setStandingsOpen] = useState(false);
  const [fillAnchor, setFillAnchor] = useState<HTMLElement | null>(null);
  const [startUser, setStartUser] = useState<string | null>(null);

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

  const chooseStartingBracket = (username: string | null) => {
    setStartUser(username);
    if (!bracketData || !username) {
      setPredicted([]);
      return;
    }
    const picks: GameWinner[] = [];
    for (const gameId of ALL_GAME_IDS) {
      if (actualByGame.has(gameId)) continue;
      const pick = bracketData.games[gameId]?.picks[username];
      if (!pick) continue;
      const teams = getGameTeamsConsistent(gameId, bracketData, gameResults, gameWinners, picks);
      if (teams.includes(pick)) picks.push({ gameId, winner: pick });
    }
    setPredicted(picks);
  };

  const startRow = startUser ? rows.find((r) => r.username === startUser) : undefined;

  const rootFor = useMemo(() => {
    if (!bracketData || !startUser) return [];
    const rankOf = (picks: GameWinner[]) => {
      const scores = calculateHypotheticalScores(bracketData, gameWinners, picks);
      const mine = scores.find((s) => s.username === startUser)?.score ?? 0;
      return 1 + scores.filter((s) => s.score > mine).length;
    };
    const teamsOf = (gid: string, pending: GameWinner[]) => getGameTeamsConsistent(gid, bracketData, gameResults, gameWinners, pending);
    return ALL_GAME_IDS.filter((gid) => !actualByGame.has(gid))
      .map((gid) => ({ gid, teams: getGameTeamsConsistent(gid, bracketData, gameResults, gameWinners, []) }))
      .filter(({ teams }) => teams.length === 2 && !teams.includes('TBD'))
      .map(({ gid, teams }) => {
        const outcomes = teams.map((team) => ({ team, rank: rankOf(mergePredictedWinner(gid, team, predicted, teamsOf)) }));
        return { gid, outcomes, swing: Math.abs(outcomes[0].rank - outcomes[1].rank) };
      })
      .filter((g) => g.swing > 0)
      .sort((a, b) => b.swing - a.swing)
      .slice(0, ROOT_FOR_LIMIT);
  }, [bracketData, startUser, gameWinners, gameResults, actualByGame, predicted]);

  if (loading || error || !bracketData) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        {loading ? <CircularProgress /> : <Alert severity="error">{error || 'No data'}</Alert>}
      </Box>
    );
  }

  const columns: BracketColumn[] =
    tab === 'FULL'
      ? []
      : tab === 'FINAL_FOUR'
        ? [
            { ...ROUND_META.finalFour, gameIds: regions.FINAL_FOUR.games },
            { ...ROUND_META.championship, gameIds: regions.FINAL_FOUR.championship },
          ]
        : (['round64', 'round32', 'sweet16', 'elite8'] as const).map((k) => ({ ...ROUND_META[k], gameIds: regions[tab][k] }));
  const regionLayout = (key: RegionKey): RegionLayout => ({
    key,
    label: TABS.find((t) => t.key === key)!.label,
    rounds: [regions[key].round64, regions[key].round32, regions[key].sweet16, regions[key].elite8],
  });
  const bracketProps = {
    getTeams: (id: string) => teamsFor(id),
    getSeed: (team: string) => seedByTeam[team],
    getActualWinner: (id: string) => actualByGame.get(id) ?? '',
    getPredictedWinner: (id: string) => predictedByGame.get(id) ?? '',
    onPick: handlePick,
  };

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

  const startingSelector = (
    <Box>
      <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: tokens.body, mb: 0.75 }}>Starting bracket</Typography>
      <Autocomplete
        size="small"
        options={rows}
        value={startRow ?? null}
        onChange={(_, v) => chooseStartingBracket(v?.username ?? null)}
        getOptionLabel={(o) => o.fullName}
        isOptionEqualToValue={(o, v) => o.username === v.username}
        filterOptions={(opts, { inputValue }) => {
          const q = inputValue.trim().toLowerCase();
          return (q ? opts.filter((o) => [o.username, o.fullName, o.bracketName].some((v) => v.toLowerCase().includes(q))) : opts).slice(0, 50);
        }}
        renderOption={(props, o) => (
          <Box component="li" {...props} key={o.username}>
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: '0.875rem' }}>{o.fullName}</Typography>
              <Typography noWrap sx={{ fontSize: '0.75rem', color: tokens.muted }}>{o.bracketName}</Typography>
            </Box>
          </Box>
        )}
        renderInput={(p) => <TextField {...p} placeholder="Choose a bracket" />}
        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5, bgcolor: '#fff' } }}
      />
      {!startRow && (
        <Typography sx={{ fontSize: '0.75rem', color: tokens.muted, mt: 0.75 }}>
          Start from someone’s picks, then change the games still to play.
        </Typography>
      )}
    </Box>
  );

  const firstName = startRow?.fullName.split(' ')[0] ?? '';
  const startingPanel = startRow && (
    <Box sx={{ mt: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 1, rowGap: 0.25, p: 1.5, borderRadius: 2.5, bgcolor: tokens.primarySoft }}>
        <Typography sx={{ fontSize: '0.85rem', color: tokens.body }}>
          Current rank <Box component="span" sx={{ fontWeight: 700, color: tokens.ink }}>#{startRow.rank + startRow.rankChange}</Box>
        </Typography>
        <Typography sx={{ color: tokens.muted }}>→</Typography>
        <Typography sx={{ fontSize: '0.85rem', color: tokens.body }}>
          potential rank <Box component="span" sx={{ fontWeight: 800, color: tokens.primaryDark, fontSize: '1rem' }}>#{startRow.rank}</Box>
        </Typography>
      </Box>
      {rootFor.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', mb: 0.25 }}>Root for</Typography>
          <Typography sx={{ fontSize: '0.75rem', color: tokens.muted, mb: 1 }}>Upcoming games that move {firstName} the most in this scenario.</Typography>
          {rootFor.map((g) => {
            const [better, worse] = [...g.outcomes].sort((a, b) => a.rank - b.rank);
            const verb = (rank: number) => (rank < startRow.rank ? 'moves to' : rank > startRow.rank ? 'falls to' : 'stays at');
            return (
              <Box key={g.gid} sx={{ py: 1, borderTop: `1px solid ${tokens.divider}`, fontSize: '0.825rem', lineHeight: 1.5 }}>
                <Box>
                  If <Box component="span" sx={{ fontWeight: 700, color: tokens.up }}>{better.team}</Box> wins, {firstName} {verb(better.rank)}{' '}
                  <Box component="span" sx={{ fontWeight: 700 }}>#{better.rank}</Box>.
                </Box>
                <Box sx={{ color: tokens.muted }}>
                  If <Box component="span" sx={{ fontWeight: 700, color: tokens.down }}>{worse.team}</Box> wins, {firstName} {verb(worse.rank)}{' '}
                  <Box component="span" sx={{ fontWeight: 700 }}>#{worse.rank}</Box>.
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 320px', xl: 'minmax(0, 1fr) 360px' },
        columnGap: { lg: 4, xl: 5 },
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
            <Button size="small" disabled={!picksMade && !startUser} onClick={() => chooseStartingBracket(null)}>
              Reset
            </Button>
          </Box>
        </Box>

        <Box
          sx={{
            position: 'relative',
            mb: 3,
            maxWidth: 820,
            '&::after': {
              content: '""',
              display: { xs: 'block', md: 'none' },
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: 32,
              borderRadius: '0 12px 12px 0',
              pointerEvents: 'none',
              background: `linear-gradient(to right, rgba(246, 247, 249, 0), ${tokens.surfaceAlt})`,
            },
          }}
        >
        <Box
          role="tablist"
          sx={{
            display: 'flex',
            p: 0.5,
            pr: { xs: 3, md: 0.5 },
            bgcolor: tokens.surfaceAlt,
            borderRadius: 3,
            overflowX: 'auto',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <ButtonBase
                key={t.key}
                role="tab"
                aria-selected={active}
                onClick={(e) => {
                  setTab(t.key);
                  e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }}
                sx={{
                  order: t.key === 'FULL' ? { xs: 1, md: 0 } : 0,
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
        </Box>

        <Box sx={{ display: { xs: 'block', lg: 'none' }, maxWidth: 420, mb: 3 }}>{startingSelector}</Box>

        <Typography component="h2" sx={{ fontSize: { xs: '1.5rem', md: '1.75rem' }, fontWeight: 800, letterSpacing: '-0.02em' }}>
          {tab === 'FULL' ? 'Full bracket' : tab === 'FINAL_FOUR' ? 'Final Four' : `${tabLabel} Region`}
        </Typography>
        <Typography sx={{ color: tokens.muted, mb: 3 }}>
          {tournamentOver
            ? 'Every game has been played. Green shows the actual winners.'
            : tab === 'FULL'
              ? 'Click a team to pick a winner, or open a region to work through it up close.'
              : 'Tap a team to pick a winner. See how it changes the standings.'}
        </Typography>

        {tab === 'FULL' ? (
          <FullBracket
            regions={[regionLayout('SOUTH'), regionLayout('WEST'), regionLayout('EAST'), regionLayout('MIDWEST')]}
            semis={['61', '62']}
            championshipId="63"
            onRegionSelect={(key) => setTab(key as RegionKey)}
            {...bracketProps}
          />
        ) : (
          <>
            {tab !== 'FINAL_FOUR' && (
              <Typography sx={{ display: { xs: 'block', sm: 'none' }, fontSize: '0.8rem', color: tokens.muted, mt: -2, mb: 1.5 }}>
                Swipe sideways for later rounds →
              </Typography>
            )}
            <RegionBracket columns={columns} championGameId={tab === 'FINAL_FOUR' ? '63' : undefined} {...bracketProps} />
          </>
        )}

        <Box sx={{ display: 'flex', gap: 2.5, mt: 2, color: tokens.muted, fontSize: '0.8rem', flexWrap: 'wrap' }}>
          {[
            { color: tokens.success, label: 'Actual result' },
            { color: tokens.primary, label: startRow ? `${firstName}’s pick or yours` : 'Your pick' },
          ].map((l) => (
            <Box key={l.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: l.color }} />
              {l.label}
            </Box>
          ))}
        </Box>

        {/* Leaves room for the fixed scenario bar on mobile */}
        <Box sx={{ display: { xs: 'block', lg: 'none' }, height: 72 }} />
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
        <Box sx={{ pb: 2, mb: 2, borderBottom: `1px solid ${tokens.border}` }}>
          {startingSelector}
          {startingPanel}
        </Box>
        <Box sx={{ pb: 2, mb: 2, borderBottom: `1px solid ${tokens.border}` }}>{summary}</Box>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', mb: 1.5 }}>Scenario standings</Typography>
        <ScenarioStandings rows={rows} hasPicks={picksMade > 0} highlight={startUser} />
      </Box>

      {/* Mobile scenario bar */}
      <ButtonBase
        onClick={() => setStandingsOpen(true)}
        sx={{
          display: { xs: 'flex', lg: 'none' },
          alignItems: 'center',
          gap: 1.5,
          position: 'fixed',
          left: 12,
          right: 12,
          bottom: { xs: `calc(${MOBILE_NAV_HEIGHT}px + env(safe-area-inset-bottom) + 8px)`, md: 16 },
          zIndex: (t) => t.zIndex.appBar - 1,
          bgcolor: tokens.ink,
          color: '#fff',
          borderRadius: 3,
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.18)',
          px: 2,
          py: 1.25,
          textAlign: 'left',
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
            {startRow ? (
              <>
                {firstName}: #{startRow.rank + startRow.rankChange} → #{startRow.rank}
                {rootFor.length > 0 && <Box component="span" sx={{ opacity: 0.6, ml: 0.75 }}>· Root for {rootFor[0].outcomes.reduce((a, b) => (a.rank <= b.rank ? a : b)).team}</Box>}
              </>
            ) : (
            <>
            {picksMade} {picksMade === 1 ? 'pick' : 'picks'}
            <Box component="span" sx={{ opacity: 0.6, mx: 0.75 }}>·</Box>
            {picksMade ? 'Projected leader' : 'Leader'}: {leader?.fullName ?? '—'}
            {tiedLeaders > 1 ? ` +${tiedLeaders - 1}` : ''}
            </>
            )}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#9cc0f5', whiteSpace: 'nowrap' }}>View standings ↑</Typography>
      </ButtonBase>

      <Drawer
        anchor="bottom"
        open={standingsOpen}
        onClose={() => setStandingsOpen(false)}
        PaperProps={{ sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '85vh', px: 2, pb: 'calc(16px + env(safe-area-inset-bottom))' } }}
      >
        <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: tokens.border, mx: 'auto', mt: 1.25, mb: 2 }} />
        {startingPanel && <Box sx={{ pb: 2, mb: 2, mt: -1.5, borderBottom: `1px solid ${tokens.border}` }}>{startingPanel}</Box>}
        <Box sx={{ pb: 2, mb: 2, borderBottom: `1px solid ${tokens.border}` }}>{summary}</Box>
        <Typography sx={{ fontWeight: 700, fontSize: '1.2rem', mb: 1.5 }}>Scenario standings</Typography>
        <ScenarioStandings rows={rows} hasPicks={picksMade > 0} highlight={startUser} />
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
