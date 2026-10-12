import { Router, type IRouter, type Request } from "express";
import {
  SendChatMessageBody,
  SendChatMessageResponse,
} from "@workspace/api-zod";
import { getChatVisitorId } from "../lib/chat-visitor";
import { sendSupabaseError } from "../lib/supabase-error-response";
import {
  createConversation,
  getConversation,
  listConversations,
  toConversationMessages,
  updateConversation,
  type ConversationMessage,
} from "../lib/supabase-rest";

const router: IRouter = Router();
const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const MAX_STORED_MESSAGES = 160;
const MAX_STORED_CHARACTERS = 250_000;

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

function trimContext(messages: ConversationMessage[]): ConversationMessage[] {
  const context = messages
    .slice(-24)
    .map((message) => ({
      role: message.role,
      content: message.content.slice(-12_000),
    }));

  let totalCharacters = context.reduce(
    (total, message) => total + message.content.length,
    0,
  );
  while (context.length > 1 && totalCharacters > 32_000) {
    totalCharacters -= context.shift()!.content.length;
  }
  return context;
}

function compactHistory(messages: ConversationMessage[]): ConversationMessage[] {
  const compacted = messages.map((message) => ({
    role: message.role,
    content: message.content.slice(0, 50_000),
  }));
  let totalCharacters = compacted.reduce(
    (total, message) => total + message.content.length,
    0,
  );

  while (
    compacted.length > MAX_STORED_MESSAGES ||
    totalCharacters > MAX_STORED_CHARACTERS
  ) {
    totalCharacters -= compacted.shift()!.content.length;
  }
  return compacted;
}

function makeTitle(firstMessage: string): string {
  const oneLine = firstMessage.replace(/\s+/g, " ").trim();
  return oneLine.length > 72 ? `${oneLine.slice(0, 69)}…` : oneLine;
}

async function getGeminiReply(
  req: Request,
  messages: ConversationMessage[],
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    req.log.error("GEMINI_API_KEY is not configured");
    return null;
  }

  const upstream = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: "You are a helpful, friendly AI assistant. Answer clearly and thoughtfully. If you are uncertain, say so.",
          },
        ],
      },
      contents: trimContext(messages).map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      })),
      generationConfig: { maxOutputTokens: 8192 },
    }),
  });

  if (!upstream.ok) {
    await upstream.body?.cancel();
    req.log.warn(
      { statusCode: upstream.status },
      "Gemini chat request failed",
    );
    return null;
  }

  const result = (await upstream.json()) as GeminiResponse;
  return (
    result.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() || null
  );
}

router.post("/chat", async (req, res): Promise<void> => {
  const parsed = SendChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please send a valid chat message." });
    return;
  }

  const userContent = parsed.data.message.trim();
  if (!userContent) {
    res.status(400).json({ error: "Please enter a message." });
    return;
  }

  const visitorId = getChatVisitorId(req, res);
  const conversationId = parsed.data.conversationId ?? null;
  let existingMessages: ConversationMessage[] = [];
  let existingTitle: string | null = null;

  try {
    if (conversationId) {
      const conversation = await getConversation(visitorId, conversationId);
      if (!conversation) {
        res.status(404).json({ error: "Conversation not found." });
        return;
      }
      existingMessages = toConversationMessages(conversation.messages);
      existingTitle = conversation.title;
    } else {
      // Verify Supabase is ready before spending a Gemini request.
      await listConversations(visitorId, 1);
    }
  } catch (error) {
    sendSupabaseError(req, res, error, "Could not prepare chat conversation");
    return;
  }

  let reply: string | null;
  try {
    reply = await getGeminiReply(req, [
      ...existingMessages,
      { role: "user", content: userContent },
    ]);
  } catch (error) {
    req.log.error({ err: error }, "Gemini chat request failed");
    res
      .status(502)
      .json({ error: "The AI service could not respond. Please try again." });
    return;
  }

  if (!reply) {
    const isConfigured = Boolean(process.env.GEMINI_API_KEY);
    res.status(isConfigured ? 502 : 503).json({
      error: isConfigured
        ? "The AI service could not respond. Please try again."
        : "AI chat is not configured yet.",
    });
    return;
  }

  const updatedMessages = compactHistory([
    ...existingMessages,
    { role: "user", content: userContent },
    { role: "assistant", content: reply },
  ]);

  try {
    const saved = conversationId
      ? await updateConversation({
          visitorId,
          id: conversationId,
          messages: updatedMessages,
        })
      : await createConversation({
          visitorId,
          title: makeTitle(userContent),
          messages: updatedMessages,
        });

    if (!saved) {
      res.status(404).json({ error: "Conversation not found." });
      return;
    }

    res.json(
      SendChatMessageResponse.parse({
        conversationId: saved.id,
        reply,
      }),
    );
  } catch (error) {
    sendSupabaseError(req, res, error, "Could not save chat conversation");
  }
});

export default router;
