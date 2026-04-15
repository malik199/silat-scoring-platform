import {
  ActionType,
  JudgeScoreEvent,
  OfficialScoreEvent,
  PenaltyValue,
} from "@silat/shared-types";

// ---------------------------------------------------------------------------
// Point values (official Pencak Silat tanding rules)
// ---------------------------------------------------------------------------

export const POINT_VALUES: Record<Exclude<ActionType, "penalty">, number> = {
  punch: 1,
  kick: 2,
  takedown: 3,
};

export const PENALTY_POINT_VALUES: Record<Exclude<PenaltyValue, "disqualification">, number> = {
  1: 1,
  2: 2,
  5: 5,
  10: 10,
};

// ---------------------------------------------------------------------------
// Quorum rules
// ---------------------------------------------------------------------------

/**
 * Minimum number of judges who must submit the same action against the same
 * target within the time window for the action to be officially counted.
 */
export const QUORUM_THRESHOLD = 2;

/** Time window in milliseconds within which judge submissions must cluster */
export const QUORUM_WINDOW_MS = 5_000;

/**
 * Evaluates a set of raw JudgeScoreEvents and returns which groups reach quorum.
 *
 * All events must be for the same match and round.
 * Returns the minimal winning group for each action+corner combination.
 *
 * Pure function — all persistence happens in the scoring engine service.
 */
export function evaluateQuorum(
  events: JudgeScoreEvent[]
): Array<{
  action: ActionType;
  targetCorner: "red" | "blue";
  quorumEventIds: string[];
}> {
  // Group by action + targetCorner
  const groups = new Map<string, JudgeScoreEvent[]>();

  for (const event of events) {
    const key = `${event.action}:${event.targetCorner}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(event);
  }

  const results: ReturnType<typeof evaluateQuorum> = [];

  for (const [key, group] of groups) {
    // Sort ascending by submission time
    const sorted = [...group].sort(
      (a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
    );

    // Sliding window: find the earliest cluster of >= QUORUM_THRESHOLD
    // submissions that all fall within QUORUM_WINDOW_MS of each other.
    for (let i = 0; i <= sorted.length - QUORUM_THRESHOLD; i++) {
      const windowStart = new Date(sorted[i].submittedAt).getTime();
      const windowEnd = windowStart + QUORUM_WINDOW_MS;

      const inWindow = sorted.filter(
        (s) => new Date(s.submittedAt).getTime() <= windowEnd
      );

      if (inWindow.length >= QUORUM_THRESHOLD) {
        const [action, targetCorner] = key.split(":") as [ActionType, "red" | "blue"];
        results.push({
          action,
          targetCorner,
          quorumEventIds: inWindow.map((s) => s.id),
        });
        break; // count this group once
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Net score calculation
// ---------------------------------------------------------------------------

/**
 * Calculates net points for a corner from a list of official score events.
 *
 * Scoring convention:
 *   - targetCorner is the fighter who was *hit* or *penalised*.
 *   - For attack actions (punch, kick, takedown): points go to the attacker,
 *     i.e. the corner opposite targetCorner.
 *   - For penalties: points are deducted from targetCorner (the offender).
 *
 * Returns -Infinity to signal disqualification — callers must handle this.
 */
export function calculateNetPoints(
  events: OfficialScoreEvent[],
  corner: "red" | "blue"
): number {
  let total = 0;

  for (const event of events) {
    if (event.action === "penalty") {
      if (event.targetCorner === corner && event.penalty) {
        const value = event.penalty.value;
        if (value === "disqualification") {
          return -Infinity;
        }
        total -= PENALTY_POINT_VALUES[value];
      }
    } else {
      // Attack action: points go to the attacker (the non-target corner)
      if (event.targetCorner !== corner) {
        total += POINT_VALUES[event.action];
      }
    }
  }

  return total;
}
