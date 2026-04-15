import { db } from "../firebase";
import { processDewanEvent } from "../quorum/processor";
import { DewanScoreEvent } from "@silat/shared-types";

/**
 * Listens for new DewanScoreEvents across all active matches.
 *
 * Dewan events (takedown, penalty) do not require quorum — they are
 * authoritative on submission and are converted to OfficialScoreEvents
 * immediately.
 *
 * A `processed` flag is set after writing to prevent re-processing on
 * listener restart.
 *
 * Returns an unsubscribe function for graceful shutdown.
 */
export function startDewanScoreEventListener(): () => void {
  const query = db
    .collectionGroup("dewanScoreEvents")
    .where("processed", "==", false);

  const unsubscribe = query.onSnapshot(
    async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type !== "added") continue;

        const doc = change.doc;
        const event = doc.data() as Omit<DewanScoreEvent, "id">;
        const { matchId, roundNumber, action, targetCorner, penalty } = event;

        console.log(
          `[dewan-listener] New event: matchId=${matchId} round=${roundNumber} ` +
            `action=${action} corner=${targetCorner}`
        );

        try {
          await processDewanEvent(
            matchId,
            roundNumber,
            doc.id,
            action,
            targetCorner,
            penalty
          );

          // Mark as processed so restarts do not re-write
          await doc.ref.update({ processed: true });
        } catch (err) {
          console.error(`[dewan-listener] Failed to process event ${doc.id}:`, err);
        }
      }
    },
    (err) => {
      console.error("[dewan-listener] Snapshot error:", err);
    }
  );

  return unsubscribe;
}
