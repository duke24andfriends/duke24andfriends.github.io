import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { DataProvider } from './context/DataContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Leaderboard from './pages/Leaderboard';
import BracketMachine from './pages/BracketMachine';
import RoundPage from './pages/RoundPage';
import TeamPage from './pages/TeamPage';
import UserPage from './pages/UserPage';
import GamePage from './pages/GamePage';
import PoolAnalysisPage from './pages/PoolAnalysisPage';

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
      <DataProvider>
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/bracket-machine" element={<BracketMachine />} />
              <Route path="/rounds/:roundId" element={<RoundPage />} />
              <Route path="/teams/:teamCode" element={<TeamPage />} />
              <Route path="/users/:username" element={<UserPage />} />
              <Route path="/games/:gameId" element={<GamePage />} />
              <Route path="/pool-analysis" element={<PoolAnalysisPage />} />
            </Routes>
          </Layout>
        </Router>
      </DataProvider>
    </ThemeProvider>
  );
}

export default App; 