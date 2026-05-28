import { useState, useEffect, useCallback } from 'react';
import type { Player, Tournament, TournamentSummary, TournamentFormat, TournamentMatch } from '../types';
import { api } from '../api/client';

interface Props { players: Player[] }

export default function Tournaments({ players }: Props) {
  const [list, setList] = useState<TournamentSummary[]>([]);
  const [selected, setSelected] = useState<Tournament | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadList = useCallback(async () => {
    setLoading(true);
    try { setList(await api.getTournaments()); } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadList(); }, [loadList]);

  const openTournament = async (id: number) => setSelected(await api.getTournament(id));

  const onCreated = async (t: Tournament) => {
    setCreating(false);
    await loadList();
    setSelected(t);
  };

  const onUpdated = (t: Tournament) => setSelected(t);

  if (creating)
    return <CreateTournament onCreated={onCreated} onCancel={() => setCreating(false)} />;

  if (selected)
    return (
      <TournamentDetail
        tournament={selected}
        players={players}
        onUpdated={onUpdated}
        onBack={() => { setSelected(null); void loadList(); }}
      />
    );

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 className="card-title" style={{ marginBottom: 0 }}>Tournaments</h2>
        <button className="btn" onClick={() => setCreating(true)}>+ New Tournament</button>
      </div>

      {loading ? (
        <div className="loading" style={{ padding: 40 }}>Loading...</div>
      ) : list.length === 0 ? (
        <div className="empty-state">No tournaments yet. Create one to get started!</div>
      ) : (
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Format</th>
                <th>Players</th>
                <th>Status</th>
                <th className="hide-mobile">Winner</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map(t => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{t.name}</td>
                  <td><span className="badge" style={{ background: 'var(--surface2)', color: 'var(--text)' }}>{formatLabel(t.format)}</span></td>
                  <td style={{ color: 'var(--muted)' }}>{t.playerCount}</td>
                  <td><StatusBadge status={t.status} /></td>
                  <td className="hide-mobile" style={{ fontWeight: t.winnerName ? 600 : undefined, color: t.winnerName ? 'var(--win)' : 'var(--muted)' }}>
                    {t.winnerName ? `🏆 ${t.winnerName}` : '—'}
                  </td>
                  <td><button className="btn-sm" onClick={() => void openTournament(t.id)}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Create Form ───────────────────────────────────────────────────────────────

function CreateTournament({ onCreated, onCancel }: {
  onCreated: (t: Tournament) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [format, setFormat] = useState<TournamentFormat>('SingleElim');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!name.trim()) { setError('Enter a tournament name.'); return; }
    setSubmitting(true); setError('');
    try {
      await onCreated(await api.createTournament(name.trim(), format));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create tournament');
      setSubmitting(false);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <button className="btn-ghost" onClick={onCancel}>← Back</button>
        <h2 className="card-title" style={{ marginBottom: 0 }}>New Tournament</h2>
      </div>
      {error && <div className="error-msg">{error}</div>}
      <div className="form-group">
        <label>Name</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Office Championship" />
      </div>
      <div className="form-group">
        <label>Format</label>
        <select value={format} onChange={e => setFormat(e.target.value as TournamentFormat)}>
          <option value="SingleElim">Single Elimination</option>
          <option value="DoubleElim">Double Elimination</option>
          <option value="Swiss">Swiss</option>
        </select>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 16px' }}>
        Players sign up after creation. Start the tournament when everyone is ready.
      </p>
      <button className="btn" onClick={() => void submit()} disabled={submitting}>
        {submitting ? 'Creating…' : 'Create Tournament'}
      </button>
    </div>
  );
}

// ── Tournament Detail ─────────────────────────────────────────────────────────

function TournamentDetail({ tournament, players, onUpdated, onBack }: {
  tournament: Tournament;
  players: Player[];
  onUpdated: (t: Tournament) => void;
  onBack: () => void;
}) {
  const champ = getChampion(tournament);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn-ghost" onClick={onBack}>← Back</button>
          <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{tournament.name}</span>
          <span className="badge" style={{ background: 'var(--surface2)', color: 'var(--text)' }}>{formatLabel(tournament.format)}</span>
          <StatusBadge status={tournament.status} />
          {champ && <span style={{ fontWeight: 700, color: 'var(--win)' }}>🏆 {champ.name}</span>}
        </div>
      </div>

      {tournament.status === 'Pending' ? (
        <PendingView tournament={tournament} players={players} onUpdated={onUpdated} />
      ) : (
        <>
          {tournament.format === 'Swiss'
            ? <SwissView tournament={tournament} onResultRecorded={onUpdated} />
            : <BracketView tournament={tournament} onResultRecorded={onUpdated} />}
          <StandingsView tournament={tournament} />
        </>
      )}
    </div>
  );
}

// ── Pending / Signup View ─────────────────────────────────────────────────────

function PendingView({ tournament, players, onUpdated }: {
  tournament: Tournament;
  players: Player[];
  onUpdated: (t: Tournament) => void;
}) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | ''>('');
  const [adding, setAdding] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const registeredIds = new Set(tournament.participants.map(p => p.playerId));
  const available = players.filter(p => !registeredIds.has(p.id));
  const canStart = tournament.participants.length >= 2;
  const estimatedRounds = tournament.format === 'Swiss' && tournament.participants.length >= 2
    ? Math.max(3, Math.ceil(Math.log2(tournament.participants.length)) + 1)
    : null;

  const add = async () => {
    if (!selectedPlayerId) return;
    setAdding(true); setError('');
    try {
      onUpdated(await api.addParticipant(tournament.id, selectedPlayerId as number));
      setSelectedPlayerId('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error adding player');
    } finally { setAdding(false); }
  };

  const remove = async (playerId: number) => {
    setError('');
    try { onUpdated(await api.removeParticipant(tournament.id, playerId)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Error removing player'); }
  };

  const start = async () => {
    setStarting(true); setError('');
    try { onUpdated(await api.startTournament(tournament.id)); }
    catch (e) {
      setError(e instanceof Error ? e.message : 'Error starting tournament');
      setStarting(false);
    }
  };

  return (
    <div className="card">
      <h3 className="card-title">
        Registration
        <span style={{ fontWeight: 400, fontSize: '0.9rem', color: 'var(--muted)', marginLeft: 8 }}>
          {tournament.participants.length} player{tournament.participants.length !== 1 ? 's' : ''}
        </span>
      </h3>
      {error && <div className="error-msg">{error}</div>}
      {tournament.participants.length === 0 ? (
        <div className="empty-state" style={{ padding: '16px 0' }}>No players signed up yet.</div>
      ) : (
        <div className="player-select-list" style={{ marginBottom: 16 }}>
          {[...tournament.participants].sort((a, b) => a.seed - b.seed).map(p => (
            <div key={p.id} className="player-select-row selected" style={{ cursor: 'default' }}>
              <span className="player-seed">{p.seed}</span>
              <span>{p.playerName}</span>
              <button
                className="btn-ghost"
                style={{ fontSize: 12, marginLeft: 'auto', color: 'var(--loss)' }}
                onClick={() => void remove(p.playerId)}
              >Remove</button>
            </div>
          ))}
        </div>
      )}
      {available.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <select value={selectedPlayerId} onChange={e => setSelectedPlayerId(e.target.value ? Number(e.target.value) : '')} style={{ flex: 1 }}>
            <option value="">— Add a player —</option>
            {available.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn" onClick={() => void add()} disabled={!selectedPlayerId || adding}>
            {adding ? '…' : 'Add'}
          </button>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => void start()} disabled={!canStart || starting}>
          {starting ? 'Starting…' : 'Start Tournament'}
        </button>
        {!canStart && <span style={{ color: 'var(--muted)', fontSize: 13 }}>Need at least 2 players to start</span>}
        {estimatedRounds && <span style={{ color: 'var(--muted)', fontSize: 13 }}>{estimatedRounds} rounds (Swiss)</span>}
      </div>
    </div>
  );
}

// ── Bracket View ──────────────────────────────────────────────────────────────

function BracketView({ tournament, onResultRecorded }: {
  tournament: Tournament;
  onResultRecorded: (t: Tournament) => void;
}) {
  const [scoringMatch, setScoringMatch] = useState<TournamentMatch | null>(null);
  const isVoid = (m: TournamentMatch) => m.isBye && !m.player1Id && !m.player2Id;

  const handleSaved = (t: Tournament) => { setScoringMatch(null); onResultRecorded(t); };

  if (tournament.format === 'DoubleElim') {
    const wb = tournament.matches.filter(m => m.bracket === 'Winners' && !isVoid(m));
    const lb = tournament.matches.filter(m => m.bracket === 'Losers' && !isVoid(m));
    const gf = tournament.matches.filter(m => m.bracket === 'GrandFinal');
    return (
      <>
        {scoringMatch && <ScoreModal match={scoringMatch} tournament={tournament} onSaved={handleSaved} onClose={() => setScoringMatch(null)} />}
        <div className="card">
          <h3 className="card-title">Winners Bracket</h3>
          <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
            <BracketTree matches={wb} onEnterScore={setScoringMatch} />
          </div>
        </div>
        {lb.length > 0 && (
          <div className="card">
            <h3 className="card-title">Losers Bracket</h3>
            <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
              <BracketColumns matches={lb} onEnterScore={setScoringMatch} />
            </div>
          </div>
        )}
        {gf.length > 0 && (
          <div className="card" style={{ maxWidth: 280 }}>
            <h3 className="card-title">Grand Final</h3>
            <BracketMatchCard match={gf[0]} onEnterScore={setScoringMatch} />
          </div>
        )}
      </>
    );
  }

  const matches = tournament.matches.filter(m => !isVoid(m));
  return (
    <>
      {scoringMatch && <ScoreModal match={scoringMatch} tournament={tournament} onSaved={handleSaved} onClose={() => setScoringMatch(null)} />}
      <div className="card">
        <h3 className="card-title">Bracket</h3>
        <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
          <BracketTree matches={matches} onEnterScore={setScoringMatch} />
        </div>
      </div>
    </>
  );
}

// ── Bracket layout constants ──────────────────────────────────────────────────

const B = { CARD_H: 72, CARD_W: 220, COL_GAP: 56, ROW_GAP: 16 } as const;
const SLOT_H = B.CARD_H + B.ROW_GAP; // 88

function groupByRound(matches: TournamentMatch[]) {
  const map = new Map<number, TournamentMatch[]>();
  for (const m of matches) {
    if (!map.has(m.round)) map.set(m.round, []);
    map.get(m.round)!.push(m);
  }
  return [...map.keys()].sort((a, b) => a - b)
    .map(r => map.get(r)!.sort((a, b) => a.matchNumber - b.matchNumber));
}

function buildPaths(matches: TournamentMatch[], positions: Map<number, { x: number; y: number }>) {
  const ids = new Set(matches.map(m => m.id));
  return matches
    .filter(m => m.nextWinnerMatchId && ids.has(m.nextWinnerMatchId))
    .map(m => {
      const from = positions.get(m.id);
      const to = positions.get(m.nextWinnerMatchId!);
      if (!from || !to) return null;
      const x1 = from.x + B.CARD_W, y1 = from.y + B.CARD_H / 2;
      const x2 = to.x,               y2 = to.y + B.CARD_H / 2;
      const mx = x1 + B.COL_GAP / 2;
      return { key: m.id, d: `M ${x1} ${y1} H ${mx} V ${y2} H ${x2}` };
    })
    .filter(Boolean) as Array<{ key: number; d: string }>;
}

// ── Bracket Tree — doubling spacing (for WB and single-elim) ─────────────────

function BracketTree({ matches, onEnterScore }: {
  matches: TournamentMatch[];
  onEnterScore: (m: TournamentMatch) => void;
}) {
  const rounds = groupByRound(matches);
  if (rounds.length === 0) return null;

  const numR1 = rounds[0].length;
  const totalH = numR1 * SLOT_H;
  const totalW = rounds.length * (B.CARD_W + B.COL_GAP) - B.COL_GAP;

  const positions = new Map<number, { x: number; y: number }>();
  rounds.forEach((roundMatches, rIdx) => {
    const slotsPerMatch = Math.pow(2, rIdx);
    roundMatches.forEach((m, mIdx) => {
      positions.set(m.id, {
        x: rIdx * (B.CARD_W + B.COL_GAP),
        y: (mIdx * slotsPerMatch + (slotsPerMatch - 1) / 2) * SLOT_H,
      });
    });
  });

  const paths = buildPaths(matches, positions);

  return (
    <div style={{ position: 'relative', width: totalW, height: totalH }}>
      <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }} width={totalW} height={totalH}>
        {paths.map(p => <path key={p.key} d={p.d} stroke="var(--border)" strokeWidth={2} fill="none" />)}
      </svg>
      {matches.map(m => {
        const pos = positions.get(m.id);
        return pos ? (
          <div key={m.id} style={{ position: 'absolute', left: pos.x, top: pos.y, width: B.CARD_W }}>
            <BracketMatchCard match={m} onEnterScore={onEnterScore} />
          </div>
        ) : null;
      })}
    </div>
  );
}

// ── Bracket Columns — even spacing (for LB with irregular round sizes) ────────

function BracketColumns({ matches, onEnterScore }: {
  matches: TournamentMatch[];
  onEnterScore: (m: TournamentMatch) => void;
}) {
  const rounds = groupByRound(matches);
  if (rounds.length === 0) return null;

  const maxPerRound = Math.max(...rounds.map(r => r.length));
  const totalH = maxPerRound * SLOT_H;
  const totalW = rounds.length * (B.CARD_W + B.COL_GAP) - B.COL_GAP;

  const positions = new Map<number, { x: number; y: number }>();
  rounds.forEach((roundMatches, rIdx) => {
    roundMatches.forEach((m, mIdx) => {
      const centerY = (mIdx + 0.5) * (totalH / roundMatches.length);
      positions.set(m.id, {
        x: rIdx * (B.CARD_W + B.COL_GAP),
        y: centerY - B.CARD_H / 2,
      });
    });
  });

  const paths = buildPaths(matches, positions);

  return (
    <div style={{ position: 'relative', width: totalW, height: totalH }}>
      <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }} width={totalW} height={totalH}>
        {paths.map(p => <path key={p.key} d={p.d} stroke="var(--border)" strokeWidth={2} fill="none" />)}
      </svg>
      {matches.map(m => {
        const pos = positions.get(m.id);
        return pos ? (
          <div key={m.id} style={{ position: 'absolute', left: pos.x, top: pos.y, width: B.CARD_W }}>
            <BracketMatchCard match={m} onEnterScore={onEnterScore} />
          </div>
        ) : null;
      })}
    </div>
  );
}

// ── Bracket Match Card ────────────────────────────────────────────────────────

function BracketMatchCard({ match, onEnterScore }: {
  match: TournamentMatch;
  onEnterScore: (m: TournamentMatch) => void;
}) {
  const done = match.winnerId !== null;
  const ready = !done && !!match.player1Id && !!match.player2Id && !match.isBye;
  const p1win = done && match.winnerId === match.player1Id;
  const p2win = done && match.winnerId === match.player2Id;

  return (
    <div
      className={`brac-card${ready ? ' brac-ready' : ''}${done ? ' brac-done' : ''}`}
      onClick={ready ? () => onEnterScore(match) : undefined}
    >
      <div className={`brac-slot${p1win ? ' brac-win' : ''}`}>
        <span className="brac-name">{match.player1Name ?? (match.isBye ? '—' : 'TBD')}</span>
        {done && <span className="brac-score">{match.player1Sets}</span>}
      </div>
      <div className="brac-sep" />
      <div className={`brac-slot${p2win ? ' brac-win' : ''}`}>
        <span className={`brac-name${match.isBye ? ' brac-bye-label' : ''}`}>
          {match.isBye ? 'BYE' : (match.player2Name ?? 'TBD')}
        </span>
        {done && !match.isBye && <span className="brac-score">{match.player2Sets}</span>}
      </div>
    </div>
  );
}

// ── Score Entry Modal ─────────────────────────────────────────────────────────

function ScoreModal({ match, tournament, onSaved, onClose }: {
  match: TournamentMatch;
  tournament: Tournament;
  onSaved: (t: Tournament) => void;
  onClose: () => void;
}) {
  const [p1Sets, setP1Sets] = useState(0);
  const [p2Sets, setP2Sets] = useState(0);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (p1Sets === p2Sets) { setErr('Sets cannot be tied.'); return; }
    setSaving(true); setErr('');
    try {
      onSaved(await api.recordTournamentResult(tournament.id, match.id, p1Sets, p2Sets));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error saving result');
      setSaving(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={onClose}
    >
      <div className="card" style={{ margin: 16, minWidth: 280, maxWidth: 340 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginBottom: 4, fontSize: '1rem' }}>Enter Score</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
          {match.player1Name} vs {match.player2Name}
        </p>
        {err && <div className="error-msg">{err}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, justifyContent: 'center' }}>
          <SetsInput label={match.player1Name!} value={p1Sets} onChange={setP1Sets} />
          <span style={{ color: 'var(--muted)', fontSize: 20, fontWeight: 300 }}>–</span>
          <SetsInput label={match.player2Name!} value={p2Sets} onChange={setP2Sets} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" style={{ flex: 1 }} onClick={() => void submit()} disabled={saving}>
            {saving ? 'Saving…' : 'Save Result'}
          </button>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Swiss View ────────────────────────────────────────────────────────────────

function SwissView({ tournament, onResultRecorded }: {
  tournament: Tournament;
  onResultRecorded: (t: Tournament) => void;
}) {
  const rounds = [...new Set(tournament.matches.map(m => m.round))].sort((a, b) => a - b);
  return (
    <>
      {rounds.map(r => (
        <div key={r} className="card">
          <h3 className="card-title">Round {r}{r === (tournament.swissRounds ?? 0) ? ' (Final)' : ''}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tournament.matches.filter(m => m.round === r).sort((a, b) => a.matchNumber - b.matchNumber).map(m => (
              <MatchCard key={m.id} match={m} tournament={tournament} onResultRecorded={onResultRecorded} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

// ── Match Card (inline score entry — used for Swiss) ──────────────────────────

function MatchCard({ match, tournament, onResultRecorded }: {
  match: TournamentMatch;
  tournament: Tournament;
  onResultRecorded: (t: Tournament) => void;
}) {
  const [entering, setEntering] = useState(false);
  const [p1Sets, setP1Sets] = useState(0);
  const [p2Sets, setP2Sets] = useState(0);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (p1Sets === p2Sets) { setErr('Sets cannot be tied.'); return; }
    setSaving(true); setErr('');
    try {
      onResultRecorded(await api.recordTournamentResult(tournament.id, match.id, p1Sets, p2Sets));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
      setSaving(false);
    }
  };

  const p1 = match.player1Name ?? 'TBD';
  const p2 = match.player2Name ?? 'TBD';
  const done = match.winnerId !== null;

  if (match.isBye) {
    return (
      <div className="match-card match-bye">
        <span className="match-player">{p1}</span>
        <span className="match-score-label">BYE</span>
      </div>
    );
  }

  return (
    <div className={`match-card${done ? ' match-done' : ''}${!done && match.player1Id && match.player2Id ? ' match-ready' : ''}`}>
      <div className="match-players">
        <span className={`match-player${match.winnerId === match.player1Id && done ? ' match-winner' : ''}`}>{p1}</span>
        <span className="match-vs">vs</span>
        <span className={`match-player${match.winnerId === match.player2Id && done ? ' match-winner' : ''}`}>{p2}</span>
      </div>
      {done ? (
        <span className="match-score-label">{match.player1Sets} – {match.player2Sets}</span>
      ) : match.player1Id && match.player2Id && !entering ? (
        <button className="btn-sm" onClick={() => setEntering(true)}>Enter score</button>
      ) : match.player1Id && match.player2Id && entering ? (
        <div className="match-entry">
          {err && <span style={{ color: 'var(--loss)', fontSize: 12 }}>{err}</span>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <SetsInput label={p1} value={p1Sets} onChange={setP1Sets} />
            <span style={{ color: 'var(--muted)' }}>–</span>
            <SetsInput label={p2} value={p2Sets} onChange={setP2Sets} />
            <button className="btn-sm" onClick={() => void submit()} disabled={saving}>Save</button>
            <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => { setEntering(false); setErr(''); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <span style={{ color: 'var(--muted)', fontSize: 12 }}>Waiting…</span>
      )}
    </div>
  );
}

function SetsInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ fontSize: 10, color: 'var(--muted)' }}>{label}</span>
      <div className="sets-control">
        <button className="sets-btn" onClick={() => onChange(Math.max(0, value - 1))}>−</button>
        <span className="sets-value">{value}</span>
        <button className="sets-btn" onClick={() => onChange(value + 1)}>+</button>
      </div>
    </div>
  );
}

// ── Standings ─────────────────────────────────────────────────────────────────

function StandingsView({ tournament }: { tournament: Tournament }) {
  const champ = getChampion(tournament);
  const sorted = [...tournament.participants].sort((a, b) => {
    if (champ) {
      if (a.playerId === champ.playerId) return -1;
      if (b.playerId === champ.playerId) return 1;
    }
    return b.points - a.points || b.wins - a.wins || a.losses - b.losses;
  });
  return (
    <div className="card">
      <h3 className="card-title">Standings</h3>
      <div className="table-responsive">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>W</th>
              <th>L</th>
              {tournament.format === 'Swiss' && <th>Pts</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => (
              <tr key={p.id}>
                <td style={{ color: 'var(--muted)' }}>{i + 1}</td>
                <td style={{ fontWeight: 600 }}>{champ?.playerId === p.playerId ? '🏆 ' : ''}{p.playerName}</td>
                <td><span className="badge badge-win">{p.wins}</span></td>
                <td><span className="badge badge-loss">{p.losses}</span></td>
                {tournament.format === 'Swiss' && <td style={{ fontWeight: 600 }}>{p.points.toFixed(1)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function getChampion(t: Tournament): { playerId: number; name: string } | null {
  if (t.status !== 'Completed') return null;
  let m: TournamentMatch | undefined;
  if (t.format === 'DoubleElim')
    m = t.matches.find(x => x.bracket === 'GrandFinal' && x.winnerId !== null);
  else if (t.format === 'SingleElim') {
    const maxRound = Math.max(...t.matches.map(x => x.round));
    m = t.matches.find(x => x.round === maxRound && x.winnerId !== null);
  }
  if (m?.winnerId && m?.winnerName) return { playerId: m.winnerId, name: m.winnerName };
  const top = [...t.participants].sort((a, b) => b.points - a.points || b.wins - a.wins)[0];
  return top ? { playerId: top.playerId, name: top.playerName } : null;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    Pending:    { bg: '#1e3a5f', color: '#93c5fd' },
    InProgress: { bg: '#3f2d00', color: '#fbbf24' },
    Completed:  { bg: '#14532d', color: '#86efac' },
  };
  const s = styles[status] ?? styles.Pending;
  return <span className="badge" style={{ background: s.bg, color: s.color }}>{status}</span>;
}

function formatLabel(f: string) {
  return f === 'SingleElim' ? 'Single Elim' : f === 'DoubleElim' ? 'Double Elim' : 'Swiss';
}
