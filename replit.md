# AI Chatbot

A simple, anonymous chat app that sends conversation context to Gemini and saves chat history in Supabase.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/ai-chatbot run dev` — run the chatbot web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required secret: `GEMINI_API_KEY` — used by the API server for Gemini responses; API usage is billed by Google under the key's account
- Required secrets: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — used only by the API server
- Apply `supabase/migrations/202610120001_create_chat_conversations.sql` in the Supabase SQL Editor before using chat history

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- Web: React + Vite
- AI: Gemini 2.5 Flash via the Google Generative Language API
- Validation: Zod (`zod/v4`)
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/ai-chatbot/src/pages/chat.tsx` — chat screen and saved conversation history UI
- `artifacts/ai-chatbot/src/index.css` — chatbot visual theme
- `artifacts/api-server/src/routes/chat.ts` — server-side Gemini request and Supabase persistence
- `artifacts/api-server/src/lib/supabase-rest.ts` — server-only Supabase REST client
- `artifacts/api-server/src/lib/chat-visitor.ts` — anonymous browser-session cookie
- `supabase/migrations/202610120001_create_chat_conversations.sql` — chat history table and index
- `lib/api-spec/openapi.yaml` — chat endpoint contract

## Architecture decisions

- Conversations are scoped to a random, HTTP-only browser cookie and persisted in Supabase; clearing that cookie loses access to the anonymous history.
- The Supabase service-role key is used only on the API server. Row Level Security is enabled with no public policies; server queries filter by the browser-session ID.
- The Gemini key is read server-side; it is never sent to the browser.
- Chat context and stored history are bounded to control request and row size.

## Product

- Users can ask questions, continue a conversation with Gemini, retry failed requests, start a new chat, reopen saved conversations, and delete conversation history.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
