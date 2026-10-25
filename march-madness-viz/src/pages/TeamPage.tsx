import { useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { Box, CircularProgress, Link, MenuItem, Select, Typography } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useData } from '../context/DataContext';
import { useYearPath } from '../utils/yearRouting';
import { ROUND_LABELS, ROUND_ORDER, displayNames } from '../hooks/usePoolStandings';
import { getRoundNameFromGameId } from '../types';
import { SectionHeading } from '../components/ui/PageTitle';
import SegmentedControl from '../components/ui/SegmentedControl';
import Meter from '../components/ui/Meter';
import { tokens } from '../theme';

type Mode = 'pct' | 'count';

const CONFIDENCE_KEYS = ['round64', 'round32', 'sweet16', 'elite8', 'finalFour', 'championship'] as const;
const DEPTH_LABELS = ['Out in R64', 'Out in R32', 'Out in Sweet 16', 'Out in Elite 8', 'Out in Final Four', 'Lost title game', 'Champion'];
const NAMES_PREVIEW = 3;
const COMPARISON_COUNT = 5;

const fmtPct = (n: number) => `${n.toFixed(1)}%`;
const fmt = (n: number) => n.toLocaleString();

/* Step line: share of brackets that had the team winning each round. */
const StepChart = ({ values, labels, solidThrough, format }: { values: number[]; labels: string[]; solidThrough: number; format: (n: number) => string }) => {
  const W = 640;
  const H = 230;
  const pad = { l: 44, r: 28, t: 28, b: 30 };
  const max = Math.max(...values, 1);
  const yMax = format(1).endsWith('%') ? 100 : Math.ceil(max / 50) * 50 || 1;
  const x = (i: number) => pad.l + (i / (values.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / yMax) * (H - pad.t - pad.b);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * yMax);

  const segment = (i: number) => `M${x(i)},${y(values[i])} H${x(i + 1)} V${y(values[i + 1])}`;
  const area = `M${x(0)},${y(0)} ${values.map((v, i) => `L${x(i)},${y(v)} ${i < values.length - 1 ? `L${x(i + 1)},${y(v)}` : ''}`).join(' ')} L${x(values.length - 1)},${y(0)} Z`;

  return (
    <Box component="svg" viewBox={`0 0 ${W} ${H}`} sx={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={tokens.divider} />
          <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill={tokens.muted}>
            {format(t).replace('.0', '')}
          </text>
        </g>
      ))}
      <path d={area} fill={tokens.primary} opacity={0.08} />
      {values.slice(0, -1).map((_, i) => (
        <path
          key={i}
          d={segment(i)}
          fill="none"
          stroke={tokens.primary}
          strokeWidth={2.25}
          strokeDasharray={i + 1 > solidThrough ? '5 5' : undefined}
        />
      ))}
      {values.map((v, i) => (
        <g key={labels[i]}>
          <circle cx={x(i)} cy={y(v)} r={5} fill={i <= solidThrough ? tokens.primary : '#fff'} stroke={tokens.primary} strokeWidth={2} />
          <text x={x(i)} y={y(v) - 11} textAnchor="middle" fontSize="12" fontWeight={700} fill={tokens.ink}>
            {format(v)}
          </text>
          <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill={tokens.muted}>
            {labels[i]}
          </text>
        </g>
      ))}
    </Box>
  );
};

