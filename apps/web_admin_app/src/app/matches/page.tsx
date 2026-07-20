"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Shell } from "@/components/Shell";
import { ActiveTournamentBanner } from "@/components/ActiveTournamentBanner";
import { useAuth } from "@/context/AuthContext";
import { subscribeActiveTournament, type Tournament } from "@/lib/tournaments";
import { subscribeCompetitors, type Competitor } from "@/lib/competitors";
import {
  subscribeMatches,
  subscribeScoreEvents,
  subscribeAdminEvents,
  createMatch,
  deleteMatch,
  reorderMatches,
  startMatch,
  endMatch,
  computeConfirmedScores,
  MATCH_STATUS_LABELS,
  MATCH_STATUS_COLOR,
  type Match,
  type ScoreEvent,
  type AdminEvent,
} from "@/lib/matches";

// ─── Age categories (Pencak Silat / PERSILAT) ─────────────────────────────────

function getAgeYears(dob: string): number {
  if (!dob) return 0;
  const d = new Date(dob + "T00:00:00");
  const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) years--;
  return Math.max(0, years);
}

const AGE_CATS = [
  { key: "all",       label: "All Ages",     min: 0,  max: 999 },
  { key: "kids",      label: "Kids (U10)",   min: 0,  max: 9   },
  { key: "prejunior", label: "Pre-Junior",   min: 10, max: 12  },
  { key: "junior",    label: "Junior",       min: 13, max: 17  },
  { key: "senior",    label: "Senior (18+)", min: 18, max: 999 },
];

