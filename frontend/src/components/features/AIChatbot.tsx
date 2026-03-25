import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

// ─── API ──────────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api/v1';

async function sendQuery(query: string): Promise<string> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}/ai/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error('AI request failed');
  const data = await res.json();
  return data.answer as string;
}

// ─── Helper: format time ─────────────────────────────────────────────────────
function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Component ────────────────────────────────────────────────────────────────
export function AIChatbot() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  // Suggestions from translations (array)
  const SUGGESTIONS: string[] = t('aiChatbot.suggestions', { returnObjects: true }) as string[];

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pulse, setPulse] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset welcome message when language changes
  useEffect(() => {
    setMessages([
      {
        id: 'welcome',
        role: 'ai',
        content: t('aiChatbot.welcome'),
        timestamp: new Date(),
      },
    ]);
  }, [i18n.language]);

  // Auto scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  // Pulse the robot icon every 8s to attract attention
  useEffect(() => {
    const id = setInterval(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 1000);
    }, 8000);
    return () => clearInterval(id);
  }, []);

  const handleSend = async (text?: string) => {
    const userText = (text ?? input).trim();
    if (!userText || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const answer = await sendQuery(userText);
      const aiMsg: Message = {
        id: Date.now().toString() + '_ai',
        role: 'ai',
        content: answer,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + '_err',
          role: 'ai',
          content: t('aiChatbot.errorMessage'),
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Render markdown-lite (bold + bullets)
  const renderContent = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      const parts = line.split(/\*\*(.*?)\*\*/g);
      const formatted = parts.map((part, j) =>
        j % 2 === 1 ? <strong key={j}>{part}</strong> : <span key={j}>{part}</span>
      );
      if (line.startsWith('- ')) {
        return (
          <div key={i} style={{ display: 'flex', gap: '0.4rem', marginTop: '0.15rem' }}>
            <span style={{ color: 'hsl(217 91% 53%)' }}>•</span>
            <span>{formatted}</span>
          </div>
        );
      }
      return (
        <div key={i} style={{ minHeight: line ? undefined : '0.5rem' }}>
          {formatted}
        </div>
      );
    });
  };

  return (
    <>
      {/* ── Floating Robot Button ───────────────────────────────────────── */}
      <button
        id="ai-chatbot-toggle"
        onClick={() => setOpen((v) => !v)}
        title={t('aiChatbot.toggleTitle')}
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          ...(isRtl ? { left: '1.5rem' } : { right: '1.5rem' }),
          zIndex: 9999,
          width: '3.5rem',
          height: '3.5rem',
          borderRadius: '50%',
          border: 'none',
          cursor: 'pointer',
          background: 'linear-gradient(135deg, hsl(218 63% 16%), hsl(217 91% 40%))',
          boxShadow: open
            ? '0 0 0 4px hsl(217 91% 53% / 0.3), 0 8px 32px hsl(217 91% 53% / 0.4)'
            : '0 4px 20px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          transform: open ? 'scale(1.1) rotate(10deg)' : pulse ? 'scale(1.08)' : 'scale(1)',
        }}
      >
        {/* Pulse ring */}
        {!open && (
          <span
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'hsl(217 91% 53% / 0.3)',
              animation: 'ai-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
            }}
          />
        )}
        {/* Icon */}
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="26" height="26" viewBox="0 0 64 64" fill="white">
            <rect x="16" y="22" width="32" height="24" rx="6" fill="white" opacity="0.95" />
            <rect x="20" y="28" width="8" height="7" rx="2" fill="hsl(218 63% 16%)" />
            <rect x="36" y="28" width="8" height="7" rx="2" fill="hsl(218 63% 16%)" />
            <rect x="24" y="38" width="16" height="3" rx="1.5" fill="hsl(217 91% 53%)" />
            <rect x="28" y="12" width="8" height="10" rx="3" fill="white" opacity="0.95" />
            <circle cx="32" cy="10" r="3" fill="hsl(217 91% 53%)" />
            <rect x="8" y="28" width="5" height="12" rx="2.5" fill="white" opacity="0.8" />
            <rect x="51" y="28" width="5" height="12" rx="2.5" fill="white" opacity="0.8" />
            <rect x="24" y="46" width="6" height="7" rx="2" fill="white" opacity="0.8" />
            <rect x="34" y="46" width="6" height="7" rx="2" fill="white" opacity="0.8" />
          </svg>
        )}
      </button>

      {/* ── Chat Window ──────────────────────────────────────────────────── */}
      <div
        id="ai-chat-window"
        dir={isRtl ? 'rtl' : 'ltr'}
        style={{
          position: 'fixed',
          bottom: '5.5rem',
          ...(isRtl ? { left: '1.5rem' } : { right: '1.5rem' }),
          zIndex: 9998,
          width: 'min(420px, calc(100vw - 2rem))',
          height: '540px',
          borderRadius: '1.25rem',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: 'hsl(var(--background))',
          border: '1px solid hsl(var(--border))',
          boxShadow: '0 25px 60px rgba(0,0,0,0.2), 0 0 0 1px hsl(217 91% 53% / 0.1)',
          opacity: open ? 1 : 0,
          transform: open ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.25s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          transformOrigin: isRtl ? 'bottom left' : 'bottom right',
          fontFamily: isRtl ? "'Almarai', sans-serif" : "'Plus Jakarta Sans', sans-serif",
        }}
      >
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div
          style={{
            background: 'linear-gradient(135deg, hsl(218 63% 16%), hsl(217 91% 40%))',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            flexShrink: 0,
          }}
        >
          {/* Animated robot head */}
          <div
            style={{
              width: '2.4rem',
              height: '2.4rem',
              borderRadius: '50%',
              background: 'hsl(217 91% 53% / 0.25)',
              border: '2px solid hsl(217 91% 53% / 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              animation: 'ai-float 3s ease-in-out infinite',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 64 64" fill="white">
              <rect x="14" y="20" width="36" height="28" rx="7" fill="white" opacity="0.9" />
              <rect x="19" y="27" width="9" height="8" rx="2.5" fill="hsl(218 63% 16%)" />
              <rect x="36" y="27" width="9" height="8" rx="2.5" fill="hsl(218 63% 16%)" />
              <rect x="22" y="38" width="20" height="3.5" rx="1.75" fill="hsl(217 91% 53%)" />
              <rect x="27" y="10" width="10" height="10" rx="4" fill="white" opacity="0.9" />
              <circle cx="32" cy="8" r="3.5" fill="hsl(217 91% 53%)" />
              <rect x="6" y="26" width="5.5" height="14" rx="2.75" fill="white" opacity="0.7" />
              <rect x="52.5" y="26" width="5.5" height="14" rx="2.75" fill="white" opacity="0.7" />
            </svg>
          </div>

          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, color: 'white', fontSize: '0.95rem', fontWeight: 700 }}>
              {t('aiChatbot.title')}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.1rem' }}>
              <span
                style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: '#4ade80', flexShrink: 0,
                  animation: 'ai-blink 2s ease-in-out infinite',
                }}
              />
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' }}>
                {t('aiChatbot.subtitle')}
              </span>
            </div>
          </div>

          <button
            onClick={() => setOpen(false)}
            style={{
              background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
              width: '2rem', height: '2rem', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: 'white',
              flexShrink: 0, transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Messages ──────────────────────────────────────────────────── */}
        <div
          id="ai-chat-messages"
          style={{
            flex: 1, overflowY: 'auto', padding: '1rem',
            display: 'flex', flexDirection: 'column', gap: '0.75rem',
            scrollbarWidth: 'thin', scrollbarColor: 'hsl(var(--muted)) transparent',
          }}
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-end',
                gap: '0.5rem',
              }}
            >
              {/* AI avatar */}
              {msg.role === 'ai' && (
                <div
                  style={{
                    width: '1.75rem', height: '1.75rem', borderRadius: '50%',
                    background: 'linear-gradient(135deg, hsl(218 63% 16%), hsl(217 91% 40%))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginBottom: '0.25rem',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 64 64" fill="white">
                    <rect x="14" y="18" width="36" height="28" rx="7" fill="white" opacity="0.9" />
                    <rect x="19" y="25" width="9" height="8" rx="2.5" fill="hsl(218 63% 16%)" />
                    <rect x="36" y="25" width="9" height="8" rx="2.5" fill="hsl(218 63% 16%)" />
                    <rect x="6" y="24" width="5.5" height="14" rx="2.75" fill="white" opacity="0.7" />
                    <rect x="52.5" y="24" width="5.5" height="14" rx="2.75" fill="white" opacity="0.7" />
                  </svg>
                </div>
              )}

              <div style={{ maxWidth: '80%' }}>
                <div
                  style={{
                    padding: '0.6rem 0.875rem',
                    borderRadius: msg.role === 'user'
                      ? isRtl ? '1rem 1rem 1rem 0.25rem' : '1rem 1rem 0.25rem 1rem'
                      : isRtl ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
                    background: msg.role === 'user'
                      ? 'linear-gradient(135deg, hsl(217 91% 40%), hsl(217 91% 53%))'
                      : 'hsl(var(--muted))',
                    color: msg.role === 'user' ? 'white' : 'hsl(var(--foreground))',
                    fontSize: '0.85rem',
                    lineHeight: '1.6',
                    boxShadow: msg.role === 'user'
                      ? '0 2px 12px hsl(217 91% 53% / 0.3)'
                      : '0 1px 4px rgba(0,0,0,0.06)',
                    textAlign: isRtl ? 'right' : 'left',
                  }}
                >
                  {renderContent(msg.content)}
                </div>
                <div
                  style={{
                    fontSize: '0.68rem', color: 'hsl(var(--muted-foreground))',
                    marginTop: '0.2rem',
                    textAlign: msg.role === 'user' ? (isRtl ? 'left' : 'right') : (isRtl ? 'right' : 'left'),
                    paddingInline: '0.25rem',
                  }}
                >
                  {fmtTime(msg.timestamp)}
                </div>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', flexDirection: isRtl ? 'row-reverse' : 'row' }}>
              <div
                style={{
                  width: '1.75rem', height: '1.75rem', borderRadius: '50%',
                  background: 'linear-gradient(135deg, hsl(218 63% 16%), hsl(217 91% 40%))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 64 64" fill="white">
                  <rect x="14" y="18" width="36" height="28" rx="7" fill="white" opacity="0.9" />
                  <rect x="19" y="25" width="9" height="8" rx="2.5" fill="hsl(218 63% 16%)" />
                  <rect x="36" y="25" width="9" height="8" rx="2.5" fill="hsl(218 63% 16%)" />
                </svg>
              </div>
              <div
                style={{
                  padding: '0.7rem 1rem',
                  borderRadius: isRtl ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
                  background: 'hsl(var(--muted))',
                  display: 'flex', gap: '0.35rem', alignItems: 'center',
                }}
              >
                <span
                  style={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))', marginInlineEnd: '0.3rem' }}
                >
                  {t('aiChatbot.typing')}
                </span>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    style={{
                      width: '7px', height: '7px', borderRadius: '50%',
                      background: 'hsl(217 91% 53%)',
                      animation: `ai-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                      display: 'inline-block',
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Suggestions (shown only with welcome message) ─────────── */}
        {messages.length === 1 && !loading && (
          <div
            style={{
              padding: '0 1rem 0.5rem', display: 'flex',
              flexWrap: 'wrap', gap: '0.4rem', flexShrink: 0,
              justifyContent: isRtl ? 'flex-end' : 'flex-start',
            }}
          >
            {SUGGESTIONS.map((s: string) => (
              <button
                key={s}
                onClick={() => handleSend(s)}
                style={{
                  background: 'hsl(var(--muted))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '2rem',
                  padding: '0.3rem 0.75rem',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  color: 'hsl(var(--foreground))',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'hsl(217 91% 53% / 0.12)';
                  e.currentTarget.style.borderColor = 'hsl(217 91% 53% / 0.5)';
                  e.currentTarget.style.color = 'hsl(217 91% 53%)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'hsl(var(--muted))';
                  e.currentTarget.style.borderColor = 'hsl(var(--border))';
                  e.currentTarget.style.color = 'hsl(var(--foreground))';
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* ── Input area ────────────────────────────────────────────────── */}
        <div
          style={{
            padding: '0.75rem 1rem',
            borderTop: '1px solid hsl(var(--border))',
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'center',
            flexShrink: 0,
            background: 'hsl(var(--background))',
          }}
        >
          <input
            ref={inputRef}
            id="ai-chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={t('aiChatbot.placeholder')}
            disabled={loading}
            style={{
              flex: 1,
              border: '1.5px solid hsl(var(--border))',
              borderRadius: '2rem',
              padding: '0.55rem 1rem',
              fontSize: '0.85rem',
              background: 'hsl(var(--muted) / 0.4)',
              color: 'hsl(var(--foreground))',
              outline: 'none',
              transition: 'border-color 0.2s, box-shadow 0.2s',
              direction: isRtl ? 'rtl' : 'ltr',
              fontFamily: 'inherit',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'hsl(217 91% 53%)';
              e.target.style.boxShadow = '0 0 0 3px hsl(217 91% 53% / 0.15)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'hsl(var(--border))';
              e.target.style.boxShadow = 'none';
            }}
          />

          <button
            id="ai-chat-send"
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            title={t('aiChatbot.send')}
            style={{
              width: '2.4rem', height: '2.4rem', borderRadius: '50%', border: 'none',
              cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
              background: input.trim() && !loading
                ? 'linear-gradient(135deg, hsl(217 91% 45%), hsl(217 91% 55%))'
                : 'hsl(var(--muted))',
              color: input.trim() && !loading ? 'white' : 'hsl(var(--muted-foreground))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'all 0.2s',
              boxShadow: input.trim() && !loading ? '0 2px 8px hsl(217 91% 53% / 0.35)' : 'none',
              transform: input.trim() && !loading ? 'scale(1)' : 'scale(0.9)',
            }}
          >
            {/* Send icon — flipped for RTL */}
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="currentColor"
              style={{ transform: isRtl ? 'scaleX(-1)' : 'none' }}
            >
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Keyframe animations ───────────────────────────────────────────── */}
      <style>{`
        @keyframes ai-ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
        @keyframes ai-bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
        @keyframes ai-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes ai-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </>
  );
}
