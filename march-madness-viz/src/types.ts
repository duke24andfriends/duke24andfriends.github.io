import React from 'react';

// React types
export type ReactNode = React.ReactNode;
export type FC<P = {}> = React.FC<P>;
export type SyntheticEvent = React.SyntheticEvent;

// Game related types
export interface GameWinner {
  gameId: string;
  winner: string;
}

export interface GameResult {
  gameId: string;
  winner: string;
  loser: string;
  winnerSeed: number;
  loserSeed: number;
}

// Function to determine the round name from a game ID
export const getRoundNameFromGameId = (gameId: string): string => {
  const id = parseInt(gameId);
  if (id <= 32) return "ROUND_64";
  if (id <= 48) return "ROUND_32";
  if (id <= 56) return "SWEET_16";
  if (id <= 60) return "ELITE_8";
  if (id <= 62) return "FINAL_FOUR";
  return "CHAMPIONSHIP";
}; 