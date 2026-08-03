"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
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

  const [match,          setMatch]          = useState<Match | null>(null);
  const [redComp,        setRedComp]        = useState<Competitor | null>(null);
  const [blueComp,       setBlueComp]       = useState<Competitor | null>(null);
  const [scoreEvents,    setScoreEvents]    = useState<ScoreEvent[]>([]);
  const [adminEvents,    setAdminEvents]    = useState<AdminEvent[]>([]);
  const [remaining,      setRemaining]      = useState(120);
  const [tournamentName, setTournamentName] = useState("");

  useEffect(() => {
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";
    return () => {
      document.body.style.background = "";
      document.documentElement.style.background = "";
    };
  }, []);

  useEffect(() => {
    getDoc(doc(db, "tournaments", tournamentId)).then((snap) => {
      if (snap.exists()) setTournamentName(snap.data().name ?? "");
    });
  }, [tournamentId]);

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
    const unsubRed  = subscribeCompetitor(match.redCornerCompetitorId, setRedComp);
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

  // SVG viewBox 1485.57 × 156.63 — panel boundaries as % of width:
  //   Left panel light zone:  8% → 31%   (0 → 482px in SVG = 0 → 32.4%)
  //   Left panel dark accent: 33% → 40%  (482 → 604px = 32.4% → 40.7%)
  //   Center panel:           41.3% → 58.7%
  //   Right panel dark accent:59.5% → 67.5% (881 → 1003px = 59.3% → 67.5%)
  //   Right panel light zone: 68% → 92.5% (1003 → 1393px = 67.5% → 93.7%)
  //   Height: 156.63/1485.57 = 10.54vw

  return (
    <div
      style={{ background: "transparent", userSelect: "none", fontFamily: "'Impact', 'Arial Black', Arial, sans-serif" }}
      className="w-screen h-screen"
    >
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: "10.54vw" }}>

        {/* ── SVG background ── */}
        <svg
          viewBox="0 0 1485.57 156.63"
          preserveAspectRatio="none"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <polygon points="604.36 143.96 47.69 143.96 0 .59 587.77 .59 604.36 143.96"           fill="#323232" />
          <polygon points="604.36 143.96 507 143.96 482.11 .59 587.77 .59 604.36 143.96"        fill="#465155" />
          <polygon points="858.83 143.96 626.69 143.96 613.21 .59 872.31 .59 858.83 143.96"     fill="#343434" />
          <polygon points="92.96 102.56 70.29 102.56 52.04 38.93 74.71 38.93 92.96 102.56"     fill="#d5363b" />
          <polygon points="606.01 156.63 212.6 156.63 202.23 143.98 603.94 143.98 606.01 156.63" fill="#d5363b" />
          <polygon points="881.21 143.37 1437.87 143.37 1485.57 0 897.8 0 881.21 143.37"        fill="#323232" />
          <polygon points="881.21 143.37 978.57 143.37 1003.45 0 897.8 0 881.21 143.37"         fill="#465155" />
          <polygon points="1392.61 101.97 1415.27 101.97 1433.52 38.34 1410.86 38.34 1392.61 101.97" fill="#0068ff" />
          <polygon points="879.55 156.04 1272.97 156.04 1283.34 143.39 881.63 143.39 879.55 156.04" fill="#0068ff" />
          <rect x="626.29" y="143.39" width="232.97" height="13.13" fill="#969696" />
        </svg>

        {/* ── LEFT: competitor name + tournament ── */}
        <div style={{
          position: "absolute",
          left: "8%", right: "69%",
          top: "6%", bottom: "14%",
          display: "flex", flexDirection: "column", justifyContent: "center",
          overflow: "hidden", gap: "0.3vw",
        }}>
          <div style={{
            color: "#ffffff", fontWeight: 900, fontSize: "1.7vw",
            textTransform: "uppercase", letterSpacing: "0.06em",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {redName}
          </div>
          {tournamentName && (
            <div style={{
              color: "rgba(255,255,255,0.5)", fontWeight: 700, fontSize: "0.72vw",
              textTransform: "uppercase", letterSpacing: "0.12em",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {tournamentName}
            </div>
          )}
        </div>

        {/* ── LEFT: round label + score ── */}
        <div style={{
          position: "absolute",
          left: "33%", right: "59.5%",
          top: "6%", bottom: "14%",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: "0.15vw",
        }}>
          <div style={{
            color: "rgba(255,255,255,0.5)", fontWeight: 700, fontSize: "0.62vw",
            letterSpacing: "0.2em", textTransform: "uppercase", lineHeight: 1,
          }}>
            Round {currentRound}
          </div>
          <div style={{
            color: totalRed > totalBlue ? "#facc15" : "#ffffff",
            fontWeight: 900, fontSize: "3.3vw", lineHeight: 1, letterSpacing: "-0.02em",
          }}>
            {totalRed}
          </div>
        </div>

        {/* ── CENTER: timer ── */}
        <div style={{
          position: "absolute",
          left: "41.5%", right: "41.5%",
          top: "6%", bottom: "14%",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{
            color: timerColor, fontWeight: 900, fontSize: "3.7vw",
            fontFamily: "monospace", letterSpacing: "0.04em", lineHeight: 1,
          }}>
            {formatTime(remaining)}
          </span>
        </div>

        {/* ── RIGHT: round label + score ── */}
        <div style={{
          position: "absolute",
          left: "59.5%", right: "32%",
          top: "6%", bottom: "14%",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: "0.15vw",
        }}>
          <div style={{
            color: "rgba(255,255,255,0.5)", fontWeight: 700, fontSize: "0.62vw",
            letterSpacing: "0.2em", textTransform: "uppercase", lineHeight: 1,
          }}>
            Round {currentRound}
          </div>
          <div style={{
            color: totalBlue > totalRed ? "#facc15" : "#ffffff",
            fontWeight: 900, fontSize: "3.3vw", lineHeight: 1, letterSpacing: "-0.02em",
          }}>
            {totalBlue}
          </div>
        </div>

        {/* ── RIGHT: competitor name + tournament ── */}
        <div style={{
          position: "absolute",
          left: "68%", right: "8%",
          top: "6%", bottom: "14%",
          display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-end",
          overflow: "hidden", gap: "0.3vw",
        }}>
          <div style={{
            color: "#ffffff", fontWeight: 900, fontSize: "1.7vw",
            textTransform: "uppercase", letterSpacing: "0.06em",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            width: "100%", textAlign: "right",
          }}>
            {blueName}
          </div>
          {tournamentName && (
            <div style={{
              color: "rgba(255,255,255,0.5)", fontWeight: 700, fontSize: "0.72vw",
              textTransform: "uppercase", letterSpacing: "0.12em",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              width: "100%", textAlign: "right",
            }}>
              {tournamentName}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
