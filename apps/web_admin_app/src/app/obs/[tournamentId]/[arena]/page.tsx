"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  subscribeScoreEvents,
  subscribeAdminEvents,
  computeConfirmedScores,
  computePenaltyFlagPoints,
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

// ─── Judge indicator (compact for lower-third) ────────────────────────────────

function JudgeIndicator({ number, tap, corner, type }: {
  number: number;
  tap: RecentTap | null;
  corner: "red" | "blue";
  type: "punch" | "kick";
}) {
  const active = tap !== null && tap.side === corner &&
    (type === "punch" ? tap.points === 1 : tap.points !== 1);

  return (
    <div style={{
      width: 34, height: 22, borderRadius: 5, flexShrink: 0,
      background:  active ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.3)",
      boxShadow:   active ? "0 0 10px rgba(255,255,255,0.5)" : "none",
      transform:   active ? "scale(1.1)" : "scale(1)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      transition: "all 0.2s",
    }}>
      {active ? (
        <>
          <span style={{ fontSize: 11, lineHeight: 1 }}>{type === "punch" ? "👊" : "🦶"}</span>
          <span style={{ fontSize: 8, fontWeight: 900, lineHeight: 1,
            color: corner === "red" ? "#c42e28" : "#0072c4" }}>J{number}</span>
        </>
      ) : (
        <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.25)" }}>J{number}</span>
      )}
    </div>
  );
}

// ─── Build active indicator list for one corner ───────────────────────────────

function activeIndicators(
  corner: "red" | "blue",
  currentRound: number,
  warnings: Record<string, boolean> | undefined,
  recentAdmin: RecentAdmin | null,
) {
  const w1  = warnings?.[`r${currentRound}_${corner}_w1`]  === true;
  const w2  = warnings?.[`r${currentRound}_${corner}_w2`]  === true;
  const m1  = warnings?.[`r${currentRound}_${corner}_m1`]  === true;
  const m2  = warnings?.[`r${currentRound}_${corner}_m2`]  === true;
  const m5  = warnings?.[`r${currentRound}_${corner}_m5`]  === true;
  const m10 = warnings?.[`r${currentRound}_${corner}_m10`] === true;
  const dq  = warnings?.[`${corner}_dq`] === true;
  const jatohan = recentAdmin !== null && recentAdmin.points > 0;

  return [
    { src: "/jatohan_sah.svg",  active: jatohan, bg: "rgba(0,208,132,0.5)",   border: "rgba(0,208,132,0.85)",  large: true  },
    { src: "/warning_1.svg",    active: w1,      bg: "rgba(250,173,20,0.45)", border: "rgba(250,173,20,0.75)", large: false },
    { src: "/warning_2.svg",    active: w2,      bg: "rgba(250,173,20,0.45)", border: "rgba(250,173,20,0.75)", large: false },
    { src: "/violation_1.svg",  active: m1,      bg: "rgba(250,173,20,0.45)", border: "rgba(250,173,20,0.75)", large: false },
    { src: "/violation_2.svg",  active: m2,      bg: "rgba(250,173,20,0.45)", border: "rgba(250,173,20,0.75)", large: false },
    { src: "/violation_5.svg",  active: m5,      bg: "rgba(255,77,79,0.45)",  border: "rgba(255,77,79,0.75)",  large: false },
    { src: "/violation_10.svg", active: m10,     bg: "rgba(255,77,79,0.45)",  border: "rgba(255,77,79,0.75)",  large: false },
    { src: "/violation_dq.svg", active: dq,      bg: "rgba(255,77,79,0.45)",  border: "rgba(255,77,79,0.75)",  large: false },
  ].filter((i) => i.active);
}

