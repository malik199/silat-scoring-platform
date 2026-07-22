"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
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

// ─── Country → flag emoji ─────────────────────────────────────────────────────

const FLAGS: Record<string, string> = {
  Indonesia: "🇮🇩", INA: "🇮🇩",
  Malaysia:  "🇲🇾", MAS: "🇲🇾",
  Singapore: "🇸🇬", SGP: "🇸🇬", SIN: "🇸🇬",
  Thailand:  "🇹🇭", THA: "🇹🇭",
  Philippines: "🇵🇭", PHI: "🇵🇭",
  Brunei:    "🇧🇳", BRN: "🇧🇳",
  Vietnam:   "🇻🇳", VIE: "🇻🇳",
  Myanmar:   "🇲🇲", MYA: "🇲🇲",
  Cambodia:  "🇰🇭", CAM: "🇰🇭",
  Laos:      "🇱🇦", LAO: "🇱🇦",
  "United States": "🇺🇸", USA: "🇺🇸",
  "United Kingdom": "🇬🇧", UK: "🇬🇧", GBR: "🇬🇧",
  Australia: "🇦🇺", AUS: "🇦🇺",
  Japan:     "🇯🇵", JPN: "🇯🇵",
  "South Korea": "🇰🇷", KOR: "🇰🇷",
  China:     "🇨🇳", CHN: "🇨🇳",
  France:    "🇫🇷", FRA: "🇫🇷",
  Germany:   "🇩🇪", GER: "🇩🇪",
  Netherlands: "🇳🇱", NED: "🇳🇱",
  Canada:    "🇨🇦", CAN: "🇨🇦",
};

function flag(country?: string) {
  if (!country) return "";
  return FLAGS[country] ?? "";
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface RecentTap {
  side: "red" | "blue";
  points: number;
  at: number;
}

interface RecentAdmin {
  points: number;
  at: number;
}

// ─── Judge indicator ──────────────────────────────────────────────────────────

function JudgeIndicator({ number, tap, corner, type }: {
  number: number;
  tap: RecentTap | null;
  corner: "red" | "blue";
  type: "punch" | "kick";
}) {
  const isRed  = corner === "red";
  const active = tap !== null && tap.side === corner &&
    (type === "punch" ? tap.points === 1 : tap.points !== 1);

  return (
    <div style={{
      width: 44, height: 34, borderRadius: 8, flexShrink: 0,
      background:  active ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.3)",
      boxShadow:   active ? "0 0 14px rgba(255,255,255,0.5)" : "none",
      transform:   active ? "scale(1.08)" : "scale(1)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      transition: "all 0.2s",
    }}>
      {active ? (
        <>
          <span style={{ fontSize: 16, lineHeight: 1 }}>{type === "punch" ? "👊" : "🦶"}</span>
          <span style={{ fontSize: 10, fontWeight: 900, lineHeight: 1, marginTop: 1, color: isRed ? "#c42e28" : "#0072c4" }}>J{number}</span>
        </>
      ) : (
        <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.22)" }}>J{number}</span>
      )}
    </div>
  );
}

// ─── Corner panel ─────────────────────────────────────────────────────────────