const TeamPage = () => {
  const { teamCode } = useParams();
  const navigate = useNavigate();
  const { yearPath } = useYearPath();
  const { teamConfidence, gameResults, bracketData, userNameMapping, loading, error } = useData();
  const [mode, setMode] = useState<Mode>('pct');
  const [expandedBucket, setExpandedBucket] = useState<number | null>(null);

  const seedByTeam = useMemo(() => {
    const m: Record<string, number> = {};
    gameResults.forEach((r) => {
      m[r.winner] = r.winnerSeed;
      m[r.loser] = r.loserSeed;
    });
    return m;
  }, [gameResults]);

  const teams = useMemo(
    () => teamConfidence.map((t) => t.team).sort((a, b) => (seedByTeam[a] ?? 99) - (seedByTeam[b] ?? 99) || a.localeCompare(b)),
    [teamConfidence, seedByTeam]
  );
  const team = teams.includes(teamCode ?? '') ? teamCode! : teams.includes('DUKE') ? 'DUKE' : teams[0] ?? '';
  const confidence = teamConfidence.find((t) => t.team === team);
  const totalBrackets = bracketData?.metadata.total_brackets ?? 0;

  const wins = useMemo(() => gameResults.filter((r) => r.winner === team).sort((a, b) => Number(a.gameId) - Number(b.gameId)), [gameResults, team]);
  const loss = gameResults.find((r) => r.loser === team);
  const champion = wins.some((w) => w.gameId === '63');
  const roundsPlayed = wins.length + (loss ? 1 : 0);

  const buckets = useMemo(() => {
    if (!bracketData) return [] as string[][];
    const depthOf = (gameId: string) => ROUND_ORDER.indexOf(getRoundNameFromGameId(gameId) as (typeof ROUND_ORDER)[number]) + 1;
    const depth = new Map<string, number>();
    Object.entries(bracketData.games).forEach(([gameId, game]) => {
      Object.entries(game.picks).forEach(([u, pick]) => {
        if (!depth.has(u)) depth.set(u, 0);
        if (pick === team) depth.set(u, Math.max(depth.get(u)!, depthOf(gameId)));
      });
    });
    const out: string[][] = DEPTH_LABELS.map(() => []);
    depth.forEach((d, u) => out[d].push(u));
    return out.map((users) =>
      users.sort((a, b) => displayNames(a, userNameMapping[a]).fullName.localeCompare(displayNames(b, userNameMapping[b]).fullName))
    );
  }, [bracketData, team, userNameMapping]);

  const comparison = useMemo(() => {
    const top = [...teamConfidence].sort((a, b) => b.championship - a.championship).slice(0, COMPARISON_COUNT);
    if (confidence && !top.some((t) => t.team === team)) top.push(confidence);
    return top;
  }, [teamConfidence, confidence, team]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 320 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error || !confidence) {
    return <Typography color="error" sx={{ py: 8, textAlign: 'center' }}>{error || 'No team data available'}</Typography>;
  }

  const seed = seedByTeam[team];
  const chartValues = CONFIDENCE_KEYS.map((k) => (mode === 'pct' ? confidence[k] : confidence[`${k}_count`]) ?? 0);
  const compareValue = (t: (typeof comparison)[number]) => (mode === 'pct' ? t.championship : t.championship_count);
  const compareMax = Math.max(...comparison.map(compareValue), 1);
  const isContender = comparison.findIndex((t) => t.team === team) < COMPARISON_COUNT;
  const showComparison = isContender || confidence.championship_count > 0;

  const status = (() => {
    if (champion) return { lead: 'National', accent: 'Champion' };
    if (loss) return { lead: 'Eliminated in', accent: ROUND_LABELS[getRoundNameFromGameId(loss.gameId) as keyof typeof ROUND_LABELS].long };
    if (wins.length) return { lead: 'Still alive ·', accent: `${wins.length} win${wins.length === 1 ? '' : 's'}` };
    return { lead: 'Not yet', accent: 'played' };
  })();

  return (
    <Box>
      {/* Title row */}
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 3, rowGap: 1.5, mb: { xs: 3, md: 4 } }}>
        <Typography component="h1" sx={{ fontSize: { xs: '2rem', md: '2.6rem' }, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.1 }}>
          Team analysis
        </Typography>
        <Select
          size="small"
          value={team}
          onChange={(e) => navigate(yearPath(`/teams/${e.target.value}`))}
          MenuProps={{ PaperProps: { sx: { maxHeight: 420 } } }}
          sx={{ minWidth: 200, fontWeight: 600, borderRadius: 2.5, '& .MuiSelect-select': { py: 1.1 } }}
        >
          {teams.map((t) => (
            <MenuItem key={t} value={t}>
              <Box component="span" sx={{ color: tokens.muted, width: 26, display: 'inline-block' }}>{seedByTeam[t] ?? ''}</Box>
              {t}
            </MenuItem>
          ))}
        </Select>
        {seed && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.75, borderRadius: 2.5, border: `1px solid ${tokens.border}`, bgcolor: tokens.surfaceAlt }}>
            <Typography sx={{ fontWeight: 800, color: tokens.primary }}>{seed}</Typography>
            <Typography sx={{ fontSize: '0.85rem', color: tokens.muted }}>Seed</Typography>
          </Box>
        )}
        <Box sx={{ ml: { md: 'auto' } }}>
          <SegmentedControl
            size="small"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'pct', label: 'Percentages' },
              { value: 'count', label: 'Counts' },
            ]}
          />
        </Box>
      </Box>

      {/* Status + confidence chart */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 5fr) minmax(0, 7fr)' }, columnGap: 5, rowGap: 4, pb: 4, borderBottom: `1px solid ${tokens.border}` }}>
        <Box sx={{ pr: { lg: 5 }, borderRight: { lg: `1px solid ${tokens.border}` } }}>
          <Typography sx={{ fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.muted, mb: 0.5 }}>Team status</Typography>
          <Typography sx={{ fontSize: { xs: '2rem', md: '2.4rem' }, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, mb: 4 }}>
            {status.lead} <Box component="span" sx={{ color: champion ? tokens.success : tokens.primary }}>{status.accent}</Box>
          </Typography>
          <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <Box sx={{ pr: 4, borderRight: { sm: `1px solid ${tokens.border}` } }}>
              <Typography sx={{ fontSize: '0.9rem', color: tokens.body }}>Championship pick rate</Typography>
              <Typography sx={{ fontSize: { xs: '2.6rem', md: '3.2rem' }, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                {fmtPct(confidence.championship)}
              </Typography>
              <Typography sx={{ fontSize: '0.85rem', color: tokens.muted }}>
                {fmt(confidence.championship_count)} of {fmt(totalBrackets)} brackets
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.9rem', color: tokens.body, mb: 0.5 }}>Win history</Typography>
              {wins.length === 0 ? (
                <Typography sx={{ fontSize: '0.875rem', color: tokens.muted }}>No wins yet</Typography>
              ) : (
                wins.map((w) => (
                  <Link
                    key={w.gameId}
                    component={RouterLink}
                    to={yearPath(`/games/${w.gameId}`)}
                    underline="none"
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      width: 'fit-content',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      py: 0.6,
                      pl: 1.25,
                      pr: 0.5,
                      mb: 0.75,
                      borderRadius: 2,
                      border: `1px solid ${tokens.border}`,
                      transition: 'border-color 120ms, background-color 120ms',
                      '&:hover': { borderColor: tokens.primary, bgcolor: tokens.primarySoft },
                    }}
                  >
                    {ROUND_LABELS[getRoundNameFromGameId(w.gameId) as keyof typeof ROUND_LABELS].long}
                    <Box component="span" sx={{ color: tokens.muted, fontWeight: 400, ml: 1 }}>
                      def. {w.loserSeed} {w.loser}
                    </Box>
                    <ChevronRightIcon sx={{ fontSize: 18 }} />
                  </Link>
                ))
              )}
            </Box>
          </Box>
        </Box>

        <Box>
          <SectionHeading>Team confidence by round</SectionHeading>
          <Typography sx={{ fontSize: '0.8rem', color: tokens.muted, mt: -1.5, mb: 1 }}>
            Brackets that picked {team} to win a game in each round. Dashed is past where {team} actually got to.
          </Typography>
          <StepChart
            values={chartValues}
            labels={ROUND_ORDER.map((r) => ROUND_LABELS[r].short)}
            solidThrough={champion ? 5 : roundsPlayed - 1}
            format={mode === 'pct' ? fmtPct : (n) => fmt(Math.round(n))}
          />
        </Box>
      </Box>

      {/* Contenders lead with the championship comparison; long shots lead with how far brackets took them. */}
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {showComparison && (
      <Box
        sx={{
          py: 4,
          order: isContender ? 0 : 1,
          borderTop: isContender ? 'none' : `1px solid ${tokens.border}`,
          borderBottom: isContender ? `1px solid ${tokens.border}` : 'none',
        }}
      >
        <SectionHeading
          action={
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 2, fontSize: '0.8rem', color: tokens.muted }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: tokens.primary }} /> {team}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#b6bfcc' }} /> Other top teams
              </Box>
            </Box>
          }
        >
          Championship picks: top teams
        </SectionHeading>
        <Box sx={{ display: 'grid', gridTemplateColumns: '110px 1fr 64px', alignItems: 'center', columnGap: 2, rowGap: 1.5 }}>
          {comparison.map((t) => {
            const selected = t.team === team;
            const v = compareValue(t);
            return (
              <Box key={t.team} sx={{ display: 'contents' }}>
                <Link component={RouterLink} to={yearPath(`/teams/${t.team}`)} underline="hover" color="inherit" sx={{ fontWeight: selected ? 700 : 500, fontSize: '0.9rem' }}>
                  {t.team}
                  <Box component="span" sx={{ color: tokens.muted, fontWeight: 400, ml: 1 }}>({seedByTeam[t.team] ?? '–'})</Box>
                </Link>
                <Box sx={{ pr: 1 }}>
                  <Meter value={(v / compareMax) * 85} color={selected ? tokens.primary : '#b6bfcc'} height={8} dot />
                </Box>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: selected ? 700 : 500, textAlign: 'right' }}>
                  {mode === 'pct' ? fmtPct(v) : fmt(v)}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>
      )}

      <Box sx={{ pt: 4, pb: isContender ? 0 : 4, order: isContender ? 1 : 0 }}>
        <SectionHeading>Where brackets took {team}</SectionHeading>
        <Typography sx={{ fontSize: '0.8rem', color: tokens.muted, mt: -1.5, mb: 2.5 }}>
          Every bracket, grouped by the furthest round it had {team} going.
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))', lg: 'repeat(7, minmax(0, 1fr))' },
            rowGap: 3,
          }}
        >
          {buckets.map((users, depth) => {
            const expanded = expandedBucket === depth;
            const shown = expanded ? users : users.slice(0, NAMES_PREVIEW);
            return (
              <Box key={DEPTH_LABELS[depth]} sx={{ px: 2, borderLeft: `1px solid ${tokens.border}`, minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.8rem', color: tokens.body, mb: 0.5, whiteSpace: 'nowrap' }}>{DEPTH_LABELS[depth]}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
                  <Typography sx={{ fontSize: '1.5rem', fontWeight: 800 }}>
                    {mode === 'pct' ? fmtPct(totalBrackets ? (users.length / totalBrackets) * 100 : 0) : fmt(users.length)}
                  </Typography>
                  <Typography sx={{ fontSize: '0.8rem', color: tokens.muted }}>
                    {mode === 'pct' ? `${fmt(users.length)} brackets` : totalBrackets ? fmtPct((users.length / totalBrackets) * 100) : ''}
                  </Typography>
                </Box>
                <Box sx={{ maxHeight: expanded ? 320 : 'none', overflowY: expanded ? 'auto' : 'visible' }}>
                  {shown.map((u) => (
                    <Link
                      key={u}
                      component={RouterLink}
                      to={yearPath(`/users/${encodeURIComponent(u)}`)}
                      underline="hover"
                      noWrap
                      sx={{ display: 'block', fontSize: '0.825rem', lineHeight: 1.7 }}
                    >
                      {displayNames(u, userNameMapping[u]).fullName}
                    </Link>
                  ))}
                </Box>
                {users.length > NAMES_PREVIEW && (
                  <Link
                    component="button"
                    onClick={() => setExpandedBucket(expanded ? null : depth)}
                    sx={{ fontSize: '0.8rem', mt: 0.5, color: tokens.muted }}
                  >
                    {expanded ? 'Show less' : `+ ${fmt(users.length - NAMES_PREVIEW)} more`}
                  </Link>
                )}
              </Box>
            );
          })}
        </Box>
      </Box>
      </Box>
    </Box>
  );
};

export default TeamPage;
