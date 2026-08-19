"use client";

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  writeBatch,
  onSnapshot,
  orderBy,
  query,
  where,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";

// ─── Types ───────────────────────────────────────────────────────────────────

export type MatchStatus = "pending" | "in_progress" | "completed" | "cancelled";

export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  pending:     "Pending",
  in_progress: "In Progress",
  completed:   "Completed",
  cancelled:   "Cancelled",
};

export const MATCH_STATUS_COLOR: Record<MatchStatus, string> = {
  pending:     "bg-elevated text-secondary border-border",
  in_progress: "bg-warn/10 text-warn border-warn/30",
  completed:   "bg-accent/10 text-accent border-accent/30",
  cancelled:   "bg-danger/10 text-danger border-danger/30",
};

export interface ActiveVerification {
  /** Unique ID for this verification session — changes each time a new one is started */
  id: string;
  type: "drop_takedown" | "protest";
}

export interface Match {
  id: string;
  tournamentId: string;
  tournamentName: string;
  arenaNumber: number;
  redCornerCompetitorId: string;
  blueCornerCompetitorId: string;
  status: MatchStatus;
  /** 1-based position within the tournament — determines display order */
  order: number;
  /** Duration of each round in seconds — either 90 (1:30) or 120 (2:00) */
  roundDurationSeconds: 60 | 90 | 120;
  /** Current round number (1–3) */
  currentRound: number;
  /** Whether the timer is currently counting down */
  timerRunning: boolean;
  /** Server timestamp of the last timer start */
  timerStartedAt: { seconds: number } | null;
  /** Seconds already elapsed before the last start */
  timerElapsedSeconds: number;
  /** Set when Dewan requests a drop/takedown or protest verification from judges */
  activeVerification: ActiveVerification | null;
  /** When true, dewan can add scores while the timer is running */
  dirtyTime: boolean;
  createdAt: string;
  /** Stored when match completes — null/undefined for old matches or draws */
  winnerCorner?: "red" | "blue" | "draw" | null;
  /** Keyed as `r{round}_{side}_w1` / `r{round}_{side}_w2` */
  warnings?: Record<string, boolean>;
  /** Dewan-assigned judge seats: key is "1" | "2" | "3" */
  judgeSeats?: Record<string, { uid: string; name: string; email: string }>;
  /** UIDs of judges the dewan has logged out — their taps are excluded from scoring */
  disabledJudges?: string[];
}

export interface JudgePresence {
  uid: string;
  name: string;
  email: string;
  connectedAt: { seconds: number } | string;
}

// ─── Timer helpers ────────────────────────────────────────────────────────────

/** Compute remaining seconds for the current round. Safe to call in a render loop. */
export function computeRemainingSeconds(match: Match): number {
  const duration = match.roundDurationSeconds ?? 120;
  const base     = match.timerElapsedSeconds ?? 0;
  const extra    = match.timerRunning && match.timerStartedAt
    ? Date.now() / 1000 - match.timerStartedAt.seconds
    : 0;
  return Math.max(0, duration - (base + extra));
}

export function formatTime(totalSeconds: number): string {
  const s = Math.floor(totalSeconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export interface CreateMatchInput {
  tournamentId: string;
  tournamentName: string;
  arenaNumber: number;
  redCornerCompetitorId: string;
  blueCornerCompetitorId: string;
  roundDurationSeconds: 60 | 90 | 120;
  dirtyTime: boolean;
  /** Pass current match count so order = count + 1 */
  currentCount: number;
}

// ─── Firestore ────────────────────────────────────────────────────────────────

const COL = "matches";

export function subscribeMatches(
  tournamentId: string,
  cb: (matches: Match[]) => void
): Unsubscribe {
  // Query only by tournamentId; sort by order client-side to avoid composite index requirement
  const q = query(collection(db, COL), where("tournamentId", "==", tournamentId));
  return onSnapshot(
    q,
    (snap) => {
      const matches = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Match, "id">) }))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      cb(matches);
    },
    () => cb([])
  );
}

