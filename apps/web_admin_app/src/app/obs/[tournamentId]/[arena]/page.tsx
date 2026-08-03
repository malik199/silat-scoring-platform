"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { Teko, Inter } from "next/font/google";
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

const teko  = Teko ({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"],       display: "swap" });

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

  const redName    = redComp  ? `${redComp.firstName} ${redComp.lastName}`   : "—";
  const blueName   = blueComp ? `${blueComp.firstName} ${blueComp.lastName}` : "—";
  const redSub     = [redComp?.schoolName,  redComp?.country ].filter(Boolean).join(" · ");
  const blueSub    = [blueComp?.schoolName, blueComp?.country].filter(Boolean).join(" · ");

  return (
    <div
      className={`w-screen h-screen ${teko.className}`}
      style={{ background: "transparent", userSelect: "none" }}
    >
      {/* Outer padding — bar floats off all screen edges */}
      <div style={{
        position: "fixed",
        bottom: "1.8%",
        left: "2.8%",
        right: "2.8%",
        height: "10.54vw",
      }}>

        {/* ── SVG background ── */}
        <svg
          viewBox="0 0 1485.57 156.63"
          preserveAspectRatio="none"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <polygon points="604.36 143.96 47.69 143.96 0 .59 587.77 .59 604.36 143.96"               fill="#323232" />
          <polygon points="604.36 143.96 507 143.96 482.11 .59 587.77 .59 604.36 143.96"            fill="#465155" />
          <polygon points="858.83 143.96 626.69 143.96 613.21 .59 872.31 .59 858.83 143.96"         fill="#343434" />
          <polygon points="92.96 102.56 70.29 102.56 52.04 38.93 74.71 38.93 92.96 102.56"         fill="#d5363b" />
          <polygon points="606.01 156.63 212.6 156.63 202.23 143.98 603.94 143.98 606.01 156.63"   fill="#d5363b" />
          <polygon points="881.21 143.37 1437.87 143.37 1485.57 0 897.8 0 881.21 143.37"            fill="#323232" />
          <polygon points="881.21 143.37 978.57 143.37 1003.45 0 897.8 0 881.21 143.37"             fill="#465155" />
          <polygon points="1392.61 101.97 1415.27 101.97 1433.52 38.34 1410.86 38.34 1392.61 101.97" fill="#0068ff" />
          <polygon points="879.55 156.04 1272.97 156.04 1283.34 143.39 881.63 143.39 879.55 156.04"  fill="#0068ff" />
          <rect x="626.29" y="143.39" width="232.97" height="13.13" fill="#969696" />
        </svg>

        {/* ── LEFT: name + school/country ── */}
        <div style={{
          position: "absolute",
          left: "8%", right: "69%",
          top: "6%", bottom: "14%",
          display: "flex", flexDirection: "column", justifyContent: "center",
          overflow: "hidden", gap: "0.1vw",
        }}>
          <div style={{
            color: "#ffffff", fontWeight: 700, fontSize: "2.1vw",
            textTransform: "uppercase", letterSpacing: "0.05em",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            lineHeight: 1,
          }}>
            {redName}
          </div>
          {redSub && (
            <div style={{
              color: "rgba(255,255,255,0.52)", fontWeight: 500, fontSize: "0.75vw",
              textTransform: "uppercase", letterSpacing: "0.1em",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              lineHeight: 1, fontFamily: inter.style.fontFamily,
            }}>
              {redSub}
            </div>
          )}
        </div>

        {/* ── LEFT: score ── */}
        <div style={{
          position: "absolute",
          left: "33%", right: "59.5%",
          top: "8%", bottom: "14%",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            color: totalRed > totalBlue ? "#facc15" : "#ffffff",
            fontWeight: 700, fontSize: "3.6vw", lineHeight: 1, letterSpacing: "0.02em",
          }}>
            {totalRed}
          </div>
        </div>

        {/* ── CENTER: tournament name → round → timer ── */}
        <div style={{
          position: "absolute",
          left: "41.5%", right: "41.5%",
          top: "4%", bottom: "10%",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: "0.2vw",
          overflow: "hidden",
        }}>
          {tournamentName && (
            <div style={{
              color: "rgba(255,255,255,0.9)", fontWeight: 600, fontSize: "1.05vw",
              textTransform: "uppercase", letterSpacing: "0.1em",
              textAlign: "center", lineHeight: 1.15,
              wordBreak: "break-word",
              width: "100%",
            }}>
              {tournamentName}
            </div>
          )}
          <div style={{
            color: "rgba(255,255,255,0.55)", fontWeight: 500, fontSize: "0.65vw",
            letterSpacing: "0.2em", textTransform: "uppercase", lineHeight: 1,
          }}>
            Round {currentRound}
          </div>
          <div style={{
            color: timerColor, fontWeight: 700, fontSize: "2.7vw",
            fontFamily: "monospace", letterSpacing: "0.04em", lineHeight: 1,
          }}>
            {formatTime(remaining)}
          </div>
        </div>

        {/* ── RIGHT: score ── */}
        <div style={{
          position: "absolute",
          left: "59.5%", right: "32%",
          top: "8%", bottom: "14%",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            color: totalBlue > totalRed ? "#facc15" : "#ffffff",
            fontWeight: 700, fontSize: "3.6vw", lineHeight: 1, letterSpacing: "0.02em",
          }}>
            {totalBlue}
          </div>
        </div>

        {/* ── RIGHT: name + school/country ── */}
        <div style={{
          position: "absolute",
          left: "68%", right: "8%",
          top: "6%", bottom: "14%",
          display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-end",
          overflow: "hidden", gap: "0.1vw",
        }}>
          <div style={{
            color: "#ffffff", fontWeight: 700, fontSize: "2.1vw",
            textTransform: "uppercase", letterSpacing: "0.05em",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            lineHeight: 1, width: "100%", textAlign: "right",
          }}>
            {blueName}
          </div>
          {blueSub && (
            <div style={{
              color: "rgba(255,255,255,0.52)", fontWeight: 500, fontSize: "0.75vw",
              textTransform: "uppercase", letterSpacing: "0.1em",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              lineHeight: 1, fontFamily: inter.style.fontFamily, width: "100%", textAlign: "right",
            }}>
              {blueSub}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
