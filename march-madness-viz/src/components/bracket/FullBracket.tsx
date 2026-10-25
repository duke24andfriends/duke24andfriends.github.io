import { Box, ButtonBase, Typography } from '@mui/material';
import { tokens } from '../../theme';

export interface RegionLayout {
  key: string;
  label: string;
  /** Game ids per round, R64 → Elite 8. */
  rounds: string[][];
}

interface FullBracketProps {
  /** [top-left, bottom-left, top-right, bottom-right]; left pair feeds `semis[0]`, right pair feeds `semis[1]`. */
  regions: [RegionLayout, RegionLayout, RegionLayout, RegionLayout];
  semis: [string, string];
  championshipId: string;
  getTeams: (gameId: string) => string[];
  getSeed: (team: string) => number | undefined;
  getActualWinner: (gameId: string) => string;
  getPredictedWinner: (gameId: string) => string;
  onPick: (gameId: string, team: string) => void;
  onRegionSelect?: (key: string) => void;
}

const COL_W = 92;
const GAP = 12;
const CENTER_W = 124;
const SLOT_H = 22;
const SLOT_GAP = 2;
const GAME_H = SLOT_H * 2 + SLOT_GAP;
const UNIT = 52;
const REGION_H = UNIT * 8;
const REGION_GAP = 28;
const HEADER_H = 26;
const BODY_H = REGION_H * 2 + REGION_GAP;
const SIDE_W = 4 * COL_W + 4 * GAP;
const WIDTH = SIDE_W * 2 + CENTER_W;
const ROUND_HEADERS = ['R64', 'R32', 'Sweet 16', 'Elite 8'];

type SlotState = 'actual' | 'picked' | 'eliminated' | 'open' | 'tbd';

const CompactSlot = ({ team, seed, state, onClick }: { team: string; seed?: number; state: SlotState; onClick?: () => void }) => {
  if (state === 'tbd') {
    return <Box sx={{ height: SLOT_H, borderRadius: 1, border: `1px dashed ${tokens.border}` }} />;
  }
  const filled = state === 'actual' || state === 'picked';
  const bg = state === 'actual' ? tokens.success : state === 'picked' ? tokens.primary : tokens.surface;
  return (
    <ButtonBase
      disabled={!onClick}
      onClick={onClick}
      title={team}
      sx={{
        width: '100%',
        height: SLOT_H,
        borderRadius: 1,
        px: 0.75,
        gap: 0.75,
        justifyContent: 'flex-start',
        bgcolor: bg,
        border: `1px solid ${filled ? bg : tokens.border}`,
        color: filled ? '#fff' : state === 'eliminated' ? tokens.subtle : tokens.ink,
        fontSize: '0.72rem',
        fontWeight: filled ? 600 : 500,
        textDecoration: state === 'eliminated' ? 'line-through' : 'none',
        '&:hover': onClick && !filled ? { borderColor: tokens.primary, bgcolor: tokens.primarySoft } : undefined,
        '&.Mui-disabled': { color: filled ? '#fff' : state === 'eliminated' ? tokens.subtle : tokens.ink },
      }}
    >
      <Box component="span" sx={{ width: 14, textAlign: 'right', fontSize: '0.65rem', opacity: filled ? 0.85 : 0.6, flexShrink: 0 }}>
        {seed ?? ''}
      </Box>
      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team}</Box>
    </ButtonBase>
  );
};