function Divider() {
  return (
    <div style={{
      width: 1, alignSelf: "stretch", flexShrink: 0,
      background: "rgba(255,255,255,0.12)",
      margin: "10px 0",
    }} />
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

  const prevScoreLen = useRef(0);
  const [recentTaps, setRecentTaps] = useState<Map<string, RecentTap>>(new Map());

  const prevAdminLen = useRef(0);
  const [recentAdminRed,  setRecentAdminRed]  = useState<RecentAdmin | null>(null);
  const [recentAdminBlue, setRecentAdminBlue] = useState<RecentAdmin | null>(null);

  useEffect(() => {
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";
    return () => {
      document.body.style.background = "";
      document.documentElement.style.background = "";
    };
  }, []);

  useEffect(() => {
    const q = query(collection(db, "matches"), where("tournamentId", "==", tournamentId));
    return onSnapshot(q, (snap) => {
      const found = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Match, "id">) }))
        .find((m) => m.arenaNumber === arenaNumber && m.status === "in_progress");
      setMatch(found ?? null);
    }, () => setMatch(null));
  }, [tournamentId, arenaNumber]);

  useEffect(() => {
    if (!match) { setRedComp(null); setBlueComp(null); return; }
    const unsubRed  = subscribeCompetitor(match.redCornerCompetitorId,  setRedComp);
    const unsubBlue = subscribeCompetitor(match.blueCornerCompetitorId, setBlueComp);
    return () => { unsubRed(); unsubBlue(); };
  }, [match?.id]);

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

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setRecentAdminRed((p)  => (p && now - p.at > 4000 ? null : p));
      setRecentAdminBlue((p) => (p && now - p.at > 4000 ? null : p));
    }, 300);
    return () => clearInterval(id);
  }, []);

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

  const judgeOrder = useMemo(() => {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const e of scoreEvents) {
      if (!seen.has(e.judgeId)) { seen.add(e.judgeId); order.push(e.judgeId); }
    }
    return order;
  }, [scoreEvents]);

  // Render nothing visible when no match is running (transparent OBS source)
  if (!match) {
    return <div style={{ background: "transparent" }} className="w-screen h-screen" />;
  }

  const currentRound = match.currentRound ?? 1;
  const { red: confirmedRed, blue: confirmedBlue } = computeConfirmedScores(scoreEvents);
  const adminRed  = adminEvents.filter((e) => e.side === "red"  && e.points > 0).reduce((s, e) => s + e.points, 0);
  const adminBlue = adminEvents.filter((e) => e.side === "blue" && e.points > 0).reduce((s, e) => s + e.points, 0);
  const totalRed  = confirmedRed  + adminRed  + computePenaltyFlagPoints(match.warnings, "red",  currentRound);
  const totalBlue = confirmedBlue + adminBlue + computePenaltyFlagPoints(match.warnings, "blue", currentRound);
  const isExpired  = remaining <= 0;
  const timerColor = isExpired ? "#ef4444" : match.timerRunning ? "#facc15" : "#ffffff";

  const blueName   = blueComp ? `${blueComp.firstName} ${blueComp.lastName}` : "—";
  const blueSchool = blueComp
    ? [blueComp.schoolName, flag(blueComp.country), blueComp.country].filter(Boolean).join("  ")
    : "";
  const redName   = redComp ? `${redComp.firstName} ${redComp.lastName}` : "—";
  const redSchool = redComp
    ? [redComp.schoolName, flag(redComp.country), redComp.country].filter(Boolean).join("  ")
    : "";

  const slots = Array.from({ length: 3 }, (_, i) => {
    const judgeId = judgeOrder[i] ?? null;
    return { number: i + 1, tap: judgeId ? (recentTaps.get(judgeId) ?? null) : null };
  });

  const blueIcons = activeIndicators("blue", currentRound, match.warnings, recentAdminBlue);
  const redIcons  = activeIndicators("red",  currentRound, match.warnings, recentAdminRed);

  const iconCell = (icons: ReturnType<typeof activeIndicators>) => (
    <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0, minWidth: 28 }}>
      {icons.length === 0 ? (
        <span style={{ color: "rgba(255,255,255,0.1)", fontSize: 11 }}>—</span>
      ) : icons.map(({ src, bg, border, large }, i) => (
        <div key={i} style={{
          width: large ? 36 : 24, height: large ? 36 : 24,
          borderRadius: 5, background: bg, border: `1.5px solid ${border}`,
          padding: large ? 4 : 3,
          boxShadow: `0 0 ${large ? 12 : 5}px ${border}`,
          flexShrink: 0,
        }}>
          <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", filter: "brightness(0) invert(1)" }} />
        </div>
      ))}
    </div>
  );

  const judgeCell = (corner: "red" | "blue") => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
      <div style={{ display: "flex", gap: 3 }}>
        {slots.map((s) => <JudgeIndicator key={`${corner}p${s.number}`} number={s.number} tap={s.tap} corner={corner} type="punch" />)}
      </div>
      <div style={{ display: "flex", gap: 3 }}>
        {slots.map((s) => <JudgeIndicator key={`${corner}k${s.number}`} number={s.number} tap={s.tap} corner={corner} type="kick" />)}
      </div>
    </div>
  );

  return (
    <div
      style={{ background: "transparent", fontFamily: "'Arial Black', Arial, sans-serif", userSelect: "none" }}
      className="w-screen h-screen"
    >
      {/* ── Lower-third strip ── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        display: "flex", height: 88,
        backdropFilter: "blur(4px)",
        borderTop: "2px solid rgba(255,255,255,0.07)",
      }}>

        {/* ── Blue corner (left): Name | Icons | Judges | Score ── */}
        <div style={{
          flex: 1, display: "flex", alignItems: "center", gap: 10,
          background: "rgba(8,55,145,0.92)", padding: "0 14px",
          overflow: "hidden",
        }}>
          {/* 1. Name + School */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#fff", fontWeight: 900, fontSize: 18, lineHeight: 1.2,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {blueName}
            </div>
            {blueSchool && (
              <div style={{ color: "rgba(255,255,255,0.55)", fontWeight: 600, fontSize: 11, marginTop: 2,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {blueSchool}
              </div>
            )}
          </div>

          <Divider />

          {/* 2. Jatohan + penalty icons */}
          {iconCell(blueIcons)}

          <Divider />

          {/* 3. Judge indicators */}
          {judgeCell("blue")}

          <Divider />

          {/* 4. Score */}
          <div style={{
            fontSize: 50, fontWeight: 900, lineHeight: 1, flexShrink: 0,
            minWidth: 54, textAlign: "center",
            color: totalBlue > totalRed ? "#facc15" : "#fff",
          }}>
            {totalBlue}
          </div>
        </div>

        {/* ── Center: timer + round ── */}
        <div style={{
          background: "rgba(0,0,0,0.88)", flexShrink: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "0 20px", minWidth: 118,
          borderLeft:  "1px solid rgba(255,255,255,0.06)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}>
          <span style={{ color: timerColor, fontSize: 24, fontWeight: 900, fontFamily: "monospace", letterSpacing: 2 }}>
            {formatTime(remaining)}
          </span>
          <span style={{ color: "rgba(255,255,255,0.38)", fontSize: 10, fontWeight: 700,
            letterSpacing: 2, textTransform: "uppercase", marginTop: 3 }}>
            R{currentRound} · A{arenaNumber}
          </span>
        </div>

        {/* ── Red corner (right, mirrored): Score | Judges | Icons | Name ── */}
        <div style={{
          flex: 1, display: "flex", alignItems: "center", gap: 10, flexDirection: "row-reverse",
          background: "rgba(140,18,18,0.92)", padding: "0 14px",
          overflow: "hidden",
        }}>
          {/* 1. Name + School (far right) */}
          <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
            <div style={{ color: "#fff", fontWeight: 900, fontSize: 18, lineHeight: 1.2,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {redName}
            </div>
            {redSchool && (
              <div style={{ color: "rgba(255,255,255,0.55)", fontWeight: 600, fontSize: 11, marginTop: 2,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {redSchool}
              </div>
            )}
          </div>

          <Divider />

          {/* 2. Icons */}
          {iconCell(redIcons)}

          <Divider />

          {/* 3. Judges */}
          {judgeCell("red")}

          <Divider />

          {/* 4. Score (leftmost due to row-reverse = nearest center) */}
          <div style={{
            fontSize: 50, fontWeight: 900, lineHeight: 1, flexShrink: 0,
            minWidth: 54, textAlign: "center",
            color: totalRed > totalBlue ? "#facc15" : "#fff",
          }}>
            {totalRed}
          </div>
        </div>

      </div>
    </div>
  );
}