export async function createMatch(input: CreateMatchInput): Promise<string> {
  const { currentCount, ...rest } = input;
  const ref = await addDoc(collection(db, COL), {
    ...rest,
    order: currentCount + 1,
    status: "pending",
    currentRound: 1,
    timerRunning: false,
    timerStartedAt: null,
    timerElapsedSeconds: 0,
    dirtyTime: rest.dirtyTime,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteMatch(id: string, remaining: Match[]): Promise<void> {
  const batch = writeBatch(db);
  // Delete the target match
  batch.delete(doc(db, COL, id));
  // Close the gap: renumber all others in order
  remaining
    .filter((m) => m.id !== id)
    .sort((a, b) => a.order - b.order)
    .forEach((m, i) => {
      if (m.order !== i + 1) {
        batch.update(doc(db, COL, m.id), { order: i + 1 });
      }
    });
  await batch.commit();
}

export async function swapMatchOrder(
  id1: string, order1: number,
  id2: string, order2: number
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, COL, id1), { order: order2 });
  batch.update(doc(db, COL, id2), { order: order1 });
  await batch.commit();
}

export async function swapMatchCorners(id: string, redId: string, blueId: string): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    redCornerCompetitorId: blueId,
    blueCornerCompetitorId: redId,
  });
}

export async function reorderMatches(updates: { id: string; order: number }[]): Promise<void> {
  const batch = writeBatch(db);
  for (const { id, order } of updates) {
    batch.update(doc(db, COL, id), { order });
  }
  await batch.commit();
}

export async function startMatch(id: string): Promise<void> {
  await updateDoc(doc(db, COL, id), { status: "in_progress" });
}

export async function endMatch(id: string, redWeightKg?: number, blueWeightKg?: number): Promise<void> {
  const [eventsSnap, adminSnap, matchSnap] = await Promise.all([
    getDocs(collection(db, COL, id, "scoreEvents")),
    getDocs(collection(db, COL, id, "adminEvents")),
    getDoc(doc(db, COL, id)),
  ]);
  const events: ScoreEvent[] = eventsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ScoreEvent, "id">) }));
  const { red, blue, redCounts, blueCounts } = computeConfirmedScores(events);

  let winnerCorner: "red" | "blue" | "draw";
  if (red !== blue) {
    winnerCorner = red > blue ? "red" : "blue";
  } else {
    const adminData = adminSnap.docs.map((d) => d.data() as { side: string; points: number });
    const redThreePt  = adminData.filter((e) => e.side === "red"  && e.points === 3).length;
    const blueThreePt = adminData.filter((e) => e.side === "blue" && e.points === 3).length;
    const matchData   = matchSnap.data() as Match | undefined;
    const tb = computeTiebreaker({ redThreePt, blueThreePt, redCounts, blueCounts, warnings: matchData?.warnings, redWeightKg, blueWeightKg });
    winnerCorner = tb.winner === "lots" ? "draw" : tb.winner;
  }
  await updateDoc(doc(db, COL, id), { status: "completed", winnerCorner });
}

// ─── Timer controls ───────────────────────────────────────────────────────────

export async function timerStart(id: string): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    timerRunning:    true,
    timerStartedAt:  serverTimestamp(),
  });
}

export async function timerStop(id: string, elapsedSeconds: number): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    timerRunning:         false,
    timerStartedAt:       null,
    timerElapsedSeconds:  elapsedSeconds,
  });
}

export async function timerReset(id: string): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    timerRunning:        false,
    timerStartedAt:      null,
    timerElapsedSeconds: 0,
  });
}

export async function advanceRound(id: string, nextRound: number): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    currentRound:        nextRound,
    timerRunning:        false,
    timerStartedAt:      null,
    timerElapsedSeconds: 0,
  });
}

// ─── Score events ─────────────────────────────────────────────────────────────

function getEventSeconds(e: ScoreEvent): number {
  if (!e.createdAt) return 0;
  return typeof e.createdAt === "object" && "seconds" in e.createdAt
    ? (e.createdAt as { seconds: number }).seconds
    : 0;
}

/** Confirmed score using the ≥2-judges-within-5s rule.
 *
 *  Key detail: only the FIRST tap per judge within the 5-second window counts
 *  toward a single confirmation. This means a second round of taps from the
 *  same judges (even within 5s) produces a separate confirmation rather than
 *  being absorbed into the first one and lost.
 */
