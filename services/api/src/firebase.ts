import * as admin from "firebase-admin";

// Initialise Firebase Admin SDK once.
// In Cloud Run, GOOGLE_APPLICATION_CREDENTIALS or workload identity is used.
// Locally, set GOOGLE_APPLICATION_CREDENTIALS to a service account key file.
if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();
export const auth = admin.auth();
