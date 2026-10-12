import { Router, type IRouter } from "express";
import {
  SendChatMessageBody,
  SendChatMessageResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

router.post("/chat", async (req, res): Promise<void> => {
  const parsed = SendChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please send a valid chat message." });
    return;
  }

  const messages = parsed.data.messages;
  const lastMessage = messages.at(-1);
  if (lastMessage?.role !== "user") {
    res.status(400).json({ error: "The latest message must be from you." });
    return;
  }

  const totalCharacters = messages.reduce(
    (total, message) => total + message.content.length,
    0,
  );
  if (totalCharacters > 32_000) {
    res.status(400).json({
      error: "This conversation is too long. Start a new chat to continue.",
    });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    req.log.error("GEMINI_API_KEY is not configured");
    res.status(503).json({ error: "AI chat is not configured yet." });
    return;
  }

  try {
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
        contents: messages.map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }],
        })),
        generationConfig: { maxOutputTokens: 8192 },
      }),
    });

    if (!upstream.ok) {
      await upstream.text();
      req.log.warn(
        { statusCode: upstream.status },
        "Gemini chat request failed",
      );
      const status = upstream.status === 429 ? 503 : 502;
      res.status(status).json({
        error:
          upstream.status === 429
            ? "The AI service is busy. Please try again shortly."
            : "The AI service could not respond. Please try again.",
      });
      return;
    }

    const result = (await upstream.json()) as GeminiResponse;
    const reply = result.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();

    if (!reply) {
      req.log.warn("Gemini returned no text for the chat request");
      res.status(502).json({
        error: "The AI service returned an empty response. Please try again.",
      });
      return;
    }

    res.json(SendChatMessageResponse.parse({ reply }));
  } catch (error) {
    req.log.error({ err: error }, "Gemini chat request failed");
    res
      .status(502)
      .json({ error: "The AI service could not respond. Please try again." });
  }
});

export default router;
