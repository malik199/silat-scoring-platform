import { JudgeActionType, DewanActionType, ActionType, Penalty } from "./scoring";

// ---------------------------------------------------------------------------
// Raw score events — submitted by judges or dewan, stored before any decision
// ---------------------------------------------------------------------------

interface BaseScoreEvent {
  id: string;
  matchId: string;
  roundNumber: number;
  /** Which fighter the action was applied to */
  targetCorner: "red" | "blue";
  /** ISO timestamp when the event was submitted */
  submittedAt: string;
}

/**
 * A raw scoring submission from a judge.
 * Only punch and kick are valid judge actions.
 * Does not become an official score until quorum is reached server-side.
 */
export interface JudgeScoreEvent extends BaseScoreEvent {
  source: "judge";
  action: JudgeActionType;
  judgeId: string;
  /** Seat the judge occupied (1, 2, or 3) — denormalised from JudgeAssignment */
  judgeSeat: 1 | 2 | 3;
}

/**
 * A scoring submission from the Dewan (match official).
 * Takedowns and penalties are entered directly and do not require quorum.
 */
export interface DewanScoreEvent extends BaseScoreEvent {
  source: "dewan";
  action: DewanActionType;
  dewanId: string;
  /** Present when action === "penalty" */
  penalty?: Penalty;
}

/** Discriminated union of all raw score events */
export type ScoreEvent = JudgeScoreEvent | DewanScoreEvent;

// ---------------------------------------------------------------------------
// Official score event — the server-authoritative scoring record
// ---------------------------------------------------------------------------

/**
 * An official, server-decided scoring record.
 *
 * Created by the scoring engine after:
 *   - quorum is reached for a JudgeScoreEvent group, or
 *   - the Dewan submits a DewanScoreEvent directly.
 *
 * This is the source of truth for all match scores. Clients must never
 * calculate totals from raw events — only from OfficialScoreEvents.
 */
export interface OfficialScoreEvent {
  id: string;
  matchId: string;
  roundNumber: number;
  action: ActionType;
  /** The fighter who received the action (was hit or penalised) */
  targetCorner: "red" | "blue";
  /**
   * Points awarded to the attacker (the corner opposite targetCorner).
   * Zero for penalty events.
   */
  pointsAwarded: number;
  /** Present when action === "penalty" */
  penalty?: Penalty;
  /**
   * IDs of the JudgeScoreEvents that formed the quorum.
   * Empty array for dewan-entered events (takedown, penalty).
   */
  quorumEventIds: string[];
  /**
   * ID of the DewanScoreEvent that triggered this record.
   * Undefined for judge-quorum events.
   */
  dewanEventId?: string;
  /** ISO timestamp when the scoring engine decided this event */
  decidedAt: string;
}
