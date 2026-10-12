import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";

const COOKIE_NAME = "stillroom_visitor";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getChatVisitorId(req: Request, res: Response): string {
  const savedId = req.cookies?.[COOKIE_NAME];
  if (typeof savedId === "string" && UUID_PATTERN.test(savedId)) {
    return savedId;
  }

  const visitorId = randomUUID();
  res.cookie(COOKIE_NAME, visitorId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 180 * 24 * 60 * 60 * 1000,
    path: "/api",
  });
  return visitorId;
}
