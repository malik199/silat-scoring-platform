import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function initAdmin() {
  if (getApps().length > 0) return;

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccount) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.");
  }

  initializeApp({
    credential: cert(JSON.parse(serviceAccount)),
  });
}

export function adminAuth() {
  initAdmin();
  return getAuth();
}

export function adminDb() {
  initAdmin();
  return getFirestore();
}
