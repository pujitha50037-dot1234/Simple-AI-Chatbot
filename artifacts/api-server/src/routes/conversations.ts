import { Router, type IRouter } from "express";
import {
  DeleteConversationParams,
  GetConversationParams,
  GetConversationResponse,
  ListConversationsResponse,
} from "@workspace/api-zod";
import { getChatVisitorId } from "../lib/chat-visitor";
import { sendSupabaseError } from "../lib/supabase-error-response";
import {
  getConversation,
  listConversations,
  removeConversation,
  toConversationMessages,
} from "../lib/supabase-rest";

const router: IRouter = Router();

router.get("/conversations", async (req, res): Promise<void> => {
  const visitorId = getChatVisitorId(req, res);
  res.setHeader("Cache-Control", "private, no-store");

  try {
    const rows = await listConversations(visitorId);
    res.json(
      ListConversationsResponse.parse(
        rows.map((row) => ({
          id: row.id,
          title: row.title,
          updatedAt: row.updated_at,
        })),
      ),
    );
  } catch (error) {
    sendSupabaseError(req, res, error, "Could not list chat conversations");
  }
});

router.get("/conversations/:id", async (req, res): Promise<void> => {
  const params = GetConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Please choose a valid conversation." });
    return;
  }

  const visitorId = getChatVisitorId(req, res);
  res.setHeader("Cache-Control", "private, no-store");

  try {
    const row = await getConversation(visitorId, params.data.id);
    if (!row) {
      res.status(404).json({ error: "Conversation not found." });
      return;
    }

    res.json(
      GetConversationResponse.parse({
        id: row.id,
        title: row.title,
        messages: toConversationMessages(row.messages),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }),
    );
  } catch (error) {
    sendSupabaseError(req, res, error, "Could not load chat conversation");
  }
});

router.delete("/conversations/:id", async (req, res): Promise<void> => {
  const params = DeleteConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Please choose a valid conversation." });
    return;
  }

  const visitorId = getChatVisitorId(req, res);
  try {
    const deleted = await removeConversation(visitorId, params.data.id);
    if (!deleted) {
      res.status(404).json({ error: "Conversation not found." });
      return;
    }
    res.status(204).end();
  } catch (error) {
    sendSupabaseError(req, res, error, "Could not delete chat conversation");
  }
});

export default router;
