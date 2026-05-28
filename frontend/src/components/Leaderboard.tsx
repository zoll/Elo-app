import type { Player } from '../types';

interface Props { players: Player[] }

const rankClass = (i: number) =>
  i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : '';

const rankLabel = (i: number) =>
  i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1);

export default function Leaderboard({ players }: Props) {
  if (players.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">No players yet. Add some players to get started!</div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="card-title">Leaderboard</h2>
      <div className="table-responsive">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>ELO</th>
              <th>W</th>
              <th>L</th>
              <th className="hide-mobile">Games</th>
              <th>Win%</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => (
              <tr key={p.id}>
                <td className={rankClass(i)} style={{ width: 40 }}>{rankLabel(i)}</td>
                <td style={{ fontWeight: 600 }}>{p.name}</td>
                <td className="elo-value">{p.eloRating}</td>
                <td><span className="badge badge-win">{p.gamesWon}</span></td>
                <td><span className="badge badge-loss">{p.gamesLost}</span></td>
                <td className="hide-mobile" style={{ color: 'var(--muted)' }}>{p.gamesPlayed}</td>
                <td style={{ minWidth: 80 }}>
                  <div className="win-rate-bar">
                    <div className="bar-bg">
                      <div className="bar-fill" style={{ width: `${p.winRate}%` }} />
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {p.winRate.toFixed(0)}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
