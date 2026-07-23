"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/context/AuthContext";
import { subscribeActiveTournament } from "@/lib/tournaments";
import { subscribeCompetitors, type Competitor } from "@/lib/competitors";
import {
  subscribeActiveMatch,
  subscribeScoreEvents,
  subscribeAdminEvents,
  subscribeLightViolations,
  subscribeSeriousViolations,
  addLightViolation,
  deleteLightViolation,
  addSeriousViolation,
  deleteSeriousViolation,
  computeConfirmedScores,
  LIGHT_VIOLATION_TYPES,
  SERIOUS_VIOLATION_TYPES,
  type Match,
  type ScoreEvent,
  type AdminEvent,
  type LightViolation,
  type LightViolationType,
  type SeriousViolation,
  type SeriousViolationType,
} from "@/lib/matches";

function adminTotals(events: AdminEvent[]) {
  let red = 0, blue = 0;
  for (const e of events) { if (e.side === "red") red += e.points; else blue += e.points; }
  return { red, blue };
}

function rawPerJudge(events: ScoreEvent[]) {
  const byJudge = new Map<string, { red: number; blue: number; name: string; email: string }>();
  const judgeOrder: string[] = [];
  for (const e of events) {
    if (!byJudge.has(e.judgeId)) {
      byJudge.set(e.judgeId, { red: 0, blue: 0, name: e.judgeName ?? "", email: e.judgeEmail ?? "" });
      judgeOrder.push(e.judgeId);
    }
    const t = byJudge.get(e.judgeId)!;
    if (e.side === "red") t.red += e.points; else t.blue += e.points;
  }
  return { byJudge, judgeOrder };
}

