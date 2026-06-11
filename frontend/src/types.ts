export type TournamentFormat = 'SingleElim' | 'DoubleElim' | 'Swiss' | 'TimeTrial';
export type TournamentStatus = 'Pending' | 'InProgress' | 'Completed';
export type MatchBracket = 'Winners' | 'Losers' | 'GrandFinal' | null;

export interface TournamentSummary {
  id: number;
  name: string;
  format: TournamentFormat;
  status: TournamentStatus;
  swissRounds: number | null;
  createdAt: string;
  playerCount: number;
  winnerName: string | null;
}

export interface TimeTrialEntry {
  id: number;
  playerId: number;
  playerName: string;
  timeMs: number;
  recordedAt: string;
}

export interface TournamentParticipant {
  id: number;
  seed: number;
  wins: number;
  losses: number;
  points: number;
  playerId: number;
  playerName: string;
}

export interface TournamentMatch {
  id: number;
  round: number;
  matchNumber: number;
  bracket: MatchBracket;
  player1Id: number | null;
  player1Name: string | null;
  player2Id: number | null;
  player2Name: string | null;
  winnerId: number | null;
  winnerName: string | null;
  player1Sets: number | null;
  player2Sets: number | null;
  isBye: boolean;
  nextWinnerMatchId: number | null;
  nextLoserMatchId: number | null;
}

export interface Tournament extends TournamentSummary {
  participants: TournamentParticipant[];
  matches: TournamentMatch[];
  timeTrialEntries: TimeTrialEntry[];
}

export interface Player {
  id: number;
  name: string;
  eloRating: number;
  gamesWon: number;
  gamesLost: number;
  gamesPlayed: number;
  winRate: number;
  createdAt: string;
}

export interface Game {
  id: number;
  playedAt: string;
  winner: string;
  winnerId: number;
  loser: string;
  loserId: number;
  winnerEloBefore: number;
  loserEloBefore: number;
  winnerEloAfter: number;
  loserEloAfter: number;
  winnerEloChange: number;
  loserEloChange: number;
  winnerSets: number;
  loserSets: number;
}
