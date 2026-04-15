"use client";

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
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
  arenaAssignments: Record<string, string[]>;
  createdAt: string;
  updatedAt: string;
}

const COL = "tournaments";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CreateTournamentInput {
  name: string;
  arenaCount: ArenaCount;
  organiserId: string;
}

// ─── Listeners ───────────────────────────────────────────────────────────────

export function subscribeTournaments(
  cb: (tournaments: Tournament[]) => void
): Unsubscribe {
  const q = query(collection(db, COL), orderBy("createdAt", "desc"));
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
  const ref = await addDoc(collection(db, COL), {
    name: input.name,
    arenaCount: input.arenaCount,
    arenaAssignments: buildEmptyAssignments(input.arenaCount),
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildEmptyAssignments(count: ArenaCount): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (let i = 1; i <= count; i++) result[String(i)] = [];
  return result;
}
