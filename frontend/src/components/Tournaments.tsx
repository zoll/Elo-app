import { useState, useEffect, useCallback } from 'react';
import type { Player, Tournament, TournamentSummary, TournamentFormat, TournamentMatch, TimeTrialEntry } from '../types';
import { api } from '../api/client';

interface Props {
  players: Player[];
  initialTournamentId?: number;
  onNavigate: (id?: number) => void;
}

export default function Tournaments({ players, initialTournamentId, onNavigate }: Props) {
  const [list, setList] = useState<TournamentSummary[]>([]);
  const [selected, setSelected] = useState<Tournament | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadList = useCallback(async () => {
    setLoading(true);
    try { setList(await api.getTournaments()); } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadList(); }, [loadList]);

  // Open tournament from URL on initial load
  useEffect(() => {
    if (initialTournamentId && !selected) {
      api.getTournament(initialTournamentId).then(t => setSelected(t)).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTournamentId]);

  const openTournament = async (id: number) => {
    const t = await api.getTournament(id);
    setSelected(t);
    onNavigate(id);
  };

  const onCreated = async (t: Tournament) => {
    setCreating(false);
    await loadList();
    setSelected(t);
    onNavigate(t.id);
  };

  const onUpdated = (t: Tournament) => setSelected(t);

  const goBack = () => {
    setSelected(null);
    onNavigate(undefined);
    void loadList();
  };

  if (creating)
    return <CreateTournament onCreated={onCreated} onCancel={() => setCreating(false)} />;

  if (selected)
    return (
      <TournamentDetail
        tournament={selected}
        players={players}
        onUpdated={onUpdated}
        onBack={goBack}
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
                  <td>
                    <a className="btn-sm" href={`#tournaments/${t.id}`} onClick={e => { e.preventDefault(); void openTournament(t.id); }}>
                      View
                    </a>
                  </td>
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
          <option value="TimeTrial">Time Trial</option>
        </select>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 16px' }}>
        {format === 'TimeTrial'
          ? 'Players submit their best times. End the tournament manually when everyone is done — fastest time wins.'
          : 'Players sign up after creation. Start the tournament when everyone is ready.'}
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
          <a className="btn-ghost" href="#tournaments" onClick={e => { e.preventDefault(); onBack(); }}>← Back</a>
          <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{tournament.name}</span>
          <span className="badge" style={{ background: 'var(--surface2)', color: 'var(--text)' }}>{formatLabel(tournament.format)}</span>
          <StatusBadge status={tournament.status} />
          {champ && <span style={{ fontWeight: 700, color: 'var(--win)' }}>🏆 {champ.name}</span>}
        </div>
      </div>

      {tournament.format === 'TimeTrial' ? (
        tournament.status === 'Pending'
          ? <TimeTrialPendingView tournament={tournament} onUpdated={onUpdated} />
          : <TimeTrialView tournament={tournament} players={players} onUpdated={onUpdated} />
      ) : tournament.status === 'Pending' ? (
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
  const [busy, setBusy] = useState<number | null>(null); // playerId currently being toggled
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const registeredIds = new Set(tournament.participants.map(p => p.playerId));
  const canStart = tournament.participants.length >= 2;
  const estimatedRounds = tournament.format === 'Swiss' && tournament.participants.length >= 2
    ? Math.max(3, Math.ceil(Math.log2(tournament.participants.length)) + 1)
    : null;

  const join = async (playerId: number) => {
    setBusy(playerId); setError('');
    try { onUpdated(await api.addParticipant(tournament.id, playerId)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Error joining'); }
    finally { setBusy(null); }
  };

  const leave = async (playerId: number) => {
    setBusy(playerId); setError('');
    try { onUpdated(await api.removeParticipant(tournament.id, playerId)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Error leaving'); }
    finally { setBusy(null); }
  };

  const start = async () => {
    setStarting(true); setError('');
    try { onUpdated(await api.startTournament(tournament.id)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Error starting'); setStarting(false); }
  };

  return (
    <div className="card">
      <h3 className="card-title">
        Sign Up
        <span style={{ fontWeight: 400, fontSize: '0.9rem', color: 'var(--muted)', marginLeft: 8 }}>
          {tournament.participants.length} joined
        </span>
      </h3>
      {error && <div className="error-msg">{error}</div>}
      <div className="player-select-list" style={{ marginBottom: 16 }}>
        {players.map(p => {
          const joined = registeredIds.has(p.id);
          return (
            <div key={p.id} className={`player-select-row${joined ? ' selected' : ''}`}>
              <span>{p.name}</span>
              <button
                className={joined ? 'btn-ghost' : 'btn-sm'}
                style={{ marginLeft: 'auto', ...(joined ? { color: 'var(--muted)' } : {}) }}
                onClick={() => void (joined ? leave(p.id) : join(p.id))}
                disabled={busy === p.id || starting}
              >
                {busy === p.id ? '…' : joined ? 'Leave' : 'Join'}
              </button>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => void start()} disabled={!canStart || starting || busy !== null}>
          {starting ? 'Starting…' : 'Start Tournament'}
        </button>
        {!canStart && <span style={{ color: 'var(--muted)', fontSize: 13 }}>Need at least 2 players</span>}
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

// ── Time Trial View ───────────────────────────────────────────────────────────

function digitsToMs(digits: string): number {
  const p = digits.padStart(6, '0');
  const min = parseInt(p.slice(0, 2), 10);
  const sec = parseInt(p.slice(2, 4), 10);
  const cs  = parseInt(p.slice(4, 6), 10);
  return (min * 60 + sec) * 1000 + cs * 10;
}

function formatDigits(digits: string): string {
  const p = digits.padStart(6, '0');
  const min = p.slice(0, 2).replace(/^0/, '') || '0';
  return `${min}:${p.slice(2, 4)}.${p.slice(4, 6)}`;
}

function TimeInput({ submitKey, onValue }: { submitKey: number; onValue: (ms: number) => void }) {
  const [digits, setDigits] = useState('');

  useEffect(() => { setDigits(''); onValue(0); }, [submitKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key >= '0' && e.key <= '9') {
      if (digits.length >= 6) return;
      e.preventDefault();
      const next = digits + e.key;
      setDigits(next);
      onValue(digitsToMs(next));
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      const next = digits.slice(0, -1);
      setDigits(next);
      onValue(digitsToMs(next));
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={formatDigits(digits)}
      onKeyDown={handleKeyDown}
      onChange={() => {}}
      style={{
        width: 110,
        fontFamily: 'monospace',
        fontSize: '1.3rem',
        textAlign: 'center',
        letterSpacing: 1,
        fontVariantNumeric: 'tabular-nums',
      }}
    />
  );
}

function formatTime(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const centis = Math.floor((ms % 1000) / 10);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}

function bestTimes(entries: TimeTrialEntry[]): { playerId: number; playerName: string; bestMs: number; attempts: number }[] {
  const map = new Map<number, { playerName: string; bestMs: number; attempts: number }>();
  for (const e of entries) {
    const prev = map.get(e.playerId);
    if (!prev) map.set(e.playerId, { playerName: e.playerName, bestMs: e.timeMs, attempts: 1 });
    else { prev.attempts++; if (e.timeMs < prev.bestMs) prev.bestMs = e.timeMs; }
  }
  return [...map.entries()]
    .map(([playerId, v]) => ({ playerId, ...v }))
    .sort((a, b) => a.bestMs - b.bestMs);
}

function TimeTrialPendingView({ tournament, onUpdated }: {
  tournament: Tournament;
  onUpdated: (t: Tournament) => void;
}) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const start = async () => {
    setStarting(true); setError('');
    try { onUpdated(await api.startTournament(tournament.id)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Error starting tournament'); setStarting(false); }
  };

  return (
    <div className="card">
      <h3 className="card-title">Time Trial</h3>
      {error && <div className="error-msg">{error}</div>}
      <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 16px' }}>
        Once started, anyone can submit their time. No pre-registration needed — submitting a time counts as entering.
      </p>
      <button className="btn" onClick={() => void start()} disabled={starting}>
        {starting ? 'Starting…' : 'Start Tournament'}
      </button>
    </div>
  );
}

function TimeTrialView({ tournament, players, onUpdated }: {
  tournament: Tournament;
  players: Player[];
  onUpdated: (t: Tournament) => void;
}) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | ''>('');
  const [timeMs, setTimeMs] = useState(0);
  const [submitKey, setSubmitKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState('');

  const leaderboard = bestTimes(tournament.timeTrialEntries ?? []);

  const submitTime = async () => {
    if (!selectedPlayerId) { setError('Select a player.'); return; }
    if (timeMs <= 0) { setError('Enter a time greater than zero.'); return; }
    setSubmitting(true); setError('');
    try {
      onUpdated(await api.addTimeTrialEntry(tournament.id, selectedPlayerId as number, timeMs));
      setSubmitKey(k => k + 1);
      setSelectedPlayerId('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error submitting time');
    } finally { setSubmitting(false); }
  };

  const complete = async () => {
    setCompleting(true); setError('');
    try { onUpdated(await api.completeTournament(tournament.id)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Error ending tournament'); setCompleting(false); }
  };

  return (
    <>
      {/* Status bar */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          {tournament.status === 'Completed' && leaderboard[0] ? (
            <div style={{ fontWeight: 700, color: 'var(--win)', fontSize: '1.1rem' }}>
              Winner: {leaderboard[0].playerName} — {formatTime(leaderboard[0].bestMs)}
            </div>
          ) : (
            <span style={{ color: 'var(--muted)', fontSize: 14 }}>End the tournament when everyone has submitted their time.</span>
          )}
          {tournament.status === 'InProgress' && (
            <button
              className="btn"
              style={{ background: 'var(--loss)', borderColor: 'var(--loss)' }}
              onClick={() => void complete()}
              disabled={completing}
            >
              {completing ? 'Ending…' : 'End Tournament'}
            </button>
          )}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="card">
        <h3 className="card-title">Leaderboard</h3>
        {leaderboard.length === 0 ? (
          <div className="empty-state" style={{ padding: '12px 0' }}>No times submitted yet.</div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr><th>#</th><th>Player</th><th>Best Time</th><th>Attempts</th></tr>
              </thead>
              <tbody>
                {leaderboard.map((row, i) => (
                  <tr key={row.playerId}>
                    <td style={{ color: 'var(--muted)' }}>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>
                      {tournament.status === 'Completed' && i === 0 ? '🏆 ' : ''}{row.playerName}
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: i === 0 ? 700 : undefined, color: i === 0 ? 'var(--win)' : undefined }}>
                      {formatTime(row.bestMs)}
                    </td>
                    <td style={{ color: 'var(--muted)' }}>{row.attempts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Submit time */}
      {tournament.status === 'InProgress' && (
        <div className="card">
          <h3 className="card-title">Submit Time</h3>
          {error && <div className="error-msg">{error}</div>}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ margin: 0, flex: '1 1 160px' }}>
              <label>Player</label>
              <select value={selectedPlayerId} onChange={e => setSelectedPlayerId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">— Select player —</option>
                {players.map(p =>
                  <option key={p.id} value={p.id}>{p.name}</option>
                )}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Time — type digits, backspace to clear</label>
              <TimeInput submitKey={submitKey} onValue={setTimeMs} />
            </div>
            <button className="btn" onClick={() => void submitTime()} disabled={submitting} style={{ marginBottom: 0 }}>
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </div>
      )}

      {/* All entries */}
      {(tournament.timeTrialEntries ?? []).length > 0 && (
        <div className="card">
          <h3 className="card-title">All Entries</h3>
          <div className="table-responsive">
            <table>
              <thead>
                <tr><th>Player</th><th>Time</th><th>Submitted</th></tr>
              </thead>
              <tbody>
                {[...(tournament.timeTrialEntries ?? [])].sort((a, b) => a.timeMs - b.timeMs).map(e => (
                  <tr key={e.id}>
                    <td>{e.playerName}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatTime(e.timeMs)}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>
                      {new Date(e.recordedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
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
  if (t.format === 'TimeTrial') {
    const lb = bestTimes(t.timeTrialEntries ?? []);
    return lb[0] ? { playerId: lb[0].playerId, name: lb[0].playerName } : null;
  }
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
  if (f === 'SingleElim') return 'Single Elim';
  if (f === 'DoubleElim') return 'Double Elim';
  if (f === 'TimeTrial') return 'Time Trial';
  return 'Swiss';
}
