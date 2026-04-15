import { db } from "../firebase";
import { evaluateQuorum, POINT_VALUES } from "@silat/shared-rules";
import { JudgeScoreEvent } from "@silat/shared-types";
import { writeOfficialScoreEvent } from "../scoring/officialScoreWriter";
import { updateRoundScore } from "../scoring/roundScoreUpdater";

/**
 * Runs the full quorum evaluation pipeline for a single match + round.
 *
 * Steps:
 *   1. Fetch all judge score events for the match + round that have not
 *      yet been consumed by a quorum decision.
 *   2. Pass them to evaluateQuorum() from shared_rules, which applies the
 *      5-second sliding window and returns any groups that reach threshold.
 *   3. For each quorum group, guard against double-write by checking whether
 *      an OfficialScoreEvent already references any of those event IDs.
 *   4. Write a new OfficialScoreEvent and mark the contributing events as
 *      quorum-decided so they are not re-evaluated.
 *   5. Trigger a round score recompute.
 *
 * This function is intentionally the only place in the scoring engine that
 * calls evaluateQuorum(). All persistence is delegated to scoring/.
 */
export async function processJudgeEvents(
  matchId: string,
  roundNumber: number
): Promise<void> {
  // 1. Fetch pending (not yet quorum-decided) judge score events
  const snapshot = await db
    .collection("matches")
    .doc(matchId)
    .collection("judgeScoreEvents")
    .where("roundNumber", "==", roundNumber)
    .where("quorumDecided", "==", false)
    .get();

  if (snapshot.empty) return;

  const events: JudgeScoreEvent[] = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<JudgeScoreEvent, "id">),
  }));

  // 2. Evaluate quorum using the shared pure function
  const quorumGroups = evaluateQuorum(events);

  if (quorumGroups.length === 0) return;

  // 3 & 4. Write each quorum result and mark events as decided
  for (const group of quorumGroups) {
    const pointsAwarded = POINT_VALUES[group.action as Exclude<typeof group.action, "penalty">];

    await writeOfficialScoreEvent(
      {
        matchId,
        roundNumber,
        action: group.action,
        targetCorner: group.targetCorner,
        pointsAwarded,
        quorumEventIds: group.quorumEventIds,
        decidedAt: new Date().toISOString(),
      },
      group.quorumEventIds
    );
  }

  // 5. Recompute the aggregated round score
  await updateRoundScore(matchId, roundNumber);
}

/**
 * Processes a dewan score event (takedown or penalty) directly into an
 * OfficialScoreEvent. Dewan events bypass quorum — they are authoritative
 * on submission.
 *
 * Called by the dewan listener immediately on each new event.
 */
export async function processDewanEvent(
  matchId: string,
  roundNumber: number,
  dewanEventId: string,
  action: "takedown" | "penalty",
  targetCorner: "red" | "blue",
  penalty?: { value: import("@silat/shared-types").PenaltyValue; reason: string }
): Promise<void> {
  const pointsAwarded = action === "takedown" ? POINT_VALUES.takedown : 0;

  await writeOfficialScoreEvent(
    {
      matchId,
      roundNumber,
      action,
      targetCorner,
      pointsAwarded,
      quorumEventIds: [],
      dewanEventId,
      penalty,
      decidedAt: new Date().toISOString(),
    },
    [] // no judge events to mark
  );

  await updateRoundScore(matchId, roundNumber);
}