const FullBracket = ({ regions, semis, championshipId, getTeams, getSeed, getActualWinner, getPredictedWinner, onPick, onRegionSelect }: FullBracketProps) => {
  const games: Array<{ id: string; x: number; y: number; w: number }> = [];
  const paths: string[] = [];

  const centerY = (regionIdx: number, round: number, i: number) => (regionIdx % 2) * (REGION_H + REGION_GAP) + UNIT * 2 ** round * (i + 0.5);

  regions.forEach((region, ri) => {
    const right = ri >= 2;
    const colX = (round: number) => (right ? WIDTH - COL_W - round * (COL_W + GAP) : round * (COL_W + GAP));
    region.rounds.forEach((ids, round) => {
      ids.forEach((id, i) => {
        const x = colX(round);
        const y = centerY(ri, round, i);
        games.push({ id, x, y, w: COL_W });
        if (round < 3) {
          const nx = colX(round + 1);
          const ny = centerY(ri, round + 1, Math.floor(i / 2));
          const x1 = right ? x : x + COL_W;
          const x2 = right ? nx + COL_W : nx;
          const mid = (x1 + x2) / 2;
          paths.push(`M${x1},${y} H${mid} V${ny} H${x2}`);
        }
      });
    });
  });

  const centerX = SIDE_W;
  const midY = BODY_H / 2;
  const semiY = [midY - 92, midY + 92];
  semis.forEach((id, si) => games.push({ id, x: centerX, y: semiY[si], w: CENTER_W }));

  /* Elite 8 → semifinal elbows */
  regions.forEach((_, ri) => {
    const right = ri >= 2;
    const e8x = right ? WIDTH - COL_W - 3 * (COL_W + GAP) : 3 * (COL_W + GAP);
    const y = centerY(ri, 3, 0);
    const ty = semiY[right ? 1 : 0] + (ri % 2 === 0 ? -SLOT_H / 2 - SLOT_GAP / 2 : SLOT_H / 2 + SLOT_GAP / 2);
    const x1 = right ? e8x : e8x + COL_W;
    const x2 = right ? centerX + CENTER_W : centerX;
    paths.push(`M${x1},${y} H${(x1 + x2) / 2} V${ty} H${x2}`);
  });
  /* Semis → champion */
  const champY = midY;
  paths.push(`M${centerX + CENTER_W / 2},${semiY[0] + GAME_H / 2} V${champY - 22}`);
  paths.push(`M${centerX + CENTER_W / 2},${semiY[1] - GAME_H / 2} V${champY + 22}`);

  const champion = getActualWinner(championshipId) || getPredictedWinner(championshipId);
  const championDecided = !!getActualWinner(championshipId);

  const slotState = (gameId: string, team: string): SlotState => {
    const actual = getActualWinner(gameId);
    if (actual) return actual === team ? 'actual' : 'eliminated';
    return getPredictedWinner(gameId) === team ? 'picked' : 'open';
  };

  return (
    <Box sx={{ overflowX: 'auto', pb: 1 }}>
      <Box sx={{ position: 'relative', width: WIDTH, minWidth: WIDTH, mx: 'auto' }}>
        {/* Round headers */}
        <Box sx={{ position: 'relative', height: HEADER_H }}>
          {ROUND_HEADERS.map((label, round) => (
            <Box key={label}>
              {[round * (COL_W + GAP), WIDTH - COL_W - round * (COL_W + GAP)].map((x) => (
                <Typography key={x} sx={{ position: 'absolute', left: x, width: COL_W, textAlign: 'center', fontSize: '0.72rem', fontWeight: 600, color: tokens.muted }}>
                  {label}
                </Typography>
              ))}
            </Box>
          ))}
          <Typography sx={{ position: 'absolute', left: centerX, width: CENTER_W, textAlign: 'center', fontSize: '0.72rem', fontWeight: 600, color: tokens.muted }}>
            Final Four
          </Typography>
        </Box>

        <Box sx={{ position: 'relative', height: BODY_H }}>
          <svg width={WIDTH} height={BODY_H} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden>
            {paths.map((d, i) => (
              <path key={i} d={d} fill="none" stroke="#cbd2db" strokeWidth={1} />
            ))}
          </svg>

          {/* Region labels sit in the empty space above each Elite 8 game */}
          {regions.map((region, ri) => {
            const right = ri >= 2;
            const x = right ? WIDTH - COL_W - 3 * (COL_W + GAP) : 3 * (COL_W + GAP);
            return (
              <ButtonBase
                key={region.key}
                onClick={onRegionSelect ? () => onRegionSelect(region.key) : undefined}
                disabled={!onRegionSelect}
                sx={{
                  position: 'absolute',
                  left: x,
                  top: (ri % 2) * (REGION_H + REGION_GAP) + 4,
                  width: COL_W,
                  py: 0.5,
                  borderRadius: 1,
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: tokens.primary,
                  '&:hover': { bgcolor: tokens.primarySoft },
                }}
              >
                {region.label}
              </ButtonBase>
            );
          })}

          {games.map(({ id, x, y, w }) => {
            const teams = getTeams(id);
            const slots = teams.length === 2 ? teams : ['TBD', 'TBD'];
            const decided = !!getActualWinner(id);
            return (
              <Box key={id} sx={{ position: 'absolute', left: x, top: y - GAME_H / 2, width: w, display: 'flex', flexDirection: 'column', gap: `${SLOT_GAP}px` }}>
                {slots.map((team, idx) =>
                  team === 'TBD' ? (
                    <CompactSlot key={`tbd-${idx}`} team="" state="tbd" />
                  ) : (
                    <CompactSlot
                      key={team}
                      team={team}
                      seed={getSeed(team)}
                      state={slotState(id, team)}
                      onClick={decided ? undefined : () => onPick(id, getPredictedWinner(id) === team ? '' : team)}
                    />
                  )
                )}
              </Box>
            );
          })}

          {/* Champion */}
          <Box sx={{ position: 'absolute', left: centerX - 8, width: CENTER_W + 16, top: champY - 22, height: 44, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.muted, lineHeight: 1.4 }}>
              Champion
            </Typography>
            <Box
              sx={{
                height: 26,
                borderRadius: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.75,
                fontSize: '0.85rem',
                fontWeight: 700,
                bgcolor: champion ? (championDecided ? tokens.success : tokens.primary) : 'transparent',
                color: champion ? '#fff' : tokens.subtle,
                border: champion ? 'none' : `1px dashed ${tokens.border}`,
              }}
            >
              {champion ? (
                <>
                  <Box component="span" sx={{ fontSize: '0.7rem', opacity: 0.85 }}>{getSeed(champion)}</Box>
                  {champion}
                </>
              ) : (
                'TBD'
              )}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default FullBracket;
