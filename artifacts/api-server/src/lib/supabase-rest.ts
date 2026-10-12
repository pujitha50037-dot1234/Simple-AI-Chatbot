export type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ConversationRow = {
  id: string;
  title: string;
  messages: unknown;
  created_at: string;
  updated_at: string;
};

type SupabaseConfig = {
  baseUrl: string;
  serviceRoleKey: string;
};

export class SupabaseRestError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = "SupabaseRestError";
  }
}

function getConfig(): SupabaseConfig {
  const baseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!baseUrl || !serviceRoleKey) {
    throw new SupabaseRestError("Supabase server credentials are not configured.");
  }

  try {
    const url = new URL(baseUrl);
    const isLocalHttp =
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1");
    if (url.protocol !== "https:" && !isLocalHttp) {
      throw new Error("Supabase URL must use HTTPS.");
    }
  } catch {
    throw new SupabaseRestError("Supabase URL is invalid.");
  }

  return { baseUrl, serviceRoleKey };
}

async function requestSupabase<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const { baseUrl, serviceRoleKey } = getConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", serviceRoleKey);
  headers.set("Authorization", `Bearer ${serviceRoleKey}`);
  headers.set("Accept-Profile", "public");

  if (init.method && init.method !== "GET") {
    headers.set("Content-Profile", "public");
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/rest/v1/${path}`, {
      ...init,
      headers,
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new SupabaseRestError("Supabase could not be reached.");
  }

  if (!response.ok) {
    throw new SupabaseRestError(
      `Supabase returned HTTP ${response.status}.`,
      response.status,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new SupabaseRestError("Supabase returned an invalid response.");
  }
}

const columns = "id,title,messages,created_at,updated_at";

function conversationFilter(visitorId: string, id?: string): string {
  const params = new URLSearchParams({
    select: columns,
    visitor_id: `eq.${visitorId}`,
  });
  if (id) params.set("id", `eq.${id}`);
  return params.toString();
}

export async function listConversations(
  visitorId: string,
  limit = 50,
): Promise<ConversationRow[]> {
  const params = new URLSearchParams({
    select: "id,title,updated_at",
    visitor_id: `eq.${visitorId}`,
    order: "updated_at.desc",
    limit: String(limit),
  });
  return requestSupabase<ConversationRow[]>(
    `chat_conversations?${params.toString()}`,
  );
}

export async function getConversation(
  visitorId: string,
  id: string,
): Promise<ConversationRow | null> {
  const rows = await requestSupabase<ConversationRow[]>(
    `chat_conversations?${conversationFilter(visitorId, id)}`,
  );
  return rows[0] ?? null;
}

export async function createConversation(input: {
  visitorId: string;
  title: string;
  messages: ConversationMessage[];
}): Promise<ConversationRow | null> {
  const rows = await requestSupabase<ConversationRow[]>(
    `chat_conversations?select=${encodeURIComponent(columns)}`,
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        visitor_id: input.visitorId,
        title: input.title,
        messages: input.messages,
      }),
    },
  );
  return rows[0] ?? null;
}

export async function updateConversation(input: {
  visitorId: string;
  id: string;
  messages: ConversationMessage[];
}): Promise<ConversationRow | null> {
  const params = new URLSearchParams(conversationFilter(input.visitorId, input.id));
  const rows = await requestSupabase<ConversationRow[]>(
    `chat_conversations?${params.toString()}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        messages: input.messages,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  return rows[0] ?? null;
}

export async function removeConversation(
  visitorId: string,
  id: string,
): Promise<boolean> {
  const params = new URLSearchParams({
    id: `eq.${id}`,
    visitor_id: `eq.${visitorId}`,
    select: "id",
  });
  const rows = await requestSupabase<Array<{ id: string }>>(
    `chat_conversations?${params.toString()}`,
    {
      method: "DELETE",
      headers: { Prefer: "return=representation" },
    },
  );
  return rows.length > 0;
}

export function toConversationMessages(value: unknown): ConversationMessage[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is ConversationMessage =>
      typeof item === "object" &&
      item !== null &&
      ((item as ConversationMessage).role === "user" ||
        (item as ConversationMessage).role === "assistant") &&
      typeof (item as ConversationMessage).content === "string" &&
      (item as ConversationMessage).content.length > 0,
  );
}
