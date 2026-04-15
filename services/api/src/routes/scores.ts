import { Router, Request, Response } from "express";
import { db } from "../firebase";
import { JudgeSubmission } from "@silat/shared-types";
import { requireAuth } from "../middleware/auth";

const router = Router({ mergeParams: true });

/**
 * POST /matches/:matchId/score-events
 *
 * Accepts a judge submission. The scoring engine (separate service) listens
 * to Firestore and evaluates quorum — this endpoint only persists the raw
 * submission and returns immediately.
 */
router.post("/", requireAuth, async (req: Request, res: Response) => {
  const { matchId } = req.params as { matchId: string };
  const body = req.body as Partial<JudgeSubmission>;

  if (!body.judgeId || !body.action || !body.targetCorner || body.roundNumber === undefined) {
    res.status(400).json({
      error: "judgeId, action, targetCorner, and roundNumber are required",
    });
    return;
  }

  const submission: Omit<JudgeSubmission, "id"> = {
    matchId,
    roundNumber: body.roundNumber,
    judgeId: body.judgeId,
    action: body.action,
    targetCorner: body.targetCorner,
    submittedAt: new Date().toISOString(),
  };

  try {
    const ref = await db
      .collection("matches")
      .doc(matchId)
      .collection("judgeSubmissions")
      .add(submission);

    res.status(201).json({ id: ref.id, ...submission });
  } catch (err) {
    res.status(500).json({ error: "Failed to record submission" });
  }
});

export default router;
