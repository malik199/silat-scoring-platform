"use client";

import { useEffect, useRef, useState } from "react";
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

export default function OBSPage() {
  const { tournamentId, arena } = useParams<{ tournamentId: string; arena: string }>();
  const arenaNumber = Number(arena);

  const [match,       setMatch]       = useState<Match | null>(null);
  const [redComp,     setRedComp]     = useState<Competitor | null>(null);
  const [blueComp,    setBlueComp]    = useState<Competitor | null>(null);
  const [scoreEvents, setScoreEvents] = useState<ScoreEvent[]>([]);
  const [adminEvents, setAdminEvents] = useState<AdminEvent[]>([]);
  const [remaining,   setRemaining]   = useState(120);

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
    if (!match) { setScoreEvents([]); setAdminEvents([]); return; }
    const unsubScore = subscribeScoreEvents(match.id, setScoreEvents);
    const unsubAdmin = subscribeAdminEvents(match.id, setAdminEvents);
    return () => { unsubScore(); unsubAdmin(); };
  }, [match?.id]);

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

  const redName  = redComp  ? `${redComp.firstName} ${redComp.lastName}`   : "—";
  const blueName = blueComp ? `${blueComp.firstName} ${blueComp.lastName}` : "—";

  // SVG viewBox: 1485.57 × 156.63
  // Panel boundaries as % of width:
  //   Left  0 → 40.69%  |  Center 41.28 → 58.71%  |  Right 59.31 → 100%
  // Height: 156.63 / 1485.57 = 10.54vw

  return (
    <div
      style={{ background: "transparent", userSelect: "none", fontFamily: "'Impact', 'Arial Black', Arial, sans-serif" }}
      className="w-screen h-screen"
    >
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        height: "10.54vw",
      }}>

        {/* ── SVG background ── */}
        <svg
          viewBox="0 0 1485.57 156.63"
          preserveAspectRatio="none"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Left panel main */}
          <polygon points="604.36 143.96 47.69 143.96 0 .59 587.77 .59 604.36 143.96" fill="#323232" />
          {/* Left panel darker right accent */}
          <polygon points="604.36 143.96 507 143.96 482.11 .59 587.77 .59 604.36 143.96" fill="#465155" />
          {/* Center panel */}
          <polygon points="858.83 143.96 626.69 143.96 613.21 .59 872.31 .59 858.83 143.96" fill="#343434" />
          {/* Red diagonal stripe */}
          <polygon points="92.96 102.56 70.29 102.56 52.04 38.93 74.71 38.93 92.96 102.56" fill="#d5363b" />
          {/* Red bottom stripe */}
          <polygon points="606.01 156.63 212.6 156.63 202.23 143.98 603.94 143.98 606.01 156.63" fill="#d5363b" />
          {/* Right panel main */}
          <polygon points="881.21 143.37 1437.87 143.37 1485.57 0 897.8 0 881.21 143.37" fill="#323232" />
          {/* Right panel darker left accent */}
          <polygon points="881.21 143.37 978.57 143.37 1003.45 0 897.8 0 881.21 143.37" fill="#465155" />
          {/* Blue diagonal stripe */}
          <polygon points="1392.61 101.97 1415.27 101.97 1433.52 38.34 1410.86 38.34 1392.61 101.97" fill="#0068ff" />
          {/* Blue bottom stripe */}
          <polygon points="879.55 156.04 1272.97 156.04 1283.34 143.39 881.63 143.39 879.55 156.04" fill="#0068ff" />
          {/* Center bottom gray bar */}
          <rect x="626.29" y="143.39" width="232.97" height="13.13" fill="#969696" />
        </svg>

        {/* ── Left panel text: NAME ... SCORE ── */}
        {/* Content sits between red stripe (~6.3%) and left panel right edge (~40.7%) */}
        <div style={{
          position: "absolute",
          left: "7.5%", right: "61%",
          top: 0, bottom: "8%",
          display: "flex", alignItems: "center",
          gap: "1vw",
          overflow: "hidden",
        }}>
          <div style={{
            flex: 1, minWidth: 0,
            color: "#ffffff",
            fontWeight: 900,
            fontSize: "1.7vw",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {redName}
          </div>
          <div style={{
            flexShrink: 0,
            color: totalRed > totalBlue ? "#facc15" : "#ffffff",
            fontWeight: 900,
            fontSize: "3.5vw",
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}>
            {totalRed}
          </div>
        </div>

        {/* ── Center text: TIMER ── */}
        {/* Center panel spans 41.28% → 58.71% */}
        <div style={{
          position: "absolute",
          left: "41.3%", right: "41.3%",
          top: 0, bottom: "8%",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{
            color: timerColor,
            fontWeight: 900,
            fontSize: "3.7vw",
            fontFamily: "monospace",
            letterSpacing: "0.04em",
            lineHeight: 1,
          }}>
            {formatTime(remaining)}
          </span>
        </div>

        {/* ── Right panel text: SCORE ... NAME ── */}
        {/* Content sits between right panel left edge (~59.3%) and blue stripe (~93.7%) */}
        <div style={{
          position: "absolute",
          left: "60%", right: "7.5%",
          top: 0, bottom: "8%",
          display: "flex", alignItems: "center",
          gap: "1vw",
          overflow: "hidden",
        }}>
          <div style={{
            flexShrink: 0,
            color: totalBlue > totalRed ? "#facc15" : "#ffffff",
            fontWeight: 900,
            fontSize: "3.5vw",
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}>
            {totalBlue}
          </div>
          <div style={{
            flex: 1, minWidth: 0, textAlign: "right",
            color: "#ffffff",
            fontWeight: 900,
            fontSize: "1.7vw",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {blueName}
          </div>
        </div>

      </div>
    </div>
  );
}
