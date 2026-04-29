"use client";

import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import type { TierId } from "./tiers";

export interface UserProfile {
  uid:       string;
  email:     string;
  tier:      TierId;
  createdAt: unknown;
}

/** Called immediately after a new Firebase Auth account is created. */
export async function createUserProfile(uid: string, email: string): Promise<void> {
  await setDoc(doc(db, "users", uid), {
    uid,
    email,
    tier:      "free" satisfies TierId,
    createdAt: serverTimestamp(),
  });
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}
