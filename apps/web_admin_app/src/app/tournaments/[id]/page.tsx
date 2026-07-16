"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/context/AuthContext";
import {
  subscribeTournament,
  updateTournamentName,
  archiveTournament,
  regenerateArenaPin,
  isActiveTournament,
  type Tournament,
} from "@/lib/tournaments";
import { subscribeCompetitors, type Competitor } from "@/lib/competitors";
import {
  subscribeMatches,
  subscribeScoreEvents,
  subscribeAdminEvents,
  computeConfirmedScores,
  MATCH_STATUS_LABELS,
  MATCH_STATUS_COLOR,
  type Match,
  type ScoreEvent,
  type AdminEvent,
} from "@/lib/matches";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function arenaLabel(n: number) { return `Arena ${n}`; }

// ─── Arena Card ───────────────────────────────────────────────────────────────

interface ArenaCardProps {
  arenaNumber: number;
  pin: string;
  onRegeneratePin: (n: number) => void;
}

function ArenaCard({ arenaNumber, pin, onRegeneratePin }: ArenaCardProps) {
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center text-sm font-bold text-accent flex-shrink-0">
          {arenaNumber}
        </div>
        <p className="text-sm font-semibold text-primary flex-1">{arenaLabel(arenaNumber)}</p>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-elevated border border-border rounded-lg px-3 py-1.5">
            <span className="text-xs text-muted font-medium">PIN</span>
            <span className="text-base font-black text-primary tracking-widest">{pin || "—"}</span>
          </div>
          <button
            onClick={() => onRegeneratePin(arenaNumber)}
            title="Generate new PIN"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-warn hover:bg-elevated transition-colors text-sm"
          >
            ↻
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Match detail modal ───────────────────────────────────────────────────────

interface MatchDetailModalProps {
  match: Match;
  redName: string;
  blueName: string;
  onClose: () => void;
}

function MatchDetailModal({ match, redName, blueName, onClose }: MatchDetailModalProps) {
  const [scoreEvents, setScoreEvents] = useState<ScoreEvent[]>([]);
  const [adminEvents, setAdminEvents] = useState<AdminEvent[]>([]);

  useEffect(() => {
    const unsubScore = subscribeScoreEvents(match.id, setScoreEvents);
    const unsubAdmin = subscribeAdminEvents(match.id, setAdminEvents);
    return () => { unsubScore(); unsubAdmin(); };
  }, [match.id]);

  const { red: confirmedRed, blue: confirmedBlue } = computeConfirmedScores(scoreEvents);
  const adminRed  = adminEvents.filter((e) => e.side === "red").reduce((s, e) => s + e.points, 0);
  const adminBlue = adminEvents.filter((e) => e.side === "blue").reduce((s, e) => s + e.points, 0);
  const totalRed  = confirmedRed + adminRed;
  const totalBlue = confirmedBlue + adminBlue;
  const winner    = totalRed !== totalBlue ? (totalRed > totalBlue ? "red" : "blue") : null;

  const judgeOrder: string[] = [];
  const byJudge = new Map<string, { name: string; email: string; red: number; blue: number }>();
  for (const e of scoreEvents) {
    if (!byJudge.has(e.judgeId)) {
      byJudge.set(e.judgeId, { name: e.judgeName ?? "", email: e.judgeEmail ?? "", red: 0, blue: 0 });
      judgeOrder.push(e.judgeId);
    }
    const t = byJudge.get(e.judgeId)!;
    if (e.side === "red") t.red += e.points; else t.blue += e.points;
  }

  const ACTIONS = [
    { pts:  3, label: "+3",  sublabel: "Takedown / Sweep" },
    { pts: -1, label: "−1",  sublabel: "Minor penalty"    },
    { pts: -2, label: "−2",  sublabel: "Warning"          },
    { pts: -5, label: "−5",  sublabel: "Major penalty"    },
    { pts:-10, label: "−10", sublabel: "Disqualification" },
  ];
  const count = (side: "red" | "blue", pts: number) =>
    adminEvents.filter((e) => e.side === side && e.points === pts).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <p className="text-xs text-muted uppercase tracking-widest font-semibold">Match #{match.order} · Arena {match.arenaNumber}</p>
            <p className="text-sm font-semibold text-primary mt-0.5">{redName} vs {blueName}</p>
          </div>
          <button type="button" onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-warn hover:bg-elevated transition-colors">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Scores + Winner */}
          <div className="grid grid-cols-3 rounded-xl overflow-hidden border border-border">
            <div className={`flex flex-col items-center justify-center py-6 ${winner === "red" ? "bg-danger/10" : "bg-elevated"}`}>
              <p className="text-xs font-semibold uppercase tracking-widest text-danger mb-1">Red</p>
              <p className="text-6xl font-black text-danger">{totalRed}</p>
              {winner === "red" && <p className="text-xs font-bold text-danger mt-2 uppercase tracking-widest">Winner</p>}
            </div>
            <div className="flex flex-col items-center justify-center py-6 border-x border-border bg-surface">
              {winner ? (
                <>
                  <p className="text-xs text-muted uppercase tracking-widest font-semibold mb-1">Winner</p>
                  <p className={`text-lg font-black ${winner === "red" ? "text-danger" : "text-blue-400"}`}>
                    {winner === "red" ? redName : blueName}
                  </p>
                </>
              ) : (
                <p className="text-sm font-bold text-muted">Draw</p>
              )}
            </div>
            <div className={`flex flex-col items-center justify-center py-6 ${winner === "blue" ? "bg-blue-500/10" : "bg-elevated"}`}>
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-1">Blue</p>
              <p className="text-6xl font-black text-blue-400">{totalBlue}</p>
              {winner === "blue" && <p className="text-xs font-bold text-blue-400 mt-2 uppercase tracking-widest">Winner</p>}
            </div>
          </div>

          {/* Judge Taps */}
          <div className="bg-elevated border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">Judge Taps (raw)</p>
            </div>
            {judgeOrder.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted">No judge scores recorded.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-left   text-xs font-semibold uppercase tracking-widest text-muted">Judge</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-widest text-danger">Red</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-widest text-blue-400">Blue</th>
                    <th className="px-4 py-2 text-right  text-xs font-semibold uppercase tracking-widest text-muted">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {judgeOrder.map((judgeId, i) => {
                    const t = byJudge.get(judgeId)!;
                    return (
                      <tr key={judgeId} className="border-b border-border last:border-b-0">
                        <td className="px-4 py-2.5">
                          <span className="text-sm font-medium text-primary">{t.name || t.email || `Judge ${i + 1}`}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center"><span className="text-base font-bold text-danger">{t.red}</span></td>
                        <td className="px-4 py-2.5 text-center"><span className="text-base font-bold text-blue-400">{t.blue}</span></td>
                        <td className="px-4 py-2.5 text-right"><span className="text-sm font-semibold text-secondary">{t.red + t.blue}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Score Breakdown */}
          {adminEvents.length > 0 && (
            <div className="bg-elevated border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted">Score Breakdown</p>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-widest text-danger w-1/3">Red</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-widest text-muted">Action</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-widest text-blue-400 w-1/3">Blue</th>
                  </tr>
                </thead>
                <tbody>
                  {ACTIONS.map(({ pts, label, sublabel }) => {
                    const r = count("red", pts);
                    const b = count("blue", pts);
                    if (r === 0 && b === 0) return null;
                    return (
                      <tr key={pts} className="border-b border-border last:border-b-0">
                        <td className="px-4 py-2.5 text-center">
                          <span className={`text-lg font-black ${r > 0 ? "text-danger" : "text-muted/30"}`}>{r}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <p className="text-sm font-bold text-secondary">{label}</p>
                          <p className="text-xs text-muted">{sublabel}</p>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`text-lg font-black ${b > 0 ? "text-blue-400" : "text-muted/30"}`}>{b}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  draft:             "Active",
  registration_open: "Active",
  in_progress:       "Active",
  completed:         "Completed",
  cancelled:         "Cancelled",
};

const STATUS_COLOR: Record<string, string> = {
  draft:             "bg-green-500/10 text-green-400 border-green-500/30",
  registration_open: "bg-green-500/10 text-green-400 border-green-500/30",
  in_progress:       "bg-green-500/10 text-green-400 border-green-500/30",
  completed:         "bg-elevated text-muted border-border",
  cancelled:         "bg-danger/10 text-danger border-danger/30",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const { user } = useAuth();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [matches, setMatches]         = useState<Match[]>([]);
  const [detailMatch, setDetailMatch] = useState<Match | null>(null);
  const [loading, setLoading]         = useState(true);

  // Archiving
  const [archiving, setArchiving] = useState(false);

  // Inline name edit
  const [editingName, setEditingName] = useState(false);
  const [nameValue,   setNameValue]   = useState("");
  const [savingName,  setSavingName]  = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubT = subscribeTournament(id, (t) => { setTournament(t); setLoading(false); });
    const unsubM = subscribeMatches(id, setMatches);
    if (!user) return () => { unsubT(); unsubM(); };
    const unsubC = subscribeCompetitors(user.uid, setCompetitors);
    return () => { unsubT(); unsubC(); unsubM(); };
  }, [id, user]);

  async function handleArchive() {
    if (!tournament) return;
    if (!confirm(`Archive "${tournament.name}"? This cannot be undone and will allow a new tournament to be created.`)) return;
    setArchiving(true);
    await archiveTournament(tournament.id);
    router.push("/tournaments");
  }

  function startEditName() {
    if (!tournament) return;
    setNameValue(tournament.name);
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.select(), 0);
  }

  async function commitName() {
    if (!tournament || !nameValue.trim() || nameValue.trim() === tournament.name) {
      setEditingName(false); return;
    }
    setSavingName(true);
    await updateTournamentName(tournament.id, nameValue.trim());
    setSavingName(false);
    setEditingName(false);
  }

  function handleNameKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commitName();
    if (e.key === "Escape") setEditingName(false);
  }

  async function handleRegeneratePin(arenaNumber: number) {
    if (!tournament) return;
    if (!confirm(`Generate a new PIN for Arena ${arenaNumber}? The old PIN will stop working immediately.`)) return;
    await regenerateArenaPin(tournament.id, arenaNumber);
  }

  if (loading) return <Shell title="Tournament"><p className="text-sm text-secondary">Loading…</p></Shell>;
  if (!tournament) return <Shell title="Tournament"><p className="text-sm text-danger">Tournament not found.</p></Shell>;

  const arenas = Array.from({ length: tournament.arenaCount }, (_, i) => i + 1);

  return (
    <Shell title={tournament.name}>
      {/* Back + meta */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.push("/tournaments")}
          className="text-xs text-secondary hover:text-primary transition-colors">
          ← Tournaments
        </button>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLOR[tournament.status] ?? "bg-elevated text-secondary border-border"}`}>
          {STATUS_LABEL[tournament.status] ?? tournament.status}
        </span>
        {isActiveTournament(tournament) && (
          <button onClick={handleArchive} disabled={archiving}
            className="ml-auto px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-secondary hover:text-danger hover:border-danger/50 transition-colors disabled:opacity-50">
            {archiving ? "Archiving…" : "Archive Tournament"}
          </button>
        )}
      </div>

      {/* Info strip */}
      <div className="bg-surface border border-border rounded-xl px-5 py-4 mb-6 flex items-center gap-6">
        <div className="min-w-0">
          <p className="text-xs text-muted uppercase tracking-widest font-semibold mb-0.5">Tournament</p>
          {editingName ? (
            <div className="flex items-center gap-2">
              <input ref={nameInputRef} type="text" value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={commitName} onKeyDown={handleNameKeyDown} disabled={savingName}
                className="bg-elevated border border-accent rounded-md px-2 py-0.5 text-sm font-semibold text-primary focus:outline-none w-56" />
              <button onClick={commitName} disabled={savingName} className="text-xs text-accent hover:underline disabled:opacity-50">
                {savingName ? "Saving…" : "Save"}
              </button>
              <button onClick={() => setEditingName(false)} className="text-xs text-muted hover:text-secondary">
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <p className="text-sm font-semibold text-primary truncate">{tournament.name}</p>
              <button onClick={startEditName}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-secondary text-xs px-1"
                title="Edit name">✎</button>
            </div>
          )}
        </div>
        <div className="w-px h-8 bg-border" />
        <div>
          <p className="text-xs text-muted uppercase tracking-widest font-semibold mb-0.5">Arenas</p>
          <p className="text-sm font-semibold text-primary">{tournament.arenaCount}</p>
        </div>
        <div className="w-px h-8 bg-border" />
        <div>
          <p className="text-xs text-muted uppercase tracking-widest font-semibold mb-0.5">Matches</p>
          <p className="text-sm font-semibold text-primary">{matches.length}</p>
        </div>
      </div>

      {/* Arena PINs */}
      <h2 className="text-sm font-semibold text-primary mb-4">Arena PINs</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {arenas.map((n) => (
          <ArenaCard
            key={n}
            arenaNumber={n}
            pin={tournament.arenaPins?.[String(n)] ?? ""}
            onRegeneratePin={handleRegeneratePin}
          />
        ))}
      </div>

      {/* Matches section */}
      {matches.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-primary mb-4">Matches</h2>
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            {/* Column headers */}
            <div className="grid grid-cols-[40px_1fr_1fr_80px_130px] gap-3 px-5 py-3 border-b border-border">
              {["#", "Red Corner", "Blue Corner", "Arena", "Status"].map((h, i) => (
                <span key={i} className="text-xs font-semibold uppercase tracking-widest text-muted">{h}</span>
              ))}
            </div>
            <ul>
              {matches.map((m) => {
                const red  = competitors.find((c) => c.id === m.redCornerCompetitorId);
                const blue = competitors.find((c) => c.id === m.blueCornerCompetitorId);
                const redName  = red  ? `${red.firstName} ${red.lastName}`   : "Unknown";
                const blueName = blue ? `${blue.firstName} ${blue.lastName}` : "Unknown";
                const isFinished = m.status === "completed" || m.status === "cancelled";
                const isRunning  = m.status === "in_progress";
                return (
                  <li
                    key={m.id}
                    className={`grid grid-cols-[40px_1fr_1fr_80px_130px] gap-3 px-5 py-3.5 items-center border-b border-border last:border-b-0 ${isFinished ? "cursor-pointer hover:bg-elevated/50 transition-colors" : ""}`}
                    onClick={isFinished ? () => setDetailMatch(m) : undefined}
                  >
                    <span className="text-sm font-bold text-muted text-center">{m.order}</span>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-danger flex-shrink-0" />
                      <span className="text-sm font-medium text-primary truncate">{redName}</span>
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                      <span className="text-sm font-medium text-primary truncate">{blueName}</span>
                    </div>
                    <span className="text-sm text-secondary">Arena {m.arenaNumber}</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${MATCH_STATUS_COLOR[m.status]}`}>
                      {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-warn mr-1.5 animate-pulse" />}
                      {MATCH_STATUS_LABELS[m.status]}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {/* Match detail modal */}
      {detailMatch && (() => {
        const red  = competitors.find((c) => c.id === detailMatch.redCornerCompetitorId);
        const blue = competitors.find((c) => c.id === detailMatch.blueCornerCompetitorId);
        return (
          <MatchDetailModal
            match={detailMatch}
            redName={red  ? `${red.firstName} ${red.lastName}`   : "Unknown"}
            blueName={blue ? `${blue.firstName} ${blue.lastName}` : "Unknown"}
            onClose={() => setDetailMatch(null)}
          />
        );
      })()}

    </Shell>
  );
}
