import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";

export interface Bracket {
  id: string;
  organiserId: string;
  tournamentId: string;
  tournamentName: string;
  name: string;
  seededIds: (string | null)[];
  createdAt: unknown;
}

export interface BracketMatchup {
  p1Id: string | null;
  p2Id: string | null;
}

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function padToPowerOfTwo(ids: string[]): (string | null)[] {
  let P = 1;
  while (P < ids.length) P *= 2;
  const numByes = P - ids.length;
  // Place each bye adjacent to one real competitor so no null-vs-null matchup forms
  const result: (string | null)[] = [];
  for (let i = 0; i < numByes; i++) result.push(ids[i], null);
  for (let i = numByes; i < ids.length; i++) result.push(ids[i]);
  return result;
}

export function buildRounds(seededIds: (string | null)[]): BracketMatchup[][] {
  const ids = seededIds.filter((id): id is string => id !== null);
  const n = ids.length;
  if (n === 0) return [];
  if (n === 1) return [[{ p1Id: ids[0], p2Id: null }]];

  let P = 1;
  while (P < n) P *= 2;
  const numByes = P - n;

  const byeIds = ids.slice(0, numByes);
  const r1Ids  = ids.slice(numByes);

  // Round 1: pair non-bye competitors — no null slots
  const round1: BracketMatchup[] = [];
  for (let i = 0; i < r1Ids.length; i += 2) {
    round1.push({ p1Id: r1Ids[i], p2Id: r1Ids[i + 1] ?? null });
  }

  if (numByes === 0) {
    const rounds: BracketMatchup[][] = [round1];
    let count = round1.length;
    while (count > 1) {
      count = Math.ceil(count / 2);
      rounds.push(Array.from({ length: count }, () => ({ p1Id: null, p2Id: null })));
    }
    return rounds;
  }

  // Round 2: place bye players pre-seeded, paired with TBD slots for round-1 winners.
  // When there are more byes than round-1 matchups, pair excess byes together.
  const r2Count = P / 4;
  const round2: BracketMatchup[] = [];
  let byeIdx = 0;
  let r1Consumed = 0;

  for (let i = 0; i < r2Count; i++) {
    if (byeIdx < byeIds.length && r1Consumed < round1.length) {
      round2.push({ p1Id: byeIds[byeIdx++], p2Id: null });
      r1Consumed++;
    } else if (byeIdx + 1 < byeIds.length) {
      round2.push({ p1Id: byeIds[byeIdx], p2Id: byeIds[byeIdx + 1] });
      byeIdx += 2;
    } else if (byeIdx < byeIds.length) {
      round2.push({ p1Id: byeIds[byeIdx++], p2Id: null });
    } else {
      round2.push({ p1Id: null, p2Id: null });
      r1Consumed += 2;
    }
  }

  const rounds = [round1, round2];
  let count = r2Count;
  while (count > 1) {
    count = Math.ceil(count / 2);
    rounds.push(Array.from({ length: count }, () => ({ p1Id: null, p2Id: null })));
  }
  return rounds;
}

export function getRoundName(numMatchups: number): string {
  if (numMatchups === 1) return "Final";
  if (numMatchups === 2) return "Semifinals";
  if (numMatchups === 4) return "Quarterfinals";
  return `Round of ${numMatchups * 2}`;
}

const COL = "brackets";

export function subscribeBrackets(
  tournamentId: string,
  cb: (brackets: Bracket[]) => void
): Unsubscribe {
  const q = query(collection(db, COL), where("tournamentId", "==", tournamentId));
  return onSnapshot(
    q,
    (snap) => {
      const brackets = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Bracket, "id">) }))
        .sort((a, b) => {
          const ta = (a.createdAt as { seconds?: number })?.seconds ?? 0;
          const tb = (b.createdAt as { seconds?: number })?.seconds ?? 0;
          return ta - tb;
        });
      cb(brackets);
    },
    () => cb([])
  );
}

export async function createBracket(
  organiserId: string,
  tournamentId: string,
  tournamentName: string,
  name: string,
  seededIds: (string | null)[]
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    organiserId,
    tournamentId,
    tournamentName,
    name,
    seededIds,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function renameBracket(id: string, name: string): Promise<void> {
  await updateDoc(doc(db, COL, id), { name });
}

export async function deleteBracket(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}

export async function getBracket(id: string): Promise<Bracket | null> {
  const snap = await getDoc(doc(db, COL, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Bracket, "id">) };
}
