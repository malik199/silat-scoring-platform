import { startHealthServer } from "./health";
import { startJudgeScoreEventListener } from "./listeners/judgeScoreEvents";
import { startDewanScoreEventListener } from "./listeners/dewanScoreEvents";
import { QuorumWindow } from "./quorum/window";

const PORT = process.env.PORT ?? 3002;

// Shared debounce manager for judge quorum evaluation
const quorumWindow = new QuorumWindow();

// Start Firestore listeners
const unsubscribeJudge = startJudgeScoreEventListener(quorumWindow);
const unsubscribeDewan = startDewanScoreEventListener();

console.log("[scoring-engine] Listeners active");

// Health check server required by Cloud Run
startHealthServer(PORT);

// Graceful shutdown
function shutdown(signal: string): void {
  console.log(`[scoring-engine] ${signal} received — shutting down`);
  quorumWindow.clear();
  unsubscribeJudge();
  unsubscribeDewan();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
