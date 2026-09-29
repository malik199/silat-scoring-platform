"use client";

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  increment,
  writeBatch,
  type Unsubscribe,
  type Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TournamentEntry {
  id: string;
  tournamentId: string;
  competitorId: string;
  organiserId: string;
  /** null = active; set when removed from tournament roster */
  deletedAt: Timestamp | null;
  createdAt: Timestamp;
}

const COL = "tournamentEntries";

// ─── Reads ────────────────────────────────────────────────────────────────────

/** Live subscription to all active (not soft-deleted) entries for a tournament. */
export function subscribeTournamentRoster(
  tournamentId: string,
  cb: (entries: TournamentEntry[]) => void
): Unsubscribe {
  const q = query(
    collection(db, COL),
    where("tournamentId", "==", tournamentId),
    where("deletedAt", "==", null)
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TournamentEntry, "id">) }))),
    () => cb([])
  );
}

/** Returns the active entry for a competitor in a tournament, or null if none. */
export async function getActiveEntry(
  tournamentId: string,
  competitorId: string
): Promise<TournamentEntry | null> {
  const snap = await getDocs(
    query(
      collection(db, COL),
      where("tournamentId", "==", tournamentId),
      where("competitorId", "==", competitorId),
      where("deletedAt", "==", null)
    )
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<TournamentEntry, "id">) };
}

// ─── Writes ──────────────────────────────────────────────────────────────────

/**
 * Add one competitor to a tournament roster.
 * Creates the entry doc and atomically increments slotsConsumed.
 * Throws if the competitor already has an active entry.
 */
export async function addToTournament(
  tournamentId: string,
  competitorId: string,
  organiserId: string
): Promise<void> {
  const existing = await getActiveEntry(tournamentId, competitorId);
  if (existing) throw new Error("already_entered");

  await addDoc(collection(db, COL), {
    tournamentId,
    competitorId,
    organiserId,
    deletedAt: null,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "tournaments", tournamentId), {
    slotsConsumed: increment(1),
  });
}

/**
 * Add multiple competitors to a tournament in one batch.
 * Skips any that already have an active entry (no throw, no double-count).
 */
export async function bulkAddToTournament(
  tournamentId: string,
  competitorIds: string[],
  organiserId: string
): Promise<void> {
  if (competitorIds.length === 0) return;

  // Filter out already-entered competitors
  const existing = await getDocs(
    query(
      collection(db, COL),
      where("tournamentId", "==", tournamentId),
      where("deletedAt", "==", null)
    )
  );
  const enteredIds = new Set(existing.docs.map((d) => d.data().competitorId as string));
  const toAdd = competitorIds.filter((id) => !enteredIds.has(id));
  if (toAdd.length === 0) return;

  const CHUNK = 490; // Firestore batch limit is 500; leave headroom
  for (let i = 0; i < toAdd.length; i += CHUNK) {
    const chunk = toAdd.slice(i, i + CHUNK);
    const batch = writeBatch(db);
    for (const competitorId of chunk) {
      batch.set(doc(collection(db, COL)), {
        tournamentId,
        competitorId,
        organiserId,
        deletedAt: null,
        createdAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }

  // One atomic increment for the whole batch
  await updateDoc(doc(db, "tournaments", tournamentId), {
    slotsConsumed: increment(toAdd.length),
  });
}

/** Soft-delete an entry — removes competitor from tournament roster without deleting them globally. */
export async function removeFromTournament(entryId: string): Promise<void> {
  await updateDoc(doc(db, COL, entryId), { deletedAt: serverTimestamp() });
}
