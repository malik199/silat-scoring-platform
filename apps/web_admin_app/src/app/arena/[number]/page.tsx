"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { subscribeActiveTournament, type Tournament } from "@/lib/tournaments";
import { subscribeMatches, type Match } from "@/lib/matches";
import { subscribeCompetitor, type Competitor } from "@/lib/competitors";

// ─── Corner panel ─────────────────────────────────────────────────────────────

interface CornerPanelProps {
  corner: "red" | "blue";
  competitor: Competitor | null | undefined;
}

function CornerPanel({ corner, competitor }: CornerPanelProps) {
  const isRed = corner === "red";

  const bg      = isRed ? "bg-red-950"   : "bg-blue-950";
  const accent  = isRed ? "text-red-400"  : "text-blue-400";
  const border  = isRed ? "border-red-700/40" : "border-blue-700/40";
  const label   = isRed ? "RED CORNER"   : "BLUE CORNER";
  const dot     = isRed ? "bg-red-500"   : "bg-blue-500";

  return (
    <div className={`flex-1 flex flex-col items-center justify-center ${bg} border-r ${border} px-12 py-16 gap-8`}>
      {/* Corner label */}
      <div className="flex items-center gap-3">
        <span className={`w-3 h-3 rounded-full ${dot}`} />
        <span className={`text-sm font-bold uppercase tracking-[0.3em] ${accent}`}>
          {label}
        </span>
        <span className={`w-3 h-3 rounded-full ${dot}`} />
      </div>

      {competitor ? (
        <>
          {/* Name */}
          <div className="text-center">
            <p className="text-7xl font-black text-white leading-tight tracking-tight">
              {competitor.firstName}
            </p>
            <p className="text-7xl font-black text-white leading-tight tracking-tight">
              {competitor.lastName}
            </p>
          </div>

          {/* School */}
          {competitor.schoolName && (
            <p className={`text-2xl font-semibold ${accent} text-center`}>
              {competitor.schoolName}
            </p>
          )}

          {/* Country */}
          <p className="text-3xl font-bold text-white/70 text-center uppercase tracking-widest">
            {competitor.country}
          </p>

          {/* Score placeholder */}
          <div className={`mt-8 border-2 ${isRed ? "border-red-700/50" : "border-blue-700/50"} rounded-3xl px-20 py-8`}>
            <p className="text-9xl font-black text-white tabular-nums text-center">0</p>
            <p className="text-sm font-semibold uppercase tracking-widest text-white/40 text-center mt-2">
              Score
            </p>
          </div>
        </>
      ) : (
        <p className="text-2xl text-white/30 font-medium">—</p>
      )}
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

  const [tournament, setTournament] = useState<Tournament | null | undefined>(undefined);
  const [matches,    setMatches]    = useState<Match[] | null>(null);
  const [redComp,    setRedComp]    = useState<Competitor | null | undefined>(undefined);
  const [blueComp,   setBlueComp]   = useState<Competitor | null | undefined>(undefined);

  // Active tournament
  useEffect(() => {
    if (!user) return;
    return subscribeActiveTournament(user.uid, setTournament);
  }, [user]);

  // Matches for this tournament
  useEffect(() => {
    if (!tournament) { setMatches(tournament === null ? [] : null); return; }
    return subscribeMatches(tournament.id, setMatches);
  }, [tournament?.id]);

  const runningMatch = matches?.find(
    (m) => m.arenaNumber === arenaNumber && m.status === "in_progress"
  ) ?? null;

  // Subscribe to both competitors whenever the running match changes
  useEffect(() => {
    if (!runningMatch) { setRedComp(null); setBlueComp(null); return; }
    const unsubRed  = subscribeCompetitor(runningMatch.redCornerCompetitorId,  setRedComp);
    const unsubBlue = subscribeCompetitor(runningMatch.blueCornerCompetitorId, setBlueComp);
    return () => { unsubRed(); unsubBlue(); };
  }, [runningMatch?.id]);

  // ── Loading / waiting states ──────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-white/30 text-lg font-medium animate-pulse">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-3">
        <p className="text-6xl font-black text-white/10 uppercase tracking-widest">
          Arena {arenaNumber}
        </p>
        <p className="text-xl text-white/30 font-medium">Not signed in</p>
        <p className="text-sm text-white/20">Open this screen while logged into the admin app.</p>
      </div>
    );
  }

  if (tournament === undefined || matches === null) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-white/30 text-lg font-medium animate-pulse">Loading…</p>
      </div>
    );
  }

  if (!runningMatch) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
        <p className="text-6xl font-black text-white/10 uppercase tracking-widest">
          Arena {arenaNumber}
        </p>
        <p className="text-xl text-white/30 font-medium">No match in progress</p>
      </div>
    );
  }

  // ── Active match ──────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-gray-950 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-center py-4 bg-gray-900 border-b border-white/5">
        <p className="text-xs font-bold uppercase tracking-[0.4em] text-white/40">
          Arena {arenaNumber}
          {tournament && (
            <span className="text-white/20 mx-3">·</span>
          )}
          {tournament?.name && (
            <span className="text-white/40">{tournament.name}</span>
          )}
        </p>
      </div>

      {/* Split screen */}
      <div className="flex flex-1">
        <CornerPanel corner="red"  competitor={redComp} />
        <CornerPanel corner="blue" competitor={blueComp} />
      </div>

      {/* Match number footer */}
      <div className="flex items-center justify-center py-3 bg-gray-900 border-t border-white/5">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/20">
          Match #{runningMatch.order}
        </p>
      </div>
    </div>
  );
}
