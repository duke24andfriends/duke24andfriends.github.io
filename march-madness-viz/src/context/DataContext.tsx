import React, { createContext, useContext, useState, useEffect } from 'react';
import { calculateRoundAccuracy, calculateHypotheticalScores, parseGameResults, parseUserNameMapping, UserNameMapping } from '../utils/dataProcessing';
import { BracketData, GameWinner, UserScore, RoundAccuracy, LeaderboardTrend, GameResult, ROUNDS, getPointsForGame } from '../types';

interface DataContextProps {
  bracketData: BracketData | null;
  gameWinners: GameWinner[];
  gameResults: GameResult[];
  userScores: UserScore[];
  userNameMapping: Record<string, UserNameMapping>;
  filteredUsernames: string[];
  roundAccuracy: Record<string, RoundAccuracy>;
  teamConfidence: Array<{ team: string } & Record<string, number>>;
  leaderboardTrend: LeaderboardTrend[];
  loading: boolean;
  error: string | null;
  setFilteredUsernames: (usernames: string[]) => void;
  setHypotheticalWinners: (winners: GameWinner[]) => void;
  resetHypotheticalWinners: () => void;
}

const DataContext = createContext<DataContextProps | undefined>(undefined);

interface DataProviderProps {
  children: React.ReactNode;
}

