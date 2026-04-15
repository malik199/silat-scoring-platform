import { db } from "../firebase";
import { calculateNetPoints } from "@silat/shared-rules";
import { OfficialScoreEvent, RoundScore } from "@silat/shared-types";

/**
 * Recomputes the RoundScore for a given match + round from all
 * OfficialScoreEvents and writes the result back to the Match document.
 *
 * This keeps Match.scores always consistent with the official event log.
 * Clients read from Match.scores — they never aggregate OfficialScoreEvents
 * directly.
 */
export async function updateRoundScore(
  matchId: string,
  roundNumber: number
): Promise<void> {
  const matchRef = db.collection("matches").doc(matchId);

  const snapshot = await matchRef
    .collection("officialScoreEvents")
    .where("roundNumber", "==", roundNumber)
    .get();

  const events: OfficialScoreEvent[] = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<OfficialScoreEvent, "id">),
  }));

  const redNet = calculateNetPoints(events, "red");
  const blueNet = calculateNetPoints(events, "blue");

  // calculateNetPoints returns -Infinity on disqualification
  const roundScore: RoundScore = {
    roundNumber,
    redPoints: isFinite(redNet) ? Math.max(0, redNet) : 0,
    bluePoints: isFinite(blueNet) ? Math.max(0, blueNet) : 0,
    redPenaltyTotal: computePenaltyTotal(events, "red"),
    bluePenaltyTotal: computePenaltyTotal(events, "blue"),
  };

  // Merge into the scores array on the Match document
  await db.runTransaction(async (tx) => {
    const matchDoc = await tx.get(matchRef);
    if (!matchDoc.exists) return;

    const existing: RoundScore[] = (matchDoc.data()?.scores as RoundScore[]) ?? [];
    const updated = existing.filter((s) => s.roundNumber !== roundNumber);
    updated.push(roundScore);
    updated.sort((a, b) => a.roundNumber - b.roundNumber);

    tx.update(matchRef, { scores: updated, updatedAt: new Date().toISOString() });
  });
}

function computePenaltyTotal(
  events: OfficialScoreEvent[],
  corner: "red" | "blue"
): number {
  return events
    .filter((e) => e.action === "penalty" && e.targetCorner === corner && e.penalty)
    .reduce((sum, e) => {
      const value = e.penalty!.value;
      return typeof value === "number" ? sum + value : sum;
    }, 0);
}
