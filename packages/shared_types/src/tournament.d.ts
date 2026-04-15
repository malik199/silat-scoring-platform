/**
 * Age categories used in official Pencak Silat competitions.
 * Extend as needed per sanctioning body rules.
 */
export type AgeCategory = "youth" | "junior" | "senior" | "master";
/**
 * Weight classes. Values are upper-bound kg for each class.
 * "open" means no weight restriction.
 */
export type WeightClass = "45kg" | "50kg" | "55kg" | "60kg" | "65kg" | "70kg" | "75kg" | "80kg" | "85kg" | "open";
export type TournamentStatus = "draft" | "registration_open" | "in_progress" | "completed" | "cancelled";
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
    createdAt: string;
    updatedAt: string;
}
//# sourceMappingURL=tournament.d.ts.map