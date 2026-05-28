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

export default function App() {
  const [tab, setTab] = useState<Tab>('leaderboard');
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
              <button
                key={t.id}
                className={`tab-btn${tab === t.id ? ' active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
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
            {tab === 'leaderboard' && <Leaderboard players={players} />}
            {tab === 'record' && <RecordGame players={players} onGameRecorded={loadData} />}
            {tab === 'history' && <GameHistory games={games} />}
            {tab === 'tournaments' && <Tournaments players={players} />}
            {tab === 'add' && <AddPlayer onPlayerAdded={loadData} />}
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
