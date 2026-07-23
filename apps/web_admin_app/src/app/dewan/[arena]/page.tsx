"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/context/AuthContext";
import { subscribeActiveTournament, type Tournament } from "@/lib/tournaments";
import { subscribeCompetitors, type Competitor } from "@/lib/competitors";
import {
  subscribeActiveMatch,
  subscribeScoreEvents,
  subscribeAdminEvents,
  subscribeVerificationResponses,
  subscribeSeriousViolations,
  addAdminEvent,
  deleteAdminEvent,
  setWarning,
  setMatchFlag,
  computeConfirmedScores,
  computePenaltyFlagPoints,
  computeRemainingSeconds,
  formatTime,
  timerStart,
  timerStop,
  timerReset,
  advanceRound,
  endMatch,
  startVerification,
  clearVerification,
  SERIOUS_VIOLATION_TYPES,
  type Match,
  type ScoreEvent,
  type AdminEvent,
  type VerificationResponse,
  type SeriousViolation,
  type SeriousViolationType,
} from "@/lib/matches";

// ─── Raw per-judge tallies ────────────────────────────────────────────────────

interface JudgeTotals { red: number; blue: number; name: string; email: string; }

function rawPerJudge(events: ScoreEvent[]): {
  byJudge: Map<string, JudgeTotals>;
  judgeOrder: string[];
} {
  const byJudge = new Map<string, JudgeTotals>();
  const judgeOrder: string[] = [];
  for (const e of events) {
    if (!byJudge.has(e.judgeId)) {
      byJudge.set(e.judgeId, { red: 0, blue: 0, name: e.judgeName ?? '', email: e.judgeEmail ?? '' });
      judgeOrder.push(e.judgeId);
    }
    const t = byJudge.get(e.judgeId)!;
    if (e.side === "red") t.red += e.points;
    else t.blue += e.points;
  }
  return { byJudge, judgeOrder };
}

function adminTotals(events: AdminEvent[]): { red: number; blue: number } {
  let red = 0, blue = 0;
  for (const e of events) {
    if (e.side === "red") red += e.points;
    else blue += e.points;
  }
  return { red, blue };
}

// ─── Persistent penalty/warning indicators ────────────────────────────────────

function IndicatorRow({
  side, currentRound, warnings,
}: {
  side: "red" | "blue";
  currentRound: number;
  warnings?: Record<string, boolean>;
}) {
  const w1  = warnings?.[`r${currentRound}_${side}_w1`]  === true;
  const w2  = warnings?.[`r${currentRound}_${side}_w2`]  === true;
  const m1  = warnings?.[`r${currentRound}_${side}_m1`]  === true;
  const m2  = warnings?.[`r${currentRound}_${side}_m2`]  === true;
  const m5  = warnings?.[`r${currentRound}_${side}_m5`]  === true;
  const m10 = warnings?.[`r${currentRound}_${side}_m10`] === true;
  const dq  = warnings?.[`${side}_dq`] === true;

  const items = [
    { src: "/warning_1.svg",    active: w1,  label: "W1",  color: "warn"   },
    { src: "/warning_2.svg",    active: w2,  label: "W2",  color: "warn"   },
    { src: "/violation_1.svg",  active: m1,  label: "-1",  color: "warn"   },
    { src: "/violation_2.svg",  active: m2,  label: "-2",  color: "warn"   },
    { src: "/violation_5.svg",  active: m5,  label: "-5",  color: "danger" },
    { src: "/violation_10.svg", active: m10, label: "-10", color: "danger" },
    { src: "/violation_dq.svg", active: dq,  label: "DQ",  color: "danger" },
  ];

  if (!items.some((i) => i.active)) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {items.map(({ src, active, label, color }) =>
        active ? (
          <div
            key={label}
            className={`flex items-center justify-center rounded-lg p-1 border ${
              color === "warn"
                ? "bg-warn/20 border-warn/50"
                : "bg-danger/20 border-danger/50"
            }`}
            style={{ width: 34, height: 34 }}
            title={label}
          >
            <img
              src={src}
              alt={label}
              className="w-full h-full object-contain"
              style={{ filter: "brightness(0) invert(1)" }}
            />
          </div>
        ) : null
      )}
    </div>
  );
}

// ─── Admin action button ──────────────────────────────────────────────────────

