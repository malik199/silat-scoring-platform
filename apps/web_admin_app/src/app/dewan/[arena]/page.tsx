"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/context/AuthContext";
import { subscribeActiveTournament } from "@/lib/tournaments";
import { subscribeCompetitors, type Competitor } from "@/lib/competitors";
import {
  subscribeActiveMatch,
  subscribeScoreEvents,
  subscribeAdminEvents,
  addAdminEvent,
  deleteAdminEvent,
  computeConfirmedScores,
  type Match,
  type ScoreEvent,
  type AdminEvent,
} from "@/lib/matches";

// ─── Raw per-judge tallies ────────────────────────────────────────────────────

interface JudgeTotals { red: number; blue: number }

function rawPerJudge(events: ScoreEvent[]): {
  byJudge: Map<string, JudgeTotals>;
  judgeOrder: string[];
} {
  const byJudge = new Map<string, JudgeTotals>();
  const judgeOrder: string[] = [];
  for (const e of events) {
    if (!byJudge.has(e.judgeId)) {
      byJudge.set(e.judgeId, { red: 0, blue: 0 });
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
  label, sublabel, onClick, variant, className = "",
}: {
  label: string;
  sublabel?: string;
  onClick: () => void;
  variant: "red-positive" | "red-penalty" | "blue-positive" | "blue-penalty";
  className?: string;
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
      className={`flex flex-col items-center justify-center rounded-xl font-bold py-3 transition-all duration-75 active:scale-95 active:brightness-75 select-none ${styles} ${className}`}
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
  const [tournamentId,  setTournamentId]  = useState<string | null>(null);
  const [match,         setMatch]         = useState<Match | null | undefined>(undefined);
  const [competitors,   setCompetitors]   = useState<Competitor[]>([]);
  const [scoreEvents,   setScoreEvents]   = useState<ScoreEvent[]>([]);
  const [adminEvents,   setAdminEvents]   = useState<AdminEvent[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeActiveTournament(user.uid, (t) => setTournamentId(t?.id ?? null));
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

  useEffect(() => subscribeCompetitors(setCompetitors), []);

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

  return (
    <Shell
      title={`Dewan — Arena ${arenaNumber}`}
      badge={match ? (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warn/10 border border-warn/30">
          <span className="w-1.5 h-1.5 rounded-full bg-warn animate-pulse" />
          <span className="text-xs font-semibold text-warn">Live</span>
        </div>
      ) : undefined}
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
              {(adminRed !== 0) && (
                <p className="text-xs text-muted mt-1">
                  {confirmedRed} judges {adminRed >= 0 ? "+" : ""}{adminRed} admin
                </p>
              )}
              {winner === "red" && <p className="text-xs font-semibold text-danger mt-1">Leading</p>}
            </div>
            <div className="col-span-2 flex flex-col items-center justify-center py-6 border-x border-border gap-3">
              {/* Round pips */}
              <div className="flex gap-2">
                {[1, 2, 3].map((r) => (
                  <div
                    key={r}
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                      r === 1
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border text-muted"
                    }`}
                  >
                    {r}
                  </div>
                ))}
              </div>
              {/* Timer */}
              <p className="text-5xl font-black text-primary tabular-nums tracking-tight">2:00</p>
              {/* Start / Stop / Reset */}
              <div className="flex gap-2 w-full px-6">
                <button type="button" disabled className="flex-1 py-3 rounded-xl text-sm font-bold bg-accent/10 text-accent border border-accent/30 opacity-40 cursor-not-allowed select-none">▶ Start</button>
                <button type="button" disabled className="flex-1 py-3 rounded-xl text-sm font-bold bg-danger/10 text-danger border border-danger/30 opacity-40 cursor-not-allowed select-none">■ Stop</button>
                <button type="button" disabled className="flex-1 py-3 rounded-xl text-sm font-bold bg-elevated text-muted border border-border opacity-40 cursor-not-allowed select-none">↺ Reset</button>
              </div>
              <button type="button" disabled className="px-4 py-2 rounded-lg text-sm font-semibold text-muted border border-border opacity-40 cursor-not-allowed select-none">Next Round →</button>
            </div>
            <div className={`flex flex-col items-center justify-center py-6 ${winner === "blue" ? "bg-blue-500/10" : ""}`}>
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-1">Blue</p>
              <p className="text-6xl font-black text-blue-400">{totalBlue}</p>
              {(adminBlue !== 0) && (
                <p className="text-xs text-muted mt-1">
                  {confirmedBlue} judges {adminBlue >= 0 ? "+" : ""}{adminBlue} admin
                </p>
              )}
              {winner === "blue" && <p className="text-xs font-semibold text-blue-400 mt-1">Leading</p>}
            </div>
          </div>
        </div>

        {/* ── Admin action buttons ── */}
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
              />
              {([-1, -2, -5, -10] as const).map((pts) => (
                <AdminBtn
                  key={pts} label={String(pts)} sublabel="Penalty"
                  onClick={() => apply("red", pts)}
                  variant="red-penalty"
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => undoLast("red")}
              disabled={!adminEvents.some((e) => e.side === "red")}
              className="w-full py-2 rounded-lg text-xs font-semibold text-muted border border-border hover:text-danger hover:border-danger/40 hover:bg-danger/5 transition-all duration-75 active:scale-95 active:brightness-75 select-none disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              ↩ Undo last red action
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
              />
              {([-1, -2, -5, -10] as const).map((pts) => (
                <AdminBtn
                  key={pts} label={String(pts)} sublabel="Penalty"
                  onClick={() => apply("blue", pts)}
                  variant="blue-penalty"
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => undoLast("blue")}
              disabled={!adminEvents.some((e) => e.side === "blue")}
              className="w-full py-2 rounded-lg text-xs font-semibold text-muted border border-border hover:text-blue-400 hover:border-blue-400/40 hover:bg-blue-500/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ↩ Undo last blue action
            </button>
          </div>
        </div>

        {/* ── Judge taps (raw) ── */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          {judgeOrder.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-secondary">
              <p className="text-3xl mb-3">⚖</p>
              <p className="text-sm">Waiting for judges to score…</p>
              <p className="text-xs text-muted mt-1">Scores count when ≥ 2 judges agree within 5 seconds.</p>
            </div>
          ) : (
            <>
              <div className="px-5 py-2.5 border-b border-border">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted">Judge Taps (raw)</p>
              </div>
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
                            <span className="text-sm font-medium text-primary">Judge {i + 1}</span>
                            <span className="text-xs text-muted font-mono hidden sm:inline">{judgeId.slice(-6)}</span>
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
            </>
          )}
        </div>

      </>)}
    </Shell>
  );
}
