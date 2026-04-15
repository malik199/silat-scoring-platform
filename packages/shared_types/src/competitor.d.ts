import { AgeCategory, WeightClass } from "./tournament";
/**
 * A registered competitor in the system.
 *
 * Corner assignment (red/blue) is match-specific and lives on Match,
 * not on the competitor record itself.
 */
export interface Competitor {
    id: string;
    name: string;
    /** Official registration number issued by the sanctioning body */
    registrationNumber: string;
    clubName: string;
    /** Province or region the competitor represents */
    province: string;
    gender: "male" | "female";
    weightClass: WeightClass;
    ageCategory: AgeCategory;
    /** ISO date string */
    dateOfBirth: string;
}
//# sourceMappingURL=competitor.d.ts.map