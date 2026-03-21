import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useParams } from 'react-router-dom';
import { DataProvider } from './context/DataContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Leaderboard from './pages/Leaderboard';
import BracketMachineTemp from './pages/BracketMachineTemp';
import RoundPage from './pages/RoundPage';
import TeamPage from './pages/TeamPage';
import UserPage from './pages/UserPage';
import GamePage from './pages/GamePage';
import PoolAnalysisPage from './pages/PoolAnalysisPage';
import { DEFAULT_YEAR, isSupportedYear } from './utils/yearRouting';

// Custom theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#0099ff',
      light: '#b3e0ff',
      dark: '#005999',
    },
    secondary: {
      main: '#f50057',
    },
  },
  typography: {
    fontFamily: 'Roboto, sans-serif',
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/" element={<Navigate to={`/${DEFAULT_YEAR}`} replace />} />
          <Route path="/:year/*" element={<YearShell />}>
            <Route index element={<Home />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="bracket-machine" element={<BracketMachineTemp />} />
            <Route path="rounds/:roundId" element={<RoundPage />} />
            <Route path="teams/:teamCode" element={<TeamPage />} />
            <Route path="users/:username" element={<UserPage />} />
            <Route path="games/:gameId" element={<GamePage />} />
            <Route path="pool-analysis" element={<PoolAnalysisPage />} />
          </Route>
          <Route path="*" element={<Navigate to={`/${DEFAULT_YEAR}`} replace />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

function YearShell() {
  const { year } = useParams();

  if (!isSupportedYear(year)) {
    return <Navigate to={`/${DEFAULT_YEAR}`} replace />;
  }

  return (
    <DataProvider year={year}>
      <Layout year={year}>
        <Outlet />
      </Layout>
    </DataProvider>
  );
}

export default App; 