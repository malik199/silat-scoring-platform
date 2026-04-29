"use client";

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
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
  roundDurationSeconds: 90 | 120;
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
  createdAt: string;
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
  roundDurationSeconds: 90 | 120;
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

export async function startMatch(id: string): Promise<void> {
  await updateDoc(doc(db, COL, id), { status: "in_progress" });
}

export async function endMatch(id: string): Promise<void> {
  await updateDoc(doc(db, COL, id), { status: "completed" });
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
export function computeConfirmedScores(events: ScoreEvent[]): { red: number; blue: number; confirmedEventIds: Set<string> } {
  const sorted = [...events].sort((a, b) => getEventSeconds(a) - getEventSeconds(b));
  const used = new Set<string>();
  const confirmedEventIds = new Set<string>();
  let red = 0, blue = 0;

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
          if (side === "red") red += pts; else blue += pts;
          // Mark only the one-per-judge events as used; later taps from the
          // same judges remain available for the next confirmation.
          for (const e of onePerJudge) { used.add(e.id); confirmedEventIds.add(e.id); }
        } else {
          used.add(anchor.id);
        }
      }
    }
  }

  return { red, blue, confirmedEventIds };
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
  createdAt: { seconds: number } | null;
}

export async function addAdminEvent(
  matchId: string,
  side: "red" | "blue",
  points: number
): Promise<void> {
  await addDoc(collection(db, COL, matchId, "adminEvents"), {
    side,
    points,
    createdAt: serverTimestamp(),
  });
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
  { type: "poor_form",     label: "Poor Form",       icon: "🥋" },
  { type: "avoiding",      label: "Avoiding",        icon: "🏃" },
  { type: "out_of_bounds", label: "Out of Bounds",   icon: "🦶" },
  { type: "wrong_target",  label: "Wrong Target",    icon: "🎯" },
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
