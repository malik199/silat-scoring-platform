/**
 * Actions that judges can submit for punch/kick scoring.
 * Takedowns and penalties are entered by Dewan directly.
 */
export type JudgeActionType = "punch" | "kick";
/**
 * Actions that only Dewan can submit.
 */
export type DewanActionType = "takedown" | "penalty";
export type ActionType = JudgeActionType | DewanActionType;
/** Penalty magnitudes as defined by official Pencak Silat rules */
export type PenaltyValue = 1 | 2 | 5 | 10 | "disqualification";
export interface Penalty {
    value: PenaltyValue;
    reason: string;
}
/**
 * Aggregated score for one round. Computed server-side from OfficialScoreEvents.
 * This is what clients display — never compute totals from raw ScoreEvents.
 */
export interface RoundScore {
    roundNumber: number;
    /** Total points awarded to the red corner's attacker actions */
    redPoints: number;
    /** Total points awarded to the blue corner's attacker actions */
    bluePoints: number;
    /** Total penalty deductions applied to the red corner */
    redPenaltyTotal: number;
    /** Total penalty deductions applied to the blue corner */
    bluePenaltyTotal: number;
}
//# sourceMappingURL=scoring.d.ts.map