-- Stillroom chat history.
-- The API server uses the Supabase service-role key and enforces visitor
-- ownership itself. RLS stays enabled with no public policies.
create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null,
  title text not null,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_conversations_messages_array
    check (jsonb_typeof(messages) = 'array')
);

create index if not exists chat_conversations_visitor_updated_idx
  on public.chat_conversations (visitor_id, updated_at desc);

alter table public.chat_conversations enable row level security;
