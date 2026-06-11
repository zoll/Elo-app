import type { Game } from '../types';

interface Props { games: Game[] }

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function GameHistory({ games }: Props) {
  if (games.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">No games recorded yet. Play a match!</div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="card-title">Game History</h2>
      <div className="table-responsive">
        <table>
          <thead>
            <tr>
              <th className="hide-mobile">When</th>
              <th>Winner</th>
              <th>Score</th>
              <th>Loser</th>
              <th>±ELO</th>
            </tr>
          </thead>
          <tbody>
            {games.map(g => (
              <tr key={g.id}>
                <td className="hide-mobile" style={{ color: 'var(--muted)', whiteSpace: 'nowrap', fontSize: 12 }}>
                  {timeAgo(g.playedAt)}
                </td>
                <td>
                  <a href={`#players/${g.winnerId}`} style={{ fontWeight: 600, color: 'inherit', textDecoration: 'none' }}>{g.winner}</a>
                  <span className="elo-before-after" style={{ color: 'var(--muted)', fontSize: 11, marginLeft: 6 }}>
                    {g.winnerEloBefore}→{g.winnerEloAfter}
                  </span>
                </td>
                <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                  <span className="elo-change-pos">{g.winnerSets}</span>
                  <span style={{ color: 'var(--muted)', margin: '0 3px' }}>–</span>
                  <span className="elo-change-neg">{g.loserSets}</span>
                </td>
                <td>
                  <a href={`#players/${g.loserId}`} style={{ color: 'inherit', textDecoration: 'none' }}>{g.loser}</a>
                  <span className="elo-before-after" style={{ color: 'var(--muted)', fontSize: 11, marginLeft: 6 }}>
                    {g.loserEloBefore}→{g.loserEloAfter}
                  </span>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <span className="elo-change-pos">+{g.winnerEloChange}</span>
                  <span style={{ color: 'var(--muted)', margin: '0 4px' }}>/</span>
                  <span className="elo-change-neg">{g.loserEloChange}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
