import express from "express";
import matchesRouter from "./routes/matches";
import scoresRouter from "./routes/scores";

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(express.json());

// Health check — used by Cloud Run
app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/matches", matchesRouter);
app.use("/matches/:matchId/score-events", scoresRouter);

app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});

export default app;