function WinnerCheck() {
  return <img src="/greencheckmark.svg" alt="Winner" className="w-4 h-4 flex-shrink-0" />;
}

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
  const [genderFilter,         setGenderFilter]         = useState<"male" | "female" | null>(null);
  const [ageCat,               setAgeCat]               = useState("all");
  const [redId,                setRedId]                = useState("");
  const [blueId,               setBlueId]               = useState("");
  const [roundDurationSeconds, setRoundDurationSeconds] = useState<90 | 120>(120);
  const [dirtyTime,            setDirtyTime]            = useState(false);
  const [saving,               setSaving]               = useState(false);
  const [error,                setError]                = useState("");

  function handleArenaChange(n: number) {
    setArenaNumber(n);
    setRedId(""); setBlueId(""); setError("");
  }

  function handleGenderFilter(g: "male" | "female") {
    setGenderFilter((prev) => (prev === g ? null : g));
    setRedId(""); setBlueId("");
  }

  function handleAgeCat(key: string) {
    setAgeCat(key);
    setRedId(""); setBlueId("");
  }

  const filteredCompetitors = competitors.filter((c) => {
    if (genderFilter && c.gender !== genderFilter) return false;
    if (ageCat !== "all") {
      const cat = AGE_CATS.find((a) => a.key === ageCat);
      if (cat) {
        const age = getAgeYears(c.dateOfBirth);
        if (age < cat.min || age > cat.max) return false;
      }
    }
    return true;
  });

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
        dirtyTime,
        currentCount,
      });
      onClose();
    } catch {
      setError("Failed to create match. Please try again.");
      setSaving(false);
    }
  }

  const sel = "w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:border-accent transition-colors appearance-none [color-scheme:dark]";
  const filterBtn = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
      active
        ? "bg-accent/10 border-accent text-accent"
        : "bg-elevated border-border text-secondary hover:text-warn"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-semibold text-primary">Create New Match</h2>
          <p className="text-xs text-secondary mt-1">{tournament.name} · Match #{currentCount + 1}</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            {/* Arena */}
            {arenas.length > 1 && (
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-widest mb-1.5">Arena</label>
                <select value={arenaNumber} onChange={(e) => handleArenaChange(Number(e.target.value))} className={sel}>
                  {arenas.map((n) => <option key={n} value={n}>Arena {n}</option>)}
                </select>
              </div>
            )}

            {/* Filters */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-secondary uppercase tracking-widest">Filter Competitors</label>
              {/* Gender */}
              <div className="flex gap-1.5">
                {(["male", "female"] as const).map((g) => (
                  <button key={g} type="button" onClick={() => handleGenderFilter(g)}
                    className={filterBtn(genderFilter === g) + " capitalize"}>
                    {g}
                  </button>
                ))}
                {genderFilter && (
                  <button type="button" onClick={() => { setGenderFilter(null); setRedId(""); setBlueId(""); }}
                    className="px-2 py-1.5 rounded-lg text-xs text-muted hover:text-danger border border-border bg-elevated transition-colors">
                    ✕
                  </button>
                )}
              </div>
              {/* Age category */}
              <div className="flex flex-wrap gap-1.5">
                {AGE_CATS.map((cat) => (
                  <button key={cat.key} type="button" onClick={() => handleAgeCat(cat.key)}
                    className={filterBtn(ageCat === cat.key)}>
                    {cat.label}
                  </button>
                ))}
              </div>
              {filteredCompetitors.length > 0 && (
                <p className="text-xs text-muted">{filteredCompetitors.length} competitor{filteredCompetitors.length !== 1 ? "s" : ""} match</p>
              )}
            </div>

            {filteredCompetitors.length === 0 ? (
              <div className="bg-elevated border border-border rounded-lg px-4 py-4 text-center">
                <p className="text-sm text-secondary">No competitors match these filters.</p>
              </div>
            ) : (
              <>
                {/* Red corner */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5 text-danger">Red Corner</label>
                  <select value={redId} onChange={(e) => { setRedId(e.target.value); setError(""); }} className={sel}>
                    <option value="">Select competitor…</option>
                    {filteredCompetitors.map((c) => (
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
                        {redComp.schoolName || redComp.country || "—"} · {redComp.gender === "male" ? "Male" : "Female"} · {getAgeYears(redComp.dateOfBirth)}y
                      </span>
                    </div>
                  )}
                </div>

                {/* Blue corner */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5 text-blue-400">Blue Corner</label>
                  <select value={blueId} onChange={(e) => { setBlueId(e.target.value); setError(""); }} className={sel}>
                    <option value="">Select competitor…</option>
                    {filteredCompetitors.map((c) => (
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
                        {blueComp.schoolName || blueComp.country || "—"} · {blueComp.gender === "male" ? "Male" : "Female"} · {getAgeYears(blueComp.dateOfBirth)}y
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
                {([120, 90] as const).map((secs) => (
                  <button
                    key={secs}
                    type="button"
                    onClick={() => setRoundDurationSeconds(secs)}
                    className={`py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
                      roundDurationSeconds === secs
                        ? "bg-accent/10 border-accent text-accent"
                        : "bg-elevated border-border text-secondary hover:text-warn hover:bg-elevated/80"
                    }`}
                  >
                    {secs === 120 ? "2:00" : "1:30"}
                  </button>
                ))}
              </div>
            </div>

            {/* Dirty time toggle */}
            <div
              className="flex items-center justify-between px-4 py-3 bg-elevated border border-border rounded-lg cursor-pointer select-none"
              onClick={() => setDirtyTime((v) => !v)}
            >
              <div>
                <p className="text-sm font-semibold text-primary">Dirty Time</p>
                <p className="text-xs text-secondary mt-0.5">Allow dewan to score while timer is running</p>
              </div>
              <div className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${dirtyTime ? "bg-accent" : "bg-border"}`}>
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${dirtyTime ? "translate-x-4" : "translate-x-0.5"}`} />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-danger/5 border border-danger/30 rounded-lg px-3 py-2.5">
                <span className="text-danger text-xs mt-0.5 flex-shrink-0">✕</span>
                <p className="text-xs text-danger">{error}</p>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-border flex gap-3 flex-shrink-0">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-secondary hover:text-warn hover:bg-elevated transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg bg-accent text-black text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-40">
              {saving ? "Creating…" : "Create Match"}
            </button>
          </div>
        </form>
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

  // Per-judge raw tallies
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

        {/* Header */}
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

          {/* ── Scores + Winner ── */}
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

          {/* ── Judge Taps ── */}
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

          {/* ── Score Breakdown ── */}
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

// ─── Match row ────────────────────────────────────────────────────────────────

interface MatchRowProps {
  match: Match;
  matchNumber: number;
  redName: string;
  blueName: string;
  arenaBlocked: boolean;
  onDelete:     () => void;
  onStart:      () => void;
  onEnd:        () => void;
  onViewDetail: () => void;
}

function MatchRow({
  match, matchNumber, redName, blueName, arenaBlocked,
  onDelete, onStart, onEnd, onViewDetail,
}: MatchRowProps) {
  const isPending  = match.status === "pending";
  const isRunning  = match.status === "in_progress";
  const isFinished = match.status === "completed" || match.status === "cancelled";
  const startBlocked = arenaBlocked && !isRunning;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: match.id, disabled: !isPending });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: "relative",
    zIndex: isDragging ? 1 : undefined,
  };

  // For completed matches that pre-date the winnerCorner field, compute it via one-shot read.
  const [computedWinner, setComputedWinner] = useState<"red" | "blue" | "draw" | null>(null);
  useEffect(() => {
    if (match.status !== "completed" || match.winnerCorner != null) return;
    getDocs(collection(db, "matches", match.id, "scoreEvents")).then((snap) => {
      const events = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<import("@/lib/matches").ScoreEvent, "id">) }));
      const { red, blue } = computeConfirmedScores(events);
      setComputedWinner(red > blue ? "red" : blue > red ? "blue" : "draw");
    });
  }, [match.id, match.status, match.winnerCorner]);

  const winner = match.winnerCorner ?? computedWinner;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`grid grid-cols-[20px_40px_1fr_1fr_80px_130px_160px] gap-3 px-5 py-3.5 items-center border-b border-border last:border-b-0 ${isFinished ? "cursor-pointer hover:bg-elevated/50 transition-colors" : ""}`}
      onClick={isFinished ? onViewDetail : undefined}
    >
      {/* Drag handle */}
      <div className="flex items-center justify-center">
        {isPending ? (
          <span
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted hover:text-secondary transition-colors touch-none"
            onClick={(e) => e.stopPropagation()}
          >
            <svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor">
              <circle cx="3" cy="3"  r="1.5" /><circle cx="9" cy="3"  r="1.5" />
              <circle cx="3" cy="9"  r="1.5" /><circle cx="9" cy="9"  r="1.5" />
              <circle cx="3" cy="15" r="1.5" /><circle cx="9" cy="15" r="1.5" />
            </svg>
          </span>
        ) : (
          <span />
        )}
      </div>

      {/* # */}
      <span className="text-sm font-bold text-muted text-center">{matchNumber}</span>

      {/* Red */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-2 h-2 rounded-full bg-danger flex-shrink-0" />
        <span className="text-sm font-medium text-primary truncate">{redName}</span>
        {winner === "red" && <WinnerCheck />}
      </div>

      {/* Blue */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
        <span className="text-sm font-medium text-primary truncate">{blueName}</span>
        {winner === "blue" && <WinnerCheck />}
      </div>

      {/* Arena */}
      <span className="text-sm text-secondary">Arena {match.arenaNumber}</span>

      {/* Status */}
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${MATCH_STATUS_COLOR[match.status]}`}>
        {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-warn mr-1.5 animate-pulse" />}
        {MATCH_STATUS_LABELS[match.status]}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
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
            End Current Match
          </button>
        )}
        {isFinished && (
          <span className="px-2.5 py-1 rounded-md bg-elevated text-muted text-xs font-medium">
            {MATCH_STATUS_LABELS[match.status]}
          </span>
        )}
        {!isRunning && (
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
  const [detailMatch, setDetailMatch] = useState<Match | null>(null);
  const [busy,        setBusy]        = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (!user) return;
    const unsubT = subscribeActiveTournament(user.uid, setTournament);
    const unsubC = subscribeCompetitors(user.uid, setCompetitors);
    return () => { unsubT(); unsubC(); };
  }, [user]);

  useEffect(() => {
    if (!tournament) { setMatches([]); return; }
    return subscribeMatches(tournament.id, setMatches);
  }, [tournament?.id]);

  const compMap = new Map(competitors.map((c) => [c.id, c]));

  const runningArenas = new Set(
    matches.filter((m) => m.status === "in_progress").map((m) => m.arenaNumber)
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || busy) return;
    const oldIdx = matches.findIndex((m) => m.id === active.id);
    const newIdx = matches.findIndex((m) => m.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    setBusy(true);
    const reordered = arrayMove(matches, oldIdx, newIdx);
    const updates = reordered
      .map((m, i) => ({ id: m.id, order: i + 1, oldOrder: m.order }))
      .filter(({ order, oldOrder }) => order !== oldOrder)
      .map(({ id, order }) => ({ id, order }));
    if (updates.length > 0) await reorderMatches(updates);
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
        <div className="grid grid-cols-[20px_40px_1fr_1fr_80px_130px_160px] gap-3 px-5 py-3 border-b border-border">
          {["", "#", "Red Corner", "Blue Corner", "Arena", "Status", ""].map((h, i) => (
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
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={matches.map((m) => m.id)} strategy={verticalListSortingStrategy}>
              <ul>
                {matches.map((m) => {
                  const red  = compMap.get(m.redCornerCompetitorId);
                  const blue = compMap.get(m.blueCornerCompetitorId);
                  return (
                    <MatchRow
                      key={m.id}
                      match={m}
                      matchNumber={m.order}
                      redName={red  ? `${red.firstName} ${red.lastName}`   : "Unknown"}
                      blueName={blue ? `${blue.firstName} ${blue.lastName}` : "Unknown"}
                      arenaBlocked={runningArenas.has(m.arenaNumber)}
                      onDelete={() => handleDelete(m)}
                      onStart={() => handleStart(m)}
                      onEnd={() => handleEnd(m)}
                      onViewDetail={() => setDetailMatch(m)}
                    />
                  );
                })}
              </ul>
            </SortableContext>
          </DndContext>
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

      {detailMatch && (() => {
        const red  = compMap.get(detailMatch.redCornerCompetitorId);
        const blue = compMap.get(detailMatch.blueCornerCompetitorId);
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
