import { PenaltyValue } from "@silat/shared-types";

/** All valid numeric penalty deduction magnitudes */
export const VALID_PENALTY_VALUES: ReadonlyArray<PenaltyValue> = [1, 2, 5, 10, "disqualification"];

/**
 * Returns true if the given value is a recognised PenaltyValue.
 * Use this to validate Dewan input before persisting.
 */
export function isValidPenaltyValue(value: unknown): value is PenaltyValue {
  return VALID_PENALTY_VALUES.includes(value as PenaltyValue);
}

/**
 * Returns true if the penalty value results in immediate disqualification.
 */
export function isDisqualification(value: PenaltyValue): boolean {
  return value === "disqualification";
}

/**
 * Returns the numeric point deduction for a penalty value.
 * Throws if called with "disqualification" — callers must check
 * isDisqualification first and handle it as a match-ending event.
 */
export function penaltyPointDeduction(value: Exclude<PenaltyValue, "disqualification">): number {
  return value; // values 1, 2, 5, 10 equal their own deduction
}