export default function MoreDewanPage() {
  const { arena } = useParams<{ arena: string }>();
  const arenaNumber = Number(arena);
  const router = useRouter();
  const { user } = useAuth();

  const [tournamentId,      setTournamentId]      = useState<string | null>(null);
  const [match,             setMatch]             = useState<Match | null | undefined>(undefined);
  const [competitors,       setCompetitors]       = useState<Competitor[]>([]);
  const [scoreEvents,       setScoreEvents]       = useState<ScoreEvent[]>([]);
  const [adminEvents,       setAdminEvents]       = useState<AdminEvent[]>([]);
  const [lightViolations,   setLightViolations]   = useState<LightViolation[]>([]);
  const [seriousViolations, setSeriousViolations] = useState<SeriousViolation[]>([]);

  const [violationsOpen,        setViolationsOpen]        = useState(true);
  const [seriousViolationsOpen, setSeriousViolationsOpen] = useState(true);
  const [breakdownOpen,         setBreakdownOpen]         = useState(false);
  const [judgeTapsOpen,         setJudgeTapsOpen]         = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsubT = subscribeActiveTournament(user.uid, (t) => setTournamentId(t?.id ?? null));
    const unsubC = subscribeCompetitors(user.uid, setCompetitors);
    return () => { unsubT(); unsubC(); };
  }, [user]);

  useEffect(() => {
    if (!tournamentId) { setMatch(null); return; }
    setMatch(undefined);
    return subscribeActiveMatch(tournamentId, arenaNumber, setMatch);
  }, [tournamentId, arenaNumber]);

  useEffect(() => {
    if (!match) {
      setScoreEvents([]); setAdminEvents([]);
      setLightViolations([]); setSeriousViolations([]);
      return;
    }
    const unsubScore   = subscribeScoreEvents(match.id, setScoreEvents);
    const unsubAdmin   = subscribeAdminEvents(match.id, setAdminEvents);
    const unsubViol    = subscribeLightViolations(match.id, setLightViolations);
    const unsubSerious = subscribeSeriousViolations(match.id, setSeriousViolations);
    return () => { unsubScore(); unsubAdmin(); unsubViol(); unsubSerious(); };
  }, [match?.id]);

  const compMap  = new Map(competitors.map((c) => [c.id, c]));
  const redComp  = match ? compMap.get(match.redCornerCompetitorId)  : undefined;
  const blueComp = match ? compMap.get(match.blueCornerCompetitorId) : undefined;

  const { red: confirmedRed, blue: confirmedBlue } = computeConfirmedScores(scoreEvents);
  const { red: adminRed, blue: adminBlue } = adminTotals(adminEvents);
  const totalRed  = confirmedRed + adminRed;
  const totalBlue = confirmedBlue + adminBlue;

  const currentRound = match?.currentRound ?? 1;
  const { byJudge, judgeOrder } = rawPerJudge(scoreEvents);

  const ACTIONS = [
    { pts:  3, label: "+3",  sublabel: "Takedown / Sweep" },
    { pts: -1, label: "−1",  sublabel: "Minor penalty"    },
    { pts: -2, label: "−2",  sublabel: "Warning"          },
    { pts: -5, label: "−5",  sublabel: "Major penalty"    },
    { pts:-10, label: "−10", sublabel: "Disqualification" },
  ];

  return (
    <Shell title={`Dewan ${arenaNumber} — More Functions`}>

      {/* Back button */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => router.push(`/dewan/${arenaNumber}`)}
          className="flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors"
        >
          ← Back to Dewan {arenaNumber}
        </button>
        {match && redComp && blueComp && (
          <p className="text-xs text-muted">
            <span className="text-danger font-semibold">{redComp.firstName} {redComp.lastName}</span>
            {" vs "}
            <span className="text-blue-400 font-semibold">{blueComp.firstName} {blueComp.lastName}</span>
          </p>
        )}
      </div>

      {match === undefined && <p className="text-sm text-secondary">Loading…</p>}
      {match === null && (
        <div className="flex items-center justify-between gap-4 bg-surface border border-border rounded-xl px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-primary">No match in progress</p>
            <p className="text-xs text-muted mt-0.5">To set up or start a new match, go to &ldquo;Matches&rdquo;</p>
          </div>
          <button
            onClick={() => router.push("/matches")}
            className="shrink-0 px-4 py-2 rounded-lg bg-accent text-black text-sm font-bold hover:bg-accent/80 transition-colors"
          >
            Matches
          </button>
        </div>
      )}

      {match && (<>

        {/* ── Light Violations ── */}
        {(() => {
          const viol = (side: "red" | "blue", type: LightViolationType) =>
            lightViolations.filter((v) => v.side === side && v.type === type && v.round === currentRound);

          const undoViol = async (side: "red" | "blue", type: LightViolationType) => {
            const last = [...lightViolations].reverse()
              .find((v) => v.side === side && v.type === type && v.round === currentRound);
            if (last) await deleteLightViolation(match.id, last.id);
          };

          return (
            <div className="bg-surface border border-border rounded-xl overflow-hidden mb-4">
              <button
                type="button"
                onClick={() => setViolationsOpen((o) => !o)}
                className="w-full px-5 py-3 flex items-center justify-between hover:bg-elevated/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted">Light Violations</p>
                  {lightViolations.filter((v) => v.round === currentRound).length > 0 && (
                    <span className="text-xs font-bold text-warn bg-warn/10 border border-warn/30 rounded-full px-2 py-0.5">
                      {lightViolations.filter((v) => v.round === currentRound).length} R{currentRound}
                    </span>
                  )}
                </div>
                <span className="text-muted text-xs">{violationsOpen ? "▲" : "▼"}</span>
              </button>
              {violationsOpen && (
                <>
                  <div className="border-t border-border" />
                  <div className="grid grid-cols-2 gap-px bg-border">
                    <div className="bg-surface p-3 space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-2">Blue Corner</p>
                      {LIGHT_VIOLATION_TYPES.map(({ type, label, icon }) => {
                        const count = viol("blue", type).length;
                        return (
                          <div key={type} className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => addLightViolation(match.id, "blue", type, currentRound)}
                              className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-elevated border border-border hover:border-blue-400/40 hover:bg-blue-500/5 transition-all active:scale-95 text-left"
                            >
                              <span className="text-base leading-none">{icon}</span>
                              <span className="text-xs font-medium text-secondary flex-1">{label}</span>
                              {count > 0 && <span className="text-sm font-black text-blue-400">{count}</span>}
                            </button>
                            {count > 0 && (
                              <button
                                type="button"
                                onClick={() => undoViol("blue", type)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-blue-400 hover:bg-blue-500/10 transition-colors text-xs"
                              >↩</button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="bg-surface p-3 space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-widest text-danger mb-2">Red Corner</p>
                      {LIGHT_VIOLATION_TYPES.map(({ type, label, icon }) => {
                        const count = viol("red", type).length;
                        return (
                          <div key={type} className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => addLightViolation(match.id, "red", type, currentRound)}
                              className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-elevated border border-border hover:border-danger/40 hover:bg-danger/5 transition-all active:scale-95 text-left"
                            >
                              <span className="text-base leading-none">{icon}</span>
                              <span className="text-xs font-medium text-secondary flex-1">{label}</span>
                              {count > 0 && <span className="text-sm font-black text-danger">{count}</span>}
                            </button>
                            {count > 0 && (
                              <button
                                type="button"
                                onClick={() => undoViol("red", type)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors text-xs"
                              >↩</button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="px-4 py-2.5 border-t border-border">
                    <p className="text-xs text-muted">Counts are per round. Round {currentRound} shown.</p>
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* ── Serious Violations ── */}
        {(() => {
          const count = (side: "red" | "blue", type: SeriousViolationType) =>
            seriousViolations.filter((v) => v.side === side && v.type === type && v.round === currentRound).length;

          const undoSerious = async (side: "red" | "blue", type: SeriousViolationType) => {
            const last = [...seriousViolations].reverse()
              .find((v) => v.side === side && v.type === type && v.round === currentRound);
            if (last) await deleteSeriousViolation(match.id, last.id, last.adminEventId);
          };

          const totalThisRound = seriousViolations.filter((v) => v.round === currentRound).length;
          const moderate = SERIOUS_VIOLATION_TYPES.filter((v) => v.severity === "moderate");
          const serious  = SERIOUS_VIOLATION_TYPES.filter((v) => v.severity === "serious");

          const ViolRow = ({ type, label, icon }: { type: SeriousViolationType; label: string; icon: string }) => {
            const r = count("red", type);
            const b = count("blue", type);
            return (
              <tr className="border-b border-border last:border-b-0">
                <td className="px-3 py-2 w-[30%]">
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => addSeriousViolation(match.id, "blue", type, currentRound)}
                      className={`w-8 h-8 rounded-lg font-black text-sm flex items-center justify-center transition-all duration-75 active:scale-90 select-none ${
                        b > 0 ? "bg-blue-500 text-white" : "bg-elevated text-muted hover:bg-blue-500/10 hover:text-blue-400 border border-border"
                      }`}
                    >{b > 0 ? b : "+"}</button>
                    {b > 0 && (
                      <button type="button" onClick={() => undoSerious("blue", type)}
                        className="text-xs text-muted hover:text-blue-400 transition-colors">↩</button>
                    )}
                  </div>
                </td>
                <td className="px-2 py-2 text-center">
                  <span className="text-sm leading-none mr-1">{icon}</span>
                  <span className="text-xs text-secondary">{label}</span>
                </td>
                <td className="px-3 py-2 w-[30%]">
                  <div className="flex items-center justify-center gap-1.5">
                    {r > 0 && (
                      <button type="button" onClick={() => undoSerious("red", type)}
                        className="text-xs text-muted hover:text-danger transition-colors">↩</button>
                    )}
                    <button
                      type="button"
                      onClick={() => addSeriousViolation(match.id, "red", type, currentRound)}
                      className={`w-8 h-8 rounded-lg font-black text-sm flex items-center justify-center transition-all duration-75 active:scale-90 select-none ${
                        r > 0 ? "bg-danger text-white" : "bg-elevated text-muted hover:bg-danger/10 hover:text-danger border border-border"
                      }`}
                    >{r > 0 ? r : "+"}</button>
                  </div>
                </td>
              </tr>
            );
          };

          return (
            <div className="bg-surface border border-border rounded-xl overflow-hidden mb-4">
              <button
                type="button"
                onClick={() => setSeriousViolationsOpen((o) => !o)}
                className="w-full px-5 py-3 flex items-center justify-between hover:bg-elevated/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted">Serious Violations</p>
                  {totalThisRound > 0 && (
                    <span className="text-xs font-bold text-danger bg-danger/10 border border-danger/30 rounded-full px-2 py-0.5">
                      {totalThisRound} R{currentRound}
                    </span>
                  )}
                </div>
                <span className="text-muted text-xs">{seriousViolationsOpen ? "▲" : "▼"}</span>
              </button>
              {seriousViolationsOpen && (
                <>
                  <div className="border-t border-border" />
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-widest text-blue-400 w-[30%]">Blue</th>
                        <th className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-widest text-muted">Violation</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-widest text-danger w-[30%]">Red</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td colSpan={3} className="px-4 py-1.5 bg-elevated/60 text-center text-xs font-semibold uppercase tracking-widest text-warn/80 border-b border-border">
                          Moderate — −1 pt each
                        </td>
                      </tr>
                      {moderate.map((v) => <ViolRow key={v.type} type={v.type as SeriousViolationType} label={v.label} icon={v.icon} />)}
                      <tr>
                        <td colSpan={3} className="px-4 py-1.5 bg-elevated/60 text-center text-xs font-semibold uppercase tracking-widest text-danger/80 border-b border-border border-t border-border">
                          Serious — −5 pts each
                        </td>
                      </tr>
                      {serious.map((v) => <ViolRow key={v.type} type={v.type as SeriousViolationType} label={v.label} icon={v.icon} />)}
                    </tbody>
                  </table>
                  <div className="px-4 py-2.5 border-t border-border">
                    <p className="text-xs text-muted">Points deducted automatically. Round {currentRound} shown.</p>
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* ── Score Breakdown ── */}
        {(() => {
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
                        <th className="px-5 py-2 text-center text-xs font-semibold uppercase tracking-widest text-blue-400 w-1/3">Blue</th>
                        <th className="px-5 py-2 text-center text-xs font-semibold uppercase tracking-widest text-muted">Action</th>
                        <th className="px-5 py-2 text-center text-xs font-semibold uppercase tracking-widest text-danger w-1/3">Red</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ACTIONS.map(({ pts, label, sublabel }) => {
                        const r = count("red", pts);
                        const b = count("blue", pts);
                        const highlight = isTied && (r !== b);
                        return (
                          <tr key={pts} className={`border-b border-border last:border-b-0 ${highlight ? (pts > 0 ? "bg-accent/5" : "bg-warn/5") : ""}`}>
                            <td className="px-5 py-3 text-center">
                              <span className={`text-xl font-black ${b > 0 ? "text-blue-400" : "text-muted/30"}`}>{b}</span>
                            </td>
                            <td className="px-5 py-3 text-center">
                              <p className={`text-sm font-bold ${highlight ? (pts > 0 ? "text-accent" : "text-warn") : "text-secondary"}`}>{label}</p>
                              <p className="text-xs text-muted">{sublabel}</p>
                            </td>
                            <td className="px-5 py-3 text-center">
                              <span className={`text-xl font-black ${r > 0 ? "text-danger" : "text-muted/30"}`}>{r}</span>
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

        {/* ── Judge Taps (raw) ── */}
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
                      <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-widest text-blue-400">Blue</th>
                      <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-widest text-danger">Red</th>
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
                                <span className="text-sm font-medium text-primary truncate">{t.name || t.email || `Judge ${i + 1}`}</span>
                                {t.name && t.email && <span className="text-xs text-muted truncate">{t.email}</span>}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-center"><span className="text-lg font-bold text-blue-400">{t.blue}</span></td>
                          <td className="px-5 py-3 text-center"><span className="text-lg font-bold text-danger">{t.red}</span></td>
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