function AdminBtn({
  label, sublabel, onClick, variant, className = "", disabled = false,
}: {
  label: string;
  sublabel?: string;
  onClick: () => void;
  variant: "red-positive" | "red-penalty" | "red-penalty-active" | "blue-positive" | "blue-penalty" | "blue-penalty-active" | "warn" | "warn-active" | "dq" | "dq-active";
  className?: string;
  disabled?: boolean;
}) {
  const styles = {
    "red-positive":        "bg-danger text-white hover:bg-danger/80",
    "red-penalty":         "bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20",
    "red-penalty-active":  "bg-danger/35 text-danger border border-danger/70 hover:bg-danger/45",
    "blue-positive":       "bg-blue-500 text-white hover:bg-blue-500/80",
    "blue-penalty":        "bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20",
    "blue-penalty-active": "bg-blue-500/35 text-blue-300 border border-blue-500/70 hover:bg-blue-500/45",
    "warn":                "bg-warn/10 text-warn border border-warn/30 hover:bg-warn/20",
    "warn-active":         "bg-warn text-black border border-warn hover:bg-warn/80",
    "dq":                  "bg-danger/10 text-danger border border-danger/40 hover:bg-danger/20",
    "dq-active":           "bg-danger text-white border border-danger hover:bg-danger/80",
  }[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center rounded-xl font-bold py-3 transition-all duration-75 active:scale-95 active:brightness-75 select-none disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100 ${styles} ${className}`}
    >
      <span className="text-2xl font-black">{label}</span>
      {sublabel && <span className="text-xs opacity-70 mt-0.5">{sublabel}</span>}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DewanPage() {
  const { arena } = useParams<{ arena: string }>();
  const arenaNumber = Number(arena);
  const { user } = useAuth();

  const [openSide, setOpenSide] = useState<"red" | "blue" | null>(null);
  const [tournament,             setTournament]             = useState<Tournament | null>(null);
  const [tournamentId,           setTournamentId]           = useState<string | null>(null);
  const [pinVisible,             setPinVisible]             = useState(false);
  const [match,                  setMatch]                  = useState<Match | null | undefined>(undefined);
  const [competitors,            setCompetitors]            = useState<Competitor[]>([]);
  const [scoreEvents,            setScoreEvents]            = useState<ScoreEvent[]>([]);
  const [adminEvents,            setAdminEvents]            = useState<AdminEvent[]>([]);
  const [remaining,              setRemaining]              = useState<number>(120);
  const [verificationResponses,  setVerificationResponses]  = useState<VerificationResponse[]>([]);
  const [seriousViolations,      setSeriousViolations]      = useState<SeriousViolation[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeActiveTournament(user.uid, (t) => {
      setTournament(t ?? null);
      setTournamentId(t?.id ?? null);
    });
  }, [user]);

  useEffect(() => {
    if (!tournamentId) { setMatch(null); return; }
    setMatch(undefined);
    return subscribeActiveMatch(tournamentId, arenaNumber, setMatch);
  }, [tournamentId, arenaNumber]);

  useEffect(() => {
    if (!match) { setScoreEvents([]); setAdminEvents([]); setSeriousViolations([]); return; }
    const unsubScore   = subscribeScoreEvents(match.id, setScoreEvents);
    const unsubAdmin   = subscribeAdminEvents(match.id, setAdminEvents);
    const unsubSerious = subscribeSeriousViolations(match.id, setSeriousViolations);
    return () => { unsubScore(); unsubAdmin(); unsubSerious(); };
  }, [match?.id]);

  // Subscribe to verification responses whenever the active verification changes
  useEffect(() => {
    const av = match?.activeVerification;
    if (!match || !av) { setVerificationResponses([]); return; }
    return subscribeVerificationResponses(match.id, av.id, setVerificationResponses);
  }, [match?.id, match?.activeVerification?.id]);


  useEffect(() => {
    if (!user) return;
    return subscribeCompetitors(user.uid, setCompetitors);
  }, [user]);

  const [jatohanVisible, setJatohanVisible] = useState<{ red: boolean; blue: boolean }>({ red: false, blue: false });
  const jatohanTimerRef = useRef<{ red: ReturnType<typeof setTimeout> | null; blue: ReturnType<typeof setTimeout> | null }>({ red: null, blue: null });

  // Auto-stop guard — reset when match or round changes
  const autoStopFiredRef = useRef(false);
  useEffect(() => { autoStopFiredRef.current = false; }, [match?.id, match?.currentRound]);

  // Tick timer display + auto-stop when round expires
  useEffect(() => {
    if (!match) return;
    setRemaining(computeRemainingSeconds(match));
    const id = setInterval(() => {
      const rem = computeRemainingSeconds(match);
      setRemaining(rem);
      if (rem <= 0 && match.timerRunning && !autoStopFiredRef.current) {
        autoStopFiredRef.current = true;
        timerStop(match.id, match.roundDurationSeconds ?? 120);
      }
    }, 100);
    return () => clearInterval(id);
  }, [match]);

  const compMap  = new Map(competitors.map((c) => [c.id, c]));
  const redComp  = match ? compMap.get(match.redCornerCompetitorId)  : undefined;
  const blueComp = match ? compMap.get(match.blueCornerCompetitorId) : undefined;

  // currentRound needed for penalty scoring — declared early to avoid TDZ
  const currentRound = match?.currentRound ?? 1;

  const { red: confirmedRed, blue: confirmedBlue, confirmedEventIds } =
    computeConfirmedScores(scoreEvents);
  // adminEvents now only carries +3 takedowns; penalties live in match.warnings
  const { red: adminRed, blue: adminBlue } = adminTotals(adminEvents.filter((e) => e.points > 0));
  const penaltyRed  = computePenaltyFlagPoints(match?.warnings, "red",  currentRound);
  const penaltyBlue = computePenaltyFlagPoints(match?.warnings, "blue", currentRound);

  const totalRed  = confirmedRed  + adminRed  + penaltyRed;
  const totalBlue = confirmedBlue + adminBlue + penaltyBlue;
  const winner    = totalRed !== totalBlue ? (totalRed > totalBlue ? "red" : "blue") : null;

  const confirmedTaps = confirmedEventIds.size;

  async function apply(side: "red" | "blue", pts: number) {
    if (!match || pts !== 3) return;
    await addAdminEvent(match.id, side, pts);
    if (jatohanTimerRef.current[side]) clearTimeout(jatohanTimerRef.current[side]!);
    setJatohanVisible((v) => ({ ...v, [side]: true }));
    jatohanTimerRef.current[side] = setTimeout(
      () => setJatohanVisible((v) => ({ ...v, [side]: false })),
      3000
    );
  }

  async function handleWarning(side: "red" | "blue", type: "w1" | "w2") {
    if (!match) return;
    const key = `r${currentRound}_${side}_${type}`;
    await setMatchFlag(match.id, key, !(match.warnings?.[key] === true));
  }

  async function handlePenalty(side: "red" | "blue", type: "m1" | "m2" | "m5" | "m10") {
    if (!match) return;
    const key = `r${currentRound}_${side}_${type}`;
    await setMatchFlag(match.id, key, !(match.warnings?.[key] === true));
  }

  async function handleDQ(side: "red" | "blue") {
    if (!match) return;
    const key = `${side}_dq`;
    await setMatchFlag(match.id, key, !(match.warnings?.[key] === true));
  }

  async function undoLast(side: "red" | "blue") {
    if (!match) return;
    // Only undoes +3 takedown events; penalties are now toggles on match.warnings
    const claimedIds = new Set(seriousViolations.map((v) => v.adminEventId));
    const last = [...adminEvents].reverse().find((e) => e.side === side && e.points > 0 && !claimedIds.has(e.id));
    if (last) await deleteAdminEvent(match.id, last.id);
  }

  const arenaPin = tournament?.arenaPins?.[String(arenaNumber)] ?? null;

  const isRunning   = match?.timerRunning ?? false;
  const dirtyTime   = match?.dirtyTime ?? false;
  const isLastRound = currentRound >= 3;

  // Penalty button active states — read from match.warnings flags
  const penaltyActive = {
    blue: {
      "-1":  match?.warnings?.[`r${currentRound}_blue_m1`]  === true,
      "-2":  match?.warnings?.[`r${currentRound}_blue_m2`]  === true,
      "-5":  match?.warnings?.[`r${currentRound}_blue_m5`]  === true,
      "-10": match?.warnings?.[`r${currentRound}_blue_m10`] === true,
      "dq":  match?.warnings?.[`blue_dq`] === true,
    },
    red: {
      "-1":  match?.warnings?.[`r${currentRound}_red_m1`]  === true,
      "-2":  match?.warnings?.[`r${currentRound}_red_m2`]  === true,
      "-5":  match?.warnings?.[`r${currentRound}_red_m5`]  === true,
      "-10": match?.warnings?.[`r${currentRound}_red_m10`] === true,
      "dq":  match?.warnings?.[`red_dq`] === true,
    },
  };
  const isExpired = remaining <= 0;

  const router = useRouter();

  const [confirmNextRound, setConfirmNextRound] = useState(false);
  const [confirmEndEarly,  setConfirmEndEarly]  = useState(false);
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [overlayCopied,    setOverlayCopied]    = useState(false);
  const [moreLinkCopied,   setMoreLinkCopied]   = useState(false);

  async function handleNextRoundConfirmed() {
    if (!match || isLastRound) return;
    await advanceRound(match.id, currentRound + 1);
    setConfirmNextRound(false);
  }

  async function handleEndMatchEarly() {
    if (!match) return;
    if (isRunning) await timerStop(match.id, (match.roundDurationSeconds ?? 120) - remaining);
    await endMatch(match.id);
    setConfirmEndEarly(false);
  }

  async function handleTimerStart() {
    if (!match || isRunning) return;
    await timerStart(match.id);
  }

  async function handleTimerStop() {
    if (!match || !isRunning) return;
    await timerStop(match.id, (match.roundDurationSeconds ?? 120) - remaining);
  }

  async function handleTimerReset() {
    if (!match) return;
    await timerReset(match.id);
  }


  return (
    <Shell
      title={`Dewan — Arena ${arenaNumber}`}
      badge={
        <div className="flex items-center gap-2">
          {match && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warn/10 border border-warn/30">
              <span className="w-1.5 h-1.5 rounded-full bg-warn animate-pulse" />
              <span className="text-xs font-semibold text-warn">Live</span>
            </div>
          )}
          {arenaPin && (
            <button
              type="button"
              onClick={() => setPinVisible((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-elevated border border-border hover:border-accent/50 transition-colors select-none"
              title={pinVisible ? "Hide PIN" : "Reveal PIN"}
            >
              <span className="text-xs text-muted">PIN</span>
              <span className="text-xs font-mono font-bold text-primary tracking-widest">
                {pinVisible ? arenaPin : "••••"}
              </span>
              <span className="text-xs text-muted">{pinVisible ? "🙈" : "👁"}</span>
            </button>
          )}
          {tournamentId && (
            <button
              type="button"
              onClick={() => {
                const url = `${window.location.origin}/obs/${tournamentId}/${arenaNumber}`;
                navigator.clipboard.writeText(url);
                setOverlayCopied(true);
                setTimeout(() => setOverlayCopied(false), 2500);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-elevated border border-border hover:border-accent/50 transition-colors select-none"
            >
              {overlayCopied
                ? <span className="text-xs font-semibold text-accent">Overlay Link Copied</span>
                : <span className="text-xs font-semibold text-muted">Video Overlay Link</span>
              }
            </button>
          )}
        </div>
      }
    >

      {match === undefined && (
        <p className="text-sm text-secondary mb-4">Loading…</p>
      )}
      {match === null && (
        <div className="flex items-center justify-between gap-4 bg-surface border border-border rounded-xl px-5 py-4 mb-4">
          <div>
            <p className="text-sm font-semibold text-primary">No match in progress</p>
            <p className="text-xs text-muted mt-0.5">To set up or start a new match, go to &ldquo;Matches&rdquo;</p>
          </div>
          <button
            onClick={() => router.push("/matches")}
            className="shrink-0 px-4 py-2 rounded-lg bg-accent text-black text-sm font-bold hover:bg-accent/80 transition-colors"
          >
            Matches
          </button>
        </div>
      )}

      {match && (<>

        {/* ── Score banner ── */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden mb-4">
          <div className="grid grid-cols-4">
            <div className={`flex flex-col items-center justify-center py-6 ${winner === "blue" ? "bg-blue-500/10" : ""}`}>
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-1">Blue</p>
              <p className="text-6xl font-black text-blue-400">{totalBlue}</p>
              {winner === "blue" && <p className="text-xs font-semibold text-blue-400 mt-1">Leading</p>}
            </div>
            <div className="col-span-2 flex flex-col items-center justify-center py-6 border-x border-border gap-3">
              {/* Round pips */}
              <div className="flex gap-2">
                {[1, 2, 3].map((r) => (
                  <div
                    key={r}
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                      r === currentRound
                        ? "border-accent bg-accent/10 text-accent"
                        : r < currentRound
                        ? "border-border text-muted line-through"
                        : "border-border text-muted"
                    }`}
                  >
                    {r}
                  </div>
                ))}
              </div>
              {/* Timer */}
              <p className={`text-5xl font-black tabular-nums tracking-tight ${isExpired ? "text-danger" : "text-primary"}`}>
                {formatTime(remaining)}
              </p>
              {/* Start / Stop / Reset */}
              <div className="flex gap-2 w-full px-6">
                <button
                  type="button"
                  onClick={handleTimerStart}
                  disabled={isRunning || isExpired}
                  className="flex-1 py-3 rounded-xl text-sm font-bold bg-accent/10 text-accent border border-accent/30 transition-all duration-75 active:scale-95 active:brightness-75 select-none disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
                >▶ Start</button>
                <button
                  type="button"
                  onClick={handleTimerStop}
                  disabled={!isRunning}
                  className="flex-1 py-3 rounded-xl text-sm font-bold bg-danger/10 text-danger border border-danger/30 transition-all duration-75 active:scale-95 active:brightness-75 select-none disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
                >■ Stop</button>
                <button
                  type="button"
                  onClick={handleTimerReset}
                  disabled={isRunning}
                  className="flex-1 py-3 rounded-xl text-sm font-bold bg-elevated text-muted border border-border transition-all duration-75 active:scale-95 active:brightness-75 select-none disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
                >↺ Reset</button>
              </div>
              {!isLastRound && !confirmNextRound && (
                <button
                  type="button"
                  onClick={() => setConfirmNextRound(true)}
                  disabled={isRunning}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-warn border border-warn/50 bg-warn/10 transition-all duration-75 active:scale-95 active:brightness-75 select-none disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
                >Next Round →</button>
              )}
              {!isLastRound && confirmNextRound && (
                <div className="flex flex-col items-center gap-2 px-4 py-3 rounded-lg border border-warn/40 bg-warn/5 w-full">
                  <p className="text-xs font-semibold text-warn text-center">Move to Round {currentRound + 1}? Cannot go back.</p>
                  <div className="flex gap-2 w-full">
                    <button
                      type="button"
                      onClick={() => setConfirmNextRound(false)}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-muted border border-border transition-all duration-75 active:scale-95 select-none"
                    >Cancel</button>
                    <button
                      type="button"
                      onClick={handleNextRoundConfirmed}
                      className="flex-1 py-1.5 rounded-lg text-xs font-bold text-warn border border-warn/50 bg-warn/10 transition-all duration-75 active:scale-95 select-none"
                    >Yes, Round {currentRound + 1}</button>
                  </div>
                </div>
              )}
              {isLastRound && (
                <p className="text-xs font-semibold text-muted">Final Round</p>
              )}
            </div>
            <div className={`flex flex-col items-center justify-center py-6 ${winner === "red" ? "bg-danger/10" : ""}`}>
              <p className="text-xs font-semibold uppercase tracking-widest text-danger mb-1">Red</p>
              <p className="text-6xl font-black text-danger">{totalRed}</p>
              {winner === "red" && <p className="text-xs font-semibold text-danger mt-1">Leading</p>}
            </div>
          </div>
        </div>

        {/* ── End match early ── */}
        <div className="flex justify-center mb-3">
          {!confirmEndEarly ? (
            <button
              type="button"
              onClick={() => setConfirmEndEarly(true)}
              className="text-xs text-muted hover:text-danger transition-colors"
            >
              End Current Match
            </button>
          ) : (
            <div className="flex items-center gap-3 px-4 py-2 rounded-lg border border-danger/30 bg-danger/5">
              <p className="text-xs text-danger font-semibold">End this match now?</p>
              <button
                type="button"
                onClick={() => setConfirmEndEarly(false)}
                className="text-xs text-muted hover:text-warn transition-colors"
              >Cancel</button>
              <button
                type="button"
                onClick={handleEndMatchEarly}
                className="text-xs font-bold text-danger hover:underline"
              >Yes, end now</button>
            </div>
          )}
        </div>

        {/* ── Admin action buttons ── */}
        {isRunning && !dirtyTime && (
          <div className="flex items-center gap-2 mb-3 px-4 py-2.5 rounded-lg bg-warn/10 border border-warn/30">
            <span className="w-1.5 h-1.5 rounded-full bg-warn animate-pulse flex-shrink-0" />
            <p className="text-xs font-semibold text-warn">Pause the timer to add takedowns or penalties.</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Blue corner */}
          <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">Blue Corner</p>
              {blueComp && (
                <>
                  <p className="text-sm font-bold text-primary truncate mt-0.5">{blueComp.firstName} {blueComp.lastName}</p>
                  <p className="text-xs text-muted truncate">{blueComp.schoolName || blueComp.country || ""}</p>
                </>
              )}
            </div>
            {jatohanVisible.blue && (
              <div className="flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-accent/10 border border-accent/30">
                <img src="/jatohan_sah.svg" alt="+3" className="w-7 h-7 object-contain" style={{ filter: "brightness(0) invert(1)" }} />
                <span className="text-sm font-bold text-accent">+3 Takedown/Sweep</span>
              </div>
            )}
            <IndicatorRow side="blue" currentRound={currentRound} warnings={match.warnings} />
            <div className="grid grid-cols-5 gap-2">
              {/* Row 1: +3 takedown */}
              <AdminBtn label="3" sublabel="Takedown / Sweep" onClick={() => apply("blue", 3)} variant="blue-positive" className="col-span-5" disabled={isRunning && !dirtyTime} />
              {/* Row 2: W1 W2 -1 -2 -5 */}
              <AdminBtn label="W1" sublabel="Warning 1" onClick={() => handleWarning("blue", "w1")} variant={match.warnings?.[`r${currentRound}_blue_w1`] ? "warn-active" : "warn"} disabled={isRunning && !dirtyTime} />
              <AdminBtn label="W2" sublabel="Warning 2" onClick={() => handleWarning("blue", "w2")} variant={match.warnings?.[`r${currentRound}_blue_w2`] ? "warn-active" : "warn"} disabled={isRunning && !dirtyTime} />
              <AdminBtn label="-1" sublabel="Penalty" onClick={() => handlePenalty("blue", "m1")} variant={penaltyActive.blue["-1"] ? "blue-penalty-active" : "blue-penalty"} disabled={isRunning && !dirtyTime} />
              <AdminBtn label="-2" sublabel="Penalty" onClick={() => handlePenalty("blue", "m2")} variant={penaltyActive.blue["-2"] ? "blue-penalty-active" : "blue-penalty"} disabled={isRunning && !dirtyTime} />
              <AdminBtn label="-5" sublabel="Penalty" onClick={() => handlePenalty("blue", "m5")} variant={penaltyActive.blue["-5"] ? "blue-penalty-active" : "blue-penalty"} disabled={isRunning && !dirtyTime} />
              {/* Row 3: -10 | DQ */}
              <AdminBtn label="-10" sublabel="Penalty" onClick={() => handlePenalty("blue", "m10")} variant={penaltyActive.blue["-10"] ? "blue-penalty-active" : "blue-penalty"} className="col-span-2" disabled={isRunning && !dirtyTime} />
              <AdminBtn label="DQ" onClick={() => handleDQ("blue")} variant={penaltyActive.blue["dq"] ? "dq-active" : "dq"} className="col-span-3" disabled={isRunning && !dirtyTime} />
            </div>
            <button
              type="button"
              onClick={() => undoLast("blue")}
              disabled={(isRunning && !dirtyTime) || !adminEvents.some((e) => e.side === "blue" && e.points > 0)}
              className="w-full py-2.5 rounded-lg text-sm font-bold text-blue-400 border border-blue-400/40 bg-blue-500/5 hover:bg-blue-500/15 hover:border-blue-400/60 transition-all duration-75 active:scale-95 active:brightness-75 select-none disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              ↩ Undo Last Takedown
            </button>
          </div>

          {/* Red corner */}
          <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-danger">Red Corner</p>
              {redComp && (
                <>
                  <p className="text-sm font-bold text-primary truncate mt-0.5">{redComp.firstName} {redComp.lastName}</p>
                  <p className="text-xs text-muted truncate">{redComp.schoolName || redComp.country || ""}</p>
                </>
              )}
            </div>
            {jatohanVisible.red && (
              <div className="flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-accent/10 border border-accent/30">
                <img src="/jatohan_sah.svg" alt="+3" className="w-7 h-7 object-contain" style={{ filter: "brightness(0) invert(1)" }} />
                <span className="text-sm font-bold text-accent">+3 Takedown/Sweep</span>
              </div>
            )}
            <IndicatorRow side="red" currentRound={currentRound} warnings={match.warnings} />
            <div className="grid grid-cols-5 gap-2">
              {/* Row 1: +3 takedown */}
              <AdminBtn label="3" sublabel="Takedown / Sweep" onClick={() => apply("red", 3)} variant="red-positive" className="col-span-5" disabled={isRunning && !dirtyTime} />
              {/* Row 2: W1 W2 -1 -2 -5 */}
              <AdminBtn label="W1" sublabel="Warning 1" onClick={() => handleWarning("red", "w1")} variant={match.warnings?.[`r${currentRound}_red_w1`] ? "warn-active" : "warn"} disabled={isRunning && !dirtyTime} />
              <AdminBtn label="W2" sublabel="Warning 2" onClick={() => handleWarning("red", "w2")} variant={match.warnings?.[`r${currentRound}_red_w2`] ? "warn-active" : "warn"} disabled={isRunning && !dirtyTime} />
              <AdminBtn label="-1" sublabel="Penalty" onClick={() => handlePenalty("red", "m1")} variant={penaltyActive.red["-1"] ? "red-penalty-active" : "red-penalty"} disabled={isRunning && !dirtyTime} />
              <AdminBtn label="-2" sublabel="Penalty" onClick={() => handlePenalty("red", "m2")} variant={penaltyActive.red["-2"] ? "red-penalty-active" : "red-penalty"} disabled={isRunning && !dirtyTime} />
              <AdminBtn label="-5" sublabel="Penalty" onClick={() => handlePenalty("red", "m5")} variant={penaltyActive.red["-5"] ? "red-penalty-active" : "red-penalty"} disabled={isRunning && !dirtyTime} />
              {/* Row 3: -10 | DQ */}
              <AdminBtn label="-10" sublabel="Penalty" onClick={() => handlePenalty("red", "m10")} variant={penaltyActive.red["-10"] ? "red-penalty-active" : "red-penalty"} className="col-span-2" disabled={isRunning && !dirtyTime} />
              <AdminBtn label="DQ" onClick={() => handleDQ("red")} variant={penaltyActive.red["dq"] ? "dq-active" : "dq"} className="col-span-3" disabled={isRunning && !dirtyTime} />
            </div>
            <button
              type="button"
              onClick={() => undoLast("red")}
              disabled={(isRunning && !dirtyTime) || !adminEvents.some((e) => e.side === "red" && e.points > 0)}
              className="w-full py-2.5 rounded-lg text-sm font-bold text-danger border border-danger/40 bg-danger/5 hover:bg-danger/15 hover:border-danger/60 transition-all duration-75 active:scale-95 active:brightness-75 select-none disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              ↩ Undo Last Takedown
            </button>
          </div>
        </div>

        {/* ── Verification — accordion ── */}
        {(() => {
          const av = match.activeVerification;
          const timerPaused = !isRunning;
          const hasResponses = verificationResponses.length > 0;
          const verdictLabel = (v: string) =>
            v === "red" ? "Valid for Red" : v === "blue" ? "Valid for Blue" : "Invalid";
          const verdictColor = (v: string) =>
            v === "red" ? "text-danger" : v === "blue" ? "text-blue-400" : "text-muted";

          return (
            <div className={`bg-surface border rounded-xl overflow-hidden mb-4 ${av ? "border-accent/50" : "border-border"}`}>
              <div className={`flex items-center justify-between px-5 py-3 ${av ? "bg-accent/5" : ""}`}>
                <button
                  type="button"
                  onClick={() => setVerificationOpen((o) => !o)}
                  className="flex items-center gap-2 flex-1 hover:opacity-80 transition-opacity text-left"
                >
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted">Verification</p>
                  {av && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                      <span className="text-xs font-bold text-accent">
                        {av.type === "drop_takedown" ? "Drop/Takedown" : "Protest"} — {verificationResponses.length}/3 responses
                      </span>
                    </div>
                  )}
                </button>
                <div className="flex items-center gap-2">
                  {av && (
                    <button
                      type="button"
                      onClick={() => match && clearVerification(match.id)}
                      className="px-3 py-1 rounded-lg border border-danger/40 text-danger text-xs font-bold hover:bg-danger/10 transition-colors"
                    >
                      Cancel ✕
                    </button>
                  )}
                  <span className="text-muted text-xs">{verificationOpen ? "▲" : "▼"}</span>
                </div>
              </div>
              {verificationOpen && (
                <>
                  <div className="border-t border-border" />
                  <div className="p-4 space-y-4">
                    {/* Trigger buttons — disabled when timer is running or verification already active */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        disabled={!timerPaused || (av?.type === "drop_takedown")}
                        onClick={() => match && startVerification(match.id, "drop_takedown")}
                        className={`flex flex-col items-center justify-center gap-1.5 py-5 rounded-xl font-bold text-sm border transition-all duration-75 active:scale-95 select-none disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 ${
                          av?.type === "drop_takedown"
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-border bg-elevated text-secondary hover:text-primary hover:border-accent/50 hover:bg-accent/5"
                        }`}
                      >
                        <span className="text-2xl">👇</span>
                        {av?.type === "drop_takedown" ? "In Progress…" : "Drop / Takedown Verification"}
                      </button>
                      <button
                        type="button"
                        disabled={!timerPaused || (av?.type === "protest")}
                        onClick={() => match && startVerification(match.id, "protest")}
                        className={`flex flex-col items-center justify-center gap-1.5 py-5 rounded-xl font-bold text-sm border transition-all duration-75 active:scale-95 select-none disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 ${
                          av?.type === "protest"
                            ? "border-warn bg-warn/10 text-warn"
                            : "border-border bg-elevated text-secondary hover:text-primary hover:border-warn/50 hover:bg-warn/5"
                        }`}
                      >
                        <span className="text-2xl">✋</span>
                        {av?.type === "protest" ? "In Progress…" : "Protest Verification"}
                      </button>
                    </div>

                    {/* Live responses */}
                    {av && (
                      <div className="bg-elevated border border-border rounded-xl overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                            Judge Responses — {av.type === "drop_takedown" ? "Drop/Takedown" : "Protest"}
                          </p>
                          <button
                            type="button"
                            onClick={() => match && clearVerification(match.id)}
                            className="text-xs font-semibold text-muted hover:text-danger transition-colors"
                          >
                            Close ✕
                          </button>
                        </div>
                        {verificationResponses.length === 0 ? (
                          <p className="px-4 py-4 text-sm text-muted">Waiting for judges to respond…</p>
                        ) : (
                          <ul className="divide-y divide-border">
                            {verificationResponses.map((r) => (
                              <li key={r.id} className="flex items-center justify-between px-4 py-3">
                                <span className="text-sm font-medium text-primary">
                                  {r.judgeName || r.judgeId}
                                </span>
                                <span className={`text-sm font-bold ${verdictColor(r.verdict)}`}>
                                  {av.type === "drop_takedown" ? "Drop " : "Protest "}
                                  {verdictLabel(r.verdict)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="px-4 py-3 border-t border-border bg-surface/50 flex items-center justify-between gap-3">
                          <p className="text-xs text-muted">
                            {verificationResponses.length >= 3
                              ? "All judges responded. Apply points then close."
                              : `${verificationResponses.length}/3 judges responded.`}
                          </p>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => match && clearVerification(match.id)}
                              className="px-4 py-2 rounded-lg border border-danger/40 text-danger text-xs font-bold hover:bg-danger/10 transition-colors"
                            >
                              Cancel Verification
                            </button>
                            {verificationResponses.length >= 3 && (
                              <button
                                type="button"
                                onClick={() => match && clearVerification(match.id)}
                                className="px-4 py-2 rounded-lg bg-accent text-black text-xs font-bold hover:bg-accent-hover transition-colors"
                              >
                                ✓ Approve &amp; Close
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* ── More Dewan Functions ── */}
        <div className="flex items-center gap-3 mt-2">
          <button
            type="button"
            onClick={() => router.push(`/dewan/${arenaNumber}/more`)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-elevated border border-border text-sm font-semibold text-secondary hover:text-primary hover:border-accent/50 transition-colors"
          >
            More Dewan Functions →
          </button>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/dewan/${arenaNumber}/more`);
              setMoreLinkCopied(true);
              setTimeout(() => setMoreLinkCopied(false), 2500);
            }}
            className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-elevated border border-border text-sm font-semibold text-secondary hover:text-primary hover:border-accent/50 transition-colors whitespace-nowrap"
          >
            {moreLinkCopied ? <span className="text-accent">Link Copied ✓</span> : "Copy Link"}
          </button>
        </div>

      </>)}
    </Shell>
  );
}
