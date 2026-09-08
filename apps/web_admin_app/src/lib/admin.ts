"use client";

import {
  collection, getDocs, doc, updateDoc, deleteDoc, query, where,
  getCountFromServer, orderBy, writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import type { UserProfile } from "./users";
import type { TierId } from "./tiers";

export type { UserProfile };

export async function listAllUsers(): Promise<UserProfile[]> {
  const snap = await getDocs(query(collection(db, "users"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => d.data() as UserProfile);
}

export async function getCompetitorCount(organiserId: string): Promise<number> {
  const snap = await getCountFromServer(
    query(collection(db, "competitors"), where("organiserId", "==", organiserId))
  );
  return snap.data().count;
}

export async function getTournamentCount(organiserId: string): Promise<number> {
  const snap = await getCountFromServer(
    query(collection(db, "tournaments"), where("organiserId", "==", organiserId))
  );
  return snap.data().count;
}

export interface AdminMatchRow {
  id: string;
  redName: string;
  blueName: string;
  arenaNumber: number;
  status: string;
  order: number;
}

export interface AdminTournament {
  id: string;
  name: string;
  matches: AdminMatchRow[];
}

export async function getUserTournaments(organiserId: string): Promise<AdminTournament[]> {
  const [tourSnap, compSnap] = await Promise.all([
    getDocs(query(collection(db, "tournaments"), where("organiserId", "==", organiserId), orderBy("createdAt", "desc"))),
    getDocs(query(collection(db, "competitors"), where("organiserId", "==", organiserId))),
  ]);

  const tours = tourSnap.docs.map((d) => ({ id: d.id, name: (d.data().name as string) || "Untitled" }));
  const compMap = new Map(tourSnap.docs.length === 0 ? [] : compSnap.docs.map((d) => {
    const data = d.data() as { firstName: string; lastName: string };
    return [d.id, `${data.firstName} ${data.lastName}`] as [string, string];
  }));

  if (tours.length === 0) return [];

  const matchSnaps = await Promise.all(
    tours.map((t) => getDocs(query(collection(db, "matches"), where("tournamentId", "==", t.id))))
  );

  return tours.map((t, i) => ({
    id: t.id,
    name: t.name,
    matches: matchSnaps[i].docs
      .map((d) => {
        const data = d.data() as { redCornerCompetitorId: string; blueCornerCompetitorId: string; arenaNumber: number; status: string; order: number };
        return {
          id: d.id,
          redName: compMap.get(data.redCornerCompetitorId) ?? "Unknown",
          blueName: compMap.get(data.blueCornerCompetitorId) ?? "Unknown",
          arenaNumber: data.arenaNumber ?? 1,
          status: data.status ?? "pending",
          order: data.order ?? 0,
        };
      })
      .sort((a, b) => a.order - b.order),
  }));
}

export async function setUserTier(uid: string, tier: TierId): Promise<void> {
  await updateDoc(doc(db, "users", uid), { tier });
}

const BOOTSTRAP_SUPER_ADMIN_EMAIL = "visdevelopllc@gmail.com";

/** Deletes a user's Firestore data (profile, competitors, tournaments).
 *  Their Firebase Auth account is kept so their email is preserved. */
export async function deleteUserData(uid: string): Promise<void> {
  // Delete competitors
  const competitors = await getDocs(query(collection(db, "competitors"), where("organiserId", "==", uid)));
  if (!competitors.empty) {
    const batch = writeBatch(db);
    competitors.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  // Delete tournaments
  const tournaments = await getDocs(query(collection(db, "tournaments"), where("organiserId", "==", uid)));
  if (!tournaments.empty) {
    const batch = writeBatch(db);
    tournaments.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  // Delete user profile
  await deleteDoc(doc(db, "users", uid));
}

export async function setUserSuperAdmin(uid: string, isSuperAdmin: boolean): Promise<void> {
  // Fetch the profile to guard the bootstrap admin
  const snap = await import("firebase/firestore").then(({ getDoc }) => getDoc(doc(db, "users", uid)));
  const email = (snap.data() as { email?: string })?.email ?? "";
  if (email === BOOTSTRAP_SUPER_ADMIN_EMAIL && !isSuperAdmin) return;
  await updateDoc(doc(db, "users", uid), { isSuperAdmin });
}
