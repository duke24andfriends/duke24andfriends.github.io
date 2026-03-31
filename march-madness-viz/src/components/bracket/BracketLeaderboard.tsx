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
}

function BracketLeaderboard({
  userScores,
  probabilityMode,
  title = "Projected Leaderboard",
  maxHeight = 'calc(100vh - 320px)'
}: BracketLeaderboardProps) {
  const pageSize = 25;
  const [page, setPage] = useState(1);
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
  const rows = userScores.slice(start, start + pageSize);

  return (
    <Paper sx={{ p: 2, mb: 2, maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      
      <TableContainer component={Paper} sx={{ maxHeight, overflowY: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Rank</TableCell>
              <TableCell>User</TableCell>
              <TableCell align="right">Score</TableCell>
              {probabilityMode && (
                <TableCell align="right">Win%</TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((user, index) => {
              const globalIndex = start + index;
              const tiedWithPrevious =
                globalIndex > 0 && userScores[globalIndex - 1].score === user.score;
              const rankLabel = tiedWithPrevious ? '' : String(globalIndex + 1);

              return (
                <TableRow key={user.username}>
                  <TableCell>{rankLabel}</TableCell>
                  <TableCell 
                    sx={{ 
                      maxWidth: 120, 
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {user.fullName || user.bracketName || user.username}
                  </TableCell>
                  <TableCell align="right">{user.score || 0}</TableCell>
                  {probabilityMode && (
                    <TableCell align="right">
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