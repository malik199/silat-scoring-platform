/**
 * Assigns a judge (userId with role "judge") to a specific seat at a specific match.
 *
 * Seats 1–3 map to the three official judge positions around the arena.
 * Only one assignment per seat per match is valid; enforcement is server-side.
 */
export interface JudgeAssignment {
    id: string;
    matchId: string;
    judgeId: string;
    /** Physical seat position 1, 2, or 3 */
    seat: 1 | 2 | 3;
    /** ID of the admin who created this assignment */
    assignedBy: string;
    assignedAt: string;
}
//# sourceMappingURL=judge-assignment.d.ts.map