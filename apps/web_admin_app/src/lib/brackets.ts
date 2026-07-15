import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export interface Bracket {
  id: string;
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
  let n = 1;
  while (n < ids.length) n *= 2;
  return [...ids, ...Array<null>(n - ids.length).fill(null)];
}

export function buildRounds(seededIds: (string | null)[]): BracketMatchup[][] {
  const firstRound: BracketMatchup[] = [];
  for (let i = 0; i < seededIds.length; i += 2) {
    firstRound.push({ p1Id: seededIds[i] ?? null, p2Id: seededIds[i + 1] ?? null });
  }
  const rounds: BracketMatchup[][] = [firstRound];
  let count = firstRound.length;
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

export async function createBracket(seededIds: (string | null)[]): Promise<string> {
  const ref = await addDoc(collection(db, COL), { seededIds, createdAt: serverTimestamp() });
  return ref.id;
}

export async function getBracket(id: string): Promise<Bracket | null> {
  const snap = await getDoc(doc(db, COL, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Bracket, "id">) };
}
