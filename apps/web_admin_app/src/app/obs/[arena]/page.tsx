"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ACTIVE_STATUSES } from "@/lib/tournaments";
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OBSLowerThirdPage() {
  const { arena } = useParams<{ arena: string }>();
  const arenaNumber = Number(arena);

  const [activeTournamentId, setActiveTournamentId] = useState<string | null | undefined>(undefined);
  const [match,       setMatch]       = useState<Match | null>(null);
  const [redComp,     setRedComp]     = useState<Competitor | null>(null);
  const [blueComp,    setBlueComp]    = useState<Competitor | null>(null);
  const [scoreEvents, setScoreEvents] = useState<ScoreEvent[]>([]);
  const [adminEvents, setAdminEvents] = useState<AdminEvent[]>([]);
  const [remaining,   setRemaining]   = useState(120);

  // Make body transparent for OBS browser source
  useEffect(() => {
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";
    return () => {
      document.body.style.background = "";
      document.documentElement.style.background = "";
    };
  }, []);

  // Find the active tournament first (public read, no auth needed)
  useEffect(() => {
    const q = query(collection(db, "tournaments"), where("status", "in", ACTIVE_STATUSES));
    return onSnapshot(q, (snap) => {
      setActiveTournamentId(snap.empty ? null : snap.docs[0].id);
    }, () => setActiveTournamentId(null));
  }, []);

  // Subscribe to matches for the active tournament only, filter by arena
  useEffect(() => {
    if (activeTournamentId === undefined) return; // still loading
    if (!activeTournamentId) { setMatch(null); return; }
    const q = query(collection(db, "matches"), where("tournamentId", "==", activeTournamentId));
    return onSnapshot(q, (snap) => {
      const found = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Match, "id">) }))
        .find((m) => m.arenaNumber === arenaNumber && m.status === "in_progress");
      setMatch(found ?? null);
    }, () => setMatch(null));
  }, [activeTournamentId, arenaNumber]);

  // Subscribe to competitors when match changes
  useEffect(() => {
    if (!match) { setRedComp(null); setBlueComp(null); return; }
    const unsubRed  = subscribeCompetitor(match.redCornerCompetitorId,  setRedComp);
    const unsubBlue = subscribeCompetitor(match.blueCornerCompetitorId, setBlueComp);
    return () => { unsubRed(); unsubBlue(); };
  }, [match?.id]);

  // Subscribe to score + admin events
  useEffect(() => {
    if (!match) { setScoreEvents([]); setAdminEvents([]); return; }
    const unsubScore = subscribeScoreEvents(match.id, setScoreEvents);
    const unsubAdmin = subscribeAdminEvents(match.id, setAdminEvents);
    return () => { unsubScore(); unsubAdmin(); };
  }, [match?.id]);

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

  const { red: confirmedRed, blue: confirmedBlue } = computeConfirmedScores(scoreEvents);
  const adminRed  = adminEvents.filter((e) => e.side === "red").reduce((s, e) => s + e.points, 0);
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

  const redName   = redComp  ? `${redComp.firstName}|${redComp.lastName}`   : "|";
  const blueName  = blueComp ? `${blueComp.firstName}|${blueComp.lastName}` : "|";
  const [redFirst,  redLast]  = redName.split("|");
  const [blueFirst, blueLast] = blueName.split("|");
  const redFlag   = flag(redComp?.country);
  const blueFlag  = flag(blueComp?.country);
  const isExpired = remaining <= 0;

  return (
    <div
      style={{ background: "transparent" }}
      className="w-screen h-screen flex flex-col items-stretch justify-end"
    >
      <LowerThird
        tournamentName={match.tournamentName}
        arenaNumber={arenaNumber}
        round={match.currentRound}
        remaining={remaining}
        timerRunning={match.timerRunning}
        isExpired={isExpired}
        redFirst={redFirst}
        redLast={redLast}
        redFlag={redFlag}
        redScore={totalRed}
        blueFirst={blueFirst}
        blueLast={blueLast}
        blueFlag={blueFlag}
        blueScore={totalBlue}
      />
    </div>
  );
}

// ─── Lower Third Component ────────────────────────────────────────────────────

