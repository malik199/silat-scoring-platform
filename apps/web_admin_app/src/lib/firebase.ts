"use client";

import { initializeApp, getApps } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

console.log('=== Firebase projectId:', firebaseConfig.projectId);
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db   = getFirestore(app);

if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true") {
  const authEmulatorUrl =
    process.env.NEXT_PUBLIC_AUTH_EMULATOR_URL ?? "http://127.0.0.1:9099";

  try {
    connectAuthEmulator(auth, authEmulatorUrl, { disableWarnings: false });
  } catch {
    // Already connected — safe to ignore on hot reload
  }

  try {
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
  } catch {
    // Already connected — safe to ignore on hot reload
  }
}
