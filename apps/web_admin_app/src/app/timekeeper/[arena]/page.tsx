"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { subscribeActiveTournament } from "@/lib/tournaments";
import { subscribeCompetitors, type Competitor } from "@/lib/competitors";
import {
  subscribeActiveMatch,
  timerStart,
  timerStop,
  timerReset,
  advanceRound,
  computeRemainingSeconds,
  formatTime,
  type Match,
} from "@/lib/matches";

const TOTAL_ROUNDS = 3;

export default function TimekeeperPage() {
  const { arena } = useParams<{ arena: string }>();
  const arenaNumber = Number(arena);
  const { user } = useAuth();

  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [match,        setMatch]        = useState<Match | null | undefined>(undefined);
  const [competitors,  setCompetitors]  = useState<Competitor[]>([]);
  const [remaining,    setRemaining]    = useState<number>(120);

  useEffect(() => {
    if (!user) return;
    return subscribeActiveTournament(user.uid, (t) => setTournamentId(t?.id ?? null));
  }, [user]);

  useEffect(() => {
    if (!tournamentId) { setMatch(null); return; }
    setMatch(undefined);
    return subscribeActiveMatch(tournamentId, arenaNumber, setMatch);
  }, [tournamentId, arenaNumber]);

  useEffect(() => {
    if (!user) return;
    return subscribeCompetitors(user.uid, setCompetitors);
  }, [user]);

  // Tick the display every 100 ms
  useEffect(() => {
    if (!match) return;
    setRemaining(computeRemainingSeconds(match));
    const id = setInterval(() => setRemaining(computeRemainingSeconds(match)), 100);
    return () => clearInterval(id);
  }, [match]);

  const compMap  = new Map(competitors.map((c) => [c.id, c]));
  const redComp  = match ? compMap.get(match.redCornerCompetitorId)  : undefined;
  const blueComp = match ? compMap.get(match.blueCornerCompetitorId) : undefined;

  const isRunning    = match?.timerRunning ?? false;
  const currentRound = match?.currentRound ?? 1;
  const isLastRound  = currentRound >= TOTAL_ROUNDS;
  const isExpired    = remaining <= 0;

  const [confirmNextRound, setConfirmNextRound] = useState(false);

  async function handleNextRoundConfirmed() {
    if (!match || isLastRound) return;
    await advanceRound(match.id, currentRound + 1);
    setConfirmNextRound(false);
  }

  async function handleStart() {
    if (!match || isRunning) return;
    await timerStart(match.id);
  }

  async function handleStop() {
    if (!match || !isRunning) return;
    await timerStop(match.id, computeRemainingSeconds(match) < 0 ? 0 : (match.roundDurationSeconds - computeRemainingSeconds(match)));
  }

  async function handleReset() {
    if (!match) return;
    await timerReset(match.id);
  }

  // Spacebar toggles start/stop
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      // Don't fire if focus is inside a button (avoids double-trigger)
      if ((e.target as HTMLElement).tagName === "BUTTON") return;
      e.preventDefault();
      if (!match || isExpired) return;
      if (isRunning) handleStop();
      else handleStart();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [match, isRunning, isExpired]);

  // Background colour shifts red when ≤ 10 s remain and timer is running
  const urgentBg = isRunning && remaining <= 10;

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-white/30 text-xl font-medium">Not signed in</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col transition-colors duration-500"
      style={{ backgroundColor: urgentBg ? "#3b0000" : "#0a0a0a" }}
    >
      {/* ── Header ── */}
      <div className="flex items-center px-10 py-4 border-b border-white/10" style={{ backgroundColor: "#111" }}>
        {/* Left: arena label */}
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/30">Timekeeper</p>
          <p className="text-xl font-bold text-white/80 mt-0.5">Arena {arenaNumber}</p>
        </div>

        {/* Centre: round pips — only shown when a match is active */}
        <div className="flex gap-5">
          {match && Array.from({ length: TOTAL_ROUNDS }, (_, i) => i + 1).map((r) => (
            <div key={r} className="flex flex-col items-center gap-1">
              <div
                className="w-11 h-11 rounded-full border-2 flex items-center justify-center text-base font-black transition-all duration-300"
                style={{
                  borderColor: r === currentRound ? "rgba(255,255,255,0.7)" : r < currentRound ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.1)",
                  background:  r === currentRound ? "rgba(255,255,255,0.12)" : "transparent",
                  color:       r === currentRound ? "rgba(255,255,255,0.9)"  : r < currentRound ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.15)",
                }}
              >
                {r < currentRound ? "✓" : r}
              </div>
              <p
                className="text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: r === currentRound ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.1)" }}
              >
                {r === currentRound ? "Now" : r < currentRound ? "Done" : ""}
              </p>
            </div>
          ))}
        </div>

        {/* Right: competitor names */}
        <div className="flex-1 flex justify-end">
          {match && (
            <div className="text-right">
              <p className="text-sm font-bold text-white/60 truncate max-w-xs">
                {redComp ? `${redComp.firstName} ${redComp.lastName}` : "Red"} vs {blueComp ? `${blueComp.firstName} ${blueComp.lastName}` : "Blue"}
              </p>
              <p className="text-xs text-white/30 mt-0.5">{match.roundDurationSeconds === 110 ? "1:50" : "2:00"} rounds</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      {match === undefined && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-white/20 text-lg animate-pulse">Loading…</p>
        </div>
      )}

      {match === null && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <p className="text-6xl font-black text-white/10">⏳</p>
          <p className="text-xl text-white/30 font-medium">No match in progress</p>
          <p className="text-sm text-white/20">Waiting for admin to start a match on Arena {arenaNumber}.</p>
        </div>
      )}

      {match && (
        <div className="flex-1 flex flex-col items-center justify-center gap-10 px-8">

          {/* Timer display */}
          <div className="flex flex-col items-center gap-2">
            <p
              className="font-black tabular-nums leading-none transition-colors duration-300"
              style={{
                fontSize: "min(35vw, 40vh)",
                color: remaining <= 10 && isRunning
                  ? "rgba(255,80,80,0.95)"
                  : remaining <= 30 && isRunning
                  ? "rgba(255,180,60,0.95)"
                  : "rgba(255,255,255,0.9)",
              }}
            >
              {formatTime(remaining)}
            </p>
            {isExpired && (
              <p className="text-lg font-bold uppercase tracking-widest text-red-400 animate-pulse">
                Time&apos;s up
              </p>
            )}
          </div>

          {/* Controls */}
          <div className="flex gap-5 w-full max-w-4xl px-4">
            <button
              type="button"
              onClick={handleStart}
              disabled={isRunning || isExpired}
              className="flex-1 rounded-3xl font-black transition-all duration-75 active:scale-95 select-none disabled:opacity-30 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-2"
              style={{ background: "rgba(0,200,80,0.15)", border: "3px solid rgba(0,200,80,0.5)", color: "rgba(0,220,90,0.9)", minHeight: "min(22vh, 180px)", fontSize: "min(4vw, 36px)" }}
            >
              <span style={{ fontSize: "min(6vw, 52px)" }}>▶</span>
              Start
              <span className="text-xs font-normal opacity-50">Space</span>
            </button>
            <button
              type="button"
              onClick={handleStop}
              disabled={!isRunning}
              className="flex-1 rounded-3xl font-black transition-all duration-75 active:scale-95 select-none disabled:opacity-30 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-2"
              style={{ background: "rgba(220,50,50,0.15)", border: "3px solid rgba(220,50,50,0.5)", color: "rgba(240,80,80,0.9)", minHeight: "min(22vh, 180px)", fontSize: "min(4vw, 36px)" }}
            >
              <span style={{ fontSize: "min(6vw, 52px)" }}>■</span>
              Stop
              <span className="text-xs font-normal opacity-50">Space</span>
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={isRunning}
              className="flex-1 rounded-3xl font-black transition-all duration-75 active:scale-95 select-none disabled:opacity-30 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-2"
              style={{ background: "rgba(255,255,255,0.06)", border: "3px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.5)", minHeight: "min(22vh, 180px)", fontSize: "min(4vw, 36px)" }}
            >
              <span style={{ fontSize: "min(6vw, 52px)" }}>↺</span>
              Reset
            </button>
          </div>

          {!isLastRound && !confirmNextRound && (
            <button
              type="button"
              onClick={() => setConfirmNextRound(true)}
              disabled={isRunning}
              className="px-10 py-4 rounded-2xl text-lg font-bold transition-all duration-75 active:scale-95 select-none disabled:opacity-20 disabled:cursor-not-allowed"
              style={{ background: "rgba(255,255,255,0.06)", border: "2px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.5)" }}
            >
              Next Round → Round {currentRound + 1}
            </button>
          )}

          {!isLastRound && confirmNextRound && (
            <div
              className="flex flex-col items-center gap-4 px-10 py-6 rounded-2xl"
              style={{ background: "rgba(255,255,255,0.06)", border: "2px solid rgba(255,180,0,0.4)" }}
            >
              <p className="text-base font-semibold text-white/70 text-center">
                Move to Round {currentRound + 1}? You cannot go back.
              </p>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setConfirmNextRound(false)}
                  className="px-8 py-3 rounded-xl text-base font-bold transition-all duration-75 active:scale-95 select-none"
                  style={{ background: "rgba(255,255,255,0.06)", border: "2px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.4)" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleNextRoundConfirmed}
                  className="px-8 py-3 rounded-xl text-base font-bold transition-all duration-75 active:scale-95 select-none"
                  style={{ background: "rgba(255,180,0,0.15)", border: "2px solid rgba(255,180,0,0.5)", color: "rgba(255,200,50,0.9)" }}
                >
                  Yes, Round {currentRound + 1}
                </button>
              </div>
            </div>
          )}

          {isLastRound && (
            <p
              className="text-base font-semibold uppercase tracking-widest"
              style={{ color: "rgba(255,255,255,0.2)" }}
            >
              Final Round
            </p>
          )}
        </div>
      )}
    </div>
  );
}
