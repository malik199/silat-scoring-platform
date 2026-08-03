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

  return (
    <div
      style={{ background: "transparent", userSelect: "none", fontFamily: "'Arial Black', Arial, sans-serif" }}
      className="w-screen h-screen"
    >
      {/* ── Lower-third broadcast strip ── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        height: 88,
        display: "flex",
        background: "rgba(14, 14, 18, 0.97)",
      }}>

        {/* ── Red corner: [red accent | NAME | SCORE] ── */}
        <div style={{
          flex: 1, display: "flex", alignItems: "center",
          overflow: "hidden",
        }}>
          {/* Diagonal red accent — parallelogram narrowing toward bottom-right */}
          <div style={{
            width: 24, alignSelf: "stretch", flexShrink: 0,
            background: "#c42e28",
            clipPath: "polygon(0 0, 100% 0, 58% 100%, 0 100%)",
          }} />

          {/* Name */}
          <div style={{ flex: 1, padding: "0 10px 0 14px", minWidth: 0 }}>
            <div style={{
              color: "#ffffff",
              fontWeight: 900,
              fontSize: 20,
              textTransform: "uppercase",
              letterSpacing: 1.5,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {redName}
            </div>
          </div>

          {/* Score */}
          <div style={{
            fontSize: 54,
            fontWeight: 900,
            lineHeight: 1,
            flexShrink: 0,
            color: totalRed > totalBlue ? "#facc15" : "#ffffff",
            padding: "0 22px 0 8px",
            letterSpacing: -1,
          }}>
            {totalRed}
          </div>
        </div>

        {/* ── Center: timer + round ── */}
        <div style={{
          flexShrink: 0,
          width: 128,
          background: "rgba(8, 8, 12, 0.99)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          borderLeft:  "1px solid rgba(255,255,255,0.08)",
          borderRight: "1px solid rgba(255,255,255,0.08)",
        }}>
          <span style={{
            color: timerColor,
            fontSize: 28,
            fontWeight: 900,
            fontFamily: "monospace",
            letterSpacing: 2,
          }}>
            {formatTime(remaining)}
          </span>
          <span style={{
            color: "rgba(255,255,255,0.28)",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
            marginTop: 4,
          }}>
            R{currentRound} · A{arenaNumber}
          </span>
        </div>

        {/* ── Blue corner: [SCORE | NAME | blue accent] ── */}
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          flexDirection: "row-reverse",
          overflow: "hidden",
        }}>
          {/* Diagonal blue accent — parallelogram narrowing toward bottom-left */}
          <div style={{
            width: 24,
            alignSelf: "stretch",
            flexShrink: 0,
            background: "#1855b8",
            clipPath: "polygon(42% 0, 100% 0, 100% 100%, 0 100%)",
          }} />

          {/* Name (row-reverse: DOM 2nd → renders right of score, left of accent) */}
          <div style={{ flex: 1, padding: "0 14px 0 10px", minWidth: 0, textAlign: "right" }}>
            <div style={{
              color: "#ffffff",
              fontWeight: 900,
              fontSize: 20,
              textTransform: "uppercase",
              letterSpacing: 1.5,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {blueName}
            </div>
          </div>

          {/* Score (row-reverse: DOM 1st → renders nearest center) */}
          <div style={{
            fontSize: 54,
            fontWeight: 900,
            lineHeight: 1,
            flexShrink: 0,
            color: totalBlue > totalRed ? "#facc15" : "#ffffff",
            padding: "0 8px 0 22px",
            letterSpacing: -1,
          }}>
            {totalBlue}
          </div>
        </div>

      </div>
    </div>
  );
}
