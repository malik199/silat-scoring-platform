import { db } from "../firebase";
import { QuorumWindow } from "../quorum/window";
import { processJudgeEvents } from "../quorum/processor";
import { JudgeScoreEvent } from "@silat/shared-types";

/**
 * Listens for new JudgeScoreEvents across all active matches.
 *
 * For each new event:
 *   1. The QuorumWindow debounces rapid bursts of submissions.
 *   2. After the debounce settles, processJudgeEvents() runs the full
 *      evaluation pipeline for that match + round.
 *
 * The listener uses a collection group query so a single listener covers
 * all matches without per-match subscriptions.
 *
 * Returns an unsubscribe function for graceful shutdown.
 */
export function startJudgeScoreEventListener(window: QuorumWindow): () => void {
  const query = db
    .collectionGroup("judgeScoreEvents")
    .where("quorumDecided", "==", false);

  const unsubscribe = query.onSnapshot(
    (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type !== "added") continue;

        const event = change.doc.data() as Omit<JudgeScoreEvent, "id">;
        const { matchId, roundNumber } = event;

        console.log(
          `[judge-listener] New event: matchId=${matchId} round=${roundNumber} ` +
            `action=${event.action} corner=${event.targetCorner}`
        );

        window.schedule(matchId, roundNumber, () =>
          processJudgeEvents(matchId, roundNumber)
        );
      }
    },
    (err) => {
      console.error("[judge-listener] Snapshot error:", err);
    }
  );

  return unsubscribe;
}
