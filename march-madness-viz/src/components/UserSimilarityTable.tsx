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
  Tooltip
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useData } from '../context/DataContext';

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
  selectedUser, 
  limit = 15,
  showDescription = true 
}) => {
  // Access user name mappings from context
  const { userNameMapping } = useData();
  
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
      
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Username</TableCell>
            <TableCell>Bracket Name</TableCell>
            <TableCell>Full Name</TableCell>
            <TableCell 
              align="right" 
              onClick={() => requestSort('similarity')}
              sx={{ 
                cursor: 'pointer',
                fontWeight: sortConfig.key === 'similarity' ? 'bold' : 'normal',
                textDecoration: sortConfig.key === 'similarity' ? 'underline' : 'none'
              }}
            >
              Regular Similarity {sortConfig.key === 'similarity' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
            </TableCell>
            <TableCell 
              align="right"
              onClick={() => requestSort('weightedSimilarity')}
              sx={{ 
                cursor: 'pointer',
                fontWeight: sortConfig.key === 'weightedSimilarity' ? 'bold' : 'normal',
                textDecoration: sortConfig.key === 'weightedSimilarity' ? 'underline' : 'none'
              }}
            >
              Weighted Similarity {sortConfig.key === 'weightedSimilarity' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
            </TableCell>
            <TableCell 
              align="right"
              onClick={() => requestSort('sharedPoints')}
              sx={{ 
                cursor: 'pointer',
                fontWeight: sortConfig.key === 'sharedPoints' ? 'bold' : 'normal',
                textDecoration: sortConfig.key === 'sharedPoints' ? 'underline' : 'none'
              }}
            >
              Shared Points {sortConfig.key === 'sharedPoints' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
            </TableCell>
            <TableCell 
              align="right"
              onClick={() => requestSort('score')}
              sx={{ 
                cursor: 'pointer',
                fontWeight: sortConfig.key === 'score' ? 'bold' : 'normal',
                textDecoration: sortConfig.key === 'score' ? 'underline' : 'none'
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
                <TableCell>
                  <Link component={RouterLink} to={`/users/${user.username}`}>
                    {user.username}
                  </Link>
                </TableCell>
                <TableCell>
                  <Tooltip title={userMapping.bracketName} arrow placement="top">
                    <span>{userMapping.bracketName}</span>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Tooltip title={userMapping.fullName} arrow placement="top">
                    <span>{userMapping.fullName}</span>
                  </Tooltip>
                </TableCell>
                <TableCell align="right">{(user.similarity * 100).toFixed(1)}%</TableCell>
                <TableCell align="right">{(user.weightedSimilarity * 100).toFixed(1)}%</TableCell>
                <TableCell align="right">{user.sharedPoints}</TableCell>
                <TableCell align="right">{user.score}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
};

export default UserSimilarityTable; 