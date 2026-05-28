import { useState } from 'react';
import { api } from '../api/client';

interface Props { onPlayerAdded: () => void }

export default function AddPlayer({ onPlayerAdded }: Props) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const p = await api.createPlayer(name.trim());
      setSuccess(`"${p.name}" added with starting ELO of 1000.`);
      setName('');
      onPlayerAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add player');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2 className="card-title">Add Player</h2>
      <form onSubmit={(e) => { void handleSubmit(e); }} style={{ maxWidth: 380 }}>
        <div className="form-group">
          <label>Player Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Enter player name..."
            maxLength={100}
            required
            autoFocus
          />
        </div>

        {error && <div className="error-msg">⚠️ {error}</div>}
        {success && <div className="success-msg">✓ {success}</div>}

        <button type="submit" className="btn" disabled={loading || !name.trim()}>
          {loading ? 'Adding...' : 'Add Player'}
        </button>
      </form>
    </div>
  );
}
