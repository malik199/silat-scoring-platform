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
  number: number;
  tap: RecentTap | null;
  corner: "red" | "blue";
  type: "punch" | "kick";
}

function JudgeIndicator({ number, tap, corner, type }: JudgeIndicatorProps) {
  const isRed  = corner === "red";
  const active = tap !== null && tap.side === corner &&
    (type === "punch" ? tap.points === 1 : tap.points !== 1);

  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl transition-all duration-200 flex-shrink-0"
      style={{
        width:  "min(3.8vw, 50px)",
        height: "min(3vw, 40px)",
        background: active ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.25)",
        boxShadow: active ? "0 0 16px rgba(255,255,255,0.5)" : "none",
        transform: active ? "scale(1.08)" : "scale(1)",
      }}
    >
      {active ? (
        <>
          <span style={{ fontSize: "min(1.5vw, 18px)", lineHeight: 1 }}>
            {type === "punch" ? "👊" : "🦶"}
          </span>
          <span
            className="font-black leading-none mt-0.5"
            style={{ fontSize: "min(0.9vw, 11px)", color: isRed ? "#c42e28" : "#0072c4" }}
          >
            J{number}
          </span>
        </>
      ) : (
        <span
          className="font-bold"
          style={{ fontSize: "min(1.2vw, 14px)", color: "rgba(255,255,255,0.2)" }}
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
  adminEvents: AdminEvent[];
  warnings?: Record<string, boolean>;
  currentRound: number;
  recentAdmin: RecentAdminAction | null;
}

function CornerPanel({ corner, competitor, score, leading, judgeOrder, recentTaps, adminEvents, warnings, currentRound, recentAdmin }: CornerPanelProps) {
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

  // Compute active indicators
  const w1  = warnings?.[`r${currentRound}_${corner}_w1`]  === true;
  const w2  = warnings?.[`r${currentRound}_${corner}_w2`]  === true;
  const m1  = adminEvents.some((e) => e.side === corner && e.points === -1  && e.round === currentRound);
  const m2  = adminEvents.some((e) => e.side === corner && e.points === -2  && e.round === currentRound);
  const m5  = adminEvents.some((e) => e.side === corner && e.points === -5);
  const m10 = adminEvents.some((e) => e.side === corner && e.points === -10);
  const jatohan = recentAdmin !== null && recentAdmin.points > 0;

  const indicators = [
    { src: "/jatohan_sah.svg",  active: jatohan, bg: "rgba(0,208,132,0.5)",   border: "rgba(0,208,132,0.8)"   },
    { src: "/warning_1.svg",    active: w1,      bg: "rgba(250,173,20,0.45)", border: "rgba(250,173,20,0.75)" },
    { src: "/warning_2.svg",    active: w2,      bg: "rgba(250,173,20,0.45)", border: "rgba(250,173,20,0.75)" },
    { src: "/violation_1.svg",  active: m1,      bg: "rgba(250,173,20,0.45)", border: "rgba(250,173,20,0.75)" },
    { src: "/violation_2.svg",  active: m2,      bg: "rgba(250,173,20,0.45)", border: "rgba(250,173,20,0.75)" },
    { src: "/violation_5.svg",  active: m5,      bg: "rgba(255,77,79,0.45)",  border: "rgba(255,77,79,0.75)"  },
    { src: "/violation_10.svg", active: m10,     bg: "rgba(255,77,79,0.45)",  border: "rgba(255,77,79,0.75)"  },
  ];
  const activeIndicators = indicators.filter((i) => i.active);

  return (
    <div className="flex-1 flex flex-col" style={{ backgroundColor: bgMain }}>

      {/* ── Section 1: Name and school ── */}
      <div className="px-6 py-4" style={{ backgroundColor: bgDark }}>
        {competitor ? (
          <>
            <p className="font-black text-white leading-tight" style={{ fontSize: "min(3.5vw, 48px)" }}>
              {competitor.firstName} {competitor.lastName}
            </p>
            <p className="font-semibold text-white/70 mt-1" style={{ fontSize: "min(2vw, 26px)" }}>
              {[competitor.schoolName, competitor.country].filter(Boolean).join("  ·  ")}
            </p>
          </>
        ) : (
          <p className="text-white/30 font-bold" style={{ fontSize: "min(3vw, 40px)" }}>—</p>
        )}
      </div>

      {/* ── Section 2: Takedown and violation indicators ── */}
      <div
        className="flex items-center justify-center gap-2 px-6"
        style={{
          height: "min(8vw, 100px)",
          backgroundColor: "rgba(0,0,0,0.25)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {activeIndicators.length === 0 ? (
          <p className="font-semibold" style={{ fontSize: "min(1.4vw, 16px)", color: "rgba(255,255,255,0.12)" }}>
            No penalties
          </p>
        ) : activeIndicators.map(({ src, bg, border }, idx) => (
          <div
            key={idx}
            className="rounded-xl flex-shrink-0"
            style={{
              width:   "min(5.5vw, 72px)",
              height:  "min(5.5vw, 72px)",
              background: bg,
              border: `2px solid ${border}`,
              padding: "min(0.6vw, 8px)",
              boxShadow: `0 0 14px ${border}`,
            }}
          >
            <img src={src} alt="" className="w-full h-full object-contain" style={{ filter: "brightness(0) invert(1)" }} />
          </div>
        ))}
      </div>

      {/* ── Section 3: Judge indicators ── */}
      <div
        className="flex flex-col items-center justify-center gap-1.5 py-3"
        style={{ backgroundColor: bgDark, borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex gap-2">
          {slots.map((slot) => (
            <JudgeIndicator key={`punch-${slot.number}`} number={slot.number} tap={slot.tap} corner={corner} type="punch" />
          ))}
        </div>
        <div className="flex gap-2">
          {slots.map((slot) => (
            <JudgeIndicator key={`kick-${slot.number}`} number={slot.number} tap={slot.tap} corner={corner} type="kick" />
          ))}
        </div>
      </div>

      {/* ── Score ── */}
      <div className="flex-1 flex items-center justify-center">
        <p
          className="font-black text-white tabular-nums leading-none transition-all duration-300"
          style={{
            fontSize: "min(28vw, 50vh)",
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
  // Track when we locally observed timerRunning become true.
  // The arena screen is a remote display — it only sees Firestore snapshots
  // AFTER the server confirms them, which can be several seconds after Start
  // is pressed. Using local elapsed time avoids an immediate jump (e.g. 2:00→1:54).
  const localRunStartRef  = useRef<number | null>(null); // seconds (Date.now()/1000)
  const localBaseRef      = useRef<number>(0);           // timerElapsedSeconds at local-start
  const prevRunningRef    = useRef(false);
  const prevMatchKeyRef   = useRef("");                  // matchId+round

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

  // Tick timer from runningMatch.
  // Uses local elapsed time when timerRunning first becomes true so the arena
  // display starts from 2:00 instead of jumping to e.g. 1:54 due to the few
  // seconds of Firestore propagation delay to this remote display device.
  useEffect(() => {
    if (!runningMatch) {
      prevRunningRef.current  = false;
      prevMatchKeyRef.current = "";
      localRunStartRef.current = null;
      return;
    }

    const matchKey = `${runningMatch.id}-${runningMatch.currentRound}`;
    const keyChanged = matchKey !== prevMatchKeyRef.current;

    if (keyChanged) {
      // New match or new round — reset local tracking
      localRunStartRef.current  = null;
      prevRunningRef.current    = false;
      prevMatchKeyRef.current   = matchKey;
    }

    if (runningMatch.timerRunning && !prevRunningRef.current) {
      // Timer just became running locally — record this moment
      localRunStartRef.current = Date.now() / 1000;
      localBaseRef.current     = runningMatch.timerElapsedSeconds ?? 0;
    } else if (!runningMatch.timerRunning) {
      localRunStartRef.current = null;
    }
    prevRunningRef.current = runningMatch.timerRunning;

    const duration = runningMatch.roundDurationSeconds ?? 120;

    function computeDisplay(): number {
      const localStart = localRunStartRef.current;
      if (runningMatch!.timerRunning && localStart !== null) {
        // Count from local observation time — avoids propagation-delay jump
        const elapsed = Date.now() / 1000 - localStart;
        return Math.max(0, duration - localBaseRef.current - elapsed);
      }
      return computeRemainingSeconds(runningMatch!);
    }

    setRemaining(computeDisplay());
    const id = setInterval(() => setRemaining(computeDisplay()), 100);
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
          <div className="flex flex-col items-center justify-center border border-white/20 rounded-xl px-5 py-3 min-w-[96px]">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/30">Round</p>
            <p className="text-7xl font-black text-white/60 leading-none">{runningMatch?.currentRound ?? 1}</p>
          </div>
        </div>
      </div>

      {/* Split screen */}
      <div className="flex flex-1">
        <CornerPanel
          corner="blue"
          competitor={blueComp}
          score={totalBlue}
          leading={totalBlue > totalRed}
          judgeOrder={judgeOrder}
          recentTaps={recentTaps}
          adminEvents={adminEvents}
          warnings={runningMatch.warnings}
          currentRound={runningMatch.currentRound ?? 1}
          recentAdmin={recentAdminBlue}
        />
        <div className="w-1 flex-shrink-0 bg-black/30" />
        <CornerPanel
          corner="red"
          competitor={redComp}
          score={totalRed}
          leading={totalRed > totalBlue}
          judgeOrder={judgeOrder}
          recentTaps={recentTaps}
          adminEvents={adminEvents}
          warnings={runningMatch.warnings}
          currentRound={runningMatch.currentRound ?? 1}
          recentAdmin={recentAdminRed}
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
