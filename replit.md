# AI Chatbot

A simple, anonymous chat app that sends conversation context to Gemini and keeps messages in browser memory for the current session.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/ai-chatbot run dev` — run the chatbot web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required secret: `GEMINI_API_KEY` — used by the API server for Gemini responses; API usage is billed by Google under the key's account

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- Web: React + Vite
- AI: Gemini 2.5 Flash via the Google Generative Language API
- Validation: Zod (`zod/v4`)
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/ai-chatbot/src/pages/chat.tsx` — chat screen and browser-session state
- `artifacts/ai-chatbot/src/index.css` — chatbot visual theme
- `artifacts/api-server/src/routes/chat.ts` — server-side Gemini API request
- `lib/api-spec/openapi.yaml` — chat endpoint contract

## Architecture decisions

- Conversation history stays in browser memory and is not persisted to a database.
- The Gemini key is read server-side; it is never sent to the browser.
- API requests are bounded by message count and total text length.

## Product

- Users can ask questions, continue a conversation with Gemini, retry failed requests, and start over.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
