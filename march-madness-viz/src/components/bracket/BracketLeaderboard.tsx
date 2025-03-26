import React from 'react';
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper
} from '@mui/material';
import { UserScore, ProbabilityScore } from '../../utils/bracketLogic';

interface BracketLeaderboardProps {
  userScores: UserScore[] | ProbabilityScore[];
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
            {userScores
              .slice(0, 25)
              .map((user, index) => (
                <TableRow key={user.username}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell 
                    sx={{ 
                      maxWidth: 120, 
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {user.username}
                  </TableCell>
                  <TableCell align="right">{user.score || 0}</TableCell>
                  {probabilityMode && (
                    <TableCell align="right">
                      {((user as ProbabilityScore).winProbability || 0).toFixed(1)}%
                    </TableCell>
                  )}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

export default BracketLeaderboard; 