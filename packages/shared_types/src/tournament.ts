/**
 * Age categories used in official Pencak Silat competitions.
 * Extend as needed per sanctioning body rules.
 */
export type AgeCategory =
  | "youth"      // under 14
  | "junior"     // 14–17
  | "senior"     // 18–35
  | "master";    // 36+

/**
 * Weight classes. Values are upper-bound kg for each class.
 * "open" means no weight restriction.
 */
export type WeightClass =
  | "45kg"
  | "50kg"
  | "55kg"
  | "60kg"
  | "65kg"
  | "70kg"
  | "75kg"
  | "80kg"
  | "85kg"
  | "open";

export type TournamentStatus =
  | "draft"
  | "registration_open"
  | "in_progress"
  | "completed"
  | "cancelled";

/** Number of simultaneous competition arenas (gelanggang) */
export type ArenaCount = 1 | 2 | 3 | 4;

export interface Tournament {
  id: string;
  name: string;
  location: string;
  /** ISO date string (date only, no time) */
  startDate: string;
  /** ISO date string (date only, no time) */
  endDate: string;
  status: TournamentStatus;
  /** User ID of the admin who owns this tournament */
  organiserId: string;
  /** Number of active arenas (gelanggang) for this tournament */
  arenaCount: ArenaCount;
  /**
   * Maps arena number (string "1"–"4") to an ordered list of competitor IDs.
   * Only arenas 1..arenaCount are meaningful.
   */
  arenaAssignments: Record<string, string[]>;
  createdAt: string;
  updatedAt: string;
}
