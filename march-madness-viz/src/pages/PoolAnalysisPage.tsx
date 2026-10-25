import { useMemo, useState, ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Autocomplete,
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  Collapse,
  InputAdornment,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useData } from '../context/DataContext';
import { useYearPath } from '../utils/yearRouting';
import { getRoundNameFromGameId } from '../types';
import { RoundKey, Standing, usePoolStandings } from '../hooks/usePoolStandings';
import { computeStrategyMetrics, StrategyMetrics } from '../utils/pickStrategy';
import PageTitle from '../components/ui/PageTitle';
import SegmentedControl from '../components/ui/SegmentedControl';
import InitialsAvatar from '../components/ui/InitialsAvatar';
import { tokens } from '../theme';

type TabKey = 'strategy' | 'similarity';
type Metric = 'chalk' | 'herding' | 'contrarian';

const PAGE_SIZE = 25;
const SPECTRUM_STEPS = 12;
const ROUND_WEIGHTS: Record<RoundKey, number> = {
  ROUND_64: 10,
  ROUND_32: 20,
  SWEET_16: 40,
  ELITE_8: 80,
  FINAL_FOUR: 160,
  CHAMPIONSHIP: 320,
};

const METRICS: Record<
  Metric,
  {
    label: string;
    title: string;
    tableTitle: string;
    column: string;
    definition: string;
    low: [string, string];
    high: [string, string];
    method: string;
    value: (m: StrategyMetrics) => number;
    format: (n: number) => string;
  }
> = {
  chalk: {
    label: 'Chalk',
    title: 'Chalk score',
    tableTitle: 'Most chalky brackets',
    column: 'Chalk score',
    definition:
      'Measures how often a bracket picks the higher-seeded team (favorites). Higher scores indicate a more chalky bracket with fewer upsets.',
    low: ['More upsets', '(less chalk)'],
    high: ['More favorites', '(more chalk)'],
    method:
      'For every game, we find the best-seeded team anyone in the pool picked. A bracket’s chalk score is the share of its 63 picks that match that team.',
    value: (m) => m.chalk,
    format: (n) => `${n.toFixed(1)}%`,
  },
  herding: {
    label: 'Herding',
    title: 'Herding score',
    tableTitle: 'Most herding brackets',
    column: 'Herding score',
    definition:
      'Measures how often a bracket goes with the pool’s most popular pick. Higher scores mean a bracket that follows the crowd.',
    low: ['More independent', '(fewer crowd picks)'],
    high: ['Follows the crowd', '(more crowd picks)'],
    method:
      'For every game, we find the team the most brackets picked. A bracket’s herding score is the share of its 63 picks that match the pool favorite.',
    value: (m) => m.herding,
    format: (n) => `${n.toFixed(1)}%`,
  },
  contrarian: {
    label: 'Contrarian',
    title: 'Contrarian score',
    tableTitle: 'Most contrarian brackets',
    column: 'Contrarian score',
    definition:
      'Measures how far a bracket strays from the pool consensus, and how unpopular those off-consensus picks were. Higher scores mean bolder brackets.',
    low: ['With the pool', '(few lone picks)'],
    high: ['Against the pool', '(many lone picks)'],
    method:
      'Each pick that isn’t the pool favorite adds 1 − (brackets on that team ÷ brackets on the favorite). A lone-wolf pick adds nearly 1; a near-tie adds almost nothing.',
    value: (m) => m.deviation,
    format: (n) => n.toFixed(1),
  },
};

const fmt = (n: number) => n.toLocaleString();

