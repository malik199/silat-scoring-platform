"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { subscribeActiveTournament, type Tournament } from "@/lib/tournaments";
import {
  subscribeMatches,
  subscribeScoreEvents,
  subscribeAdminEvents,
  computeConfirmedScores,
  computeRemainingSeconds,
  formatTime,
  type Match,
  type ScoreEvent,
  type AdminEvent,
} from "@/lib/matches";
import { subscribeCompetitor, type Competitor } from "@/lib/competitors";

// ─── Dewan action indicator ───────────────────────────────────────────────────

interface RecentAdminAction {
  points: number; // positive = takedown, negative = penalty
  at: number;
}

interface AdminIndicatorProps {
  action: RecentAdminAction | null;
  corner: "red" | "blue";
}

function AdminIndicator({ action, corner }: AdminIndicatorProps) {
  const isRed  = corner === "red";
  const active = action !== null;
  const isTakedown = active && action!.points > 0;

  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl transition-all duration-200 flex-shrink-0"
      style={{
        width:  "min(6vw, 88px)",
        height: "min(5vw, 72px)",
        background: active
          ? "rgba(255,255,255,0.95)"
          : "rgba(0,0,0,0.25)",
        boxShadow: active
          ? "0 0 24px rgba(255,255,255,0.6)"
          : "none",
        transform: active ? "scale(1.1)" : "scale(1)",
      }}
    >
      {active ? (
        <>
          <span style={{ fontSize: "min(2vw, 24px)", lineHeight: 1 }}>
            {isTakedown ? "🏅" : "⚠️"}
          </span>
          <span
            className="font-black leading-none mt-0.5"
            style={{
              fontSize: "min(1.4vw, 16px)",
              color: isTakedown
                ? (isRed ? "#c42e28" : "#0072c4")
                : "#b45309",
            }}
          >
            {action!.points > 0 ? `+${action!.points}` : action!.points}
          </span>
        </>
      ) : (
        <span
          className="font-bold"
          style={{
            fontSize: "min(1.2vw, 14px)",
            color: "rgba(255,255,255,0.2)",
          }}
        >
          DWN
        </span>
      )}
    </div>
  );
}

// ─── Judge activity indicator ─────────────────────────────────────────────────

interface RecentTap {
  side: "red" | "blue";
  points: number;
  at: number; // Date.now() when we received it locally
}

interface JudgeIndicatorProps {
  number: number;       // 1-based judge number
  tap: RecentTap | null; // null = no recent tap
  corner: "red" | "blue";
}

function JudgeIndicator({ number, tap, corner }: JudgeIndicatorProps) {
  const isRed = corner === "red";
  const active = tap !== null && tap.side === corner;

  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl transition-all duration-200 flex-shrink-0"
      style={{
        width:  "min(5vw, 72px)",
        height: "min(5vw, 72px)",
        background: active
          ? "rgba(255,255,255,0.95)"
          : "rgba(0,0,0,0.25)",
        boxShadow: active
          ? "0 0 20px rgba(255,255,255,0.5)"
          : "none",
        transform: active ? "scale(1.08)" : "scale(1)",
      }}
    >
      {active ? (
        <>
          <span style={{ fontSize: "min(2.2vw, 28px)", lineHeight: 1 }}>
            {tap!.points === 1 ? "👊" : "🦶"}
          </span>
          <span
            className="font-black leading-none mt-0.5"
            style={{
              fontSize: "min(1.4vw, 16px)",
              color: isRed ? "#c42e28" : "#0072c4",
            }}
          >
            J{number}
          </span>
        </>
      ) : (
        <span
          className="font-bold"
          style={{
            fontSize: "min(1.6vw, 18px)",
            color: "rgba(255,255,255,0.2)",
          }}
        >
          J{number}
        </span>
      )}
    </div>
  );
}

// ─── Corner panel ─────────────────────────────────────────────────────────────

interface CornerPanelProps {
  corner: "red" | "blue";
  competitor: Competitor | null | undefined;
  score: number;
  leading: boolean;
  judgeOrder: string[];
  recentTaps: Map<string, RecentTap>;
  recentAdmin: RecentAdminAction | null;
}

