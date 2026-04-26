"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/context/AuthContext";
import { subscribeActiveTournament, type Tournament } from "@/lib/tournaments";
import { subscribeCompetitors, type Competitor } from "@/lib/competitors";
import {
  subscribeActiveMatch,
  subscribeScoreEvents,
  subscribeAdminEvents,
  addAdminEvent,
  deleteAdminEvent,
  computeConfirmedScores,
  computeRemainingSeconds,
  formatTime,
  timerStart,
  timerStop,
  timerReset,
  advanceRound,
  type Match,
  type ScoreEvent,
  type AdminEvent,
} from "@/lib/matches";

// ─── Raw per-judge tallies ────────────────────────────────────────────────────

interface JudgeTotals { red: number; blue: number; name: string; email: string; }

function rawPerJudge(events: ScoreEvent[]): {
  byJudge: Map<string, JudgeTotals>;
  judgeOrder: string[];
} {
  const byJudge = new Map<string, JudgeTotals>();
  const judgeOrder: string[] = [];
  for (const e of events) {
    if (!byJudge.has(e.judgeId)) {
      byJudge.set(e.judgeId, { red: 0, blue: 0, name: e.judgeName ?? '', email: e.judgeEmail ?? '' });
      judgeOrder.push(e.judgeId);
    }
    const t = byJudge.get(e.judgeId)!;
    if (e.side === "red") t.red += e.points;
    else t.blue += e.points;
  }
  return { byJudge, judgeOrder };
}

function adminTotals(events: AdminEvent[]): { red: number; blue: number } {
  let red = 0, blue = 0;
  for (const e of events) {
    if (e.side === "red") red += e.points;
    else blue += e.points;
  }
  return { red, blue };
}

// ─── Admin action button ──────────────────────────────────────────────────────

