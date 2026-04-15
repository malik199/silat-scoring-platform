import { Competitor } from "./competitor";
import { RoundScore } from "./scoring";

export type MatchStatus =
  | "scheduled"
  | "in_progress"
  | "between_rounds"
  | "completed"
  | "cancelled";

export type Corner = "red" | "blue";

export interface Round {
  roundNumber: number;
  /** ISO timestamp when the round started, null if not yet begun */
  startedAt: string | null;
  /** ISO timestamp when the round ended, null if still running */
  endedAt: string | null;
}

export interface Match {
  id: string;
  tournamentId: string;
  arenaId: string;
  status: MatchStatus;
  /** Full competitor documents embedded for offline display */
  redCompetitor: Competitor;
  blueCompetitor: Competitor;
  rounds: Round[];
  /** Aggregated round scores, computed server-side from OfficialScoreEvents */
  scores: RoundScore[];
  createdAt: string;
  updatedAt: string;
}