export function computeConfirmedScores(
  events: ScoreEvent[],
  disabledJudgeIds?: Set<string>
): {
  red: number; blue: number; confirmedEventIds: Set<string>;
  redCounts: Record<number, number>; blueCounts: Record<number, number>;
} {
  const activeEvents = disabledJudgeIds?.size
    ? events.filter((e) => !disabledJudgeIds.has(e.judgeId))
    : events;
  const sorted = [...activeEvents].sort((a, b) => getEventSeconds(a) - getEventSeconds(b));
  const used = new Set<string>();
  const confirmedEventIds = new Set<string>();
  let red = 0, blue = 0;
  const redCounts: Record<number, number> = {};
  const blueCounts: Record<number, number> = {};

  for (const side of ["red", "blue"] as const) {
    for (const pts of [1, 2]) {
      const pool = sorted.filter((e) => e.side === side && e.points === pts);
      for (const anchor of pool) {
        if (used.has(anchor.id)) continue;
        const anchorTime = getEventSeconds(anchor);

        // All unused events within 5s of the anchor
        const inWindow = pool.filter((e) => !used.has(e.id) && getEventSeconds(e) - anchorTime <= 5);

        // Only the first tap per judge — prevents a second round of taps
        // from being swallowed into the same confirmation window.
        const seenJudges = new Set<string>();
        const onePerJudge = inWindow.filter((e) => {
          if (seenJudges.has(e.judgeId)) return false;
          seenJudges.add(e.judgeId);
          return true;
        });

        if (onePerJudge.length >= 2) {
          if (side === "red") { red += pts; redCounts[pts] = (redCounts[pts] ?? 0) + 1; }
          else                { blue += pts; blueCounts[pts] = (blueCounts[pts] ?? 0) + 1; }
          // Mark only the one-per-judge events as used; later taps from the
          // same judges remain available for the next confirmation.
          for (const e of onePerJudge) { used.add(e.id); confirmedEventIds.add(e.id); }
        } else {
          used.add(anchor.id);
        }
      }
    }
  }

  return { red, blue, confirmedEventIds, redCounts, blueCounts };
}

// ─── IPSF Tiebreaker (2026 Regulations) ─────────────────────────────────────

export interface TiebreakerResult {
  winner: "red" | "blue" | "lots";
  reason: "3pt" | "2pt" | "1pt" | "penalties" | "weight" | "lots";
  label: string;
}

export function computeTiebreaker({
  redThreePt, blueThreePt,
  redCounts, blueCounts,
  warnings,
  redWeightKg, blueWeightKg,
}: {
  redThreePt: number; blueThreePt: number;
  redCounts: Record<number, number>; blueCounts: Record<number, number>;
  warnings: Record<string, boolean> | undefined;
  redWeightKg?: number | null; blueWeightKg?: number | null;
}): TiebreakerResult {
  // 1. Most 3-point scores (valid falls)
  if (redThreePt !== blueThreePt)
    return { winner: redThreePt > blueThreePt ? "red" : "blue", reason: "3pt", label: "most 3-pt falls" };

  // 2. Most 2-point scores (kicks)
  const red2 = redCounts[2] ?? 0, blue2 = blueCounts[2] ?? 0;
  if (red2 !== blue2)
    return { winner: red2 > blue2 ? "red" : "blue", reason: "2pt", label: "most kicks" };

  // 3. Most 1-point scores (punches)
  const red1 = redCounts[1] ?? 0, blue1 = blueCounts[1] ?? 0;
  if (red1 !== blue1)
    return { winner: red1 > blue1 ? "red" : "blue", reason: "1pt", label: "most punches" };

  // 4. Fewest penalties (higher value = closer to 0 = fewer deductions)
  const redPen  = computePenaltyFlagPoints(warnings, "red",  3);
  const bluePen = computePenaltyFlagPoints(warnings, "blue", 3);
  if (redPen !== bluePen)
    return { winner: redPen > bluePen ? "red" : "blue", reason: "penalties", label: "fewest penalties" };

  // 5. Lighter weight
  if (redWeightKg != null && blueWeightKg != null && redWeightKg !== blueWeightKg)
    return { winner: redWeightKg < blueWeightKg ? "red" : "blue", reason: "weight", label: "lighter weight" };

  // 6. Drawing of lots
  return { winner: "lots", reason: "lots", label: "draw lots" };
}

