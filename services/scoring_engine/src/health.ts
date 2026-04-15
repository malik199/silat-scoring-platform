import { createServer } from "http";

/**
 * Starts a minimal HTTP server that responds to Cloud Run's health probe.
 * The scoring engine is a Firestore listener process, not an HTTP service,
 * but Cloud Run requires a port to be bound.
 */
export function startHealthServer(port: number | string): void {
  const server = createServer((req, res) => {
    if (req.url === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", service: "scoring-engine" }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(port, () => {
    console.log(`[health] Listening on port ${port}`);
  });
}
