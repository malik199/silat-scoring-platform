import { Request, Response, NextFunction } from "express";
import { auth } from "../firebase";

/**
 * Express middleware that verifies a Firebase ID token from the
 * Authorization: Bearer <token> header.
 *
 * Attaches the decoded token to req.user on success.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or malformed Authorization header" });
    return;
  }

  const token = header.slice(7);
  try {
    const decoded = await auth.verifyIdToken(token);
    (req as Request & { user: typeof decoded }).user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
