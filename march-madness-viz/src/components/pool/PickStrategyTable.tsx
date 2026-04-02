import { useMemo, useState, useEffect } from 'react';
import {
  Box,
  IconButton,
  InputAdornment,
  TextField,
  Stack,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Link
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SearchIcon from '@mui/icons-material/Search';
import { Link as RouterLink } from 'react-router-dom';
import { useYearPath } from '../../utils/yearRouting';

export interface PickStrategyTableRow {
  username: string;
  chalkScore: number;
  herdingScore: number;
  deviationScore: number;
  score: number;
  fullName?: string;
  bracketName?: string;
}

type SortKey = 'chalkScore' | 'herdingScore' | 'deviationScore' | 'score';

function truncateName(value: string, maxLength: number): string {
  if (!value) return '';
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function cmpNum(a: number, b: number): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

interface PickStrategyTableProps {
  title: string;
  description?: string;
  rows: PickStrategyTableRow[];
  /** Column used for default sort and rank (must appear in `columns`) */
  defaultSortKey: SortKey;
  /** Data columns to show (Rank + User are always shown). Defaults to [defaultSortKey, 'score']. */
  columns?: SortKey[];
  maxHeight?: string | number;
}

const COLUMN_LABELS: Record<SortKey, string> = {
  chalkScore: 'Chalk %',
  herdingScore: 'Herding %',
  deviationScore: 'Deviation',
  score: 'Score'
};

function formatMetricCell(user: PickStrategyTableRow, key: SortKey): string {
  if (key === 'chalkScore' || key === 'herdingScore') {
    return `${user[key].toFixed(1)}%`;
  }
  if (key === 'deviationScore') {
    return user.deviationScore.toFixed(1);
  }
  return String(user.score);
}

function PickStrategyTable({
  title,
  description,
  rows,
  defaultSortKey,
  columns: columnsProp,
  maxHeight = 'min(420px, 55vh)'
}: PickStrategyTableProps) {
  const { yearPath } = useYearPath();
  const displayColumns = useMemo((): SortKey[] => {
    if (columnsProp?.length) {
      const seen = new Set<SortKey>();
      const out: SortKey[] = [];
      for (const k of columnsProp) {
        if (!seen.has(k)) {
          seen.add(k);
          out.push(k);
        }
      }
      if (!seen.has(defaultSortKey)) {
        return [defaultSortKey, ...out];
      }
      return out;
    }
    return [defaultSortKey, 'score'];
  }, [columnsProp, defaultSortKey]);

  const pageSize = 25;
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>(defaultSortKey);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');

  const sortedRows = useMemo(() => {
    const dir = sortDirection === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      const primary = cmpNum(va, vb) * dir;
      if (primary !== 0) return primary;
      return a.username.localeCompare(b.username);
    });
  }, [rows, sortKey, sortDirection]);

  const rankByUsername = useMemo(() => {
    const map = new Map<string, number>();
    let currentRank = 1;
    for (let i = 0; i < sortedRows.length; i += 1) {
      const row = sortedRows[i];
      if (i > 0) {
        const prev = sortedRows[i - 1];
        if (row[sortKey] !== prev[sortKey]) {
          currentRank = i + 1;
        }
      }
      map.set(row.username, currentRank);
    }
    return map;
  }, [sortedRows, sortKey]);

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return sortedRows;
    return sortedRows.filter((u) => {
      const fullName = (u.fullName || '').toLowerCase();
      const bracketName = (u.bracketName || '').toLowerCase();
      const username = (u.username || '').toLowerCase();
      return fullName.includes(q) || bracketName.includes(q) || username.includes(q);
    });
  }, [sortedRows, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const start = (page - 1) * pageSize;
  const pageRows = filteredRows.slice(start, start + pageSize);

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

  const onSort = (next: SortKey) => {
    if (!displayColumns.includes(next)) return;
    if (sortKey === next) {
      setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setSortKey(next);
    setSortDirection('desc');
  };

  const displayLabel = (u: PickStrategyTableRow) =>
    u.fullName || u.bracketName || u.username;

  return (
    <Paper sx={{ p: { xs: 1, sm: 1.5 }, mb: 2, overflowY: 'auto' }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
        {title}
      </Typography>
      {description ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
          {description}
        </Typography>
      ) : null}
      <TextField
        fullWidth
        size="small"
        placeholder="Search by username, bracket name, or real name..."
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setPage(1);
        }}
        sx={{ mb: 1.25 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          )
        }}
      />
      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight, overflow: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ px: { xs: 0.75, sm: 2 }, py: 1, fontWeight: 600 }}>Rank</TableCell>
              <TableCell sx={{ px: { xs: 0.75, sm: 2 }, py: 1, fontWeight: 600 }}>User</TableCell>
              {displayColumns.map((key) => (
                <TableCell
                  key={key}
                  align="right"
                  onClick={() => onSort(key)}
                  sx={{
                    px: { xs: 0.75, sm: 2 },
                    py: 1,
                    cursor: 'pointer',
                    userSelect: 'none',
                    fontWeight: 600,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {COLUMN_LABELS[key]}
                  {sortKey === key ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {pageRows.map((user) => {
              const rank = rankByUsername.get(user.username) ?? start + 1;
              return (
                <TableRow key={user.username}>
                  <TableCell sx={{ px: { xs: 0.75, sm: 2 }, py: 0.85 }}>{rank}</TableCell>
                  <TableCell
                    sx={{
                      maxWidth: { xs: 120, sm: 200 },
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      px: { xs: 0.75, sm: 2 },
                      py: 0.85
                    }}
                  >
                    <Link
                      component={RouterLink}
                      to={yearPath(`/users/${user.username}`)}
                      underline="hover"
                      color="inherit"
                    >
                      {truncateName(displayLabel(user), 22)}
                    </Link>
                  </TableCell>
                  {displayColumns.map((key) => (
                    <TableCell key={key} align="right" sx={{ px: { xs: 0.75, sm: 2 }, py: 0.85 }}>
                      {formatMetricCell(user, key)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      {filteredRows.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
          No users match your search.
        </Typography>
      ) : null}
      {totalPages > 1 ? (
        <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center" sx={{ mt: 1 }}>
          <IconButton
            size="small"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            aria-label="Previous page"
          >
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
          {pagesToShow.map((p, idx) =>
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
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            aria-label="Next page"
          >
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Stack>
      ) : null}
    </Paper>
  );
}

export default PickStrategyTable;