function CornerPanel({ corner, competitor, score, leading, judgeOrder, recentTaps, recentAdmin }: CornerPanelProps) {
  const isRed  = corner === "red";
  const bgMain = isRed ? "#f53a32" : "#008dee";
  const bgDark = isRed ? "#c42e28" : "#0072c4";

  // Always show 3 slots
  const slots = Array.from({ length: 3 }, (_, i) => {
    const judgeId = judgeOrder[i] ?? null;
    return {
      number: i + 1,
      tap: judgeId ? (recentTaps.get(judgeId) ?? null) : null,
    };
  });

  return (
    <div className="flex-1 flex flex-col" style={{ backgroundColor: bgMain }}>
      {/* ── Header band: competitor info + judge indicators ── */}
      <div
        className="flex items-center gap-4 px-6 py-5"
        style={{ backgroundColor: bgDark }}
      >
        {/* Competitor info */}
        <div className="flex-1 min-w-0">
          {competitor ? (
            <>
              <p
                className="font-black text-white leading-tight"
                style={{ fontSize: "min(3.5vw, 48px)" }}
              >
                {competitor.firstName} {competitor.lastName}
              </p>
              <p
                className="font-semibold text-white/70 mt-1"
                style={{ fontSize: "min(2vw, 28px)" }}
              >
                {[competitor.schoolName, competitor.country].filter(Boolean).join("  ·  ")}
              </p>
            </>
          ) : (
            <p className="text-white/30 font-bold" style={{ fontSize: "min(3vw, 40px)" }}>—</p>
          )}
        </div>

        {/* Judge indicators + Dewan indicator */}
        <div className="flex gap-2 flex-shrink-0 items-center">
          {slots.map((slot) => (
            <JudgeIndicator
              key={slot.number}
              number={slot.number}
              tap={slot.tap}
              corner={corner}
            />
          ))}
          <div
            style={{
              width: "1px",
              height: "min(4vw, 56px)",
              background: "rgba(255,255,255,0.15)",
              margin: "0 4px",
            }}
          />
          <AdminIndicator action={recentAdmin} corner={corner} />
        </div>
      </div>

      {/* ── Score ── */}
      <div className="flex-1 flex items-center justify-center">
        <p
          className="font-black text-white tabular-nums leading-none transition-all duration-300"
          style={{
            fontSize: "min(28vw, 55vh)",
            ...(leading ? {
              outline: "6px solid rgba(255,255,255,0.9)",
              outlineOffset: "16px",
              borderRadius: "12px",
            } : {}),
          }}
        >
          {score}
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ArenaScreenPage({ params }: { params: { number: string } }) {
  const arenaNumber = parseInt(params.number, 10);
  const { user, loading: authLoading } = useAuth();

  const [tournament,  setTournament]  = useState<Tournament | null | undefined>(undefined);
  const [matches,     setMatches]     = useState<Match[] | null>(null);
  const [redComp,     setRedComp]     = useState<Competitor | null | undefined>(undefined);
  const [blueComp,    setBlueComp]    = useState<Competitor | null | undefined>(undefined);
  const [scoreEvents, setScoreEvents] = useState<ScoreEvent[]>([]);
  const [adminEvents, setAdminEvents] = useState<AdminEvent[]>([]);

  // ── Judge activity tracking ──────────────────────────────────────────────
  const prevScoreLen = useRef(0);
  const [recentTaps, setRecentTaps] = useState<Map<string, RecentTap>>(new Map());

  // ── Dewan action tracking ────────────────────────────────────────────────
  const prevAdminLen = useRef(0);
  const [recentAdminRed,  setRecentAdminRed]  = useState<RecentAdminAction | null>(null);
  const [recentAdminBlue, setRecentAdminBlue] = useState<RecentAdminAction | null>(null);

  // ── Timer display ────────────────────────────────────────────────────────
  const [remaining, setRemaining] = useState<number>(120);

  // Firestore subscriptions
  useEffect(() => {
    if (!user) return;
    return subscribeActiveTournament(user.uid, setTournament);
  }, [user]);

  useEffect(() => {
    if (!tournament) { setMatches(tournament === null ? [] : null); return; }
    return subscribeMatches(tournament.id, setMatches);
  }, [tournament?.id]);

  const runningMatch = matches?.find(
    (m) => m.arenaNumber === arenaNumber && m.status === "in_progress"
  ) ?? null;

  useEffect(() => {
    if (!runningMatch) {
      setRedComp(null); setBlueComp(null);
      setScoreEvents([]); setAdminEvents([]);
      prevScoreLen.current = 0;
      prevAdminLen.current = 0;
      setRecentTaps(new Map());
      setRecentAdminRed(null);
      setRecentAdminBlue(null);
      return;
    }
    const unsubRed    = subscribeCompetitor(runningMatch.redCornerCompetitorId,  setRedComp);
    const unsubBlue   = subscribeCompetitor(runningMatch.blueCornerCompetitorId, setBlueComp);
    const unsubEvents = subscribeScoreEvents(runningMatch.id, setScoreEvents);
    const unsubAdmin  = subscribeAdminEvents(runningMatch.id, setAdminEvents);
    return () => { unsubRed(); unsubBlue(); unsubEvents(); unsubAdmin(); };
  }, [runningMatch?.id]);

  // Detect new score events and record local arrival time
  useEffect(() => {
    const newEvents = scoreEvents.slice(prevScoreLen.current);
    prevScoreLen.current = scoreEvents.length;
    if (newEvents.length === 0) return;
    const now = Date.now();
    setRecentTaps((prev) => {
      const next = new Map(prev);
      for (const e of newEvents) {
        next.set(e.judgeId, { side: e.side as "red" | "blue", points: e.points, at: now });
      }
      return next;
    });
  }, [scoreEvents]);

  // Expire taps after 3 seconds
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setRecentTaps((prev) => {
        const stale = [...prev.entries()].filter(([, v]) => now - v.at > 3000);
        if (stale.length === 0) return prev;
        const next = new Map(prev);
        for (const [k] of stale) next.delete(k);
        return next;
      });
    }, 300);
    return () => clearInterval(id);
  }, []);

  // Detect new admin events and show indicator
  useEffect(() => {
    const newEvents = adminEvents.slice(prevAdminLen.current);
    prevAdminLen.current = adminEvents.length;
    if (newEvents.length === 0) return;
    const now = Date.now();
    for (const e of newEvents) {
      const action: RecentAdminAction = { points: e.points, at: now };
      if (e.side === "red") setRecentAdminRed(action);
      else setRecentAdminBlue(action);
    }
  }, [adminEvents]);

  // Expire admin indicators after 4 seconds
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setRecentAdminRed((prev) => (prev && now - prev.at > 4000 ? null : prev));
      setRecentAdminBlue((prev) => (prev && now - prev.at > 4000 ? null : prev));
    }, 300);
    return () => clearInterval(id);
  }, []);

  // Tick timer from runningMatch
  useEffect(() => {
    if (!runningMatch) return;
    setRemaining(computeRemainingSeconds(runningMatch));
    const id = setInterval(() => setRemaining(computeRemainingSeconds(runningMatch)), 100);
    return () => clearInterval(id);
  }, [runningMatch]);

  // Stable judge order (first-seen)
  const judgeOrder = useMemo(() => {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const e of scoreEvents) {
      if (!seen.has(e.judgeId)) { seen.add(e.judgeId); order.push(e.judgeId); }
    }
    return order;
  }, [scoreEvents]);

  // ── Loading / auth states ────────────────────────────────────────────────

  if (authLoading || tournament === undefined || matches === null) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-white/30 text-lg font-medium animate-pulse">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-3">
        <p className="text-6xl font-black text-white/10 uppercase tracking-widest">Arena {arenaNumber}</p>
        <p className="text-xl text-white/30 font-medium">Not signed in</p>
      </div>
    );
  }

  if (!runningMatch) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
        <p className="text-6xl font-black text-white/10 uppercase tracking-widest">Arena {arenaNumber}</p>
        <p className="text-xl text-white/30 font-medium">No match in progress</p>
      </div>
    );
  }

  // ── Active match ─────────────────────────────────────────────────────────

  const { red: confirmedRed, blue: confirmedBlue } = computeConfirmedScores(scoreEvents);
  const adminRed  = adminEvents.filter((e) => e.side === "red").reduce((s, e)  => s + e.points, 0);
  const adminBlue = adminEvents.filter((e) => e.side === "blue").reduce((s, e) => s + e.points, 0);
  const totalRed  = confirmedRed  + adminRed;
  const totalBlue = confirmedBlue + adminBlue;

  return (
    <div className="min-h-screen flex flex-col overflow-hidden" style={{ backgroundColor: "#111" }}>
      {/* Top bar */}
      <div className="flex items-center px-10 py-6 border-b border-white/10" style={{ backgroundColor: "#0a0a0a" }}>
        {/* Arena / tournament name — left */}
        <div className="flex-1 flex flex-col justify-center">
          <p className="text-lg font-bold uppercase tracking-[0.3em] text-white/40">
            Arena {arenaNumber}
          </p>
          {tournament?.name && (
            <p className="text-5xl font-black text-white/80 leading-tight">
              {tournament.name}
            </p>
          )}
        </div>

        {/* Timer + Round — right */}
        <div className="flex items-center gap-4">
          <p className="text-9xl font-black tabular-nums tracking-tight" style={{ color: remaining <= 10 ? "rgba(255,80,80,0.85)" : "rgba(255,255,255,0.6)" }}>
            {formatTime(remaining)}
          </p>
          <div className="flex flex-col items-center justify-center border border-white/20 rounded-xl px-8 py-4 min-w-[140px]">
            <p className="text-sm font-semibold uppercase tracking-widest text-white/30">Round</p>
            <p className="text-9xl font-black text-white/60 leading-none">{runningMatch?.currentRound ?? 1}</p>
          </div>
        </div>
      </div>

      {/* Split screen */}
      <div className="flex flex-1">
        <CornerPanel
          corner="red"
          competitor={redComp}
          score={totalRed}
          leading={totalRed > totalBlue}
          judgeOrder={judgeOrder}
          recentTaps={recentTaps}
          recentAdmin={recentAdminRed}
        />
        <div className="w-1 flex-shrink-0 bg-black/30" />
        <CornerPanel
          corner="blue"
          competitor={blueComp}
          score={totalBlue}
          leading={totalBlue > totalRed}
          judgeOrder={judgeOrder}
          recentTaps={recentTaps}
          recentAdmin={recentAdminBlue}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center py-2 border-t border-white/10" style={{ backgroundColor: "#0a0a0a" }}>
        <p className="text-xs font-semibold uppercase tracking-widest text-white/20">
          Match #{runningMatch.order}
        </p>
      </div>
    </div>
  );
}
