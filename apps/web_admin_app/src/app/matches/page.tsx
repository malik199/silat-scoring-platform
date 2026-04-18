"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { ActiveTournamentBanner } from "@/components/ActiveTournamentBanner";
import { useAuth } from "@/context/AuthContext";
import { subscribeActiveTournament, type Tournament } from "@/lib/tournaments";
import { subscribeCompetitors, type Competitor } from "@/lib/competitors";
import {
  subscribeMatches,
  createMatch,
  deleteMatch,
  swapMatchOrder,
  startMatch,
  endMatch,
  MATCH_STATUS_LABELS,
  MATCH_STATUS_COLOR,
  type Match,
} from "@/lib/matches";

// ─── New Match Modal ──────────────────────────────────────────────────────────

interface NewMatchModalProps {
  tournament: Tournament;
  competitors: Competitor[];
  currentCount: number;
  onClose: () => void;
}

function NewMatchModal({ tournament, competitors, currentCount, onClose }: NewMatchModalProps) {
  const arenas = Array.from({ length: tournament.arenaCount }, (_, i) => i + 1);

  const [arenaNumber,          setArenaNumber]          = useState<number>(arenas[0]);
  const [redId,                setRedId]                = useState("");
  const [blueId,               setBlueId]               = useState("");
  const [roundDurationSeconds, setRoundDurationSeconds] = useState<110 | 120>(120);
  const [saving,               setSaving]               = useState(false);
  const [error,                setError]                = useState("");

  const arenaCompetitorIds = new Set(tournament.arenaAssignments?.[String(arenaNumber)] ?? []);
  const arenaCompetitors   = competitors.filter((c) => arenaCompetitorIds.has(c.id));

  function handleArenaChange(n: number) {
    setArenaNumber(n);
    setRedId(""); setBlueId(""); setError("");
  }

  const redComp  = competitors.find((c) => c.id === redId);
  const blueComp = competitors.find((c) => c.id === blueId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!redId || !blueId) { setError("Select both a Red Corner and Blue Corner."); return; }
    if (redId === blueId)  { setError("Red and Blue Corner must be different competitors."); return; }
    if (redComp && blueComp && redComp.gender !== blueComp.gender) {
      setError(
        `Gender mismatch — ${redComp.firstName} is ${redComp.gender} and ${blueComp.firstName} is ${blueComp.gender}. Both must be the same gender.`
      );
      return;
    }
    setSaving(true);
    try {
      await createMatch({
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        arenaNumber,
        redCornerCompetitorId: redId,
        blueCornerCompetitorId: blueId,
        roundDurationSeconds,
        currentCount,
      });
      onClose();
    } catch {
      setError("Failed to create match. Please try again.");
      setSaving(false);
    }
  }

  const sel = "w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:border-accent transition-colors appearance-none [color-scheme:dark]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl">
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <h2 className="text-base font-semibold text-primary">New Match</h2>
          <p className="text-xs text-secondary mt-1">{tournament.name} · Match #{currentCount + 1}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4">
            {/* Arena */}
            <div>
              <label className="block text-xs font-semibold text-secondary uppercase tracking-widest mb-1.5">Arena</label>
              {arenas.length === 1 ? (
                <p className="text-sm text-primary px-3 py-2 bg-elevated border border-border rounded-lg">Arena {arenas[0]}</p>
              ) : (
                <select value={arenaNumber} onChange={(e) => handleArenaChange(Number(e.target.value))} className={sel}>
                  {arenas.map((n) => <option key={n} value={n}>Arena {n}</option>)}
                </select>
              )}
            </div>

            {arenaCompetitors.length < 2 ? (
              <div className="bg-elevated border border-border rounded-lg px-4 py-4 text-center">
                <p className="text-sm text-secondary">Arena {arenaNumber} needs at least 2 competitors assigned.</p>
                <a href={`/tournaments/${tournament.id}`} className="text-xs text-accent hover:underline mt-1 block">
                  Assign competitors →
                </a>
              </div>
            ) : (
              <>
                {/* Red corner */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5 text-danger">Red Corner</label>
                  <select value={redId} onChange={(e) => { setRedId(e.target.value); setError(""); }} className={sel}>
                    <option value="">Select competitor…</option>
                    {arenaCompetitors.map((c) => (
                      <option key={c.id} value={c.id} disabled={c.id === blueId}>
                        {c.firstName} {c.lastName} ({c.gender === "male" ? "M" : "F"} · {c.weightKg}kg)
                      </option>
                    ))}
                  </select>
                  {redComp && (
                    <div className="mt-1.5 flex items-center gap-2 px-3 py-2 bg-danger/5 border border-danger/20 rounded-lg">
                      <div className="w-5 h-5 rounded bg-danger/20 flex items-center justify-center text-xs font-bold text-danger flex-shrink-0">
                        {redComp.firstName[0]}{redComp.lastName[0]}
                      </div>
                      <span className="text-xs text-secondary truncate">
                        {redComp.schoolName || redComp.country || "—"} · {redComp.gender === "male" ? "Male" : "Female"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Blue corner */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5 text-blue-400">Blue Corner</label>
                  <select value={blueId} onChange={(e) => { setBlueId(e.target.value); setError(""); }} className={sel}>
                    <option value="">Select competitor…</option>
                    {arenaCompetitors.map((c) => (
                      <option key={c.id} value={c.id} disabled={c.id === redId}>
                        {c.firstName} {c.lastName} ({c.gender === "male" ? "M" : "F"} · {c.weightKg}kg)
                      </option>
                    ))}
                  </select>
                  {blueComp && (
                    <div className="mt-1.5 flex items-center gap-2 px-3 py-2 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                      <div className="w-5 h-5 rounded bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-400 flex-shrink-0">
                        {blueComp.firstName[0]}{blueComp.lastName[0]}
                      </div>
                      <span className="text-xs text-secondary truncate">
                        {blueComp.schoolName || blueComp.country || "—"} · {blueComp.gender === "male" ? "Male" : "Female"}
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Round duration */}
            <div>
              <label className="block text-xs font-semibold text-secondary uppercase tracking-widest mb-1.5">Round Duration</label>
              <div className="grid grid-cols-2 gap-2">
                {([120, 110] as const).map((secs) => (
                  <button
                    key={secs}
                    type="button"
                    onClick={() => setRoundDurationSeconds(secs)}
                    className={`py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
                      roundDurationSeconds === secs
                        ? "bg-accent/10 border-accent text-accent"
                        : "bg-elevated border-border text-secondary hover:text-primary hover:bg-elevated/80"
                    }`}
                  >
                    {secs === 120 ? "2:00" : "1:50"}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-danger/5 border border-danger/30 rounded-lg px-3 py-2.5">
                <span className="text-danger text-xs mt-0.5 flex-shrink-0">✕</span>
                <p className="text-xs text-danger">{error}</p>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-border flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-secondary hover:text-primary hover:bg-elevated transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving || arenaCompetitors.length < 2}
              className="flex-1 px-4 py-2.5 rounded-lg bg-accent text-black text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-40">
              {saving ? "Creating…" : "Create Match"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Match row ────────────────────────────────────────────────────────────────

interface MatchRowProps {
  match: Match;
  matchNumber: number;
  isFirst: boolean;
  isLast: boolean;
  redName: string;
  blueName: string;
  arenaBlocked: boolean; // another match in this arena is in_progress
  allMatches: Match[];
  onMoveUp:   () => void;
  onMoveDown: () => void;
  onDelete:   () => void;
  onStart:    () => void;
  onEnd:      () => void;
}

function MatchRow({
  match, matchNumber, isFirst, isLast,
  redName, blueName, arenaBlocked, allMatches,
  onMoveUp, onMoveDown, onDelete, onStart, onEnd,
}: MatchRowProps) {
  const isPending    = match.status === "pending";
  const isRunning    = match.status === "in_progress";
  const isFinished   = match.status === "completed" || match.status === "cancelled";
  const canReorder   = isPending;
  const startBlocked = arenaBlocked && !isRunning;

  return (
    <li className="grid grid-cols-[40px_1fr_1fr_80px_130px_180px] gap-3 px-5 py-3.5 items-center border-b border-border last:border-b-0">
      {/* # */}
      <span className="text-sm font-bold text-muted text-center">{matchNumber}</span>

      {/* Red */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-2 h-2 rounded-full bg-danger flex-shrink-0" />
        <span className="text-sm font-medium text-primary truncate">{redName}</span>
      </div>

      {/* Blue */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
        <span className="text-sm font-medium text-primary truncate">{blueName}</span>
      </div>

      {/* Arena */}
      <span className="text-sm text-secondary">Arena {match.arenaNumber}</span>

      {/* Status */}
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${MATCH_STATUS_COLOR[match.status]}`}>
        {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-warn mr-1.5 animate-pulse" />}
        {MATCH_STATUS_LABELS[match.status]}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 justify-end">
        {/* Start */}
        {isPending && (
          <button
            onClick={onStart}
            disabled={startBlocked}
            title={startBlocked ? `Arena ${match.arenaNumber} already has a match running` : "Start match"}
            className="px-2.5 py-1 rounded-md bg-accent text-black text-xs font-semibold hover:bg-accent-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Start
          </button>
        )}
        {isRunning && (
          <button
            onClick={onEnd}
            className="px-2.5 py-1 rounded-md bg-danger text-white text-xs font-semibold hover:bg-danger/80 transition-colors"
          >
            End Match
          </button>
        )}
        {isFinished && (
          <span className="px-2.5 py-1 rounded-md bg-elevated text-muted text-xs font-medium">
            {MATCH_STATUS_LABELS[match.status]}
          </span>
        )}

        {/* Reorder — only for pending matches */}
        {canReorder && (
          <>
            <button
              onClick={onMoveUp}
              disabled={isFirst}
              title="Move up"
              className="w-7 h-7 flex items-center justify-center rounded-md text-muted hover:text-primary hover:bg-elevated transition-colors disabled:opacity-20"
            >
              ↑
            </button>
            <button
              onClick={onMoveDown}
              disabled={isLast}
              title="Move down"
              className="w-7 h-7 flex items-center justify-center rounded-md text-muted hover:text-primary hover:bg-elevated transition-colors disabled:opacity-20"
            >
              ↓
            </button>
          </>
        )}

        {/* Delete — only pending */}
        {isPending && (
          <button
            onClick={onDelete}
            title="Delete match"
            className="w-7 h-7 flex items-center justify-center rounded-md text-muted hover:text-danger hover:bg-danger/10 transition-colors"
          >
            ✕
          </button>
        )}
      </div>
    </li>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MatchesPage() {
  const { user } = useAuth();

  const [tournament,  setTournament]  = useState<Tournament | null | undefined>(undefined);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [matches,     setMatches]     = useState<Match[]>([]);
  const [showModal,   setShowModal]   = useState(false);
  const [busy,        setBusy]        = useState(false); // debounce reorder/delete

  useEffect(() => {
    if (!user) return;
    const unsubT = subscribeActiveTournament(user.uid, setTournament);
    const unsubC = subscribeCompetitors(setCompetitors);
    return () => { unsubT(); unsubC(); };
  }, [user]);

  useEffect(() => {
    if (!tournament) { setMatches([]); return; }
    return subscribeMatches(tournament.id, setMatches);
  }, [tournament?.id]);

  const compMap = new Map(competitors.map((c) => [c.id, c]));

  // Set of arenas that currently have an in_progress match
  const runningArenas = new Set(
    matches.filter((m) => m.status === "in_progress").map((m) => m.arenaNumber)
  );

  // Only pending matches can be reordered — non-pending are locked at their position
  const pendingMatches = matches.filter((m) => m.status === "pending");

  async function handleMoveUp(match: Match) {
    const idx = pendingMatches.findIndex((m) => m.id === match.id);
    if (idx <= 0 || busy) return;
    setBusy(true);
    const prev = pendingMatches[idx - 1];
    await swapMatchOrder(match.id, match.order, prev.id, prev.order);
    setBusy(false);
  }

  async function handleMoveDown(match: Match) {
    const idx = pendingMatches.findIndex((m) => m.id === match.id);
    if (idx >= pendingMatches.length - 1 || busy) return;
    setBusy(true);
    const next = pendingMatches[idx + 1];
    await swapMatchOrder(match.id, match.order, next.id, next.order);
    setBusy(false);
  }

  async function handleDelete(match: Match) {
    if (!confirm(`Delete Match #${match.order}? This cannot be undone.`)) return;
    setBusy(true);
    await deleteMatch(match.id, matches);
    setBusy(false);
  }

  async function handleStart(match: Match) {
    if (runningArenas.has(match.arenaNumber)) return;
    await startMatch(match.id);
  }

  async function handleEnd(match: Match) {
    if (!confirm(`End Match #${match.order}? This cannot be undone — the match cannot be restarted.`)) return;
    await endMatch(match.id);
  }

  return (
    <Shell title="Matches">
      <ActiveTournamentBanner />

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold text-primary">All Matches</h2>
            {matches.length > 0 && (
              <p className="text-xs text-muted mt-0.5">
                {matches.length} match{matches.length !== 1 ? "es" : ""} ·{" "}
                {runningArenas.size > 0
                  ? `${runningArenas.size} arena${runningArenas.size !== 1 ? "s" : ""} running`
                  : "none running"}
              </p>
            )}
          </div>
          <button
            onClick={() => setShowModal(true)}
            disabled={!tournament}
            title={!tournament ? "Create a tournament first" : undefined}
            className="px-4 py-2 rounded-lg bg-accent text-black text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            + New Match
          </button>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[40px_1fr_1fr_80px_130px_180px] gap-3 px-5 py-3 border-b border-border">
          {["#", "Red Corner", "Blue Corner", "Arena", "Status", ""].map((h, i) => (
            <span key={i} className="text-xs font-semibold uppercase tracking-widest text-muted">
              {h}
            </span>
          ))}
        </div>

        {tournament === undefined ? (
          <div className="px-5 py-10 text-center text-sm text-secondary">Loading…</div>
        ) : matches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-secondary">
            <p className="text-4xl mb-3">⚔</p>
            <p className="text-sm">No matches yet.</p>
            <p className="text-xs mt-1 text-muted">
              {tournament ? `Click "+ New Match" to schedule the first match.` : "Create a tournament first."}
            </p>
          </div>
        ) : (
          <ul>
            {matches.map((m) => {
              const red  = compMap.get(m.redCornerCompetitorId);
              const blue = compMap.get(m.blueCornerCompetitorId);
              const isPending = m.status === "pending";
              const pendingIdx = isPending ? pendingMatches.findIndex((p) => p.id === m.id) : -1;

              return (
                <MatchRow
                  key={m.id}
                  match={m}
                  matchNumber={m.order}
                  isFirst={pendingIdx === 0}
                  isLast={pendingIdx === pendingMatches.length - 1}
                  redName={red  ? `${red.firstName} ${red.lastName}`   : "Unknown"}
                  blueName={blue ? `${blue.firstName} ${blue.lastName}` : "Unknown"}
                  arenaBlocked={runningArenas.has(m.arenaNumber)}
                  allMatches={matches}
                  onMoveUp={() => handleMoveUp(m)}
                  onMoveDown={() => handleMoveDown(m)}
                  onDelete={() => handleDelete(m)}
                  onStart={() => handleStart(m)}
                  onEnd={() => handleEnd(m)}
                />
              );
            })}
          </ul>
        )}
      </div>

      {showModal && tournament && (
        <NewMatchModal
          tournament={tournament}
          competitors={competitors}
          currentCount={matches.length}
          onClose={() => setShowModal(false)}
        />
      )}
    </Shell>
  );
}
