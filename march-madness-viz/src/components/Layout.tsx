import React, { useState, useMemo } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Container,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Toolbar,
  Typography,
  Button,
  Stack
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import { useData } from '../context/DataContext';

// Helper to determine the most recent round
function getMostRecentRound(gameResults: any[]): string {
  if (!gameResults || gameResults.length === 0) return 'ROUND_64';
  
  // Find the game with the highest ID that has been played
  const maxGameId = Math.max(...gameResults.map(game => parseInt(game.gameId)));
  
  // Map game ID to round
  if (maxGameId <= 32) return 'ROUND_64';
  if (maxGameId <= 48) return 'ROUND_32';
  if (maxGameId <= 56) return 'SWEET_16';
  if (maxGameId <= 60) return 'ELITE_8';
  if (maxGameId <= 62) return 'FINAL_FOUR';
  if (maxGameId <= 63) return 'CHAMPIONSHIP';
  
  return 'ROUND_64'; // Default fallback
}

const Links = [
  { name: 'Home', path: '/' },
  { name: 'Leaderboard', path: '/leaderboard' },
  { name: 'Bracket Machine', path: '/bracket-machine' },
  { name: 'Rounds', path: '/rounds/default' },
  { name: 'Teams', path: '/teams/DUKE' },
  { name: 'Pool Analysis', path: '/pool-analysis' },
];

const NavLink = ({ children, path }: { children: React.ReactNode, path: string }) => (
  <Button
    component={RouterLink}
    to={path}
    sx={{
      color: 'white',
      '&:hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
      },
    }}
  >
    {children}
  </Button>
);

const Layout = ({ children }: { children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { gameResults } = useData();

  // Calculate most recent round
  const mostRecentRound = useMemo(() => {
    return getMostRecentRound(gameResults);
  }, [gameResults]);
  
  const navItems = [
    { name: 'Home', path: '/' },
    { name: 'Leaderboard', path: '/leaderboard' },
    { name: 'Bracket Machine', path: '/bracket-machine' },
    { name: 'Rounds', path: `/rounds/${mostRecentRound}` },
    { name: 'Teams', path: '/teams/DUKE' },
    { name: 'Pool Analysis', path: '/pool-analysis' },
  ];

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" color="primary">
        <Toolbar>
          <IconButton
            size="large"
            edge="start"
            color="inherit"
            aria-label="menu"
            sx={{ mr: 2, display: { md: 'none' } }}
            onClick={handleOpen}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            March Madness Viz
          </Typography>
          <Stack direction="row" spacing={2} sx={{ display: { xs: 'none', md: 'flex' } }}>
            {navItems.map((link) => (
              <NavLink key={link.name} path={link.path}>{link.name}</NavLink>
            ))}
          </Stack>
        </Toolbar>
      </AppBar>

      <Drawer
        anchor="left"
        open={isOpen}
        onClose={handleClose}
      >
        <Box sx={{ width: 250 }} role="presentation">
          <IconButton sx={{ m: 1 }} onClick={handleClose}>
            <CloseIcon />
          </IconButton>
          <List>
            {navItems.map((link) => (
              <ListItem key={link.name} disablePadding>
                <ListItemButton component={RouterLink} to={link.path} onClick={handleClose}>
                  <ListItemText primary={link.name} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>

      <Container maxWidth="xl" sx={{ pt: 4, pb: 5, flexGrow: 1 }}>
        {children}
      </Container>
    </Box>
  );
};

export default Layout;