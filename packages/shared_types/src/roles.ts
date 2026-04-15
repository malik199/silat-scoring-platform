/**
 * Roles that a user can hold within the platform.
 *
 * admin   — full access: create tournaments, manage users
 * dewan   — match official: enters takedowns, penalties, controls timing
 * judge   — scoring judge: submits punch/kick events via the Flutter app
 * viewer  — read-only access to live scores and match history
 */
export type UserRole = "admin" | "dewan" | "judge" | "viewer";

/**
 * Internal service roles not directly assigned to human users.
 * Used for audit trail attribution when the system auto-decides a score.
 */
export type SystemRole = "scoring_engine";

export type AnyRole = UserRole | SystemRole;
