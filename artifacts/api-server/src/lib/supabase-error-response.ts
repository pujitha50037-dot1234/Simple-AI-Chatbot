import type { Request, Response } from "express";
import { SupabaseRestError } from "./supabase-rest";

export function sendSupabaseError(
  req: Request,
  res: Response,
  error: unknown,
  context: string,
): void {
  const statusCode =
    error instanceof SupabaseRestError ? error.statusCode : undefined;
  req.log.error({ statusCode, err: error }, context);

  const message =
    statusCode === 400 || statusCode === 404
      ? "Chat storage is not set up yet. Run the SQL migration in supabase/migrations."
      : "Supabase is unavailable. Please try again shortly.";

  res.status(503).json({ error: message });
}
