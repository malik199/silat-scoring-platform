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

export interface AdminTournament {
  id: string;
  name: string;
}

export async function getUserTournaments(organiserId: string): Promise<AdminTournament[]> {
  const snap = await getDocs(
    query(collection(db, "tournaments"), where("organiserId", "==", organiserId), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, name: (d.data().name as string) || "Untitled" }));
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
