import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function initAdmin() {
  if (getApps().length > 0) return;

  const serviceAccount = process.env.ADMIN_SERVICE_ACCOUNT_KEY;
  if (serviceAccount) {
    // Local dev: explicit service account JSON from .env.local
    initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
  } else {
    // Firebase App Hosting: use Application Default Credentials automatically
    initializeApp();
  }
}

export function adminAuth() {
  initAdmin();
  return getAuth();
}

export function adminDb() {
  initAdmin();
  return getFirestore();
}
