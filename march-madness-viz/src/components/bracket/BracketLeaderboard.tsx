import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  IconButton,
  Stack,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { UserScore } from '../../types';

interface BracketLeaderboardProps {
  userScores: Array<UserScore & { winProbability?: number }>;
  probabilityMode: boolean;
  title?: string;
  maxHeight?: string | number;
  currentScoreByUser?: Record<string, number>;
  scoreLabel?: string;
}

function truncateName(value: string, maxLength: number): string {
  if (!value) return '';
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function BracketLeaderboard({
  userScores,
  probabilityMode,
  title = "Leaderboard",
  maxHeight = 'calc(100vh - 320px)',
  currentScoreByUser,
  scoreLabel = 'Scenario'
}: BracketLeaderboardProps) {
  const pageSize = 25;
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState('scenario' as 'scenario' | 'current');
  const [sortDirection, setSortDirection] = useState('desc' as 'asc' | 'desc');
  const totalPages = Math.max(1, Math.ceil(userScores.length / pageSize));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pagesToShow = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (page <= 4) {
      return [1, 2, 3, 4, 5, -1, totalPages];
    }
    if (page >= totalPages - 3) {
      return [1, -1, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, -1, page - 1, page, page + 1, -1, totalPages];
  }, [page, totalPages]);

  const start = (page - 1) * pageSize;
  const sortedScores = useMemo(() => {
    const direction = sortDirection === 'desc' ? -1 : 1;
    return [...userScores].sort((a, b) => {
      const aScenario = a.score ?? 0;
      const bScenario = b.score ?? 0;
      const aCurrent = currentScoreByUser?.[a.username] ?? 0;
      const bCurrent = currentScoreByUser?.[b.username] ?? 0;
      const primaryA = sortKey === 'scenario' ? aScenario : aCurrent;
      const primaryB = sortKey === 'scenario' ? bScenario : bCurrent;
      if (primaryA !== primaryB) return (primaryA - primaryB) * direction;
      if (aScenario !== bScenario) return (aScenario - bScenario) * direction;
      return a.username.localeCompare(b.username);
    });
  }, [userScores, currentScoreByUser, sortKey, sortDirection]);
  const rows = sortedScores.slice(start, start + pageSize);

  const onSort = (nextKey: 'scenario' | 'current') => {
    if (sortKey === nextKey) {
      setSortDirection((prev: 'asc' | 'desc') => (prev === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setSortKey(nextKey);
    setSortDirection('desc');
  };

  return (
    <Paper sx={{ p: { xs: 1, sm: 1.5 }, mb: 2, overflowY: 'auto' }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        {title}
      </Typography>
      <TableContainer component={Paper} sx={{ maxHeight, overflow: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ px: { xs: 0.75, sm: 2 }, py: 1 }}>Rank</TableCell>
              <TableCell sx={{ px: { xs: 0.75, sm: 2 }, py: 1 }}>User</TableCell>
              <TableCell
                align="right"
                onClick={() => onSort('scenario')}
                sx={{ px: { xs: 0.75, sm: 2 }, py: 1, cursor: 'pointer', userSelect: 'none' }}
              >
                {scoreLabel} {sortKey === 'scenario' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
              </TableCell>
              {currentScoreByUser && (
                <TableCell
                  align="right"
                  onClick={() => onSort('current')}
                  sx={{ px: { xs: 0.75, sm: 2 }, py: 1, cursor: 'pointer', userSelect: 'none' }}
                >
                  Current {sortKey === 'current' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </TableCell>
              )}
              {probabilityMode && (
                <TableCell align="right" sx={{ px: { xs: 0.75, sm: 2 }, py: 1 }}>Win%</TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((user: UserScore & { winProbability?: number }, index: number) => {
              const globalIndex = start + index;
              const userCurrent = currentScoreByUser?.[user.username] ?? 0;
              const prevCurrent = globalIndex > 0 ? (currentScoreByUser?.[sortedScores[globalIndex - 1].username] ?? 0) : 0;
              const currentValue = sortKey === 'scenario' ? user.score : userCurrent;
              const prevValue = sortKey === 'scenario' ? sortedScores[globalIndex - 1]?.score : prevCurrent;
              const tiedWithPrevious =
                globalIndex > 0 && prevValue === currentValue;
              const rankLabel = tiedWithPrevious ? '' : String(globalIndex + 1);

              return (
                <TableRow key={user.username}>
                  <TableCell sx={{ px: { xs: 0.75, sm: 2 }, py: 0.85, fontSize: { xs: '0.94rem', sm: '1rem' } }}>
                    {rankLabel}
                  </TableCell>
                  <TableCell 
                    sx={{ 
                      maxWidth: { xs: 116, sm: 160 },
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      px: { xs: 0.75, sm: 2 },
                      py: 0.85,
                      fontSize: { xs: '0.94rem', sm: '1rem' }
                    }}
                  >
                    {truncateName(user.fullName || user.bracketName || user.username, 16)}
                  </TableCell>
                  <TableCell align="right" sx={{ px: { xs: 0.75, sm: 2 }, py: 0.85, fontSize: { xs: '0.94rem', sm: '1rem' } }}>
                    {user.score || 0}
                  </TableCell>
                  {currentScoreByUser && (
                    <TableCell align="right" sx={{ px: { xs: 0.75, sm: 2 }, py: 0.85, fontSize: { xs: '0.94rem', sm: '1rem' } }}>
                      {currentScoreByUser[user.username] ?? 0}
                    </TableCell>
                  )}
                  {probabilityMode && (
                    <TableCell align="right" sx={{ px: { xs: 1, sm: 2 }, py: 0.9, fontSize: { xs: '0.96rem', sm: '1rem' } }}>
                      {(user.winProbability ?? 0).toFixed(1)}%
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      {totalPages > 1 && (
        <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center" sx={{ mt: 1 }}>
          <IconButton
            size="small"
            onClick={() => setPage((p: number) => Math.max(1, p - 1))}
            disabled={page === 1}
            aria-label="Previous page"
          >
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
          {pagesToShow.map((p: number, idx: number) =>
            p === -1 ? (
              <Box key={`ellipsis-${idx}`} sx={{ px: 0.75, color: 'text.secondary', fontSize: 14 }}>
                ...
              </Box>
            ) : (
              <Box
                key={`page-${p}`}
                onClick={() => setPage(p)}
                sx={{
                  px: 1.25,
                  py: 0.25,
                  borderRadius: 1,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: page === p ? 700 : 500,
                  color: page === p ? 'primary.main' : 'text.secondary',
                  border: '1px solid',
                  borderColor: page === p ? 'primary.main' : 'transparent',
                  '&:hover': { bgcolor: 'action.hover' }
                }}
              >
                {p}
              </Box>
            )
          )}
          <IconButton
            size="small"
            onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            aria-label="Next page"
          >
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Stack>
      )}
    </Paper>
  );
}

export default BracketLeaderboard; 