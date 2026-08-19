"use client";

import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import type { TierId } from "./tiers";

const BOOTSTRAP_SUPER_ADMIN_EMAIL = "visdevelopllc@gmail.com";

export interface UserProfile {
  uid:          string;
  email:        string;
  displayName:  string;
  tier:         TierId;
  isSuperAdmin: boolean;
  createdAt:    unknown;
}

/** Called immediately after a new Firebase Auth account is created. */
export async function createUserProfile(uid: string, email: string, displayName = ""): Promise<void> {
  await setDoc(doc(db, "users", uid), {
    uid,
    email,
    displayName,
    tier:         "free" satisfies TierId,
    isSuperAdmin: email === BOOTSTRAP_SUPER_ADMIN_EMAIL,
    createdAt:    serverTimestamp(),
  });
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

/** Creates a profile only if one doesn't already exist — safe to call on every social sign-in. */
export async function ensureUserProfile(uid: string, email: string, displayName = ""): Promise<void> {
  const existing = await getUserProfile(uid);
  if (!existing) {
    await createUserProfile(uid, email, displayName);
  } else {
    // Always ensure the bootstrap super admin is marked, even on old profiles
    if (email === BOOTSTRAP_SUPER_ADMIN_EMAIL && !existing.isSuperAdmin) {
      await updateDoc(doc(db, "users", uid), { isSuperAdmin: true });
    }
    // Sync displayName if it changed
    if (displayName && displayName !== existing.displayName) {
      await updateDoc(doc(db, "users", uid), { displayName });
    }
  }
}
