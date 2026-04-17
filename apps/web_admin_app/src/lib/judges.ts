"use client";

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  writeBatch,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";

// ─── Types ───────────────────────────────────────────────────────────────────

export type JudgeExperience = "beginner" | "intermediate" | "advanced";

export const JUDGE_EXPERIENCE_LABELS: Record<JudgeExperience, string> = {
  beginner:     "Beginner",
  intermediate: "Intermediate",
  advanced:     "Advanced",
};

export interface Judge {
  id: string;
  firstName: string;
  lastName: string;
  /** Email used to log in to the Flutter scoring app */
  email: string;
  experience: JudgeExperience;
  /** True while the judge has the Flutter app open and is logged in */
  isOnline?: boolean;
  createdAt: string;
}

export type JudgeInput = Omit<Judge, "id" | "createdAt">;

/** Maximum judges per arena (standard Pencak Silat: 3) */
export const MAX_JUDGES_PER_ARENA = 3;

// ─── Firestore ────────────────────────────────────────────────────────────────

const COL = "judges";

export function subscribeActiveJudges(cb: (judges: Judge[]) => void): Unsubscribe {
  const q = query(collection(db, COL), where("isOnline", "==", true));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Judge, "id">) }))),
    () => cb([])
  );
}

export function subscribeJudges(cb: (judges: Judge[]) => void): Unsubscribe {
  const q = query(collection(db, COL), orderBy("lastName", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Judge, "id">) })));
    },
    () => cb([])
  );
}

export async function addJudge(input: JudgeInput): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...input,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateJudge(id: string, input: JudgeInput): Promise<void> {
  await updateDoc(doc(db, COL, id), { ...input, updatedAt: serverTimestamp() });
}

export async function bulkAddJudges(inputs: JudgeInput[]): Promise<void> {
  const CHUNK = 500;
  for (let i = 0; i < inputs.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const input of inputs.slice(i, i + CHUNK)) {
      batch.set(doc(collection(db, COL)), { ...input, createdAt: serverTimestamp() });
    }
    await batch.commit();
  }
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

export interface JudgeCsvParseResult {
  valid: JudgeInput[];
  errors: { row: number; message: string }[];
}

const VALID_EXPERIENCE = new Set<string>(["beginner", "intermediate", "advanced"]);

export function parseJudgeCsv(text: string): JudgeCsvParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) {
    return { valid: [], errors: [{ row: 0, message: "CSV has no data rows." }] };
  }

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  if (!headers.includes("first_name") || !headers.includes("last_name") || !headers.includes("email")) {
    return {
      valid: [],
      errors: [{ row: 0, message: "CSV must have at least first_name, last_name and email columns." }],
    };
  }

  const idx = (h: string) => headers.indexOf(h);
  const valid: JudgeInput[] = [];
  const errors: { row: number; message: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map((c) => c.trim());
    const row = i + 1;

    const firstName  = cells[idx("first_name")]  ?? "";
    const lastName   = cells[idx("last_name")]   ?? "";
    const email      = cells[idx("email")]?.toLowerCase() ?? "";
    const expRaw     = (headers.includes("experience") ? cells[idx("experience")] ?? "" : "").toLowerCase();

    if (!firstName) { errors.push({ row, message: "Missing first_name" }); continue; }
    if (!lastName)  { errors.push({ row, message: "Missing last_name" });  continue; }
    if (!email)     { errors.push({ row, message: "Missing email" });       continue; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ row, message: `Invalid email "${email}"` }); continue;
    }

    if (/[0-9]/.test(firstName)) { errors.push({ row, message: `first_name "${firstName}" must not contain numbers` }); continue; }
    if (/[0-9]/.test(lastName))  { errors.push({ row, message: `last_name "${lastName}" must not contain numbers` });  continue; }

    let experience: JudgeExperience = "beginner";
    if (expRaw && !VALID_EXPERIENCE.has(expRaw)) {
      errors.push({ row, message: `Invalid experience "${expRaw}" — must be beginner, intermediate, or advanced (or leave blank)` });
      continue;
    }
    if (expRaw) experience = expRaw as JudgeExperience;

    valid.push({ firstName, lastName, email, experience });
  }

  return { valid, errors };
}