interface LowerThirdProps {
  tournamentName: string;
  arenaNumber: number;
  round: number;
  remaining: number;
  timerRunning: boolean;
  isExpired: boolean;
  redFirst: string; redLast: string; redFlag: string; redScore: number;
  blueFirst: string; blueLast: string; blueFlag: string; blueScore: number;
}

function LowerThird({
  tournamentName, arenaNumber, round,
  remaining, timerRunning, isExpired,
  redFirst, redLast, redFlag, redScore,
  blueFirst, blueLast, blueFlag, blueScore,
}: LowerThirdProps) {
  const timerColor = isExpired ? "#ef4444" : timerRunning ? "#facc15" : "#ffffff";

  return (
    <div style={{ fontFamily: "'Arial Black', Arial, sans-serif", userSelect: "none" }}>

      {/* ── Tournament / round strip ── */}
      <div style={{
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        padding: "6px 24px",
        backdropFilter: "blur(4px)",
      }}>
        <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase" }}>
          {tournamentName}
        </span>
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>·</span>
        <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase" }}>
          Arena {arenaNumber}
        </span>
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>·</span>
        <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase" }}>
          Round {round}
        </span>
      </div>

      {/* ── Main lower third ── */}
      <div style={{ display: "flex", height: 110, position: "relative" }}>

        {/* Blue panel */}
        <div style={{
          flex: 1,
          background: "linear-gradient(135deg, #1a3a7a 0%, #1e4fd8 60%, #2563eb 100%)",
          clipPath: "polygon(0 0, 100% 0, calc(100% - 70px) 100%, 0 100%)",
          display: "flex",
          alignItems: "center",
          paddingLeft: 28,
          paddingRight: 90,
          gap: 16,
        }}>
          {blueFlag && (
            <span style={{ fontSize: 36, lineHeight: 1, flexShrink: 0 }}>{blueFlag}</span>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>
              {blueFirst}
            </div>
            <div style={{
              color: "#ffffff",
              fontSize: 34,
              fontWeight: 900,
              lineHeight: 1.05,
              textTransform: "uppercase",
              letterSpacing: 1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              {blueLast}
            </div>
          </div>
        </div>

        {/* Center score area */}
        <div style={{
          position: "absolute",
          left: "50%",
          top: 0,
          bottom: 0,
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 0,
          zIndex: 10,
        }}>
          {/* Blue score */}
          <div style={{
            background: "#1e40af",
            color: "#ffffff",
            fontSize: 64,
            fontWeight: 900,
            lineHeight: 1,
            width: 90,
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRight: "2px solid rgba(255,255,255,0.15)",
          }}>
            {blueScore}
          </div>

          {/* Timer pill */}
          <div style={{
            position: "absolute",
            top: -28,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#111827",
            border: "2px solid rgba(255,255,255,0.15)",
            borderRadius: 999,
            padding: "4px 18px",
            color: timerColor,
            fontSize: 18,
            fontWeight: 900,
            letterSpacing: 2,
            whiteSpace: "nowrap",
            fontFamily: "monospace",
            boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
          }}>
            {formatTime(remaining)}
          </div>

          {/* Red score */}
          <div style={{
            background: "#991b1b",
            color: "#ffffff",
            fontSize: 64,
            fontWeight: 900,
            lineHeight: 1,
            width: 90,
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderLeft: "2px solid rgba(255,255,255,0.15)",
          }}>
            {redScore}
          </div>
        </div>

        {/* Red panel */}
        <div style={{
          flex: 1,
          background: "linear-gradient(225deg, #7a1a1a 0%, #d81e1e 60%, #ef4444 100%)",
          clipPath: "polygon(70px 0, 100% 0, 100% 100%, 0 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingRight: 28,
          paddingLeft: 90,
          gap: 16,
        }}>
          <div style={{ minWidth: 0, textAlign: "right" }}>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>
              {redFirst}
            </div>
            <div style={{
              color: "#ffffff",
              fontSize: 34,
              fontWeight: 900,
              lineHeight: 1.05,
              textTransform: "uppercase",
              letterSpacing: 1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              {redLast}
            </div>
          </div>
          {redFlag && (
            <span style={{ fontSize: 36, lineHeight: 1, flexShrink: 0 }}>{redFlag}</span>
          )}
        </div>
      </div>
    </div>
  );
}
