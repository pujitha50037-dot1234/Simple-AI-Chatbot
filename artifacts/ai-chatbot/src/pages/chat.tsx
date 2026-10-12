import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  getGetConversationQueryKey,
  getListConversationsQueryKey,
  useDeleteConversation,
  useGetConversation,
  useListConversations,
  useSendChatMessage,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowUp, History, RotateCcw, AlertCircle, X, Trash2 } from 'lucide-react';

type Message = { role: 'user' | 'assistant'; content: string };

const suggestions = [
  'Help me plan a slow Sunday',
  'How do I make a good first impression?',
  'Explain compound interest simply',
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(false);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [hasRestored, setHasRestored] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);
  const queryClient = useQueryClient();
  const conversationsQuery = useListConversations({
    query: { queryKey: getListConversationsQueryKey(), retry: false },
  });
  const activeConversationQuery = useGetConversation(conversationId ?? '', {
    query: {
      enabled: conversationId !== null,
      queryKey: getGetConversationQueryKey(conversationId ?? ''),
      retry: false,
    },
  });
  const deleteConversation = useDeleteConversation();
  const chat = useSendChatMessage();

  useEffect(() => {
    if (hasRestored || conversationsQuery.isLoading) return;
    setHasRestored(true);
    const mostRecent = conversationsQuery.data?.[0];
    if (mostRecent) setConversationId(mostRecent.id);
  }, [conversationsQuery.data, conversationsQuery.isLoading, hasRestored]);

  useEffect(() => {
    const conversation = activeConversationQuery.data;
    if (conversation && conversation.id === conversationId) {
      setMessages(conversation.messages);
    }
  }, [activeConversationQuery.data, conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, chat.isPending, conversationId]);

  function ask(content: string) {
    const currentRequest = ++requestId.current;
    setError(false);
    setRetryMessage(null);
    chat.mutate(
      { data: { conversationId, message: content } },
      {
        onSuccess: (response) => {
          if (currentRequest !== requestId.current) return;
          setConversationId(response.conversationId);
          setMessages((current) => [...current, { role: 'assistant', content: response.reply }]);
          void queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
        },
        onError: () => {
          if (currentRequest !== requestId.current) return;
          setError(true);
          setRetryMessage(content);
        },
      },
    );
  }

  function submitText(text: string) {
    const content = text.trim();
    if (!content || chat.isPending || error || !hasRestored) return;
    setMessages((current) => [...current, { role: 'user', content }]);
    setDraft('');
    ask(content);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitText(draft);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submitText(draft);
    }
  }

  function startOver() {
    requestId.current += 1;
    setConversationId(null);
    setMessages([]);
    setDraft('');
    setError(false);
    setRetryMessage(null);
    setHistoryOpen(false);
  }

  function openConversation(id: string) {
    setConversationId(id);
    setMessages([]);
    setError(false);
    setRetryMessage(null);
    setHistoryOpen(false);
  }

  function deleteSavedConversation(id: string) {
    deleteConversation.mutate(
      { id },
      {
        onSuccess: () => {
          if (conversationId === id) startOver();
          queryClient.removeQueries({ queryKey: getGetConversationQueryKey(id) });
          void queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
        },
      },
    );
  }

  const isConversationLoading =
    conversationId !== null &&
    (activeConversationQuery.isLoading ||
      activeConversationQuery.data?.id !== conversationId);
  const isEmpty = messages.length === 0;
  const isStorageUnavailable = conversationsQuery.isError;
  const composerDisabled =
    chat.isPending ||
    error ||
    !hasRestored ||
    isConversationLoading ||
    isStorageUnavailable;

  return (
    <main className="chat-shell min-h-[100dvh] flex flex-col">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <span />
          </div>
          <div>
            <div className="brand-name">stillroom</div>
            <div className="brand-caption">a little room to think</div>
          </div>
        </div>
        <div className="header-right">
          <div className="availability"><span /> Here with you</div>
          <button
            type="button"
            className="history-button"
            onClick={() => setHistoryOpen((open) => !open)}
            aria-expanded={historyOpen}
            aria-label="Open saved conversations"
            data-testid="button-conversation-history"
          >
            <History size={15} strokeWidth={1.7} />
            <span>History</span>
          </button>
          <button
            type="button"
            className="reset-button"
            onClick={startOver}
            disabled={(isEmpty && !draft) || chat.isPending}
            data-testid="button-start-over"
            aria-label="Start a new conversation"
          >
            <RotateCcw size={15} strokeWidth={1.7} />
            <span>Start over</span>
          </button>
        </div>
        {historyOpen && (
          <section className="history-panel" role="dialog" aria-label="Saved conversations">
            <div className="history-panel-heading">
              <div>
                <div className="history-panel-title">Your conversations</div>
                <div className="history-panel-caption">Saved in Supabase for this browser</div>
              </div>
              <button
                type="button"
                className="history-close"
                onClick={() => setHistoryOpen(false)}
                aria-label="Close conversation history"
              >
                <X size={16} />
              </button>
            </div>
            {conversationsQuery.isLoading ? (
              <div className="history-empty">Loading your saved conversations…</div>
            ) : isStorageUnavailable ? (
              <div className="history-empty history-error" role="alert">
                <p>Supabase chat storage is not ready. Run the SQL migration in <code>supabase/migrations</code>.</p>
                <button type="button" onClick={() => void conversationsQuery.refetch()}>Try again</button>
              </div>
            ) : conversationsQuery.data?.length ? (
              <div className="history-items">
                {conversationsQuery.data.map((conversation) => (
                  <div className="history-item" key={conversation.id}>
                    <button
                      type="button"
                      className={`history-select ${conversation.id === conversationId ? 'active' : ''}`}
                      onClick={() => openConversation(conversation.id)}
                      data-testid={`button-open-conversation-${conversation.id}`}
                    >
                      <span className="history-select-title">{conversation.title}</span>
                      <time className="history-select-date">
                        {new Date(conversation.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </time>
                    </button>
                    <button
                      type="button"
                      className="history-delete"
                      onClick={() => deleteSavedConversation(conversation.id)}
                      disabled={deleteConversation.isPending}
                      aria-label={`Delete conversation: ${conversation.title}`}
                      data-testid={`button-delete-conversation-${conversation.id}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="history-empty">Your saved conversations will appear here.</div>
            )}
          </section>
        )}
      </header>

      <section className={`conversation-area ${isEmpty ? 'is-empty' : ''}`} aria-label="Conversation">
        {isConversationLoading ? (
          <div className="conversation-loading" role="status">Loading your saved conversation…</div>
        ) : conversationId !== null && activeConversationQuery.isError ? (
          <div className="conversation-load-error" role="alert">
            <AlertCircle size={18} />
            <p>Could not load this saved conversation.</p>
            <button type="button" onClick={() => void activeConversationQuery.refetch()}>Try again</button>
            <button type="button" onClick={startOver}>Start a new chat</button>
          </div>
        ) : isEmpty ? (
          <div className="welcome message-arrive">
            <div className="welcome-kicker"><span className="kicker-line" /> YOUR QUIET CORNER</div>
            <h1>What’s on<br />your <em>mind?</em></h1>
            <p className="welcome-copy">A question, a half-formed thought, a thing you’ve been meaning to figure out. Start anywhere.</p>
            {isStorageUnavailable && (
              <div className="supabase-setup-callout" role="alert">
                <AlertCircle size={16} />
                <div>
                  <strong>Supabase needs one setup step.</strong>
                  <span>Run <code>supabase/migrations/202610120001_create_chat_conversations.sql</code> in the Supabase SQL Editor.</span>
                </div>
              </div>
            )}
            <div className="suggestions" aria-label="Try asking">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion}
                  type="button"
                  className="suggestion-chip"
                  onClick={() => submitText(suggestion)}
                  disabled={composerDisabled}
                  data-testid={`button-suggestion-${index + 1}`}
                >
                  <span className="suggestion-index">0{index + 1}</span>
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="message-list" ref={scrollRef} data-testid="list-conversation-messages">
            <div className="thread-label"><span /> THIS CONVERSATION</div>
            {messages.map((message, index) => (
              <article className={`message-row ${message.role} message-arrive`} key={`${index}-${message.role}`} data-testid={`message-${message.role}-${index}`}>
                {message.role === 'assistant' && (
                  <div className="assistant-stamp" aria-hidden="true"><span /></div>
                )}
                <div className={`message-content ${message.role}`}>
                  {message.role === 'assistant' && <div className="message-byline">stillroom</div>}
                  <p>{message.content}</p>
                </div>
              </article>
            ))}
            {chat.isPending && (
              <div className="message-row assistant message-arrive" data-testid="status-assistant-pending" aria-live="polite">
                <div className="assistant-stamp" aria-hidden="true"><span /></div>
                <div className="thinking-block">
                  <div className="thinking-dots"><i className="thinking-dot" /><i className="thinking-dot" /><i className="thinking-dot" /></div>
                  <span>Thinking it through</span>
                </div>
              </div>
            )}
            {error && (
              <div className="error-note message-arrive" role="alert" data-testid="status-chat-error">
                <AlertCircle size={17} />
                <div><strong>A little pause.</strong><span>Your message is still here. Check Supabase setup or try again.</span></div>
                <button type="button" onClick={() => retryMessage && ask(retryMessage)} data-testid="button-retry-message">
                  Try again
                </button>
                <button className="dismiss-error" type="button" onClick={() => setError(false)} aria-label="Dismiss error"><X size={15} /></button>
              </div>
            )}
          </div>
        )}
      </section>

      <footer className="composer-wrap">
        <form className="composer" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="chat-message">Write a message</label>
          <textarea
            id="chat-message"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStorageUnavailable ? 'Complete Supabase setup to chat…' : 'Ask whatever’s on your mind…'}
            rows={1}
            maxLength={12000}
            disabled={composerDisabled}
            data-testid="input-chat-message"
          />
          <button
            className="send-button"
            type="submit"
            disabled={!draft.trim() || composerDisabled}
            aria-label="Send message"
            data-testid="button-send-message"
          >
            <ArrowUp size={19} strokeWidth={2.1} />
          </button>
        </form>
        <div className="composer-meta">
          <span>ENTER TO SEND <span className="meta-separator">·</span> SHIFT + ENTER FOR A NEW LINE</span>
          <span className="privacy-note">
            <span className="privacy-dot" />
            {isStorageUnavailable ? 'Supabase setup needed' : 'Sent to Gemini · Saved in Supabase'}
          </span>
        </div>
      </footer>
    </main>
  );
}
