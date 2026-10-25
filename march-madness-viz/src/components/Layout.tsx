import { useMemo, useState, ReactNode } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Autocomplete,
  Box,
  ButtonBase,
  Container,
  Dialog,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import BarChartIcon from '@mui/icons-material/BarChart';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import { useData } from '../context/DataContext';
import { AVAILABLE_YEARS, getYearPath } from '../utils/yearRouting';
import { getMostRecentRound } from '../utils/mostRecentRound';
import { MOBILE_NAV_HEIGHT, tokens } from '../theme';
import { displayNames } from '../hooks/usePoolStandings';

interface NavItem {
  name: string;
  path: string;
  match: (subPath: string) => boolean;
}

const Wordmark = ({ compact, to }: { compact?: boolean; to: string }) => (
  <Typography
    component={RouterLink}
    to={to}
    sx={{
      fontWeight: 800,
      fontSize: compact ? '1.6rem' : '1.4rem',
      letterSpacing: '-0.03em',
      textDecoration: 'none',
      color: compact ? tokens.ink : tokens.primary,
      whiteSpace: 'nowrap',
    }}
  >
    Duke
    <Box component="span" sx={{ color: tokens.primary }}>
      24
    </Box>
  </Typography>
);

const YearSelect = ({
  year,
  onChange,
  pill,
}: {
  year: string;
  onChange: (year: string) => void;
  pill?: boolean;
}) => (
  <Select
    size="small"
    value={year}
    onChange={(e) => onChange(e.target.value)}
    inputProps={{ 'aria-label': 'Tournament year' }}
    sx={{
      fontWeight: 600,
      fontSize: '0.875rem',
      borderRadius: pill ? 999 : 2,
      bgcolor: pill ? tokens.surfaceAlt : 'transparent',
      '& .MuiSelect-select': { py: 0.75, pl: 1.75 },
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: pill ? 'transparent' : tokens.border,
      },
    }}
  >
    {AVAILABLE_YEARS.map((y) => (
      <MenuItem key={y} value={y}>
        {y}
      </MenuItem>
    ))}
  </Select>
);

