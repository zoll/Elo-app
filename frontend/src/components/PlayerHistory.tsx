import { useState, useEffect } from 'react';
import type { PlayerDetail } from '../types';
import { api } from '../api/client';

interface Props { playerId: number }

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function PlayerHistory({ playerId }: Props) {
  const [player, setPlayer] = useState<PlayerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api.getPlayer(playerId)
      .then(setPlayer)
      .catch(() => setError('Player not found.'))
      .finally(() => setLoading(false));
  }, [playerId]);

  if (loading) return <div className="loading" style={{ padding: 40 }}>Loading…</div>;
  if (error || !player) return <div className="card"><div className="error-msg">{error || 'Not found.'}</div></div>;

  const gamesPlayed = player.gamesWon + player.gamesLost;
  const winRate = gamesPlayed === 0 ? 0 : Math.round(player.gamesWon / gamesPlayed * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div className="card" style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <a className="btn-ghost" href="#leaderboard">← Back</a>
          <span style={{ fontWeight: 700, fontSize: '1.15rem' }}>{player.name}</span>
          <span className="elo-value" style={{ fontSize: '1.1rem' }}>{player.eloRating}</span>
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>
            <span className="badge badge-win" style={{ marginRight: 6 }}>{player.gamesWon}W</span>
            <span className="badge badge-loss" style={{ marginRight: 6 }}>{player.gamesLost}L</span>
            {winRate}% win rate
          </span>
          <span style={{ color: 'var(--muted)', fontSize: 12, marginLeft: 'auto' }}>
            Joined {new Date(player.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Game history */}
      <div className="card">
        <h3 className="card-title">Game History</h3>
        {player.games.length === 0 ? (
          <div className="empty-state">No games yet.</div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th className="hide-mobile">When</th>
                  <th>Opponent</th>
                  <th>Score</th>
                  <th>Result</th>
                  <th>ELO</th>
                </tr>
              </thead>
              <tbody>
                {player.games.map(g => (
                  <tr key={g.id}>
                    <td className="hide-mobile" style={{ color: 'var(--muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {timeAgo(g.playedAt)}
                    </td>
                    <td>
                      <a href={`#players/${g.opponentId}`} style={{ fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}>
                        {g.opponent}
                      </a>
                    </td>
                    <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                      <span className={g.isWin ? 'elo-change-pos' : 'elo-change-neg'}>{g.mySets}</span>
                      <span style={{ color: 'var(--muted)', margin: '0 3px' }}>–</span>
                      <span className={g.isWin ? 'elo-change-neg' : 'elo-change-pos'}>{g.opponentSets}</span>
                    </td>
                    <td>
                      <span className={`badge ${g.isWin ? 'badge-win' : 'badge-loss'}`}>
                        {g.isWin ? 'Win' : 'Loss'}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      <span style={{ color: 'var(--muted)', fontSize: 12 }}>{g.eloBefore} → {g.eloAfter} </span>
                      <span className={g.eloChange >= 0 ? 'elo-change-pos' : 'elo-change-neg'}>
                        {g.eloChange >= 0 ? '+' : ''}{g.eloChange}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