const median = (values: number[]) => {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const headCellSx = { bgcolor: tokens.surfaceAlt, color: tokens.body, fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap' } as const;

const Disclosure = ({ label, children }: { label: string; children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  return (
    <Box sx={{ borderTop: `1px solid ${tokens.border}`, pt: 1.5 }}>
      <ButtonBase
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        sx={{ width: '100%', justifyContent: 'space-between', py: 0.5, fontSize: '0.875rem', color: tokens.body, borderRadius: 1 }}
      >
        {label}
        <ExpandMoreIcon sx={{ fontSize: 20, color: tokens.muted, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
      </ButtonBase>
      <Collapse in={open}>
        <Box sx={{ pt: 1, fontSize: '0.825rem', color: tokens.body, lineHeight: 1.6 }}>{children}</Box>
      </Collapse>
    </Box>
  );
};

const PersonCell = ({ s }: { s?: Standing }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
    <InitialsAvatar name={s?.fullName ?? '?'} seed={s?.username} size={28} />
    <Box sx={{ minWidth: 0 }}>
      <Typography noWrap sx={{ fontSize: '0.875rem', fontWeight: 500, color: tokens.ink }}>{s?.fullName}</Typography>
      <Typography noWrap sx={{ display: { md: 'none' }, fontSize: '0.75rem', color: tokens.muted }}>{s?.bracketName}</Typography>
    </Box>
  </Box>
);

const RowChevron = () => (
  <TableCell sx={{ width: 28, px: 0, lineHeight: 0 }}>
    <ChevronRightIcon className="row-chevron" sx={{ fontSize: 18, color: tokens.subtle }} />
  </TableCell>
);

const clickableRowSx = { cursor: 'pointer', '&:hover .row-chevron': { color: tokens.primary } } as const;

/* Tables on desktop, flat rows on phones so no value sits off-screen. */
const desktopOnly = { display: { xs: 'none', md: 'block' } } as const;
const mobileOnly = { display: { xs: 'block', md: 'none' } } as const;
const resultsPanelSx = {
  border: { md: `1px solid ${tokens.border}` },
  borderRadius: { md: 3 },
  overflow: 'hidden',
  minWidth: 0,
} as const;

const MobileRow = ({ position, s, value, detail, onClick }: { position: number; s?: Standing; value: string; detail?: string; onClick: () => void }) => (
  <ButtonBase
    onClick={onClick}
    sx={{ display: 'grid', gridTemplateColumns: '28px 32px minmax(0, 1fr) auto', alignItems: 'center', columnGap: 1.25, width: '100%', textAlign: 'left', py: 1.25, borderBottom: `1px solid ${tokens.divider}` }}
  >
    <Typography sx={{ fontSize: '0.875rem', color: tokens.body, textAlign: 'center' }}>{position}</Typography>
    <InitialsAvatar name={s?.fullName ?? '?'} seed={s?.username} size={32} />
    <Box sx={{ minWidth: 0 }}>
      <Typography noWrap sx={{ fontSize: '0.9rem', fontWeight: 600 }}>{s?.fullName}</Typography>
      <Typography noWrap sx={{ fontSize: '0.75rem', color: tokens.muted }}>{detail ?? s?.bracketName}</Typography>
    </Box>
    <Box sx={{ px: 1, py: 0.4, borderRadius: 1.5, bgcolor: tokens.primarySoft, color: tokens.primaryDark, fontWeight: 700, fontSize: '0.85rem' }}>{value}</Box>
  </ButtonBase>
);

const PoolAnalysisPage = () => {
  const { bracketData, gameResults, loading, error } = useData();
  const { standings } = usePoolStandings(1);
  const { yearPath } = useYearPath();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const tab: TabKey = params.get('tab') === 'similarity' || params.get('user') ? 'similarity' : 'strategy';
  const metric: Metric = (['chalk', 'herding', 'contrarian'] as const).find((m) => m === params.get('metric')) ?? 'chalk';
  const selectedUser = params.get('user') ?? '';

  const updateParams = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    Object.entries(next).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    setParams(p, { replace: true });
  };

  const standingByUser = useMemo(() => new Map(standings.map((s) => [s.username, s])), [standings]);
  const openProfile = (u: string) => navigate(yearPath(`/users/${encodeURIComponent(u)}`));

  /* ---------- Pick strategy ---------- */
  const strategy = useMemo(() => (bracketData ? computeStrategyMetrics(bracketData, gameResults) : new Map<string, StrategyMetrics>()), [bracketData, gameResults]);
  const [strategySearch, setStrategySearch] = useState('');
  const [strategyAsc, setStrategyAsc] = useState(false);
  const [strategyLimit, setStrategyLimit] = useState(PAGE_SIZE);

  const def = METRICS[metric];
  const ranked = useMemo(() => {
    const rows = [...strategy.entries()].map(([username, m]) => ({ username, value: def.value(m), standing: standingByUser.get(username) }));
    rows.sort((a, b) => b.value - a.value);
    return rows.map((r, i) => ({ ...r, position: i + 1 }));
  }, [strategy, def, standingByUser]);
  const values = ranked.map((r) => r.value);
  const poolMedian = median(values);
  const scaleMax = metric === 'contrarian' ? Math.max(1, ...values) : 100;

  const strategyRows = useMemo(() => {
    const q = strategySearch.trim().toLowerCase();
    const rows = q
      ? ranked.filter((r) => [r.username, r.standing?.fullName, r.standing?.bracketName].some((v) => v?.toLowerCase().includes(q)))
      : ranked;
    return strategyAsc ? [...rows].reverse() : rows;
  }, [ranked, strategySearch, strategyAsc]);

  const setMetric = (m: Metric) => {
    updateParams({ metric: m === 'chalk' ? null : m });
    setStrategyLimit(PAGE_SIZE);
    setStrategyAsc(false);
  };

  /* ---------- Bracket similarity ---------- */
  const weightedPicks = useMemo(() => {
    const byUser = new Map<string, Map<string, number>>();
    if (!bracketData) return byUser;
    Object.entries(bracketData.games).forEach(([gameId, game]) => {
      const w = ROUND_WEIGHTS[getRoundNameFromGameId(gameId) as RoundKey];
      Object.entries(game.picks).forEach(([u, p]) => {
        if (!byUser.has(u)) byUser.set(u, new Map());
        byUser.get(u)!.set(`${gameId}:${p}`, w);
      });
    });
    return byUser;
  }, [bracketData]);

  type SimKey = 'weighted' | 'regular' | 'shared' | 'score';
  const [simSort, setSimSort] = useState<{ key: SimKey; asc: boolean }>({ key: 'weighted', asc: false });
  const [simLimit, setSimLimit] = useState(PAGE_SIZE);

  const similarities = useMemo(() => {
    const mine = weightedPicks.get(selectedUser);
    if (!mine) return [];
    const rows: Array<{ username: string; weighted: number; regular: number; shared: number; score: number; standing?: Standing }> = [];
    weightedPicks.forEach((theirs, u) => {
      if (u === selectedUser) return;
      let inter = 0;
      let interCount = 0;
      let union = 0;
      new Set([...mine.keys(), ...theirs.keys()]).forEach((k) => {
        const a = mine.get(k) ?? 0;
        const b = theirs.get(k) ?? 0;
        if (a && b) {
          inter += Math.min(a, b);
          interCount += 1;
        }
        union += Math.max(a, b);
      });
      const unionCount = mine.size + theirs.size - interCount;
      const standing = standingByUser.get(u);
      rows.push({
        username: u,
        weighted: union ? inter / union : 0,
        regular: unionCount ? interCount / unionCount : 0,
        shared: inter,
        score: standing?.score ?? 0,
        standing,
      });
    });
    return rows;
  }, [weightedPicks, selectedUser, standingByUser]);

  const sortedSimilarities = useMemo(() => {
    const dir = simSort.asc ? 1 : -1;
    return [...similarities].sort((a, b) => (a[simSort.key] - b[simSort.key]) * dir || b.weighted - a.weighted);
  }, [similarities, simSort]);

  const toggleSimSort = (key: SimKey) => setSimSort((s) => (s.key === key ? { key, asc: !s.asc } : { key, asc: false }));

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

  const selected = standingByUser.get(selectedUser) ?? null;
  const markerPct = Math.min(100, (poolMedian / scaleMax) * 100);
  return (
    <Box>
      <PageTitle subtitle="Explore how your pool is picking, and find similar brackets.">Pool analysis</PageTitle>

      <Tabs
        value={tab}
        onChange={(_, v: TabKey) => updateParams({ tab: v === 'strategy' ? null : v, user: v === 'strategy' ? null : selectedUser || null })}
        sx={{ borderBottom: `1px solid ${tokens.border}`, mb: 3, minHeight: 44, '& .MuiTab-root': { minHeight: 44, px: 0, mr: 4, fontWeight: 600, fontSize: '0.95rem' } }}
      >
        <Tab value="strategy" label="Pick strategy" />
        <Tab value="similarity" label="Bracket similarity" />
      </Tabs>

      {tab === 'strategy' ? (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '300px minmax(0, 1fr)', lg: '340px minmax(0, 1fr)' }, gap: 3, alignItems: 'start' }}>
            {/* Explainer */}
            <Box sx={{ border: `1px solid ${tokens.border}`, borderRadius: 3, p: 2.5, position: { md: 'sticky' }, top: { md: 88 } }}>
              <SegmentedControl
                fullWidth
                value={metric}
                onChange={setMetric}
                options={(Object.keys(METRICS) as Metric[]).map((m) => ({ value: m, label: METRICS[m].label }))}
              />
              <Typography component="h2" sx={{ fontSize: '1.3rem', fontWeight: 700, letterSpacing: '-0.01em', mt: 3, mb: 1 }}>
                {def.title}
              </Typography>
              <Typography sx={{ fontSize: '0.9rem', color: tokens.body, lineHeight: 1.6 }}>{def.definition}</Typography>

              <Box sx={{ mt: 3, mb: 3 }}>
                <Box sx={{ position: 'relative' }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${SPECTRUM_STEPS}, 1fr)`, gap: '2px', height: 14, borderRadius: 1, overflow: 'hidden' }}>
                    {Array.from({ length: SPECTRUM_STEPS }, (_, i) => (
                      <Box key={i} sx={{ bgcolor: tokens.primary, opacity: 0.12 + (i / (SPECTRUM_STEPS - 1)) * 0.88 }} />
                    ))}
                  </Box>
                  <Box sx={{ position: 'absolute', top: -4, bottom: -6, left: `${markerPct}%`, width: 2, ml: '-1px', bgcolor: tokens.ink, borderRadius: 1 }} />
                </Box>
                <Box sx={{ position: 'relative', height: 18, mt: 0.5 }}>
                  <Typography
                    sx={{ position: 'absolute', left: `${Math.min(78, Math.max(22, markerPct))}%`, transform: 'translateX(-50%)', fontSize: '0.75rem', color: tokens.ink, fontWeight: 600, whiteSpace: 'nowrap' }}
                  >
                    Pool median {def.format(poolMedian)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5, fontSize: '0.8rem' }}>
                  <Box>
                    <Box sx={{ color: tokens.body }}>{def.low[0]}</Box>
                    <Box sx={{ color: tokens.muted }}>{def.low[1]}</Box>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Box sx={{ color: tokens.body }}>{def.high[0]}</Box>
                    <Box sx={{ color: tokens.muted }}>{def.high[1]}</Box>
                  </Box>
                </Box>
              </Box>

              <Disclosure label="How scores are calculated">{def.method}</Disclosure>
            </Box>

            {/* Ranking table */}
            <Box sx={resultsPanelSx}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: { xs: 1.5, md: 2 }, px: { xs: 0, md: 2.5 }, py: 2 }}>
                <Typography component="h2" sx={{ fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-0.01em' }}>{def.tableTitle}</Typography>
                <TextField
                  size="small"
                  placeholder="Search people or brackets…"
                  value={strategySearch}
                  onChange={(e) => {
                    setStrategySearch(e.target.value);
                    setStrategyLimit(PAGE_SIZE);
                  }}
                  sx={{ width: { xs: '100%', sm: 260 } }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: tokens.muted }} /></InputAdornment> }}
                />
              </Box>
              <Box sx={{ ...mobileOnly, borderTop: `1px solid ${tokens.border}` }}>
                {strategyRows.slice(0, strategyLimit).map((r) => (
                  <MobileRow
                    key={r.username}
                    position={r.position}
                    s={r.standing}
                    value={def.format(r.value)}
                    detail={`${r.standing?.bracketName ?? ''} · #${r.standing?.rank ?? '–'} in pool`}
                    onClick={() => openProfile(r.username)}
                  />
                ))}
                {strategyRows.length === 0 && <Typography sx={{ py: 4, textAlign: 'center', color: tokens.muted }}>No brackets match “{strategySearch}”.</Typography>}
              </Box>
              <TableContainer sx={{ ...desktopOnly, maxHeight: 720 }}>
                <Table size="small" stickyHeader sx={{ '& td': { py: 1.1 } }}>
                  <TableHead>
                    <TableRow sx={{ '& th': headCellSx }}>
                      <TableCell sx={{ width: 64, pl: 2.5 }}>Rank</TableCell>
                      <TableCell>Person</TableCell>
                      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Bracket name</TableCell>
                      <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Pool rank</TableCell>
                      <TableCell align="right">
                        <TableSortLabel active direction={strategyAsc ? 'asc' : 'desc'} onClick={() => setStrategyAsc((a) => !a)}>
                          {def.column}
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ width: 28, px: 0 }} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {strategyRows.slice(0, strategyLimit).map((r) => (
                      <TableRow key={r.username} hover onClick={() => openProfile(r.username)} sx={clickableRowSx}>
                        <TableCell sx={{ pl: 2.5, color: tokens.body }}>{r.position}</TableCell>
                        <TableCell sx={{ maxWidth: 240 }}>
                          <PersonCell s={r.standing} />
                        </TableCell>
                        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, color: tokens.body, maxWidth: 240 }}>
                          <Typography noWrap sx={{ fontSize: '0.875rem' }}>{r.standing?.bracketName}</Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' }, color: tokens.muted }}>
                          #{r.standing?.rank ?? '–'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{def.format(r.value)}</TableCell>
                        <RowChevron />
                      </TableRow>
                    ))}
                    {strategyRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} sx={{ py: 4, textAlign: 'center', color: tokens.muted }}>No brackets match “{strategySearch}”.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              {strategyRows.length > strategyLimit && (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: { xs: 0, md: 2.5 }, py: 1.5, borderTop: { md: `1px solid ${tokens.border}` } }}>
                  <Typography sx={{ fontSize: '0.8rem', color: tokens.muted }}>
                    Showing {fmt(strategyLimit)} of {fmt(strategyRows.length)}
                  </Typography>
                  <Button size="small" onClick={() => setStrategyLimit((n) => n + PAGE_SIZE * 2)}>Show more</Button>
                </Box>
              )}
            </Box>
          </Box>

        </>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '280px minmax(0, 1fr)', lg: '300px minmax(0, 1fr)' }, gap: 3, alignItems: 'start' }}>
          <Box sx={{ border: `1px solid ${tokens.border}`, borderRadius: 3, p: 2.5, position: { md: 'sticky' }, top: { md: 88 } }}>
            <Typography sx={{ fontWeight: 700, mb: 1.25 }}>Compare bracket</Typography>
            <Autocomplete
              options={standings}
              value={selected}
              onChange={(_, v) => {
                updateParams({ tab: 'similarity', user: v?.username ?? null });
                setSimLimit(PAGE_SIZE);
              }}
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
              renderInput={(p) => <TextField {...p} size="small" placeholder="Search people or brackets…" />}
            />
            {selected && (
              <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                <Box>
                  <Typography sx={{ fontSize: '1.2rem', fontWeight: 700 }}>#{selected.rank}</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: tokens.muted }}>Pool rank</Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '1.2rem', fontWeight: 700 }}>{fmt(selected.score)}</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: tokens.muted }}>Score</Typography>
                </Box>
              </Box>
            )}
            <Box sx={{ mt: 2.5 }}>
              <Disclosure label="How similarity works">
                <Box component="dl" sx={{ m: 0, '& dt': { fontWeight: 600, color: tokens.ink }, '& dd': { m: 0, mb: 1 } }}>
                  <dt>Weighted</dt>
                  <dd>Overlap of picks, with each pick weighted by its round’s points (10 → 320). Late-round agreement counts most.</dd>
                  <dt>Regular</dt>
                  <dd>Share of picks in common, every game counted equally (Jaccard index).</dd>
                  <dt>Shared possible points</dt>
                  <dd>Total point value of the picks both brackets made the same, whether or not those picks turned out right.</dd>
                </Box>
              </Disclosure>
            </Box>
          </Box>

          <Box sx={resultsPanelSx}>
            <Box sx={{ px: { xs: 0, md: 2.5 }, py: 2 }}>
              <Typography component="h2" sx={{ fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
                {selected ? `Brackets most similar to ${selected.fullName}` : 'Similar brackets'}
              </Typography>
            </Box>
            {!selected ? (
              <Typography sx={{ px: 2.5, pb: 4, color: tokens.muted }}>Pick a bracket on the left to see who picked most like it.</Typography>
            ) : (
              <>
                <Box sx={{ ...mobileOnly, borderTop: `1px solid ${tokens.border}` }}>
                  {sortedSimilarities.slice(0, simLimit).map((r, i) => (
                    <MobileRow
                      key={r.username}
                      position={i + 1}
                      s={r.standing}
                      value={`${(r.weighted * 100).toFixed(1)}%`}
                      detail={`Regular ${(r.regular * 100).toFixed(0)}% · ${fmt(r.shared)} shared possible pts · ${fmt(r.score)} score`}
                      onClick={() => openProfile(r.username)}
                    />
                  ))}
                </Box>
                <TableContainer sx={{ ...desktopOnly, maxHeight: 720 }}>
                  <Table size="small" stickyHeader sx={{ '& td': { py: 1.1 } }}>
                    <TableHead>
                      <TableRow sx={{ '& th': headCellSx }}>
                        <TableCell sx={{ width: 52, pl: 2.5 }}>#</TableCell>
                        <TableCell>Person</TableCell>
                        <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>Bracket name</TableCell>
                        {(
                          [
                            ['weighted', 'Weighted'],
                            ['regular', 'Regular'],
                            ['shared', 'Shared possible points'],
                            ['score', 'Score'],
                          ] as Array<[SimKey, string]>
                        ).map(([key, label]) => (
                          <TableCell key={key} align="right" sx={key === 'regular' || key === 'score' ? { display: { xs: 'none', sm: 'table-cell' } } : undefined}>
                            <TableSortLabel active={simSort.key === key} direction={simSort.key === key && simSort.asc ? 'asc' : 'desc'} onClick={() => toggleSimSort(key)}>
                              {label}
                            </TableSortLabel>
                          </TableCell>
                        ))}
                        <TableCell sx={{ width: 28, px: 0 }} />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sortedSimilarities.slice(0, simLimit).map((r, i) => (
                        <TableRow key={r.username} hover onClick={() => openProfile(r.username)} sx={clickableRowSx}>
                          <TableCell sx={{ pl: 2.5, color: tokens.body }}>{i + 1}</TableCell>
                          <TableCell sx={{ maxWidth: 220 }}>
                            <PersonCell s={r.standing} />
                          </TableCell>
                          <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' }, color: tokens.body, maxWidth: 200 }}>
                            <Typography noWrap sx={{ fontSize: '0.875rem' }}>{r.standing?.bracketName}</Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>{(r.weighted * 100).toFixed(1)}%</TableCell>
                          <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' }, color: tokens.body }}>{(r.regular * 100).toFixed(1)}%</TableCell>
                          <TableCell align="right" sx={{ color: tokens.body }}>{fmt(r.shared)}</TableCell>
                          <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' }, color: tokens.body }}>{fmt(r.score)}</TableCell>
                          <RowChevron />
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                {sortedSimilarities.length > simLimit && (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: { xs: 0, md: 2.5 }, py: 1.5, borderTop: { md: `1px solid ${tokens.border}` } }}>
                    <Typography sx={{ fontSize: '0.8rem', color: tokens.muted }}>
                      Showing {fmt(simLimit)} of {fmt(sortedSimilarities.length)}
                    </Typography>
                    <Button size="small" onClick={() => setSimLimit((n) => n + PAGE_SIZE * 2)}>Show more</Button>
                  </Box>
                )}
              </>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default PoolAnalysisPage;
