/**
 * A user with role "judge" assigned to officiate matches.
 * Physical seat assignment per match lives in JudgeAssignment.
 */
export interface Judge {
  id: string;
  /** Display name */
  name: string;
  /** Firebase Auth UID */
  uid: string;
}