export interface ScoreEvent {
  id: string;
  judgeId: string;
  judgeName?: string;
  judgeEmail?: string;
  side: "red" | "blue";
  points: number;
  createdAt: { seconds: number } | null;
}

export function subscribeScoreEvents(
  matchId: string,
  cb: (events: ScoreEvent[]) => void
): Unsubscribe {
  const q = query(
    collection(db, COL, matchId, "scoreEvents"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ScoreEvent, "id">) }))),
    () => cb([])
  );
}

// ─── Admin events (takedowns, penalties — no judge confirmation needed) ────────

export interface AdminEvent {
  id: string;
  side: "red" | "blue";
  points: number; // positive = takedown/sweep, negative = penalty
  round?: number;
  createdAt: { seconds: number } | null;
}

export async function addAdminEvent(
  matchId: string,
  side: "red" | "blue",
  points: number,
  round?: number
): Promise<void> {
  await addDoc(collection(db, COL, matchId, "adminEvents"), {
    side,
    points,
    ...(round !== undefined ? { round } : {}),
    createdAt: serverTimestamp(),
  });
}

export async function setWarning(
  matchId: string,
  side: "red" | "blue",
  warningType: "w1" | "w2",
  round: number,
  active: boolean
): Promise<void> {
  const key = `r${round}_${side}_${warningType}`;
  await updateDoc(doc(db, COL, matchId), { [`warnings.${key}`]: active });
}

/** Toggle any flag in match.warnings by its full key. */
export async function setMatchFlag(matchId: string, key: string, active: boolean): Promise<void> {
  await updateDoc(doc(db, COL, matchId), { [`warnings.${key}`]: active });
}

export function subscribeJudgePresence(
  matchId: string,
  cb: (judges: JudgePresence[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, COL, matchId, "judgePresence"),
    (snap) => cb(snap.docs.map((d) => d.data() as JudgePresence)),
    () => cb([])
  );
}

export async function setJudgeDisabled(
  matchId: string,
  uid: string,
  disabled: boolean
): Promise<void> {
  const { arrayUnion, arrayRemove, deleteField } = await import("firebase/firestore");
  const matchRef = doc(db, COL, matchId);

  if (disabled) {
    // Find and clear the seat for this judge
    const snap = await getDoc(matchRef);
    const seats = (snap.data() as Match | undefined)?.judgeSeats ?? {};
    const seatKey = Object.entries(seats).find(([, j]) => j.uid === uid)?.[0];
    const update: Record<string, unknown> = { disabledJudges: arrayUnion(uid) };
    if (seatKey) update[`judgeSeats.${seatKey}`] = deleteField();
    await updateDoc(matchRef, update);
    // Delete their presence so they vanish from the judge list
    await deleteDoc(doc(db, COL, matchId, "judgePresence", uid));
  } else {
    await updateDoc(matchRef, { disabledJudges: arrayRemove(uid) });
  }
}

export async function assignJudgeSeat(
  matchId: string,
  seat: "1" | "2" | "3",
  judge: { uid: string; name: string; email: string } | null
): Promise<void> {
  if (judge) {
    await updateDoc(doc(db, COL, matchId), { [`judgeSeats.${seat}`]: judge });
  } else {
    const { deleteField } = await import("firebase/firestore");
    await updateDoc(doc(db, COL, matchId), { [`judgeSeats.${seat}`]: deleteField() });
  }
}

/** Points from active per-round penalty flags, summed across rounds 1..upToRound. */
export function computePenaltyFlagPoints(
  warnings: Record<string, boolean> | undefined,
  side: "red" | "blue",
  upToRound: number
): number {
  if (!warnings) return 0;
  let total = 0;
  for (let r = 1; r <= upToRound; r++) {
    if (warnings[`r${r}_${side}_m1`]) total -= 1;
    if (warnings[`r${r}_${side}_m2`]) total -= 2;
  }
  // m5 and m10 are match-wide — applied once, persist across all rounds
  if (warnings[`${side}_m5`])  total -= 5;
  if (warnings[`${side}_m10`]) total -= 10;
  return total;
}

