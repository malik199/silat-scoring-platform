import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase";
import { OfficialScoreEvent, PenaltyValue } from "@silat/shared-types";

type NewOfficialScoreEvent = Omit<OfficialScoreEvent, "id">;

/**
 * Writes an OfficialScoreEvent to Firestore inside a transaction.
 *
 * The transaction also marks each contributing JudgeScoreEvent as
 * quorumDecided=true so it is not re-evaluated in subsequent passes.
 *
 * Double-write guard: before committing, the transaction checks whether an
 * OfficialScoreEvent already exists that overlaps with quorumEventIds. If
 * any overlap is found, the write is skipped. This makes the operation
 * idempotent in the face of listener restarts or duplicate Firestore triggers.
 */
export async function writeOfficialScoreEvent(
  event: NewOfficialScoreEvent,
  judgeEventIdsToMark: string[]
): Promise<void> {
  const matchRef = db.collection("matches").doc(event.matchId);
  const officialEventsRef = matchRef.collection("officialScoreEvents");
  const judgeEventsRef = matchRef.collection("judgeScoreEvents");

  await db.runTransaction(async (tx) => {
    // Guard: check for an existing OfficialScoreEvent that already claimed
    // any of these judge event IDs.
    if (judgeEventIdsToMark.length > 0) {
      const existing = await tx.get(
        officialEventsRef
          .where("quorumEventIds", "array-contains-any", judgeEventIdsToMark)
          .limit(1)
      );
      if (!existing.empty) {
        // Already decided — skip silently. This is normal on listener restart.
        return;
      }
    }

    // Write the official score event
    const newRef = officialEventsRef.doc();
    tx.set(newRef, {
      ...event,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Mark contributing judge events as decided
    for (const judgeEventId of judgeEventIdsToMark) {
      tx.update(judgeEventsRef.doc(judgeEventId), { quorumDecided: true });
    }
  });
}
