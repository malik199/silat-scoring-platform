"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  subscribeMatches,
  subscribeScoreEvents,
  subscribeAdminEvents,
  computeConfirmedScores,
  computePenaltyFlagPoints,
  type Match,
  type ScoreEvent,
  type AdminEvent,
} from "@/lib/matches";
import { getCompetitorsByIds, type Competitor } from "@/lib/competitors";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cntFlags(warnings: Record<string, boolean> | undefined, side: "red" | "blue", type: string): number {
  if (!warnings) return 0;
  if (type === "m5" || type === "m10") return warnings[`${side}_${type}`] ? 1 : 0;
  let n = 0;
  for (let r = 1; r <= 3; r++) if (warnings[`r${r}_${side}_${type}`]) n++;
  return n;
}

// ─── Public match detail modal ────────────────────────────────────────────────

function PublicMatchDetail({ match, redName, blueName, onClose }: {
  match: Match;
  redName: string;
  blueName: string;
  onClose: () => void;
}) {
  const [scoreEvents, setScoreEvents] = useState<ScoreEvent[]>([]);
  const [adminEvents, setAdminEvents] = useState<AdminEvent[]>([]);

  useEffect(() => {
    const unsubScore = subscribeScoreEvents(match.id, setScoreEvents);
    const unsubAdmin = subscribeAdminEvents(match.id, setAdminEvents);
    return () => { unsubScore(); unsubAdmin(); };
  }, [match.id]);

  const { red: confirmedRed, blue: confirmedBlue } = computeConfirmedScores(scoreEvents);
  const adminRed   = adminEvents.filter((e) => e.side === "red"  && e.points > 0).reduce((s, e) => s + e.points, 0);
  const adminBlue  = adminEvents.filter((e) => e.side === "blue" && e.points > 0).reduce((s, e) => s + e.points, 0);
  const penaltyRed  = computePenaltyFlagPoints(match.warnings, "red",  match.currentRound ?? 1);
  const penaltyBlue = computePenaltyFlagPoints(match.warnings, "blue", match.currentRound ?? 1);
  const totalRed  = confirmedRed + adminRed + penaltyRed;
  const totalBlue = confirmedBlue + adminBlue + penaltyBlue;
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

  const breakdownRows = [
    { label: "+3",  sublabel: "Takedown / Sweep",  r: adminEvents.filter(e => e.side === "red"  && e.points > 0).length, b: adminEvents.filter(e => e.side === "blue" && e.points > 0).length, accent: "text-accent"  },
    { label: "W1",  sublabel: "Warning 1",         r: cntFlags(match.warnings,"red","w1"),  b: cntFlags(match.warnings,"blue","w1"),  accent: "text-warn"   },
    { label: "W2",  sublabel: "Warning 2",         r: cntFlags(match.warnings,"red","w2"),  b: cntFlags(match.warnings,"blue","w2"),  accent: "text-warn"   },
    { label: "−1",  sublabel: "Moderate Violation",   r: cntFlags(match.warnings,"red","m1"),  b: cntFlags(match.warnings,"blue","m1"),  accent: "text-danger" },
    { label: "−2",  sublabel: "Violation",         r: cntFlags(match.warnings,"red","m2"),  b: cntFlags(match.warnings,"blue","m2"),  accent: "text-danger" },
    { label: "−5",  sublabel: "Major Violation",   r: cntFlags(match.warnings,"red","m5"),  b: cntFlags(match.warnings,"blue","m5"),  accent: "text-danger" },
    { label: "−10", sublabel: "Serious Violation", r: cntFlags(match.warnings,"red","m10"), b: cntFlags(match.warnings,"blue","m10"), accent: "text-danger" },
  ].filter(({ r, b }) => r > 0 || b > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">

        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <p className="text-xs text-muted uppercase tracking-widest font-semibold">Match #{match.order} · Arena {match.arenaNumber}</p>
            <p className="text-sm font-semibold text-primary mt-0.5">{redName} vs {blueName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-warn hover:bg-elevated transition-colors"
          >✕</button>
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
                          <span className="text-sm font-medium text-primary">
                            {t.name || t.email || `Judge ${i + 1}`}
                          </span>
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
          {breakdownRows.length > 0 && (
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
                  {breakdownRows.map(({ label, sublabel, r, b, accent }) => (
                    <tr key={label} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-lg font-black ${r > 0 ? "text-danger" : "text-muted/30"}`}>{r}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <p className={`text-sm font-bold ${accent}`}>{label}</p>
                        <p className="text-xs text-muted">{sublabel}</p>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-lg font-black ${b > 0 ? "text-blue-400" : "text-muted/30"}`}>{b}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PublicMatchesPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const [matches,     setMatches]     = useState<Match[] | null>(null);
  const [competitors, setCompetitors] = useState<Map<string, Competitor>>(new Map());
  const [detailMatch, setDetailMatch] = useState<Match | null>(null);

  useEffect(() => {
    return subscribeMatches(tournamentId, (m) => setMatches(m));
  }, [tournamentId]);

  useEffect(() => {
    if (!matches || matches.length === 0) return;
    const ids = [...new Set(matches.flatMap((m) => [m.redCornerCompetitorId, m.blueCornerCompetitorId]))];
    getCompetitorsByIds(ids).then((comps) => {
      setCompetitors(new Map(comps.map((c) => [c.id, c])));
    });
  }, [matches]);

  const tournamentName = matches?.[0]?.tournamentName ?? "";

  function compName(id: string): string {
    const c = competitors.get(id);
    return c ? `${c.firstName} ${c.lastName}` : "—";
  }

  return (
    <div className="min-h-screen bg-base text-primary" style={{ fontFamily: "system-ui, sans-serif" }}>

      {/* Header */}
      <div className="border-b border-border bg-surface px-6 py-5 flex items-center justify-between">
        <img src="/SilatScore.svg" alt="Silat Score" className="h-8 w-auto flex-shrink-0" />
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-0.5">Match Results</p>
          <h1 className="text-xl font-bold text-primary leading-tight">{tournamentName || "—"}</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {matches === null ? (
          <p className="text-sm text-secondary text-center py-16">Loading…</p>
        ) : matches.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">⚔️</p>
            <p className="text-sm text-secondary">No matches yet.</p>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            {/* Column headers */}
            <div className="grid grid-cols-[28px_1fr_1fr_24px_24px] gap-2 px-4 py-3 border-b border-border">
              <span className="text-xs font-semibold text-muted">#</span>
              <span className="text-xs font-semibold uppercase tracking-widest text-muted">Red</span>
              <span className="text-xs font-semibold uppercase tracking-widest text-muted">Blue</span>
              {/* Arena icon — mat shape */}
              <span className="flex items-center justify-center text-muted">
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="1" width="12" height="12" rx="1.5"/>
                  <rect x="4" y="4" width="6" height="6" rx="0.5"/>
                </svg>
              </span>
              {/* Status icon — circle indicator */}
              <span className="flex items-center justify-center text-muted">
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <circle cx="7" cy="7" r="5.5"/>
                  <circle cx="7" cy="7" r="2" fill="currentColor" stroke="none"/>
                </svg>
              </span>
            </div>
            <ul>
              {matches.map((m) => {
                const red  = compName(m.redCornerCompetitorId);
                const blue = compName(m.blueCornerCompetitorId);
                const isClickable = m.status === "completed" || m.status === "in_progress";
                return (
                  <li
                    key={m.id}
                    onClick={() => isClickable && setDetailMatch(m)}
                    className={`grid grid-cols-[28px_1fr_1fr_24px_24px] gap-2 items-center px-4 py-3.5 border-b border-border last:border-b-0 ${
                      isClickable ? "cursor-pointer hover:bg-elevated/50 transition-colors" : ""
                    }`}
                  >
                    <span className="text-sm font-bold text-muted">{m.order}</span>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-danger flex-shrink-0" />
                      <span className="text-sm font-medium text-primary truncate">{red}</span>
                      {m.winnerCorner === "red" && <img src="/greencheckmark.svg" alt="Winner" className="w-3 h-3 flex-shrink-0" />}
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                      <span className="text-sm font-medium text-primary truncate">{blue}</span>
                      {m.winnerCorner === "blue" && <img src="/greencheckmark.svg" alt="Winner" className="w-3 h-3 flex-shrink-0" />}
                    </div>
                    {/* Arena number */}
                    <span className="text-xs font-semibold text-secondary text-center">{m.arenaNumber}</span>
                    {/* Compact status */}
                    <div className="flex justify-center">
                      {m.status === "in_progress" && (
                        <span className="w-2.5 h-2.5 rounded-full bg-warn animate-pulse" title="In progress" />
                      )}
                      {m.status === "completed" && (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#00d084" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-label="Completed">
                          <circle cx="7" cy="7" r="6"/>
                          <path d="M4.5 7l2 2 3-3"/>
                        </svg>
                      )}
                      {m.status === "pending" && (
                        <span className="text-muted text-xs leading-none">—</span>
                      )}
                      {m.status === "cancelled" && (
                        <span className="text-muted text-xs leading-none">✕</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {detailMatch && (() => {
        const red  = compName(detailMatch.redCornerCompetitorId);
        const blue = compName(detailMatch.blueCornerCompetitorId);
        return (
          <PublicMatchDetail
            match={detailMatch}
            redName={red}
            blueName={blue}
            onClose={() => setDetailMatch(null)}
          />
        );
      })()}
    </div>
  );
}