export async function deleteAdminEvent(matchId: string, eventId: string): Promise<void> {
  await deleteDoc(doc(db, COL, matchId, "adminEvents", eventId));
}

export function subscribeAdminEvents(
  matchId: string,
  cb: (events: AdminEvent[]) => void
): Unsubscribe {
  const q = query(
    collection(db, COL, matchId, "adminEvents"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AdminEvent, "id">) }))),
    () => cb([])
  );
}

// ─── Verification ─────────────────────────────────────────────────────────────

export async function startVerification(
  matchId: string,
  type: "drop_takedown" | "protest"
): Promise<string> {
  const id = Date.now().toString();
  await updateDoc(doc(db, COL, matchId), { activeVerification: { id, type } });
  return id;
}

export async function clearVerification(matchId: string): Promise<void> {
  await updateDoc(doc(db, COL, matchId), { activeVerification: null });
}

export interface VerificationResponse {
  id: string;
  verificationId: string;
  judgeId: string;
  judgeName: string;
  verdict: "red" | "blue" | "invalid";
  createdAt: { seconds: number } | null;
}

export async function postVerificationResponse(
  matchId: string,
  verificationId: string,
  judgeId: string,
  judgeName: string,
  verdict: "red" | "blue" | "invalid"
): Promise<void> {
  // Use judgeId as doc ID so each judge can only have one vote per verification.
  // Path: verificationResponses/{verificationId}_{judgeId}
  const { setDoc } = await import("firebase/firestore");
  await setDoc(
    doc(db, COL, matchId, "verificationResponses", `${verificationId}_${judgeId}`),
    { verificationId, judgeId, judgeName, verdict, createdAt: serverTimestamp() }
  );
}

export function subscribeVerificationResponses(
  matchId: string,
  verificationId: string,
  cb: (responses: VerificationResponse[]) => void
): Unsubscribe {
  // No `where` filter — avoids composite index requirement.
  // Filter client-side by verificationId so old responses from prior sessions are excluded.
  return onSnapshot(
    collection(db, COL, matchId, "verificationResponses"),
    (snap) => {
      const responses = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<VerificationResponse, "id">) }))
        .filter((r) => r.verificationId === verificationId);
      cb(responses);
    },
    () => cb([])
  );
}

// ─── Light violations ─────────────────────────────────────────────────────────

export const LIGHT_VIOLATION_TYPES = [
  { type: "stalling",      label: "Stalling",       icon: "⏱️" },
  { type: "poor_form",     label: "Poor Silat Form", icon: "🥋" },
  { type: "avoiding",      label: "Avoiding",        icon: "🏃" },
  { type: "out_of_bounds", label: "Out of Bounds",   icon: "🦶" },
  { type: "wrong_target",  label: "Light Illegal Strike", icon: "🎯" },
  { type: "failed_sweep",  label: "Failed Sweep",    icon: "🧹" },
  { type: "lower_stance",  label: "Ducking / Unsafe Head Positioning", icon: "🙇" },
] as const;

export type LightViolationType = typeof LIGHT_VIOLATION_TYPES[number]["type"];

export interface LightViolation {
  id: string;
  side: "red" | "blue";
  type: LightViolationType;
  round: number;
  createdAt: { seconds: number } | null;
}

export async function addLightViolation(
  matchId: string,
  side: "red" | "blue",
  type: LightViolationType,
  round: number
): Promise<void> {
  await addDoc(collection(db, COL, matchId, "lightViolations"), {
    side, type, round, createdAt: serverTimestamp(),
  });
}

export async function deleteLightViolation(matchId: string, eventId: string): Promise<void> {
  await deleteDoc(doc(db, COL, matchId, "lightViolations", eventId));
}

export function subscribeLightViolations(
  matchId: string,
  cb: (violations: LightViolation[]) => void
): Unsubscribe {
  const q = query(
    collection(db, COL, matchId, "lightViolations"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LightViolation, "id">) }))),
    () => cb([])
  );
}

