"use client";

import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
export type ArenaCount = 1 | 2 | 3 | 4;

export type TournamentStatus =
  | "draft"
  | "registration_open"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface Tournament {
  id: string;
  name: string;
  location: string;
  startDate: string;
  endDate: string;
  status: TournamentStatus;
  organiserId: string;
  arenaCount: ArenaCount;
  /** arena number → competitor IDs */
  arenaAssignments: Record<string, string[]>;
  /** arena number → judge IDs (max 3 per arena) */
  judgeAssignments: Record<string, string[]>;
  /** arena number → 4-digit PIN string used by the judge app */
  arenaPins: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

const COL = "tournaments";

/** Statuses that count as "active" — only one may exist per organiser at a time. */
export const ACTIVE_STATUSES: TournamentStatus[] = ["draft", "registration_open", "in_progress"];

export function isActiveTournament(t: Tournament): boolean {
  return ACTIVE_STATUSES.includes(t.status);
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CreateTournamentInput {
  name: string;
  arenaCount: ArenaCount;
  organiserId: string;
}

// ─── Listeners ───────────────────────────────────────────────────────────────

export function subscribeActiveTournament(
  organiserId: string,
  cb: (tournament: Tournament | null) => void
): Unsubscribe {
  const q = query(
    collection(db, COL),
    where("organiserId", "==", organiserId),
    where("status", "in", ACTIVE_STATUSES)
  );
  return onSnapshot(q, (snap) => {
    if (snap.empty) { cb(null); return; }
    const doc = snap.docs[0];
    cb({ id: doc.id, ...(doc.data() as Omit<Tournament, "id">) });
  }, () => cb(null));
}

export function subscribeTournaments(
  organiserId: string,
  cb: (tournaments: Tournament[]) => void
): Unsubscribe {
  const q = query(
    collection(db, COL),
    where("organiserId", "==", organiserId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    const tournaments = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Tournament, "id">),
    }));
    cb(tournaments);
  });
}

export function subscribeTournament(
  id: string,
  cb: (tournament: Tournament | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, COL, id), (snap) => {
    if (!snap.exists()) { cb(null); return; }
    cb({ id: snap.id, ...(snap.data() as Omit<Tournament, "id">) });
  });
}

// ─── Writes ──────────────────────────────────────────────────────────────────

export async function createTournament(input: CreateTournamentInput): Promise<string> {
  const takenPins = await fetchActivePins();
  const ref = await addDoc(collection(db, COL), {
    name: input.name,
    arenaCount: input.arenaCount,
    arenaAssignments: buildEmptyAssignments(input.arenaCount),
    judgeAssignments: buildEmptyAssignments(input.arenaCount),
    arenaPins: buildArenaPins(input.arenaCount, takenPins),
    status: "draft",
    organiserId: input.organiserId,
    location: "",
    startDate: "",
    endDate: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function regenerateArenaPin(
  tournamentId: string,
  arenaNumber: number
): Promise<void> {
  const takenPins = await fetchActivePins(tournamentId);
  await updateDoc(doc(db, COL, tournamentId), {
    [`arenaPins.${arenaNumber}`]: generateUniquePin(takenPins),
    updatedAt: serverTimestamp(),
  });
}

export async function archiveTournament(tournamentId: string): Promise<void> {
  await updateDoc(doc(db, COL, tournamentId), {
    status: "completed",
    updatedAt: serverTimestamp(),
  });
}

export async function updateTournamentName(
  tournamentId: string,
  name: string
): Promise<void> {
  await updateDoc(doc(db, COL, tournamentId), {
    name,
    updatedAt: serverTimestamp(),
  });
}

export async function assignCompetitorToArena(
  tournamentId: string,
  arenaNumber: number,
  competitorIds: string[]
): Promise<void> {
  await updateDoc(doc(db, COL, tournamentId), {
    [`arenaAssignments.${arenaNumber}`]: competitorIds,
    updatedAt: serverTimestamp(),
  });
}

export async function assignJudgesToArena(
  tournamentId: string,
  arenaNumber: number,
  judgeIds: string[]
): Promise<void> {
  await updateDoc(doc(db, COL, tournamentId), {
    [`judgeAssignments.${arenaNumber}`]: judgeIds,
    updatedAt: serverTimestamp(),
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildEmptyAssignments(count: ArenaCount): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (let i = 1; i <= count; i++) result[String(i)] = [];
  return result;
}

/** Fetch all PINs currently in use across active tournaments.
 *  Pass excludeTournamentId to skip the tournament being regenerated. */
async function fetchActivePins(excludeTournamentId?: string): Promise<Set<string>> {
  const snap = await getDocs(
    query(collection(db, COL), where("status", "in", ACTIVE_STATUSES))
  );
  const taken = new Set<string>();
  for (const d of snap.docs) {
    if (d.id === excludeTournamentId) continue;
    const pins = (d.data().arenaPins ?? {}) as Record<string, string>;
    Object.values(pins).forEach((p) => taken.add(p));
  }
  return taken;
}

function generateUniquePin(taken: Set<string>): string {
  let pin: string;
  do { pin = String(Math.floor(1000 + Math.random() * 9000)); } while (taken.has(pin));
  taken.add(pin); // reserve it immediately for subsequent calls in the same batch
  return pin;
}

function buildArenaPins(count: ArenaCount, taken: Set<string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 1; i <= count; i++) result[String(i)] = generateUniquePin(taken);
  return result;
}
