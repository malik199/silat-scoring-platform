"use client";

import {
  collection, getDocs, doc, updateDoc, query, where,
  getCountFromServer, orderBy,
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

export async function setUserSuperAdmin(uid: string, isSuperAdmin: boolean): Promise<void> {
  await updateDoc(doc(db, "users", uid), { isSuperAdmin });
}