const SearchDialog = ({
  open,
  onClose,
  year,
}: {
  open: boolean;
  onClose: () => void;
  year: string;
}) => {
  const { bracketData, userNameMapping } = useData();
  const navigate = useNavigate();

  const options = useMemo(() => {
    if (!bracketData) return [];
    const users = new Set<string>();
    Object.values(bracketData.games).forEach((g) => Object.keys(g.picks).forEach((u) => users.add(u)));
    return [...users]
      .filter(Boolean)
      .map((username) => ({ username, ...displayNames(username, userNameMapping[username]) }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [bracketData, userNameMapping]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { mt: { xs: 2, sm: 10 }, alignSelf: 'flex-start' } }}>
      <Box sx={{ p: 2 }}>
        <Autocomplete
          autoHighlight
          openOnFocus
          options={options}
          getOptionLabel={(o) => `${o.fullName} · ${o.bracketName}`}
          filterOptions={(opts, { inputValue }) => {
            const q = inputValue.toLowerCase();
            return opts
              .filter(
                (o) =>
                  o.fullName.toLowerCase().includes(q) ||
                  o.bracketName.toLowerCase().includes(q) ||
                  o.username.toLowerCase().includes(q)
              )
              .slice(0, 50);
          }}
          renderOption={(props, o) => (
            <li {...props} key={o.username}>
              <Box>
                <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>{o.fullName}</Typography>
                <Typography sx={{ color: tokens.muted, fontSize: '0.8rem' }}>{o.bracketName}</Typography>
              </Box>
            </li>
          )}
          onChange={(_, value) => {
            if (value) {
              onClose();
              navigate(getYearPath(year, `/users/${encodeURIComponent(value.username)}`));
            }
          }}
          renderInput={(params) => (
            <TextField {...params} autoFocus placeholder="Search people or brackets" />
          )}
        />
      </Box>
    </Dialog>
  );
};

const Layout = ({ children, year }: { children: ReactNode; year: string }) => {
  const { gameResults } = useData();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const mostRecentRound = useMemo(() => getMostRecentRound(gameResults), [gameResults]);
  const hasBracketMachine = year === '2026';
  const subPath = location.pathname.replace(new RegExp(`^/${year}`), '') || '/';

  const navItems: NavItem[] = [
    { name: 'Overview', path: getYearPath(year, '/'), match: (p) => p === '/' },
    { name: 'Leaderboard', path: getYearPath(year, '/leaderboard'), match: (p) => p.startsWith('/leaderboard') || p.startsWith('/users') },
    { name: 'Round Analysis', path: getYearPath(year, `/rounds/${mostRecentRound}`), match: (p) => p.startsWith('/rounds') || p.startsWith('/games') },
    { name: 'Team Analysis', path: getYearPath(year, '/teams/DUKE'), match: (p) => p.startsWith('/teams') },
    { name: 'Pool Analysis', path: getYearPath(year, '/pool-analysis'), match: (p) => p.startsWith('/pool-analysis') },
    ...(hasBracketMachine
      ? [{ name: 'Bracket Machine', path: getYearPath(year, '/bracket-machine'), match: (p: string) => p.startsWith('/bracket-machine') }]
      : []),
  ];

  const handleYearChange = (nextYear: string) => {
    const keepPath = nextYear === '2026' || !subPath.startsWith('/bracket-machine');
    navigate(getYearPath(nextYear, keepPath ? subPath : '/') + location.search);
  };

  const [overview, leaderboard, rounds] = navItems;
  const bracketItem = navItems.find((i) => i.name === 'Bracket Machine') ?? rounds;
  const mobileTabs = [
    { ...overview, label: 'Overview', icon: <HomeOutlinedIcon /> },
    { ...leaderboard, label: 'Standings', icon: <BarChartIcon /> },
    { ...bracketItem, label: hasBracketMachine ? 'Bracket' : 'Rounds', icon: <AccountTreeOutlinedIcon /> },
  ];
  const moreItems = navItems.filter((i) => !mobileTabs.some((t) => t.name === i.name));
  const moreActive = moreItems.some((i) => i.match(subPath));

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: tokens.surface }}>
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: (t) => t.zIndex.appBar,
          bgcolor: 'rgba(255,255,255,0.92)',
          backdropFilter: 'saturate(180%) blur(8px)',
          borderBottom: { md: `1px solid ${tokens.border}` },
        }}
      >
        <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3 } }}>
          {/* Desktop */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', height: 64, gap: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5 }}>
              <Wordmark to={getYearPath(year, '/')} />
              <Typography sx={{ fontWeight: 700, fontSize: '1.25rem', color: tokens.ink, display: { md: 'none', lg: 'block' }, whiteSpace: 'nowrap' }}>
                Bracket Pool
              </Typography>
            </Box>
            <YearSelect year={year} onChange={handleYearChange} />
            <Box component="nav" sx={{ display: 'flex', alignSelf: 'stretch', gap: { md: 2, lg: 3.5 }, ml: 2 }}>
              {navItems.map((item) => {
                const active = item.match(subPath);
                return (
                  <ButtonBase
                    key={item.name}
                    component={RouterLink}
                    to={item.path}
                    sx={{
                      fontSize: '0.875rem',
                      fontWeight: active ? 600 : 500,
                      color: active ? tokens.primary : tokens.body,
                      borderBottom: `2px solid ${active ? tokens.primary : 'transparent'}`,
                      mb: '-1px',
                      whiteSpace: 'nowrap',
                      '&:hover': { color: tokens.primary },
                    }}
                  >
                    {item.name}
                  </ButtonBase>
                );
              })}
            </Box>
            <Box sx={{ flexGrow: 1 }} />
            <IconButton aria-label="Search" onClick={() => setSearchOpen(true)} sx={{ color: tokens.body }}>
              <SearchIcon />
            </IconButton>
          </Box>

          {/* Mobile */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', height: 60, position: 'relative' }}>
            <Wordmark compact to={getYearPath(year, '/')} />
            <Box sx={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
              <YearSelect year={year} onChange={handleYearChange} pill />
            </Box>
            <Box sx={{ flexGrow: 1 }} />
            <IconButton aria-label="Search" onClick={() => setSearchOpen(true)} sx={{ color: tokens.ink, mr: -1 }}>
              <SearchIcon />
            </IconButton>
          </Box>
        </Container>
      </Box>

      <Container
        maxWidth="xl"
        component="main"
        sx={{
          flexGrow: 1,
          px: { xs: 2, sm: 3 },
          pt: { xs: 1, md: 4 },
          pb: { xs: `calc(${MOBILE_NAV_HEIGHT + 24}px + env(safe-area-inset-bottom))`, md: 6 },
          overflowX: 'hidden',
        }}
      >
        {children}
      </Container>

      {/* Mobile bottom tab bar */}
      <Box
        component="nav"
        sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: (t) => t.zIndex.appBar,
          height: `calc(${MOBILE_NAV_HEIGHT}px + env(safe-area-inset-bottom))`,
          pb: 'env(safe-area-inset-bottom)',
          bgcolor: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(8px)',
          borderTop: `1px solid ${tokens.border}`,
        }}
      >
        {[...mobileTabs, { name: 'More', label: 'More', icon: <MoreHorizIcon />, path: '', match: () => moreActive }].map((tab) => {
          const active = tab.match(subPath);
          const content = (
            <>
              {tab.icon}
              <Typography sx={{ fontSize: '0.75rem', fontWeight: active ? 600 : 500, mt: 0.25 }}>{tab.label}</Typography>
            </>
          );
          const sx = {
            flex: 1,
            flexDirection: 'column',
            color: active ? tokens.primary : tokens.muted,
            '& svg': { fontSize: 24 },
          } as const;
          return tab.name === 'More' ? (
            <ButtonBase key="more" sx={sx} onClick={() => setMoreOpen(true)}>
              {content}
            </ButtonBase>
          ) : (
            <ButtonBase key={tab.name} component={RouterLink} to={tab.path} sx={sx}>
              {content}
            </ButtonBase>
          );
        })}
      </Box>

      <Drawer
        anchor="bottom"
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        PaperProps={{ sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, pb: 'env(safe-area-inset-bottom)' } }}
      >
        <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: tokens.border, mx: 'auto', mt: 1.25, mb: 1 }} />
        <List sx={{ pb: 2 }}>
          {moreItems.map((item) => (
            <ListItemButton
              key={item.name}
              component={RouterLink}
              to={item.path}
              selected={item.match(subPath)}
              onClick={() => setMoreOpen(false)}
              sx={{ px: 3, py: 1.5 }}
            >
              <ListItemText primary={item.name} primaryTypographyProps={{ fontWeight: 600 }} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} year={year} />
    </Box>
  );
};

export default Layout;
