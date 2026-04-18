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
  createdAt: string;
}

export interface CreateMatchInput {
  tournamentId: string;
  tournamentName: string;
  arenaNumber: number;
  redCornerCompetitorId: string;
  blueCornerCompetitorId: string;
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

// ─── Score events ─────────────────────────────────────────────────────────────

function getEventSeconds(e: ScoreEvent): number {
  if (!e.createdAt) return 0;
  return typeof e.createdAt === "object" && "seconds" in e.createdAt
    ? (e.createdAt as { seconds: number }).seconds
    : 0;
}

/** Confirmed score using the ≥2-judges-within-5s rule. */
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
        const inWindow = pool.filter((e) => !used.has(e.id) && getEventSeconds(e) - anchorTime <= 5);
        const judgesInWindow = new Set(inWindow.map((e) => e.judgeId));
        if (judgesInWindow.size >= 2) {
          if (side === "red") red += pts; else blue += pts;
          for (const e of inWindow) { used.add(e.id); confirmedEventIds.add(e.id); }
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