export const DataProvider = ({ children }: DataProviderProps) => {
  const [bracketData, setBracketData] = useState<BracketData | null>(null);
  const [gameWinners, setGameWinners] = useState<GameWinner[]>([]);
  const [gameResults, setGameResults] = useState<GameResult[]>([]);
  const [userScores, setUserScores] = useState<UserScore[]>([]);
  const [userNameMapping, setUserNameMapping] = useState<Record<string, UserNameMapping>>({});
  const [filteredUsernames, setFilteredUsernames] = useState<string[]>([]);
  const [roundAccuracy, setRoundAccuracy] = useState<Record<string, RoundAccuracy>>({});
  const [teamConfidence, setTeamConfidence] = useState<Array<{ team: string } & Record<string, number>>>([]);
  const [leaderboardTrend, setLeaderboardTrend] = useState<LeaderboardTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Store hypothetical winners for bracket machine
  const [hypotheticalWinners, setHypotheticalWinners] = useState<GameWinner[]>([]);
  
  // Reset hypothetical winners to their initial state
  const resetHypotheticalWinners = () => {
    setHypotheticalWinners([]);
  };
  
  // Load data from JSON and CSV files
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch bracket data
        const bracketResponse = await fetch('/data/duke24.json');
        const bracketData: BracketData = await bracketResponse.json();

        console.log(bracketData.metadata.total_brackets)

        const totalBrackets = bracketData.metadata.total_brackets;
        
        // Fetch game results with seed information
        const resultsResponse = await fetch('/data/game_results_with_seed.csv');
        const resultsCSV = await resultsResponse.text();
        const gameResults = parseGameResults(resultsCSV);
        
        // Fetch user to name mapping
        const userNameMappingResponse = await fetch('/data/user_to_name_mapping.csv');
        const userNameMappingCSV = await userNameMappingResponse.text();
        const userNameMappings = parseUserNameMapping(userNameMappingCSV);
        
        // Convert user mapping array to record for easy lookup
        const userNameMappingRecord: Record<string, UserNameMapping> = {};
        userNameMappings.forEach(mapping => {
          userNameMappingRecord[mapping.username] = mapping;
        });
        
        // Derive game winners from game results
        const gameWinners = gameResults.map(result => ({
          gameId: result.gameId,
          winner: result.winner
        }));
        
        // Process data
        const roundAccuracy = calculateRoundAccuracy(bracketData, gameWinners);
        
        // Calculate user scores with round breakdowns
        let userScores = calculateHypotheticalScores(bracketData, gameWinners, []);
        
        // Enhance user scores with round scores, champion picks, and max possible scores
        // and add user name mapping info
        userScores = userScores.map(userScore => {
          const { username } = userScore;
          const roundScores: Record<string, number> = {
            ROUND_64: 0,
            ROUND_32: 0,
            SWEET_16: 0,
            ELITE_8: 0,
            FINAL_FOUR: 0,
            CHAMPIONSHIP: 0
          };
          
          // Calculate scores per round
          gameWinners.forEach(gameWinner => {
            const game = bracketData.games[gameWinner.gameId];
            const round = getPointsForGame(gameWinner.gameId);
            const roundName = Object.keys(ROUNDS).find(key => 
              ROUNDS[key as keyof typeof ROUNDS].includes(gameWinner.gameId)
            ) || '';
            
            if (game && game.picks[username] === gameWinner.winner) {
              roundScores[roundName] = (roundScores[roundName] || 0) + round;
            }
          });
          
          // Find champion pick
          const championshipGame = bracketData.games['63'];
          const champion = championshipGame ? championshipGame.picks[username] : undefined;
          
          // Calculate max possible score
          let maxPossibleScore = userScore.score;
          
          // Add potential points from games that haven't been played yet
          const completedGameIds = new Set(gameWinners.map(g => g.gameId));
          
          Object.entries(bracketData.games).forEach(([gameId, game]) => {
            if (!completedGameIds.has(gameId) && game.picks[username]) {
              // Check if the picked team is still viable (hasn't been eliminated)
              const pick = game.picks[username];
              const isEliminated = gameResults.some(result => 
                result.loser === pick
              );
              
              if (!isEliminated) {
                maxPossibleScore += getPointsForGame(gameId);
              }
            }
          });
          
          // Get user's real name and bracket name if available
          const nameMapping = userNameMappingRecord[username];
          
          return {
            ...userScore,
            roundScores,
            champion,
            maxPossibleScore,
            bracketName: nameMapping?.bracketName || username,
            fullName: nameMapping?.fullName || username
          };
        });
        
        // Calculate team confidence
        const teams = new Set<string>();
        Object.values(bracketData.games).forEach(game => {
          Object.values(game.picks).forEach(team => {
            teams.add(team);
          });
        });
        
        // Create team confidence data - percentage of users who picked each team
        // to reach each round
        const teamConfidence = Array.from(teams).map(team => {
          const confidence = { team } as { team: string } & Record<string, number>;
          // Round of 64
          const round64Games = Object.entries(bracketData.games)
            .filter(([id]) => parseInt(id) >= 1 && parseInt(id) <= 32);
          const round64Picks = round64Games.reduce((count, [_, game]) => 
            count + Object.values(game.picks).filter(pick => pick === team).length, 0);
          confidence.round64 = (round64Picks / totalBrackets) * 100;
          confidence.round64_count = round64Picks;
          
          // Round of 32
          const round32Games = Object.entries(bracketData.games)
            .filter(([id]) => parseInt(id) >= 33 && parseInt(id) <= 48);
          const round32Picks = round32Games.reduce((count, [_, game]) => 
            count + Object.values(game.picks).filter(pick => pick === team).length, 0);
          confidence.round32 = (round32Picks / totalBrackets) * 100;
          confidence.round32_count = round32Picks;
          
          // Sweet 16
          const sweet16Games = Object.entries(bracketData.games)
            .filter(([id]) => parseInt(id) >= 49 && parseInt(id) <= 56);
          const sweet16Picks = sweet16Games.reduce((count, [_, game]) => 
            count + Object.values(game.picks).filter(pick => pick === team).length, 0);
          confidence.sweet16 = (sweet16Picks / totalBrackets) * 100;
          confidence.sweet16_count = sweet16Picks;
          
          // Elite 8
          const elite8Games = Object.entries(bracketData.games)
            .filter(([id]) => parseInt(id) >= 57 && parseInt(id) <= 60);
          const elite8Picks = elite8Games.reduce((count, [_, game]) => 
            count + Object.values(game.picks).filter(pick => pick === team).length, 0);
          confidence.elite8 = (elite8Picks / totalBrackets) * 100;
          confidence.elite8_count = elite8Picks;
          
          // Final Four
          const finalFourGames = Object.entries(bracketData.games)
            .filter(([id]) => parseInt(id) >= 61 && parseInt(id) <= 62);
          const finalFourPicks = finalFourGames.reduce((count, [_, game]) => 
            count + Object.values(game.picks).filter(pick => pick === team).length, 0);
          confidence.finalFour = (finalFourPicks / totalBrackets) * 100;
          confidence.finalFour_count = finalFourPicks;
          
          // Championship
          const championshipGame = bracketData.games['63'];
          const championshipPicks = championshipGame 
            ? Object.values(championshipGame.picks).filter(pick => pick === team).length 
            : 0;
          confidence.championship = (championshipPicks / totalBrackets) * 100;
          confidence.championship_count = championshipPicks;
          
          return confidence;
        });
        
        // Calculate leaderboard trend using the order property for sorting
        // Sort games by their order (chronological sequence they were played)
        const orderedGames = [...gameResults]
          .sort((a, b) => a.order - b.order);
        
        const leaderboardTrend: LeaderboardTrend[] = [];
        let cumulativeWinners: GameWinner[] = [];
        
        for (const game of orderedGames) {
          const winner = {
            gameId: game.gameId,
            winner: game.winner
          };
          
          cumulativeWinners = [...cumulativeWinners, winner];
          const scoresAtPoint = calculateHypotheticalScores(bracketData, cumulativeWinners, []);
          
          leaderboardTrend.push({
            gameId: game.gameId,
            scores: scoresAtPoint,
            order: game.order
          });
        }
        
        // Set state with all processed data
        setBracketData(bracketData);
        setGameWinners(gameWinners);
        setGameResults(gameResults);
        setRoundAccuracy(roundAccuracy);
        setUserScores(userScores);
        setTeamConfidence(teamConfidence);
        setLeaderboardTrend(leaderboardTrend);
        setUserNameMapping(userNameMappingRecord);
        setError(null);
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load bracket data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  // Recalculate user scores when hypothetical winners change
  useEffect(() => {
    if (bracketData) {
      const newScores = calculateHypotheticalScores(bracketData, gameWinners, hypotheticalWinners);
      
      // Add user name mapping info to scores
      const enhancedScores = newScores.map(score => {
        const nameMapping = userNameMapping[score.username];
        return {
          ...score,
          bracketName: nameMapping?.bracketName || score.username,
          fullName: nameMapping?.fullName || score.username
        };
      });
      
      setUserScores(enhancedScores);
    }
  }, [bracketData, gameWinners, hypotheticalWinners, userNameMapping]);
  
  // Parse URL params for filtered usernames
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const userParam = urlParams.get('users');
    
    if (userParam) {
      const usernames = userParam.split(',');
      setFilteredUsernames(usernames);
    }
  }, []);
  
  const value = {
    bracketData,
    gameWinners,
    gameResults,
    userScores,
    userNameMapping,
    filteredUsernames,
    roundAccuracy,
    teamConfidence,
    leaderboardTrend,
    loading,
    error,
    setFilteredUsernames,
    setHypotheticalWinners,
    resetHypotheticalWinners
  };
  
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}; 