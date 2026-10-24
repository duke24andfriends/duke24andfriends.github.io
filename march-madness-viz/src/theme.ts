import { createTheme } from '@mui/material/styles';

export const tokens = {
  primary: '#1565d8',
  primaryDark: '#0b4fb3',
  primarySoft: '#e8f0fd',
  ink: '#0f172a',
  body: '#334155',
  muted: '#64748b',
  subtle: '#94a3b8',
  border: '#e5e7eb',
  divider: '#eef0f3',
  surface: '#ffffff',
  surfaceAlt: '#f6f7f9',
  up: '#15803d',
  down: '#dc2626',
  success: '#16a34a',
};

export const MOBILE_NAV_HEIGHT = 64;

const theme = createTheme({
  palette: {
    primary: { main: tokens.primary, dark: tokens.primaryDark, light: tokens.primarySoft },
    secondary: { main: '#16a34a' },
    success: { main: tokens.success },
    error: { main: tokens.down },
    text: { primary: tokens.ink, secondary: tokens.muted },
    divider: tokens.border,
    background: { default: tokens.surface, paper: tokens.surface },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    h1: { fontWeight: 800, letterSpacing: '-0.02em' },
    h2: { fontWeight: 800, letterSpacing: '-0.02em' },
    h3: { fontWeight: 800, letterSpacing: '-0.02em' },
    h4: { fontWeight: 800, letterSpacing: '-0.015em' },
    h5: { fontWeight: 700, letterSpacing: '-0.01em' },
    h6: { fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: tokens.surface, color: tokens.ink },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 10 } },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { outlined: { borderColor: tokens.border } },
    },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottomColor: tokens.divider },
        head: { color: tokens.muted, fontWeight: 500, fontSize: '0.8125rem' },
      },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 600 } },
    },
  },
});

export default theme;
