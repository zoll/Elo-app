import type { Game, Player, Tournament, TournamentSummary, TournamentFormat } from '../types';

const API = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getPlayers: () => request<Player[]>('/players'),
  createPlayer: (name: string) =>
    request<Player>('/players', { method: 'POST', body: JSON.stringify({ name }) }),
  getGames: (limit = 50) => request<Game[]>(`/games?limit=${limit}`),
  recordGame: (winnerId: number, loserId: number, winnerSets: number, loserSets: number) =>
    request<Game>('/games', {
      method: 'POST',
      body: JSON.stringify({ winnerId, loserId, winnerSets, loserSets }),
    }),
  getTournaments: () => request<TournamentSummary[]>('/tournaments'),
  getTournament: (id: number) => request<Tournament>(`/tournaments/${id}`),
  createTournament: (name: string, format: TournamentFormat) =>
    request<Tournament>('/tournaments', { method: 'POST', body: JSON.stringify({ name, format }) }),
  addParticipant: (tournamentId: number, playerId: number) =>
    request<Tournament>(`/tournaments/${tournamentId}/participants`, {
      method: 'POST', body: JSON.stringify({ playerId }),
    }),
  removeParticipant: (tournamentId: number, playerId: number) =>
    request<Tournament>(`/tournaments/${tournamentId}/participants/${playerId}`, { method: 'DELETE' }),
  startTournament: (tournamentId: number) =>
    request<Tournament>(`/tournaments/${tournamentId}/start`, { method: 'POST', body: '{}' }),
  recordTournamentResult: (tournamentId: number, matchId: number, player1Sets: number, player2Sets: number) =>
    request<Tournament>(`/tournaments/${tournamentId}/matches/${matchId}/result`, {
      method: 'POST',
      body: JSON.stringify({ player1Sets, player2Sets }),
    }),
  addTimeTrialEntry: (tournamentId: number, playerId: number, timeMs: number) =>
    request<Tournament>(`/tournaments/${tournamentId}/timetrial`, {
      method: 'POST',
      body: JSON.stringify({ playerId, timeMs }),
    }),
  completeTournament: (tournamentId: number) =>
    request<Tournament>(`/tournaments/${tournamentId}/complete`, { method: 'POST', body: '{}' }),
};