// ─── Serious violations (moderate −1 pt / serious −5 pts, auto-deducted) ──────

export const SERIOUS_VIOLATION_TYPES = [
  // Moderate — −1 pt each
  { type: "grabbing_gear",           label: "Grabbing / Pulling Gear or Body",   icon: "🤏", points: -1, severity: "moderate" },
  { type: "grabbing_takedown",       label: "Grabbing During Takedown",           icon: "🤼", points: -1, severity: "moderate" },
  { type: "illegal_counter",         label: "Illegal Counter-Falling",            icon: "🔄", points: -1, severity: "moderate" },
  { type: "invalid_technique",       label: "Invalid Technique Execution",        icon: "🥋", points: -1, severity: "moderate" },
  { type: "moderate_illegal_strike", label: "Moderate Illegal Strike",            icon: "🎯", points: -1, severity: "moderate" },
  { type: "moderate_conduct",        label: "Moderate Unsportsmanlike Conduct",   icon: "😤", points: -1, severity: "moderate" },
  // Serious — −5 pts each
  { type: "hard_illegal_strike",     label: "Hard Strike to Prohibited Area",     icon: "⚡", points: -5, severity: "serious" },
  { type: "thigh_strike",            label: "Single Thigh Strike",                icon: "🦵", points: -5, severity: "serious" },
  { type: "dangerous_attack",        label: "Attack Causing Injury / High Risk",  icon: "💥", points: -5, severity: "serious" },
  { type: "dangerous_throw",         label: "Dangerous Throw / Slam",             icon: "🤼", points: -5, severity: "serious" },
  { type: "joint_attack",            label: "Dangerous / Illegal Joint Attack",   icon: "🦴", points: -5, severity: "serious" },
  { type: "serious_conduct",         label: "Serious Misconduct",                 icon: "😡", points: -5, severity: "serious" },
] as const;

export type SeriousViolationType = typeof SERIOUS_VIOLATION_TYPES[number]["type"];

export interface SeriousViolation {
  id: string;
  side: "red" | "blue";
  type: SeriousViolationType;
  round: number;
  points: number;
  /** ID of the linked adminEvent that applied the point deduction */
  adminEventId: string;
  createdAt: { seconds: number } | null;
}

export async function addSeriousViolation(
  matchId: string,
  side: "red" | "blue",
  type: SeriousViolationType,
  round: number
): Promise<void> {
  const vType = SERIOUS_VIOLATION_TYPES.find((v) => v.type === type)!;
  // Create the admin event first so we capture its ID for later undo
  const adminRef = await addDoc(collection(db, COL, matchId, "adminEvents"), {
    side,
    points: vType.points,
    createdAt: serverTimestamp(),
  });
  await addDoc(collection(db, COL, matchId, "seriousViolations"), {
    side, type, round,
    points: vType.points,
    adminEventId: adminRef.id,
    createdAt: serverTimestamp(),
  });
}

export async function deleteSeriousViolation(
  matchId: string,
  violationId: string,
  adminEventId: string
): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, COL, matchId, "seriousViolations", violationId));
  batch.delete(doc(db, COL, matchId, "adminEvents", adminEventId));
  await batch.commit();
}

export function subscribeSeriousViolations(
  matchId: string,
  cb: (violations: SeriousViolation[]) => void
): Unsubscribe {
  const q = query(
    collection(db, COL, matchId, "seriousViolations"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SeriousViolation, "id">) }))),
    () => cb([])
  );
}

export function subscribeActiveMatch(
  tournamentId: string,
  arenaNumber: number,
  cb: (match: Match | null) => void
): Unsubscribe {
  // Filter by tournamentId only; apply arenaNumber + status client-side to avoid composite index
  const q = query(collection(db, COL), where("tournamentId", "==", tournamentId));
  return onSnapshot(
    q,
    (snap) => {
      const match = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Match, "id">) }))
        .find((m) => m.arenaNumber === arenaNumber && m.status === "in_progress");
      cb(match ?? null);
    },
    () => cb(null)
  );
}
