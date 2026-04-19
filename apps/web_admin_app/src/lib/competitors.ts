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

export type ExperienceLevel = "beginner" | "intermediate" | "advanced" | "pro";

export const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  beginner:     "Beginner",
  intermediate: "Intermediate",
  advanced:     "Advanced",
  pro:          "Pro",
};

export const EXPERIENCE_DESCRIPTIONS: Record<ExperienceLevel, string> = {
  beginner:     "Less than 1 year",
  intermediate: "2–3 years",
  advanced:     "4–5 years",
  pro:          "Over 5 years",
};

export interface Competitor {
  id: string;
  organiserId: string;
  firstName: string;
  lastName: string;
  /** ISO date string "YYYY-MM-DD" */
  dateOfBirth: string;
  /** Body weight in kilograms */
  weightKg: number;
  gender: "male" | "female";
  country: string;
  schoolName: string;
  experience: ExperienceLevel;
  createdAt: string;
}

export type CompetitorInput = Omit<Competitor, "id" | "createdAt">;

// ─── CSV ─────────────────────────────────────────────────────────────────────

const EXPECTED_HEADERS = [
  "first_name",
  "last_name",
  "date_of_birth",
  "weight_kg",
  "gender",
  "country",
  "school_name",
  "experience",
] as const;

/** Row data from CSV — organiserId is added by the caller before writing to Firestore */
export type CsvCompetitorRow = Omit<CompetitorInput, "organiserId">;

export interface CsvParseResult {
  valid: CsvCompetitorRow[];
  errors: { row: number; message: string }[];
}

const VALID_EXPERIENCE = new Set<string>(["beginner", "intermediate", "advanced", "pro"]);

export function parseCsv(text: string): CsvParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) {
    return { valid: [], errors: [{ row: 0, message: "CSV has no data rows." }] };
  }

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const missing = EXPECTED_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    return {
      valid: [],
      errors: [{ row: 0, message: `Missing columns: ${missing.join(", ")}` }],
    };
  }

  const idx = (h: string) => headers.indexOf(h);
  const valid: CsvCompetitorRow[] = [];
  const errors: { row: number; message: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map((c) => c.trim());
    const row = i + 1;

    const firstName  = cells[idx("first_name")]  ?? "";
    const lastName   = cells[idx("last_name")]   ?? "";
    const dob        = cells[idx("date_of_birth")] ?? "";
    const weightRaw  = cells[idx("weight_kg")]   ?? "";
    const genderRaw  = cells[idx("gender")]?.toLowerCase()   ?? "";
    const country    = cells[idx("country")]     ?? "";
    const schoolName = cells[idx("school_name")] ?? "";
    const experience = cells[idx("experience")]?.toLowerCase() ?? "";

    if (!firstName) { errors.push({ row, message: "Missing first_name" }); continue; }
    if (!lastName)  { errors.push({ row, message: "Missing last_name" });  continue; }

    const weightKg = parseFloat(weightRaw);
    if (isNaN(weightKg) || weightKg <= 0) {
      errors.push({ row, message: `Invalid weight_kg: "${weightRaw}"` }); continue;
    }

    if (genderRaw !== "male" && genderRaw !== "female") {
      errors.push({ row, message: `Invalid gender: "${genderRaw}" (must be male or female)` });
      continue;
    }

    if (!VALID_EXPERIENCE.has(experience)) {
      errors.push({ row, message: `Invalid experience: "${experience}" (must be beginner/intermediate/advanced/pro)` });
      continue;
    }

    valid.push({
      firstName,
      lastName,
      dateOfBirth: dob,
      weightKg,
      gender: genderRaw as "male" | "female",
      country,
      schoolName,
      experience: experience as ExperienceLevel,
    });
  }

  return { valid, errors };
}

// ─── Firestore ────────────────────────────────────────────────────────────────

const COL = "competitors";

export function subscribeCompetitors(
  organiserId: string,
  cb: (competitors: Competitor[]) => void
): Unsubscribe {
  const q = query(
    collection(db, COL),
    where("organiserId", "==", organiserId),
    orderBy("lastName", "asc")
  );
  return onSnapshot(
    q,
    (snap) => {
      const competitors = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Competitor, "id">),
      }));
      cb(competitors);
    },
    () => cb([])
  );
}

export async function updateCompetitor(
  id: string,
  input: CompetitorInput
): Promise<void> {
  await updateDoc(doc(db, COL, id), { ...input, updatedAt: serverTimestamp() });
}

export function subscribeCompetitor(
  id: string,
  cb: (competitor: Competitor | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, COL, id), (snap) => {
    if (!snap.exists()) { cb(null); return; }
    cb({ id: snap.id, ...(snap.data() as Omit<Competitor, "id">) });
  }, () => cb(null));
}

export async function addCompetitor(input: CompetitorInput): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...input,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function bulkAddCompetitors(
  inputs: CompetitorInput[],
): Promise<void> {
  const CHUNK = 500;
  for (let i = 0; i < inputs.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const input of inputs.slice(i, i + CHUNK)) {
      batch.set(doc(collection(db, COL)), { ...input, createdAt: serverTimestamp() });
    }
    await batch.commit();
  }
}
