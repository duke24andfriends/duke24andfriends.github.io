import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Link,
  Tooltip,
  Paper
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useYearPath } from '../utils/yearRouting';

export interface UserSimilarity {
  username: string;
  similarity: number;
  weightedSimilarity: number;
  sharedPoints: number;
  score: number;
}

interface UserSimilarityTableProps {
  similarities: UserSimilarity[];
  selectedUser: string;
  limit?: number;
  showDescription?: boolean;
}

const UserSimilarityTable: React.FC<UserSimilarityTableProps> = ({ 
  similarities,
  limit = 15,
  showDescription = true 
}) => {
  // Access user name mappings from context
  const { userNameMapping } = useData();
  const { yearPath } = useYearPath();

  const hideOnMobileSx = { display: { xs: 'none', sm: 'table-cell' } } as const;
  const compactCellSx = { px: { xs: 1, sm: 2 }, py: { xs: 1, sm: 1.5 } } as const;
  const compactMetricCellSx = {
    ...compactCellSx,
    whiteSpace: 'nowrap'
  } as const;
  
  // State for managing sorting
  const [sortConfig, setSortConfig] = useState<{
    key: 'similarity' | 'weightedSimilarity' | 'sharedPoints' | 'score';
    direction: 'ascending' | 'descending';
  }>({
    key: 'weightedSimilarity',
    direction: 'descending'
  });

  // Function to handle sorting
  const requestSort = (key: 'similarity' | 'weightedSimilarity' | 'sharedPoints' | 'score') => {
    let direction: 'ascending' | 'descending' = 'descending';
    if (sortConfig.key === key && sortConfig.direction === 'descending') {
      direction = 'ascending';
    }
    setSortConfig({ key, direction });
  };

  // Get sorted data
  const sortedSimilarities = useMemo(() => {
    if (!similarities.length) return [];
    const sortableItems = [...similarities];
    
    sortableItems.sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'ascending' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'ascending' ? 1 : -1;
      }
      return 0;
    });
    
    return sortableItems.slice(0, limit);
  }, [similarities, sortConfig, limit]);

  return (
    <Box>
      {showDescription && (
        <Typography variant="body2" paragraph>
          Three similarity metrics are shown:
          <ul>
            <li><strong>Regular:</strong> Standard Jaccard similarity (all picks weighted equally)</li>
            <li><strong>Weighted:</strong> Picks weighted by round value (10, 20, 40, 80, 160, 320)</li>
            <li><strong>Shared Points:</strong> Total points from picks that both users have in common</li>
          </ul>
          Click column headers to sort. Weighted metrics emphasize matches in later rounds, which are worth more points.
        </Typography>
      )}
      
      <Paper sx={{ overflowX: { xs: 'visible', sm: 'auto' }, width: '100%' }}>
        <Table size="small" sx={{ tableLayout: { xs: 'fixed', sm: 'auto' }, width: '100%' }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ ...compactCellSx, width: { xs: '32%', sm: 'auto' } }}>Name</TableCell>
              <TableCell sx={hideOnMobileSx}>Username</TableCell>
              <TableCell sx={hideOnMobileSx}>Bracket Name</TableCell>
              <TableCell sx={hideOnMobileSx}>Full Name</TableCell>
              <TableCell 
                align="right" 
                onClick={() => requestSort('similarity')}
                sx={{ 
                  cursor: 'pointer',
                  fontWeight: sortConfig.key === 'similarity' ? 'bold' : 'normal',
                  textDecoration: sortConfig.key === 'similarity' ? 'underline' : 'none',
                  ...compactMetricCellSx
                }}
              >
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  Regular Similarity
                </Box>
                <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                  Regular
                </Box>
                {sortConfig.key === 'similarity' && (sortConfig.direction === 'ascending' ? ' ↑' : ' ↓')}
              </TableCell>
              <TableCell 
                align="right"
                onClick={() => requestSort('weightedSimilarity')}
                sx={{ 
                  cursor: 'pointer',
                  fontWeight: sortConfig.key === 'weightedSimilarity' ? 'bold' : 'normal',
                  textDecoration: sortConfig.key === 'weightedSimilarity' ? 'underline' : 'none',
                  ...compactMetricCellSx
                }}
              >
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  Weighted Similarity
                </Box>
                <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                  Weighted
                </Box>
                {sortConfig.key === 'weightedSimilarity' && (sortConfig.direction === 'ascending' ? ' ↑' : ' ↓')}
              </TableCell>
              <TableCell 
                align="right"
                onClick={() => requestSort('sharedPoints')}
                sx={{ 
                  cursor: 'pointer',
                  fontWeight: sortConfig.key === 'sharedPoints' ? 'bold' : 'normal',
                  textDecoration: sortConfig.key === 'sharedPoints' ? 'underline' : 'none',
                  ...compactMetricCellSx
                }}
              >
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  Shared Points
                </Box>
                <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                  Shared
                </Box>
                {sortConfig.key === 'sharedPoints' && (sortConfig.direction === 'ascending' ? ' ↑' : ' ↓')}
              </TableCell>
              <TableCell 
                align="right"
                onClick={() => requestSort('score')}
                sx={{ 
                  cursor: 'pointer',
                  fontWeight: sortConfig.key === 'score' ? 'bold' : 'normal',
                  textDecoration: sortConfig.key === 'score' ? 'underline' : 'none',
                  whiteSpace: 'nowrap',
                  ...hideOnMobileSx
                }}
              >
                Score {sortConfig.key === 'score' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedSimilarities.map(user => {
              const userMapping = userNameMapping[user.username] || { 
                bracketName: user.username, 
                fullName: user.username 
              };
              
              return (
                <TableRow key={user.username}>
                  <TableCell sx={compactCellSx}>
                    <Tooltip title={userMapping.fullName || user.username} arrow placement="top">
                      <Link
                        component={RouterLink}
                        to={yearPath(`/users/${user.username}`)}
                        sx={{
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {userMapping.fullName || user.username}
                      </Link>
                    </Tooltip>
                  </TableCell>
                  <TableCell sx={hideOnMobileSx}>
                    <Link component={RouterLink} to={yearPath(`/users/${user.username}`)}>
                      @{user.username}
                    </Link>
                  </TableCell>
                  <TableCell sx={hideOnMobileSx}>
                    <Tooltip title={userMapping.bracketName} arrow placement="top">
                      <span>{userMapping.bracketName}</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell sx={hideOnMobileSx}>
                    <Tooltip title={userMapping.fullName} arrow placement="top">
                      <span>{userMapping.fullName}</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right" sx={compactMetricCellSx}>{(user.similarity * 100).toFixed(1)}%</TableCell>
                  <TableCell align="right" sx={compactMetricCellSx}>{(user.weightedSimilarity * 100).toFixed(1)}%</TableCell>
                  <TableCell align="right" sx={compactMetricCellSx}>{user.sharedPoints}</TableCell>
                  <TableCell align="right" sx={hideOnMobileSx}>{user.score}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
};

export default UserSimilarityTable; 