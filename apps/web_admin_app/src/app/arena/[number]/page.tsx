"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { subscribeActiveTournament, type Tournament } from "@/lib/tournaments";
import {
  subscribeMatches,
  subscribeScoreEvents,
  subscribeAdminEvents,
  computeConfirmedScores,
  type Match,
  type ScoreEvent,
  type AdminEvent,
} from "@/lib/matches";
import { subscribeCompetitor, type Competitor } from "@/lib/competitors";

// ─── Corner panel ─────────────────────────────────────────────────────────────

interface CornerPanelProps {
  corner: "red" | "blue";
  competitor: Competitor | null | undefined;
  score: number;
  leading: boolean;
}

function CornerPanel({ corner, competitor, score, leading }: CornerPanelProps) {
  const isRed   = corner === "red";
  const bgMain  = isRed ? "#f53a32" : "#008dee";
  const bgDark  = isRed ? "#c42e28" : "#0072c4";

  return (
    <div className="flex-1 flex flex-col" style={{ backgroundColor: bgMain }}>
      {/* ── Competitor info — darker band at top ── */}
      <div
        className="flex flex-col items-center justify-center gap-2 px-8 py-6"
        style={{ backgroundColor: bgDark }}
      >
        {competitor ? (
          <>
            <p className="text-4xl font-black text-white leading-tight text-center">
              {competitor.firstName} {competitor.lastName}
            </p>
            <p className="text-2xl font-semibold text-white/70 text-center">
              {[competitor.schoolName, competitor.country].filter(Boolean).join("  ·  ")}
            </p>
          </>
        ) : (
          <p className="text-2xl font-bold text-white/30">—</p>
        )}
      </div>

      {/* ── Score — vertically centered in remaining space ── */}
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

export default function ArenaScreenPage({
  params,
}: {
  params: { number: string };
}) {
  const arenaNumber = parseInt(params.number, 10);
  const { user, loading: authLoading } = useAuth();

  const [tournament,  setTournament]  = useState<Tournament | null | undefined>(undefined);
  const [matches,     setMatches]     = useState<Match[] | null>(null);
  const [redComp,     setRedComp]     = useState<Competitor | null | undefined>(undefined);
  const [blueComp,    setBlueComp]    = useState<Competitor | null | undefined>(undefined);
  const [scoreEvents,  setScoreEvents]  = useState<ScoreEvent[]>([]);
  const [adminEvents,  setAdminEvents]  = useState<AdminEvent[]>([]);

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
      setRedComp(null); setBlueComp(null); setScoreEvents([]);
      return;
    }
    const unsubRed    = subscribeCompetitor(runningMatch.redCornerCompetitorId,  setRedComp);
    const unsubBlue   = subscribeCompetitor(runningMatch.blueCornerCompetitorId, setBlueComp);
    const unsubEvents = subscribeScoreEvents(runningMatch.id, setScoreEvents);
    const unsubAdmin  = subscribeAdminEvents(runningMatch.id, setAdminEvents);
    return () => { unsubRed(); unsubBlue(); unsubEvents(); unsubAdmin(); };
  }, [runningMatch?.id]);

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
  const adminRed   = adminEvents.filter((e) => e.side === "red").reduce((s, e) => s + e.points, 0);
  const adminBlue  = adminEvents.filter((e) => e.side === "blue").reduce((s, e) => s + e.points, 0);
  const totalRed   = confirmedRed  + adminRed;
  const totalBlue  = confirmedBlue + adminBlue;

  return (
    <div className="min-h-screen flex flex-col overflow-hidden" style={{ backgroundColor: "#111" }}>
      {/* Top bar */}
      <div className="flex items-center justify-center py-4 border-b border-white/10" style={{ backgroundColor: "#0a0a0a" }}>
        <p className="text-base font-bold uppercase tracking-[0.3em] text-white/70">
          Arena {arenaNumber}
          {tournament?.name && (
            <>
              <span className="mx-3 text-white/30">·</span>
              <span>{tournament.name}</span>
            </>
          )}
        </p>
      </div>

      {/* Split screen */}
      <div className="flex flex-1">
        <CornerPanel corner="red"  competitor={redComp}  score={totalRed}  leading={totalRed > totalBlue} />

        {/* Centre divider */}
        <div className="w-1 flex-shrink-0 bg-black/30" />

        <CornerPanel corner="blue" competitor={blueComp} score={totalBlue} leading={totalBlue > totalRed} />
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
