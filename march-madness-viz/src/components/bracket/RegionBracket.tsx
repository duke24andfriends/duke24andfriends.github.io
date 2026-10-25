import { Box, ButtonBase, Typography, useMediaQuery, useTheme } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { tokens } from '../../theme';

export interface BracketColumn {
  label: string;
  date: string;
  points: string;
  gameIds: string[];
}

interface RegionBracketProps {
  columns: BracketColumn[];
  getTeams: (gameId: string) => string[];
  getSeed: (team: string) => number | undefined;
  getActualWinner: (gameId: string) => string;
  getPredictedWinner: (gameId: string) => string;
  onPick: (gameId: string, team: string) => void;
  /** Renders a single "Champion" slot after the last column. */
  championGameId?: string;
}

const SLOT_H = 36;
const SLOT_GAP = 4;
const GAME_H = SLOT_H * 2 + SLOT_GAP;
const UNIT = GAME_H + 18;
const COL_W_DESKTOP = 172;
const COL_W_MOBILE = 150;
const COL_GAP_DESKTOP = 28;
const COL_GAP_MOBILE = 20;
const HEADER_H = 48;

type SlotState = 'actual' | 'picked' | 'eliminated' | 'open' | 'tbd' | 'locked';

const Slot = ({
  team,
  seed,
  state,
  onClick,
}: {
  team: string;
  seed?: number;
  state: SlotState;
  onClick?: () => void;
}) => {
  if (state === 'tbd') {
    return (
      <Box
        sx={{
          height: SLOT_H,
          borderRadius: 1.5,
          border: `1.5px dashed ${tokens.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: tokens.subtle,
          fontSize: '0.8rem',
        }}
      >
        TBD
      </Box>
    );
  }

  const filled = state === 'actual' || state === 'picked';
  const bg = state === 'actual' ? tokens.success : state === 'picked' ? tokens.primary : tokens.surfaceAlt;

  return (
    <ButtonBase
      disabled={!onClick}
      onClick={onClick}
      sx={{
        width: '100%',
        height: SLOT_H,
        borderRadius: 1.5,
        px: 1.25,
        justifyContent: 'flex-start',
        gap: 1.25,
        bgcolor: bg,
        color: filled ? '#fff' : state === 'eliminated' ? tokens.subtle : tokens.ink,
        border: `1px solid ${filled ? bg : tokens.border}`,
        fontSize: '0.875rem',
        fontWeight: filled ? 600 : 500,
        textDecoration: state === 'eliminated' ? 'line-through' : 'none',
        transition: 'background-color 120ms, border-color 120ms',
        '&:hover': onClick && !filled ? { borderColor: tokens.primary, bgcolor: tokens.primarySoft } : undefined,
        '&.Mui-disabled': { color: filled ? '#fff' : state === 'eliminated' ? tokens.subtle : tokens.ink },
      }}
    >
      <Box component="span" sx={{ width: 16, textAlign: 'right', fontSize: '0.75rem', opacity: filled ? 0.85 : 0.6, flexShrink: 0 }}>
        {seed ?? ''}
      </Box>
      <Box component="span" sx={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {team}
      </Box>
      {filled && <CheckCircleIcon sx={{ fontSize: 18, flexShrink: 0 }} />}
    </ButtonBase>
  );
};

const RegionBracket = ({
  columns,
  getTeams,
  getSeed,
  getActualWinner,
  getPredictedWinner,
  onPick,
  championGameId,
}: RegionBracketProps) => {
  const isMobile = useMediaQuery(useTheme().breakpoints.down('sm'));
  const COL_W = isMobile ? COL_W_MOBILE : COL_W_DESKTOP;
  const COL_GAP = isMobile ? COL_GAP_MOBILE : COL_GAP_DESKTOP;
  const firstCount = columns[0]?.gameIds.length ?? 1;
  const unit = firstCount === 1 ? UNIT * 2 : UNIT;
  const bodyH = firstCount * unit;
  const totalCols = columns.length + (championGameId ? 1 : 0);
  const width = totalCols * COL_W + (totalCols - 1) * COL_GAP;

  const centerY = (round: number, index: number) => unit * 2 ** round * (index + 0.5);
  const colX = (round: number) => round * (COL_W + COL_GAP);

  const connectors: string[] = [];
  columns.forEach((col, r) => {
    if (r === columns.length - 1) return;
    col.gameIds.forEach((_, i) => {
      const x1 = colX(r) + COL_W;
      const y1 = centerY(r, i);
      const x2 = colX(r + 1);
      const y2 = centerY(r + 1, Math.floor(i / 2));
      const mid = x1 + COL_GAP / 2;
      connectors.push(`M${x1},${y1} H${mid} V${y2} H${x2}`);
    });
  });
  if (championGameId) {
    const r = columns.length - 1;
    const y = centerY(r, 0);
    connectors.push(`M${colX(r) + COL_W},${y} H${colX(r + 1)}`);
  }

  const championTeam = championGameId
    ? getActualWinner(championGameId) || getPredictedWinner(championGameId)
    : '';

  return (
    <Box sx={{ overflowX: 'auto', mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 0 }, pb: 1 }}>
      <Box sx={{ position: 'relative', width, minWidth: width }}>
        <Box sx={{ display: 'flex', gap: `${COL_GAP}px`, height: HEADER_H }}>
          {columns.map((col) => (
            <Box key={col.label} sx={{ width: COL_W, flexShrink: 0 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>{col.label}</Typography>
              <Typography sx={{ color: tokens.muted, fontSize: '0.8rem' }}>
                {col.date} · {col.points}
              </Typography>
            </Box>
          ))}
          {championGameId && (
            <Box sx={{ width: COL_W, flexShrink: 0 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>Champion</Typography>
            </Box>
          )}
        </Box>

        <Box sx={{ position: 'relative', height: bodyH }}>
          <svg width={width} height={bodyH} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden>
            {connectors.map((d, i) => (
              <path key={i} d={d} fill="none" stroke="#cbd2db" strokeWidth={1.25} />
            ))}
          </svg>

          {columns.map((col, r) =>
            col.gameIds.map((gameId, i) => {
              const teams = getTeams(gameId);
              const actual = getActualWinner(gameId);
              const predicted = getPredictedWinner(gameId);
              const slots = teams.length ? teams : ['TBD', 'TBD'];
              return (
                <Box
                  key={gameId}
                  sx={{
                    position: 'absolute',
                    left: colX(r),
                    top: centerY(r, i) - GAME_H / 2,
                    width: COL_W,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: `${SLOT_GAP}px`,
                  }}
                >
                  {slots.map((team, idx) => {
                    if (team === 'TBD') return <Slot key={`tbd-${idx}`} team="TBD" state="tbd" />;
                    const state: SlotState = actual
                      ? actual === team
                        ? 'actual'
                        : 'eliminated'
                      : predicted === team
                        ? 'picked'
                        : 'open';
                    return (
                      <Slot
                        key={team}
                        team={team}
                        seed={getSeed(team)}
                        state={state}
                        onClick={actual ? undefined : () => onPick(gameId, predicted === team ? '' : team)}
                      />
                    );
                  })}
                </Box>
              );
            })
          )}

          {championGameId && (
            <Box
              sx={{
                position: 'absolute',
                left: colX(columns.length),
                top: centerY(columns.length - 1, 0) - SLOT_H / 2,
                width: COL_W,
              }}
            >
              {championTeam ? (
                <Slot
                  team={championTeam}
                  seed={getSeed(championTeam)}
                  state={getActualWinner(championGameId) ? 'actual' : 'picked'}
                />
              ) : (
                <Slot team="TBD" state="tbd" />
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default RegionBracket;
