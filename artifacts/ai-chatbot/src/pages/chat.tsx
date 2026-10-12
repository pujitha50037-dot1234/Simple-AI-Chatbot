import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useSendChatMessage } from '@workspace/api-client-react';
import { ArrowUp, RotateCcw, AlertCircle, X } from 'lucide-react';

type Message = { role: 'user' | 'assistant'; content: string };

const suggestions = [
  'Help me plan a slow Sunday',
  'How do I make a good first impression?',
  'Explain compound interest simply',
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(false);
  const [retryMessages, setRetryMessages] = useState<Message[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);
  const chat = useSendChatMessage();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, chat.isPending]);

  function ask(history: Message[]) {
    const currentRequest = ++requestId.current;
    setError(false);
    setRetryMessages(null);
    chat.mutate(
      { data: { messages: history.slice(-24) } },
      {
        onSuccess: (response) => {
          if (currentRequest !== requestId.current) return;
          setMessages((current) => [...current, { role: 'assistant', content: response.reply }]);
        },
        onError: () => {
          if (currentRequest !== requestId.current) return;
          setError(true);
          setRetryMessages(history);
        },
      },
    );
  }

  function submitText(text: string) {
    const content = text.trim();
    if (!content || chat.isPending) return;
    const updated = [...messages, { role: 'user' as const, content }];
    setMessages(updated);
    setDraft('');
    ask(updated);
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
    setMessages([]);
    setDraft('');
    setError(false);
    setRetryMessages(null);
  }

  const isEmpty = messages.length === 0;

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
      </header>

      <section className={`conversation-area ${isEmpty ? 'is-empty' : ''}`} aria-label="Conversation">
        {isEmpty ? (
          <div className="welcome message-arrive">
            <div className="welcome-kicker"><span className="kicker-line" /> YOUR QUIET CORNER</div>
            <h1>What’s on<br />your <em>mind?</em></h1>
            <p className="welcome-copy">A question, a half-formed thought, a thing you’ve been meaning to figure out. Start anywhere.</p>
            <div className="suggestions" aria-label="Try asking">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion}
                  type="button"
                  className="suggestion-chip"
                  onClick={() => submitText(suggestion)}
                  disabled={chat.isPending}
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
                <div><strong>A little pause.</strong><span>Your message is still here. Try sending it again.</span></div>
                <button type="button" onClick={() => retryMessages && ask(retryMessages)} data-testid="button-retry-message">
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
            placeholder="Ask whatever’s on your mind…"
            rows={1}
            maxLength={12000}
            disabled={chat.isPending}
            data-testid="input-chat-message"
          />
          <button
            className="send-button"
            type="submit"
            disabled={!draft.trim() || chat.isPending}
            aria-label="Send message"
            data-testid="button-send-message"
          >
            <ArrowUp size={19} strokeWidth={2.1} />
          </button>
        </form>
        <div className="composer-meta">
          <span>ENTER TO SEND <span className="meta-separator">·</span> SHIFT + ENTER FOR A NEW LINE</span>
          <span className="privacy-note"><span className="privacy-dot" /> Sent to Gemini · Not saved here</span>
        </div>
      </footer>
    </main>
  );
}
