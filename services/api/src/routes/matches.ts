import { Router, Request, Response } from "express";
import { db } from "../firebase";
import { Match } from "@silat/shared-types";
import { requireAuth } from "../middleware/auth";

const router = Router();

/** GET /matches — list all matches for the authenticated user's organisation */
router.get("/", requireAuth, async (_req: Request, res: Response) => {
  try {
    const snapshot = await db.collection("matches").orderBy("createdAt", "desc").get();
    const matches = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch matches" });
  }
});

/** POST /matches — create a new match */
router.post("/", requireAuth, async (req: Request, res: Response) => {
  const body = req.body as Partial<Match>;

  if (!body.redFighter || !body.blueFighter || !body.arenaId) {
    res.status(400).json({ error: "redFighter, blueFighter, and arenaId are required" });
    return;
  }

  const now = new Date().toISOString();
  const newMatch: Omit<Match, "id"> = {
    arenaId: body.arenaId,
    status: "scheduled",
    redFighter: body.redFighter,
    blueFighter: body.blueFighter,
    rounds: [],
    scores: [],
    createdAt: now,
    updatedAt: now,
  };

  try {
    const ref = await db.collection("matches").add(newMatch);
    res.status(201).json({ id: ref.id, ...newMatch });
  } catch (err) {
    res.status(500).json({ error: "Failed to create match" });
  }
});

export default router;
