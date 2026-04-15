/**
 * QuorumWindow
 *
 * Manages per-match debounce timers so that a burst of judge submissions
 * arriving within a short period (e.g. all three judges tapping within 1s)
 * are evaluated together in a single pass rather than triggering three
 * separate quorum checks.
 *
 * Flow:
 *   1. A new JudgeScoreEvent lands in Firestore.
 *   2. The listener calls window.schedule(matchId, roundNumber, evaluate).
 *   3. If a timer is already pending for that key, it is reset (debounced).
 *   4. After DEBOUNCE_MS with no new events, evaluate() is called once.
 *   5. evaluate() fetches all pending events and runs the 5-second window
 *      logic from shared_rules/evaluateQuorum().
 *
 * The 5-second consensus window is enforced by evaluateQuorum() using event
 * timestamps — QuorumWindow only handles the service-level debounce.
 */

const DEBOUNCE_MS = 200;

type EvaluateFn = () => Promise<void>;

export class QuorumWindow {
  private readonly timers = new Map<string, NodeJS.Timeout>();

  /**
   * Schedule a quorum evaluation for a given match + round.
   * Resets the debounce timer if one is already pending.
   */
  schedule(matchId: string, roundNumber: number, evaluate: EvaluateFn): void {
    const key = `${matchId}:${roundNumber}`;

    const existing = this.timers.get(key);
    if (existing !== undefined) clearTimeout(existing);

    const timer = setTimeout(async () => {
      this.timers.delete(key);
      try {
        await evaluate();
      } catch (err) {
        console.error(`[quorum-window] Evaluation failed for ${key}:`, err);
      }
    }, DEBOUNCE_MS);

    this.timers.set(key, timer);
  }

  /** Cancel all pending timers (used on graceful shutdown). */
  clear(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}
