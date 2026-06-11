import { useState, useEffect, useCallback } from 'react';
import type { Player, Game } from './types';
import { api } from './api/client';
import Leaderboard from './components/Leaderboard';
import RecordGame from './components/RecordGame';
import GameHistory from './components/GameHistory';
import AddPlayer from './components/AddPlayer';
import Tournaments from './components/Tournaments';

type Tab = 'leaderboard' | 'record' | 'history' | 'tournaments' | 'add';

const TABS: { id: Tab; label: string }[] = [
  { id: 'leaderboard', label: '🏆 Leaderboard' },
  { id: 'record', label: '🏓 Record Game' },
  { id: 'history', label: '📋 History' },
  { id: 'tournaments', label: '🎖️ Tournaments' },
  { id: 'add', label: '➕ Add Player' },
];

interface Route { tab: Tab; tournamentId?: number }

function parseHash(hash: string): Route {
  const h = hash.startsWith('#') ? hash.slice(1) : hash;
  const [segment, idStr] = h.split('/');
  const tab = TABS.some(t => t.id === segment) ? (segment as Tab) : 'leaderboard';
  const tournamentId = idStr ? parseInt(idStr, 10) : undefined;
  return { tab, tournamentId: tournamentId && !isNaN(tournamentId) ? tournamentId : undefined };
}

function hashFor(tab: Tab, tournamentId?: number) {
  return tournamentId ? `#${tab}/${tournamentId}` : `#${tab}`;
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((tab: Tab, tournamentId?: number) => {
    window.location.hash = hashFor(tab, tournamentId);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [p, g] = await Promise.all([api.getPlayers(), api.getGames()]);
      setPlayers(p);
      setGames(g);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect to backend');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <h1>🏓 Table Tennis ELO</h1>
          <nav className="tabs">
            {TABS.map(t => (
              <a
                key={t.id}
                href={hashFor(t.id)}
                className={`tab-btn${route.tab === t.id ? ' active' : ''}`}
              >
                {t.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="main">
        {error && (
          <div className="error-banner">
            ⚠️ {error} — make sure the backend is running on <strong>http://localhost:5000</strong>
          </div>
        )}

        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <>
            {route.tab === 'leaderboard' && <Leaderboard players={players} />}
            {route.tab === 'record' && <RecordGame players={players} onGameRecorded={loadData} />}
            {route.tab === 'history' && <GameHistory games={games} />}
            {route.tab === 'tournaments' && (
              <Tournaments
                players={players}
                initialTournamentId={route.tournamentId}
                onNavigate={(id) => navigate('tournaments', id)}
              />
            )}
            {route.tab === 'add' && <AddPlayer onPlayerAdded={loadData} />}
          </>
        )}
      </main>

      <footer className="footer">
        <a href="https://github.com/zoll/Elo-app" target="_blank" rel="noopener noreferrer">
          github.com/zoll/Elo-app
        </a>
      </footer>
    </div>
  );
}