function AdminBtn({
  label, sublabel, onClick, variant, className = "", disabled = false,
}: {
  label: string;
  sublabel?: string;
  onClick: () => void;
  variant: "red-positive" | "red-penalty" | "blue-positive" | "blue-penalty";
  className?: string;
  disabled?: boolean;
}) {
  const styles = {
    "red-positive":  "bg-danger text-white hover:bg-danger/80",
    "red-penalty":   "bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20",
    "blue-positive": "bg-blue-500 text-white hover:bg-blue-500/80",
    "blue-penalty":  "bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20",
  }[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center rounded-xl font-bold py-3 transition-all duration-75 active:scale-95 active:brightness-75 select-none disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100 ${styles} ${className}`}
    >
      <span className="text-2xl font-black">{label}</span>
      {sublabel && <span className="text-xs opacity-70 mt-0.5">{sublabel}</span>}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DewanPage() {
  const { arena } = useParams<{ arena: string }>();
  const arenaNumber = Number(arena);
  const { user } = useAuth();

  const [openSide, setOpenSide] = useState<"red" | "blue" | null>(null);
  const [tournament,    setTournament]    = useState<Tournament | null>(null);
  const [tournamentId,  setTournamentId]  = useState<string | null>(null);
  const [pinVisible,    setPinVisible]    = useState(false);
  const [match,         setMatch]         = useState<Match | null | undefined>(undefined);
  const [competitors,   setCompetitors]   = useState<Competitor[]>([]);
  const [scoreEvents,   setScoreEvents]   = useState<ScoreEvent[]>([]);
  const [adminEvents,   setAdminEvents]   = useState<AdminEvent[]>([]);
  const [remaining,     setRemaining]     = useState<number>(120);

  useEffect(() => {
    if (!user) return;
    return subscribeActiveTournament(user.uid, (t) => {
      setTournament(t ?? null);
      setTournamentId(t?.id ?? null);
    });
  }, [user]);

  useEffect(() => {
    if (!tournamentId) { setMatch(null); return; }
    setMatch(undefined);
    return subscribeActiveMatch(tournamentId, arenaNumber, setMatch);
  }, [tournamentId, arenaNumber]);

  useEffect(() => {
    if (!match) { setScoreEvents([]); setAdminEvents([]); return; }
    const unsubScore = subscribeScoreEvents(match.id, setScoreEvents);
    const unsubAdmin = subscribeAdminEvents(match.id, setAdminEvents);
    return () => { unsubScore(); unsubAdmin(); };
  }, [match?.id]);

  useEffect(() => {
    if (!user) return;
    return subscribeCompetitors(user.uid, setCompetitors);
  }, [user]);

  // Auto-stop guard — reset when match or round changes
  const autoStopFiredRef = useRef(false);
  useEffect(() => { autoStopFiredRef.current = false; }, [match?.id, match?.currentRound]);

  // Tick timer display + auto-stop when round expires
  useEffect(() => {
    if (!match) return;
    setRemaining(computeRemainingSeconds(match));
    const id = setInterval(() => {
      const rem = computeRemainingSeconds(match);
      setRemaining(rem);
      if (rem <= 0 && match.timerRunning && !autoStopFiredRef.current) {
        autoStopFiredRef.current = true;
        timerStop(match.id, match.roundDurationSeconds ?? 120);
      }
    }, 100);
    return () => clearInterval(id);
  }, [match]);

  const compMap  = new Map(competitors.map((c) => [c.id, c]));
  const redComp  = match ? compMap.get(match.redCornerCompetitorId)  : undefined;
  const blueComp = match ? compMap.get(match.blueCornerCompetitorId) : undefined;

  const { red: confirmedRed, blue: confirmedBlue, confirmedEventIds } =
    computeConfirmedScores(scoreEvents);
  const { red: adminRed, blue: adminBlue } = adminTotals(adminEvents);

  const totalRed  = confirmedRed  + adminRed;
  const totalBlue = confirmedBlue + adminBlue;
  const winner    = totalRed !== totalBlue ? (totalRed > totalBlue ? "red" : "blue") : null;

  const { byJudge, judgeOrder } = rawPerJudge(scoreEvents);
  const confirmedTaps = confirmedEventIds.size;

  async function apply(side: "red" | "blue", pts: number) {
    if (!match) return;
    await addAdminEvent(match.id, side, pts);
  }

  async function undoLast(side: "red" | "blue") {
    if (!match) return;
    const last = [...adminEvents].reverse().find((e) => e.side === side);
    if (last) await deleteAdminEvent(match.id, last.id);
  }

  const arenaPin = tournament?.arenaPins?.[String(arenaNumber)] ?? null;

  const isRunning    = match?.timerRunning ?? false;
  const currentRound = match?.currentRound ?? 1;
  const isLastRound  = currentRound >= 3;
  const isExpired    = remaining <= 0;

  const [confirmNextRound,  setConfirmNextRound]  = useState(false);
  const [breakdownOpen,     setBreakdownOpen]     = useState(false);
  const [judgeTapsOpen,     setJudgeTapsOpen]     = useState(false);
  const [verificationOpen,  setVerificationOpen]  = useState(false);

  async function handleNextRoundConfirmed() {
    if (!match || isLastRound) return;
    await advanceRound(match.id, currentRound + 1);
    setConfirmNextRound(false);
  }

  async function handleTimerStart() {
    if (!match || isRunning) return;
    await timerStart(match.id);
  }

  async function handleTimerStop() {
    if (!match || !isRunning) return;
    await timerStop(match.id, (match.roundDurationSeconds ?? 120) - remaining);
  }

  async function handleTimerReset() {
    if (!match) return;
    await timerReset(match.id);
  }


  return (
    <Shell
      title={`Dewan — Arena ${arenaNumber}`}
      badge={
        <div className="flex items-center gap-2">
          {match && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warn/10 border border-warn/30">
              <span className="w-1.5 h-1.5 rounded-full bg-warn animate-pulse" />
              <span className="text-xs font-semibold text-warn">Live</span>
            </div>
          )}
          {arenaPin && (
            <button
              type="button"
              onClick={() => setPinVisible((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-elevated border border-border hover:border-accent/50 transition-colors select-none"
              title={pinVisible ? "Hide PIN" : "Reveal PIN"}
            >
              <span className="text-xs text-muted">PIN</span>
              <span className="text-xs font-mono font-bold text-primary tracking-widest">
                {pinVisible ? arenaPin : "••••"}
              </span>
              <span className="text-xs text-muted">{pinVisible ? "🙈" : "👁"}</span>
            </button>
          )}
        </div>
      }
    >

      {match === undefined && (
        <p className="text-sm text-secondary mb-4">Loading…</p>
      )}
      {match === null && (
        <div className="flex items-center gap-3 bg-surface border border-border rounded-xl px-5 py-4 mb-4">
          <span className="text-2xl">⏳</span>
          <div>
            <p className="text-sm font-semibold text-primary">No match in progress</p>
            <p className="text-xs text-muted mt-0.5">Waiting for admin to start a match on Arena {arenaNumber}.</p>
          </div>
        </div>
      )}

      {match && (<>

        {/* ── Score banner ── */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden mb-4">
          <div className="grid grid-cols-4">
            <div className={`flex flex-col items-center justify-center py-6 ${winner === "red" ? "bg-danger/10" : ""}`}>
              <p className="text-xs font-semibold uppercase tracking-widest text-danger mb-1">Red</p>
              <p className="text-6xl font-black text-danger">{totalRed}</p>
              {winner === "red" && <p className="text-xs font-semibold text-danger mt-1">Leading</p>}
            </div>
            <div className="col-span-2 flex flex-col items-center justify-center py-6 border-x border-border gap-3">
              {/* Round pips */}
              <div className="flex gap-2">
                {[1, 2, 3].map((r) => (
                  <div
                    key={r}
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                      r === currentRound
                        ? "border-accent bg-accent/10 text-accent"
                        : r < currentRound
                        ? "border-border text-muted line-through"
                        : "border-border text-muted"
                    }`}
                  >
                    {r}
                  </div>
                ))}
              </div>
              {/* Timer */}
              <p className={`text-5xl font-black tabular-nums tracking-tight ${isExpired ? "text-danger" : "text-primary"}`}>
                {formatTime(remaining)}
              </p>
              {/* Start / Stop / Reset */}
              <div className="flex gap-2 w-full px-6">
                <button
                  type="button"
                  onClick={handleTimerStart}
                  disabled={isRunning || isExpired}
                  className="flex-1 py-3 rounded-xl text-sm font-bold bg-accent/10 text-accent border border-accent/30 transition-all duration-75 active:scale-95 active:brightness-75 select-none disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
                >▶ Start</button>
                <button
                  type="button"
                  onClick={handleTimerStop}
                  disabled={!isRunning}
                  className="flex-1 py-3 rounded-xl text-sm font-bold bg-danger/10 text-danger border border-danger/30 transition-all duration-75 active:scale-95 active:brightness-75 select-none disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
                >■ Stop</button>
                <button
                  type="button"
                  onClick={handleTimerReset}
                  disabled={isRunning}
                  className="flex-1 py-3 rounded-xl text-sm font-bold bg-elevated text-muted border border-border transition-all duration-75 active:scale-95 active:brightness-75 select-none disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
                >↺ Reset</button>
              </div>
              {!isLastRound && !confirmNextRound && (
                <button
                  type="button"
                  onClick={() => setConfirmNextRound(true)}
                  disabled={isRunning}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-muted border border-border transition-all duration-75 active:scale-95 active:brightness-75 select-none disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
                >Next Round →</button>
              )}
              {!isLastRound && confirmNextRound && (
                <div className="flex flex-col items-center gap-2 px-4 py-3 rounded-lg border border-warn/40 bg-warn/5 w-full">
                  <p className="text-xs font-semibold text-warn text-center">Move to Round {currentRound + 1}? Cannot go back.</p>
                  <div className="flex gap-2 w-full">
                    <button
                      type="button"
                      onClick={() => setConfirmNextRound(false)}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-muted border border-border transition-all duration-75 active:scale-95 select-none"
                    >Cancel</button>
                    <button
                      type="button"
                      onClick={handleNextRoundConfirmed}
                      className="flex-1 py-1.5 rounded-lg text-xs font-bold text-warn border border-warn/50 bg-warn/10 transition-all duration-75 active:scale-95 select-none"
                    >Yes, Round {currentRound + 1}</button>
                  </div>
                </div>
              )}
              {isLastRound && (
                <p className="text-xs font-semibold text-muted">Final Round</p>
              )}
            </div>
            <div className={`flex flex-col items-center justify-center py-6 ${winner === "blue" ? "bg-blue-500/10" : ""}`}>
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-1">Blue</p>
              <p className="text-6xl font-black text-blue-400">{totalBlue}</p>
              {winner === "blue" && <p className="text-xs font-semibold text-blue-400 mt-1">Leading</p>}
            </div>
          </div>
        </div>

        {/* ── Admin action buttons ── */}
        {isRunning && (
          <div className="flex items-center gap-2 mb-3 px-4 py-2.5 rounded-lg bg-warn/10 border border-warn/30">
            <span className="w-1.5 h-1.5 rounded-full bg-warn animate-pulse flex-shrink-0" />
            <p className="text-xs font-semibold text-warn">Pause the timer to add takedowns or penalties.</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Red corner */}
          <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-danger">Red Corner</p>
              {redComp && (
                <>
                  <p className="text-sm font-bold text-primary truncate mt-0.5">{redComp.firstName} {redComp.lastName}</p>
                  <p className="text-xs text-muted truncate">{redComp.schoolName || redComp.country || ""}</p>
                </>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              <AdminBtn
                label="3" sublabel="Takedown / Sweep"
                onClick={() => apply("red", 3)}
                variant="red-positive"
                className="col-span-4"
                disabled={isRunning}
              />
              {([-1, -2, -5, -10] as const).map((pts) => (
                <AdminBtn
                  key={pts} label={String(pts)} sublabel="Penalty"
                  onClick={() => apply("red", pts)}
                  variant="red-penalty"
                  disabled={isRunning}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => undoLast("red")}
              disabled={isRunning || !adminEvents.some((e) => e.side === "red")}
              className="w-full py-2.5 rounded-lg text-sm font-bold text-danger border border-danger/40 bg-danger/5 hover:bg-danger/15 hover:border-danger/60 transition-all duration-75 active:scale-95 active:brightness-75 select-none disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              ↩ Undo Last Red Action
            </button>
          </div>

          {/* Blue corner */}
          <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">Blue Corner</p>
              {blueComp && (
                <>
                  <p className="text-sm font-bold text-primary truncate mt-0.5">{blueComp.firstName} {blueComp.lastName}</p>
                  <p className="text-xs text-muted truncate">{blueComp.schoolName || blueComp.country || ""}</p>
                </>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              <AdminBtn
                label="3" sublabel="Takedown / Sweep"
                onClick={() => apply("blue", 3)}
                variant="blue-positive"
                className="col-span-4"
                disabled={isRunning}
              />
              {([-1, -2, -5, -10] as const).map((pts) => (
                <AdminBtn
                  key={pts} label={String(pts)} sublabel="Penalty"
                  onClick={() => apply("blue", pts)}
                  variant="blue-penalty"
                  disabled={isRunning}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => undoLast("blue")}
              disabled={isRunning || !adminEvents.some((e) => e.side === "blue")}
              className="w-full py-2.5 rounded-lg text-sm font-bold text-blue-400 border border-blue-400/40 bg-blue-500/5 hover:bg-blue-500/15 hover:border-blue-400/60 transition-all duration-75 active:scale-95 active:brightness-75 select-none disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              ↩ Undo Last Blue Action
            </button>
          </div>
        </div>

        {/* ── Verification — accordion ── */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden mb-4">
          <button
            type="button"
            onClick={() => setVerificationOpen((o) => !o)}
            className="w-full px-5 py-3 flex items-center justify-between hover:bg-elevated/50 transition-colors"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">Verification</p>
            <span className="text-muted text-xs">{verificationOpen ? "▲" : "▼"}</span>
          </button>
          {verificationOpen && (
            <>
              <div className="border-t border-border" />
              <div className="p-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className="flex flex-col items-center justify-center gap-1.5 py-5 rounded-xl font-bold text-sm border border-border bg-elevated text-secondary hover:text-primary hover:border-accent/50 hover:bg-accent/5 transition-all duration-75 active:scale-95 select-none"
                >
                  <span className="text-2xl">👇</span>
                  Drop / Takedown Verification
                </button>
                <button
                  type="button"
                  className="flex flex-col items-center justify-center gap-1.5 py-5 rounded-xl font-bold text-sm border border-border bg-elevated text-secondary hover:text-primary hover:border-warn/50 hover:bg-warn/5 transition-all duration-75 active:scale-95 select-none"
                >
                  <span className="text-2xl">✋</span>
                  Protest Verification
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── Score breakdown (tie-breaker) — accordion ── */}
        {(() => {
          const ACTIONS: { pts: number; label: string; sublabel: string }[] = [
            { pts:  3, label: "+3", sublabel: "Takedown / Sweep" },
            { pts: -1, label: "−1", sublabel: "Minor penalty"    },
            { pts: -2, label: "−2", sublabel: "Warning"          },
            { pts: -5, label: "−5", sublabel: "Major penalty"    },
            { pts:-10, label: "−10",sublabel: "Disqualification" },
          ];
          const count = (side: "red" | "blue", pts: number) =>
            adminEvents.filter((e) => e.side === side && e.points === pts).length;
          const isTied = totalRed === totalBlue;
          return (
            <div className={`bg-surface border rounded-xl overflow-hidden mb-4 ${isTied ? "border-warn/50" : "border-border"}`}>
              <button
                type="button"
                onClick={() => setBreakdownOpen((o) => !o)}
                className={`w-full px-5 py-3 flex items-center justify-between transition-colors hover:bg-elevated/50 ${isTied ? "bg-warn/5" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted">Score Breakdown</p>
                  {isTied && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-warn" />
                      <span className="text-xs font-bold text-warn">Tiebreaker active</span>
                    </div>
                  )}
                </div>
                <span className="text-muted text-xs">{breakdownOpen ? "▲" : "▼"}</span>
              </button>
              {breakdownOpen && (
                <>
                  <div className={`border-t ${isTied ? "border-warn/30" : "border-border"}`} />
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-5 py-2 text-center text-xs font-semibold uppercase tracking-widest text-danger w-1/3">Red</th>
                        <th className="px-5 py-2 text-center text-xs font-semibold uppercase tracking-widest text-muted">Action</th>
                        <th className="px-5 py-2 text-center text-xs font-semibold uppercase tracking-widest text-blue-400 w-1/3">Blue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ACTIONS.map(({ pts, label, sublabel }) => {
                        const r = count("red",  pts);
                        const b = count("blue", pts);
                        const highlight = isTied && (r !== b);
                        return (
                          <tr
                            key={pts}
                            className={`border-b border-border last:border-b-0 ${highlight ? (pts > 0 ? "bg-accent/5" : "bg-warn/5") : ""}`}
                          >
                            <td className="px-5 py-3 text-center">
                              <span className={`text-xl font-black ${r > 0 ? "text-danger" : "text-muted/30"}`}>{r}</span>
                            </td>
                            <td className="px-5 py-3 text-center">
                              <p className={`text-sm font-bold ${highlight ? (pts > 0 ? "text-accent" : "text-warn") : "text-secondary"}`}>{label}</p>
                              <p className="text-xs text-muted">{sublabel}</p>
                            </td>
                            <td className="px-5 py-3 text-center">
                              <span className={`text-xl font-black ${b > 0 ? "text-blue-400" : "text-muted/30"}`}>{b}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          );
        })()}

        {/* ── Judge taps (raw) — accordion ── */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          {judgeOrder.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-secondary">
              <p className="text-3xl mb-3">⚖</p>
              <p className="text-sm">Waiting for judges to score…</p>
              <p className="text-xs text-muted mt-1">Scores count when ≥ 2 judges agree within 5 seconds.</p>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setJudgeTapsOpen((o) => !o)}
                className="w-full px-5 py-3 flex items-center justify-between hover:bg-elevated/50 transition-colors border-b border-border"
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-muted">Judge Taps (raw)</p>
                <span className="text-muted text-xs">{judgeTapsOpen ? "▲" : "▼"}</span>
              </button>
              {judgeTapsOpen && (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-5 py-3 text-left   text-xs font-semibold uppercase tracking-widest text-muted">Judge</th>
                      <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-widest text-danger">Red</th>
                      <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-widest text-blue-400">Blue</th>
                      <th className="px-5 py-3 text-right  text-xs font-semibold uppercase tracking-widest text-muted">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {judgeOrder.map((judgeId, i) => {
                      const t = byJudge.get(judgeId)!;
                      return (
                        <tr key={judgeId} className="border-b border-border last:border-b-0 hover:bg-elevated/50 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-6 h-6 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center text-xs font-bold text-accent flex-shrink-0">
                                {i + 1}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm font-medium text-primary truncate">
                                  {t.name || t.email || `Judge ${i + 1}`}
                                </span>
                                {t.name && t.email && (
                                  <span className="text-xs text-muted truncate">{t.email}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-center"><span className="text-lg font-bold text-danger">{t.red}</span></td>
                          <td className="px-5 py-3 text-center"><span className="text-lg font-bold text-blue-400">{t.blue}</span></td>
                          <td className="px-5 py-3 text-right"><span className="text-sm font-semibold text-secondary">{t.red + t.blue}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>

      </>)}
    </Shell>
  );
}
