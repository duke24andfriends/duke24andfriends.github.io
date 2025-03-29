import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
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
            {Links.map((link) => (
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
            {Links.map((link) => (
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