function CornerPanel({ corner, competitor, score, leading, judgeOrder, recentTaps, adminEvents, warnings, currentRound, recentAdmin }: {
  corner: "red" | "blue";
  competitor: Competitor | null | undefined;
  score: number;
  leading: boolean;
  judgeOrder: string[];
  recentTaps: Map<string, RecentTap>;
  adminEvents: AdminEvent[];
  warnings?: Record<string, boolean>;
  currentRound: number;
  recentAdmin: RecentAdmin | null;
}) {
  const isRed    = corner === "red";
  const bgHeader = isRed ? "rgba(140,18,18,0.93)" : "rgba(8,55,145,0.93)";
  const bgScore  = isRed ? "rgba(185,32,32,0.80)" : "rgba(14,80,185,0.80)";

  const slots = Array.from({ length: 3 }, (_, i) => {
    const judgeId = judgeOrder[i] ?? null;
    return { number: i + 1, tap: judgeId ? (recentTaps.get(judgeId) ?? null) : null };
  });

  const w1      = warnings?.[`r${currentRound}_${corner}_w1`]  === true;
  const w2      = warnings?.[`r${currentRound}_${corner}_w2`]  === true;
  const m1      = adminEvents.some((e) => e.side === corner && e.points === -1  && e.round === currentRound);
  const m2      = adminEvents.some((e) => e.side === corner && e.points === -2  && e.round === currentRound);
  const m5      = adminEvents.some((e) => e.side === corner && e.points === -5);
  const m10     = adminEvents.some((e) => e.side === corner && e.points === -10);
  const jatohan = recentAdmin !== null && recentAdmin.points > 0;

  const indicators = [
    { src: "/jatohan_sah.svg",  active: jatohan, bg: "rgba(0,208,132,0.5)",   border: "rgba(0,208,132,0.85)",  large: true  },
    { src: "/warning_1.svg",    active: w1,      bg: "rgba(250,173,20,0.45)", border: "rgba(250,173,20,0.75)", large: false },
    { src: "/warning_2.svg",    active: w2,      bg: "rgba(250,173,20,0.45)", border: "rgba(250,173,20,0.75)", large: false },
    { src: "/violation_1.svg",  active: m1,      bg: "rgba(250,173,20,0.45)", border: "rgba(250,173,20,0.75)", large: false },
    { src: "/violation_2.svg",  active: m2,      bg: "rgba(250,173,20,0.45)", border: "rgba(250,173,20,0.75)", large: false },
    { src: "/violation_5.svg",  active: m5,      bg: "rgba(255,77,79,0.45)",  border: "rgba(255,77,79,0.75)",  large: false },
    { src: "/violation_10.svg", active: m10,     bg: "rgba(255,77,79,0.45)",  border: "rgba(255,77,79,0.75)",  large: false },
  ];
  const active = indicators.filter((i) => i.active);

  const name   = competitor ? `${competitor.firstName} ${competitor.lastName}` : "—";
  const school = competitor
    ? [competitor.schoolName, flag(competitor.country), competitor.country].filter(Boolean).join("  ")
    : "";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>

      {/* ── 3-column header ── */}
      <div style={{ display: "flex", alignItems: "stretch", background: bgHeader, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>

        {/* Col 1: Name + school */}
        <div style={{
          flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center",
          padding: "12px 18px",
          borderRight: "1px solid rgba(255,255,255,0.1)",
        }}>
          <div style={{ color: "#fff", fontWeight: 900, fontSize: 26, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {name}
          </div>
          {school && (
            <div style={{ color: "rgba(255,255,255,0.6)", fontWeight: 600, fontSize: 13, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {school}
            </div>
          )}
        </div>

        {/* Col 2: Jatohan + penalty indicators */}
        <div style={{
          minWidth: 130, display: "flex", flexWrap: "wrap",
          alignItems: "center", justifyContent: "center", alignContent: "center",
          gap: 5, padding: "10px 12px",
          borderRight: "1px solid rgba(255,255,255,0.1)",
        }}>
          {active.length === 0 ? (
            <span style={{ color: "rgba(255,255,255,0.12)", fontSize: 12, fontWeight: 600 }}>—</span>
          ) : active.map(({ src, bg, border, large }, idx) => (
            <div key={idx} style={{
              borderRadius: 8, flexShrink: 0,
              width:  large ? 66 : 36,
              height: large ? 66 : 36,
              background: bg,
              border: `2px solid ${border}`,
              padding: large ? 7 : 4,
              boxShadow: `0 0 ${large ? 18 : 8}px ${border}`,
            }}>
              <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", filter: "brightness(0) invert(1)" }} />
            </div>
          ))}
        </div>

        {/* Col 3: Judge indicators */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 5, padding: "10px 14px", flexShrink: 0,
        }}>
          <div style={{ display: "flex", gap: 5 }}>
            {slots.map((s) => <JudgeIndicator key={`p${s.number}`} number={s.number} tap={s.tap} corner={corner} type="punch" />)}
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            {slots.map((s) => <JudgeIndicator key={`k${s.number}`} number={s.number} tap={s.tap} corner={corner} type="kick" />)}
          </div>
        </div>

      </div>

      {/* ── Score ── */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: bgScore }}>
        <div style={{
          color: "#fff", fontWeight: 900, fontSize: "min(13vw, 25vh)", lineHeight: 1,
          ...(leading ? { outline: "4px solid rgba(255,255,255,0.9)", outlineOffset: 10, borderRadius: 8 } : {}),
        }}>
          {score}
        </div>
      </div>

    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OBSPage() {
  const { tournamentId, arena } = useParams<{ tournamentId: string; arena: string }>();
  const arenaNumber = Number(arena);

  const [match,       setMatch]       = useState<Match | null>(null);
  const [redComp,     setRedComp]     = useState<Competitor | null>(null);
  const [blueComp,    setBlueComp]    = useState<Competitor | null>(null);
  const [scoreEvents, setScoreEvents] = useState<ScoreEvent[]>([]);
  const [adminEvents, setAdminEvents] = useState<AdminEvent[]>([]);
  const [remaining,   setRemaining]   = useState(120);

  // Judge tap flash tracking
  const prevScoreLen = useRef(0);
  const [recentTaps, setRecentTaps] = useState<Map<string, RecentTap>>(new Map());

  // Admin action flash tracking (jatohan)
  const prevAdminLen = useRef(0);
  const [recentAdminRed,  setRecentAdminRed]  = useState<RecentAdmin | null>(null);
  const [recentAdminBlue, setRecentAdminBlue] = useState<RecentAdmin | null>(null);

  // Make body transparent for OBS browser source
  useEffect(() => {
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";
    return () => {
      document.body.style.background = "";
      document.documentElement.style.background = "";
    };
  }, []);

  // Subscribe to active match for this tournament + arena
  useEffect(() => {
    const q = query(collection(db, "matches"), where("tournamentId", "==", tournamentId));
    return onSnapshot(q, (snap) => {
      const found = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Match, "id">) }))
        .find((m) => m.arenaNumber === arenaNumber && m.status === "in_progress");
      setMatch(found ?? null);
    }, () => setMatch(null));
  }, [tournamentId, arenaNumber]);

  // Competitors
  useEffect(() => {
    if (!match) { setRedComp(null); setBlueComp(null); return; }
    const unsubRed  = subscribeCompetitor(match.redCornerCompetitorId,  setRedComp);
    const unsubBlue = subscribeCompetitor(match.blueCornerCompetitorId, setBlueComp);
    return () => { unsubRed(); unsubBlue(); };
  }, [match?.id]);

  // Score + admin events
  useEffect(() => {
    if (!match) {
      setScoreEvents([]); setAdminEvents([]);
      prevScoreLen.current = 0; prevAdminLen.current = 0;
      setRecentTaps(new Map()); setRecentAdminRed(null); setRecentAdminBlue(null);
      return;
    }
    const unsubScore = subscribeScoreEvents(match.id, setScoreEvents);
    const unsubAdmin = subscribeAdminEvents(match.id, setAdminEvents);
    return () => { unsubScore(); unsubAdmin(); };
  }, [match?.id]);

  // Detect new score events → record judge tap
  useEffect(() => {
    const newEvents = scoreEvents.slice(prevScoreLen.current);
    prevScoreLen.current = scoreEvents.length;
    if (newEvents.length === 0) return;
    const now = Date.now();
    setRecentTaps((prev) => {
      const next = new Map(prev);
      for (const e of newEvents) next.set(e.judgeId, { side: e.side as "red" | "blue", points: e.points, at: now });
      return next;
    });
  }, [scoreEvents]);

  // Expire taps after 3s
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

  // Detect new admin events → jatohan flash
  useEffect(() => {
    const newEvents = adminEvents.slice(prevAdminLen.current);
    prevAdminLen.current = adminEvents.length;
    if (newEvents.length === 0) return;
    const now = Date.now();
    for (const e of newEvents) {
      const action: RecentAdmin = { points: e.points, at: now };
      if (e.side === "red") setRecentAdminRed(action);
      else setRecentAdminBlue(action);
    }
  }, [adminEvents]);

  // Expire admin flashes after 4s
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setRecentAdminRed((p)  => (p && now - p.at > 4000 ? null : p));
      setRecentAdminBlue((p) => (p && now - p.at > 4000 ? null : p));
    }, 300);
    return () => clearInterval(id);
  }, []);

  // Timer tick
  const matchRef = useRef(match);
  matchRef.current = match;
  useEffect(() => {
    if (!match) return;
    setRemaining(computeRemainingSeconds(match));
    const id = setInterval(() => {
      if (matchRef.current) setRemaining(computeRemainingSeconds(matchRef.current));
    }, 100);
    return () => clearInterval(id);
  }, [match?.id, match?.timerRunning, match?.timerElapsedSeconds]);

  // Stable judge order
  const judgeOrder = useMemo(() => {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const e of scoreEvents) {
      if (!seen.has(e.judgeId)) { seen.add(e.judgeId); order.push(e.judgeId); }
    }
    return order;
  }, [scoreEvents]);

  const { red: confirmedRed, blue: confirmedBlue } = computeConfirmedScores(scoreEvents);
  const adminRed  = adminEvents.filter((e) => e.side === "red") .reduce((s, e) => s + e.points, 0);
  const adminBlue = adminEvents.filter((e) => e.side === "blue").reduce((s, e) => s + e.points, 0);
  const totalRed  = confirmedRed  + adminRed;
  const totalBlue = confirmedBlue + adminBlue;

  if (!match) {
    return (
      <div style={{ background: "transparent" }} className="w-screen h-screen flex items-end justify-center pb-8">
        <p style={{ color: "rgba(255,255,255,0.15)", fontSize: 14, fontFamily: "sans-serif" }}>
          No match in progress · Arena {arenaNumber}
        </p>
      </div>
    );
  }

  const currentRound = match.currentRound ?? 1;
  const isExpired    = remaining <= 0;
  const timerColor   = isExpired ? "#ef4444" : match.timerRunning ? "#facc15" : "#ffffff";

  return (
    <div
      style={{ background: "transparent", fontFamily: "'Arial Black', Arial, sans-serif", userSelect: "none" }}
      className="w-screen h-screen flex flex-col"
    >
      {/* ── Top bar ── */}
      <div style={{
        display: "flex", alignItems: "center",
        background: "rgba(0,0,0,0.78)",
        padding: "8px 28px",
        gap: 20,
        backdropFilter: "blur(6px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        {/* Left: Arena + Round */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
            Arena {arenaNumber}
          </span>
          <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 11 }}>·</span>
          <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
            Round {currentRound}
          </span>
        </div>

        {/* Center: Timer */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <span style={{ color: timerColor, fontSize: 28, fontWeight: 900, fontFamily: "monospace", letterSpacing: 3 }}>
            {formatTime(remaining)}
          </span>
        </div>

        {/* Right: Tournament name — bigger, right-aligned */}
        <div style={{ flexShrink: 0, textAlign: "right" }}>
          <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 22, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase" }}>
            {match.tournamentName}
          </span>
        </div>
      </div>

      {/* ── Main: two corner panels ── */}
      <div style={{ flex: 1, display: "flex" }}>
        <CornerPanel
          corner="blue"
          competitor={blueComp}
          score={totalBlue}
          leading={totalBlue > totalRed}
          judgeOrder={judgeOrder}
          recentTaps={recentTaps}
          adminEvents={adminEvents}
          warnings={match.warnings}
          currentRound={currentRound}
          recentAdmin={recentAdminBlue}
        />
        <div style={{ width: 2, background: "rgba(0,0,0,0.4)", flexShrink: 0 }} />
        <CornerPanel
          corner="red"
          competitor={redComp}
          score={totalRed}
          leading={totalRed > totalBlue}
          judgeOrder={judgeOrder}
          recentTaps={recentTaps}
          adminEvents={adminEvents}
          warnings={match.warnings}
          currentRound={currentRound}
          recentAdmin={recentAdminRed}
        />
      </div>
    </div>
  );
}
