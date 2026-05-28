import { useState } from 'react';
import type { Game, Player } from '../types';
import { api } from '../api/client';

interface Props {
  players: Player[];
  onGameRecorded: () => void;
}

export default function RecordGame({ players, onGameRecorded }: Props) {
  const [player1Id, setPlayer1Id] = useState('');
  const [player2Id, setPlayer2Id] = useState('');
  const [player1Sets, setPlayer1Sets] = useState(0);
  const [player2Sets, setPlayer2Sets] = useState(0);
  const [result, setResult] = useState<Game | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const player1 = players.find(p => String(p.id) === player1Id);
  const player2 = players.find(p => String(p.id) === player2Id);
  const bothSelected = player1Id && player2Id && player1Id !== player2Id;
  const isTie = player1Sets === player2Sets;
  const noSetsPlayed = player1Sets + player2Sets === 0;
  const canSubmit = bothSelected && !isTie && !noSetsPlayed;

  const player1Wins = player1Sets > player2Sets;
  const winnerName = bothSelected
    ? (player1Wins ? player1?.name : player2?.name)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const winnerId = player1Wins ? Number(player1Id) : Number(player2Id);
    const loserId  = player1Wins ? Number(player2Id) : Number(player1Id);
    const winnerSets = player1Wins ? player1Sets : player2Sets;
    const loserSets  = player1Wins ? player2Sets : player1Sets;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const g = await api.recordGame(winnerId, loserId, winnerSets, loserSets);
      setResult(g);
      setPlayer1Id('');
      setPlayer2Id('');
      setPlayer1Sets(0);
      setPlayer2Sets(0);
      onGameRecorded();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to record game');
    } finally {
      setLoading(false);
    }
  };

  if (players.length < 2) {
    return (
      <div className="card">
        <div className="empty-state">You need at least 2 players to record a game.</div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="card-title">Record Game</h2>
      <form onSubmit={(e) => { void handleSubmit(e); }} style={{ maxWidth: 460 }}>

        <div className="score-row">
          <select
            className="score-player-select"
            value={player1Id}
            onChange={e => setPlayer1Id(e.target.value)}
          >
            <option value="">Select player...</option>
            {players.map(p => (
              <option key={p.id} value={p.id} disabled={String(p.id) === player2Id}>
                {p.name} ({p.eloRating})
              </option>
            ))}
          </select>
          <div className="sets-control">
            <button type="button" className="sets-btn" onClick={() => setPlayer1Sets(s => Math.max(0, s - 1))}>−</button>
            <span className="sets-value">{player1Sets}</span>
            <button type="button" className="sets-btn" onClick={() => setPlayer1Sets(s => s + 1)}>+</button>
          </div>
        </div>

        <div className="score-row">
          <select
            className="score-player-select"
            value={player2Id}
            onChange={e => setPlayer2Id(e.target.value)}
          >
            <option value="">Select player...</option>
            {players.map(p => (
              <option key={p.id} value={p.id} disabled={String(p.id) === player1Id}>
                {p.name} ({p.eloRating})
              </option>
            ))}
          </select>
          <div className="sets-control">
            <button type="button" className="sets-btn" onClick={() => setPlayer2Sets(s => Math.max(0, s - 1))}>−</button>
            <span className="sets-value">{player2Sets}</span>
            <button type="button" className="sets-btn" onClick={() => setPlayer2Sets(s => s + 1)}>+</button>
          </div>
        </div>

        <div className="score-preview">
          {!bothSelected && <span style={{ color: 'var(--muted)' }}>Select two players</span>}
          {bothSelected && noSetsPlayed && <span style={{ color: 'var(--muted)' }}>Enter set scores</span>}
          {bothSelected && isTie && !noSetsPlayed && <span style={{ color: 'var(--gold)' }}>Tied — no winner</span>}
          {bothSelected && !isTie && (
            <span className="elo-change-pos">
              🏆 {winnerName} wins {Math.max(player1Sets, player2Sets)}–{Math.min(player1Sets, player2Sets)}
            </span>
          )}
        </div>

        {error && <div className="error-msg">⚠️ {error}</div>}

        <button type="submit" className="btn" disabled={loading || !canSubmit}>
          {loading ? 'Recording...' : 'Submit Result'}
        </button>
      </form>

      {result && (
        <div className="result-box">
          <h3>🏆 {result.winner} defeats {result.loser}! ({result.winnerSets}–{result.loserSets})</h3>
          <div className="result-players">
            <div className="result-player">
              <div className="result-player-name">{result.winner}</div>
              <div className="result-elo">{result.winnerEloBefore} → {result.winnerEloAfter}</div>
              <div className="result-change elo-change-pos">+{result.winnerEloChange}</div>
            </div>
            <div className="result-player">
              <div className="result-player-name">{result.loser}</div>
              <div className="result-elo">{result.loserEloBefore} → {result.loserEloAfter}</div>
              <div className="result-change elo-change-neg">{result.loserEloChange}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
