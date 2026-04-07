'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Lock, Send, Shield, Phone, User, AlertTriangle, CheckCircle, ChevronLeft, Wifi, Clock } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'agent';
  content: string;
  created_at: string;
}

type ConversationStatus = 'ai_handling' | 'escalated' | 'resolved' | 'closed';

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseMarkdown(text: string): string {
  // Remove escalation/resolved signals from display
  text = text.replace(/\[ESCALATE:[^\]]+\]/g, '').replace(/\[RESOLVED:[^\]]+\]/g, '').trim();

  // Escape raw HTML before processing markdown to prevent XSS
  text = escapeHtml(text);

  // Bold
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Tables
  const tableRegex = /(\|[^\n]+\|\n)+/g;
  text = text.replace(tableRegex, (match) => {
    const rows = match.trim().split('\n').filter(r => r.trim());
    if (rows.length < 2) return match;

    const headers = rows[0].split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join('');
    let tableHTML = `<table><thead><tr>${headers}</tr></thead><tbody>`;

    for (let i = 2; i < rows.length; i++) {
      const cells = rows[i].split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
      tableHTML += `<tr>${cells}</tr>`;
    }
    tableHTML += '</tbody></table>';
    return tableHTML;
  });

  // Line breaks to paragraphs
  const paragraphs = text.split('\n\n').filter(p => p.trim());
  text = paragraphs.map(p => {
    if (p.startsWith('<table>') || p.startsWith('<ul>') || p.startsWith('<ol>')) return p;

    // Bullet lists
    if (p.includes('\n• ') || p.startsWith('• ')) {
      const items = p.split('\n').filter(l => l.trim());
      return '<ul>' + items.map(l => `<li>${l.replace(/^[•\-]\s*/, '')}</li>`).join('') + '</ul>';
    }
    if (p.includes('\n✅') || p.includes('\n✓') || p.includes('\n📋') || p.includes('\n⏰')) {
      return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    }
    // Numbered lists
    if (/^\d+\./.test(p.trim())) {
      const items = p.split('\n').filter(l => l.trim());
      return '<ol>' + items.map(l => `<li>${l.replace(/^\d+\.\s*/, '')}</li>`).join('') + '</ol>';
    }
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  return text;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-3 mb-4">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shrink-0 shadow-md">
        <span className="text-white text-xs font-bold">AI</span>
      </div>
      <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-slate-100">
        <div className="flex gap-1.5 items-center h-4">
          <div className="w-2 h-2 rounded-full bg-slate-400 typing-dot"></div>
          <div className="w-2 h-2 rounded-full bg-slate-400 typing-dot"></div>
          <div className="w-2 h-2 rounded-full bg-slate-400 typing-dot"></div>
        </div>
      </div>
    </div>
  );
}

export default function CustomerPage() {
  // Restore conversation from sessionStorage so refresh doesn't reset state
  const [conversationId] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('nexus_conv_id');
      if (saved) return saved;
    }
    const id = uuidv4();
    if (typeof window !== 'undefined') sessionStorage.setItem('nexus_conv_id', id);
    return id;
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [status, setStatus] = useState<ConversationStatus>('ai_handling');
  const [streamingContent, setStreamingContent] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [showWelcome, setShowWelcome] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const knownMessageIds = useRef<Set<string>>(new Set());

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, streamingContent, scrollToBottom]);

  // On mount: restore prior conversation state from server
  useEffect(() => {
    const savedId = sessionStorage.getItem('nexus_conv_id');
    if (!savedId) return;
    fetch(`/api/conversations/${savedId}`)
      .then(r => r.ok ? r.json() : null)
      .then(conv => {
        if (!conv) return;
        if (conv.status === 'escalated' || conv.status === 'resolved' || conv.status === 'closed') {
          setStatus(conv.status as ConversationStatus);
          setShowWelcome(false);
        }
        return fetch(`/api/conversations/${savedId}/messages`);
      })
      .then(r => r?.ok ? r.json() : null)
      .then((msgs: Message[] | null) => {
        if (!msgs || msgs.length === 0) return;
        msgs.forEach(m => knownMessageIds.current.add(m.id));
        setMessages(msgs.filter(m => m.role !== 'system'));
        setShowWelcome(false);
      })
      .catch(() => { /* silent — new session */ });
  }, [conversationId]);

  // Poll for agent messages when escalated
  useEffect(() => {
    if (status !== 'escalated') return;
    const poll = setInterval(async () => {
      try {
        const r = await fetch(`/api/conversations/${conversationId}/messages`);
        if (!r.ok) return;
        const msgs: Message[] = await r.json();
        const newMsgs = msgs.filter(m => m.role === 'agent' && !knownMessageIds.current.has(m.id));
        if (newMsgs.length > 0) {
          newMsgs.forEach(m => knownMessageIds.current.add(m.id));
          setMessages(prev => [...prev, ...newMsgs]);
        }
      } catch { /* silent */ }
    }, 4000);
    return () => clearInterval(poll);
  }, [status, conversationId]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput('');
    setShowWelcome(false);

    const userMsg: Message = {
      id: uuidv4(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setIsTyping(true);
    setStreamingContent('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          message: text,
          customer_name: customerName || 'Customer',
        }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      setIsTyping(false);

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'text') {
                accumulated += data.content;
                setStreamingContent(accumulated);
              } else if (data.type === 'escalated') {
                setStatus('escalated');
              } else if (data.type === 'resolved') {
                setStatus('resolved');
              } else if (data.type === 'done') {
                const assistantMsg: Message = {
                  id: uuidv4(),
                  role: 'assistant',
                  content: accumulated,
                  created_at: new Date().toISOString(),
                };
                setMessages(prev => [...prev, assistantMsg]);
                setStreamingContent('');
              }
            } catch {
              // skip malformed JSON
            }
          }
        }
      }
    } catch (error) {
      console.error('Send error:', error);
      setMessages(prev => [...prev, {
        id: uuidv4(),
        role: 'system',
        content: 'Connection error. Please try again.',
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickActions = [
    'Check my account balance',
    'Show recent transactions',
    'I need to freeze my card',
    'What\'s my bill payment status?',
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Bank Header */}
      <header className="bg-[#0f1629] text-white shadow-xl">
        <div className="max-w-4xl mx-auto px-4">
          {/* Top bar */}
          <div className="flex items-center justify-between py-3 border-b border-white/10 text-xs text-slate-400">
            <a href="/" className="flex items-center gap-1.5 hover:text-teal-400 transition-colors">
              <ChevronLeft className="w-4 h-4" />
              Back to Portal
            </a>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                Secure Connection
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>

          {/* Main header */}
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
                <span className="text-teal-400 font-bold text-lg">N</span>
              </div>
              <div>
                <div className="font-bold text-lg tracking-tight">Nexus Financial</div>
                <div className="text-xs text-teal-400 font-medium">Member FDIC | Equal Housing Lender</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 text-xs font-medium">256-bit SSL</span>
              </div>
              <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/30 text-sm transition-colors">
                <Phone className="w-4 h-4" />
                <span className="hidden sm:block">1-800-NEXUS-01</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Chat area */}
      <main className="flex-1 max-w-4xl w-full mx-auto flex flex-col">
        {/* Chat header bar */}
        <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-md">
                <span className="text-white text-sm font-bold">AI</span>
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${status === 'escalated' ? 'bg-amber-500' : status === 'resolved' ? 'bg-slate-400' : 'bg-emerald-500'}`}></div>
            </div>
            <div>
              <div className="font-semibold text-slate-800 text-sm">
                {status === 'escalated' ? 'Agent (Human)' : 'ARIA — AI Banking Assistant'}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Shield className="w-3 h-3 text-teal-500" />
                <span>Secure Banking Chat</span>
                {status === 'ai_handling' && (
                  <span className="text-emerald-600 font-medium">• Online</span>
                )}
                {status === 'escalated' && (
                  <span className="text-amber-600 font-medium">• Transferred to Human Agent</span>
                )}
                {status === 'resolved' && (
                  <span className="text-slate-500 font-medium">• Resolved</span>
                )}
              </div>
            </div>
          </div>

          {status === 'escalated' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
              <User className="w-4 h-4 text-amber-600" />
              <span className="text-amber-700 text-sm font-medium">Human Agent</span>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1 min-h-0" style={{ maxHeight: 'calc(100vh - 280px)' }}>

          {/* Welcome state */}
          {showWelcome && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center animate-fade-in">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center mb-6 shadow-xl">
                <Shield className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-3">Welcome to Nexus Financial</h2>
              <p className="text-slate-500 max-w-sm mb-6 leading-relaxed">
                I'm ARIA, your AI banking assistant. I can help with account balances, transactions, card services, and more — securely and instantly.
              </p>

              <div className="w-full max-w-md mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-1.5 text-left">
                  Your first name <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value.slice(0, 50))}
                  placeholder="e.g. Sarah"
                  maxLength={50}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent placeholder-slate-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md">
                {quickActions.map((action) => (
                  <button
                    key={action}
                    onClick={() => {
                      setInput(action);
                      setTimeout(() => {
                        setInput('');
                        setShowWelcome(false);
                        const userMsg: Message = {
                          id: uuidv4(),
                          role: 'user',
                          content: action,
                          created_at: new Date().toISOString(),
                        };
                        setMessages(prev => [...prev, userMsg]);
                        setIsLoading(true);
                        setIsTyping(true);
                        setStreamingContent('');

                        fetch('/api/chat', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            conversation_id: conversationId,
                            message: action,
                            customer_name: customerName || 'Customer',
                          }),
                        }).then(async (response) => {
                          const reader = response.body?.getReader();
                          const decoder = new TextDecoder();
                          let accumulated = '';
                          setIsTyping(false);

                          while (reader) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            const chunk = decoder.decode(value, { stream: true });
                            const lines = chunk.split('\n');
                            for (const line of lines) {
                              if (line.startsWith('data: ')) {
                                try {
                                  const data = JSON.parse(line.slice(6));
                                  if (data.type === 'text') {
                                    accumulated += data.content;
                                    setStreamingContent(accumulated);
                                  } else if (data.type === 'escalated') {
                                    setStatus('escalated');
                                  } else if (data.type === 'resolved') {
                                    setStatus('resolved');
                                  } else if (data.type === 'done') {
                                    setMessages(prev => [...prev, {
                                      id: uuidv4(),
                                      role: 'assistant',
                                      content: accumulated,
                                      created_at: new Date().toISOString(),
                                    }]);
                                    setStreamingContent('');
                                  }
                                } catch { /* skip */ }
                              }
                            }
                          }
                        }).finally(() => {
                          setIsLoading(false);
                          setIsTyping(false);
                        });
                      }, 0);
                    }}
                    className="text-left px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50 transition-all text-sm text-slate-700 font-medium shadow-sm"
                  >
                    {action}
                  </button>
                ))}
              </div>

              <div className="mt-8 flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1.5"><Lock className="w-3 h-3" /> 256-bit SSL</span>
                <span>•</span>
                <span className="flex items-center gap-1.5"><Shield className="w-3 h-3" /> FDIC Insured</span>
                <span>•</span>
                <span>Never share your full SSN, PIN, or one-time passcode</span>
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 mb-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} fade-in-up`}>
              {msg.role !== 'user' && (
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-md ${
                  msg.role === 'agent' ? 'bg-gradient-to-br from-blue-500 to-blue-700' :
                  msg.role === 'system' ? 'bg-gradient-to-br from-slate-400 to-slate-600' :
                  'bg-gradient-to-br from-teal-500 to-cyan-600'
                }`}>
                  {msg.role === 'agent' ? (
                    <User className="w-4 h-4 text-white" />
                  ) : msg.role === 'system' ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <span className="text-white text-xs font-bold">AI</span>
                  )}
                </div>
              )}

              <div className={`max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                {msg.role !== 'user' && msg.role !== 'system' && (
                  <div className="text-xs text-slate-400 mb-1 px-1">
                    {msg.role === 'agent' ? 'Human Agent' : 'ARIA — AI Assistant'}
                  </div>
                )}

                {msg.role === 'system' ? (
                  <div className="px-4 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-sm italic">
                    {msg.content}
                  </div>
                ) : (
                  <div className={`px-4 py-3 rounded-2xl shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-[#0f1629] text-white rounded-br-sm'
                      : msg.role === 'agent'
                      ? 'bg-blue-50 text-slate-800 border border-blue-100 rounded-bl-sm'
                      : 'bg-white text-slate-800 border border-slate-100 rounded-bl-sm'
                  }`}>
                    {msg.role === 'user' ? (
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    ) : (
                      <div
                        className="text-sm chat-content"
                        dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }}
                      />
                    )}
                  </div>
                )}

                <div className="text-xs text-slate-400 mt-1 px-1">
                  {formatTime(msg.created_at)}
                </div>
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center shrink-0 mt-1">
                  <User className="w-4 h-4 text-slate-600" />
                </div>
              )}
            </div>
          ))}

          {/* Streaming message */}
          {streamingContent && (
            <div className="flex gap-3 mb-4 justify-start fade-in-up">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shrink-0 mt-1 shadow-md">
                <span className="text-white text-xs font-bold">AI</span>
              </div>
              <div className="max-w-[75%] items-start flex flex-col">
                <div className="text-xs text-slate-400 mb-1 px-1">ARIA — AI Assistant</div>
                <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-white text-slate-800 border border-slate-100 shadow-sm">
                  <div
                    className="text-sm chat-content"
                    dangerouslySetInnerHTML={{ __html: parseMarkdown(streamingContent) }}
                  />
                  <div className="inline-block w-2 h-4 bg-teal-500 ml-0.5 animate-pulse rounded-sm"></div>
                </div>
              </div>
            </div>
          )}

          {/* Typing indicator */}
          {isTyping && !streamingContent && <TypingIndicator />}

          {/* Escalated notice */}
          {status === 'escalated' && (
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl my-4">
              <User className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <div className="text-amber-800 font-semibold text-sm">Transferred to a Human Agent</div>
                <div className="text-amber-600 text-xs">Your conversation has been escalated. An agent will be with you shortly — no need to repeat yourself, they have the full context.</div>
              </div>
            </div>
          )}

          {/* Resolved notice */}
          {status === 'resolved' && (
            <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl my-4">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <div className="text-emerald-800 font-semibold text-sm">Conversation Resolved</div>
                <div className="text-emerald-600 text-xs">Your issue has been resolved. Feel free to start a new chat if you need further assistance.</div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="bg-white border-t border-slate-200 p-4 shadow-lg">
          {status === 'resolved' ? (
            <div className="text-center py-3">
              <p className="text-slate-500 text-sm mb-3">This conversation is resolved.</p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2.5 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors text-sm"
              >
                Start New Conversation
              </button>
            </div>
          ) : (
            <div className="flex gap-3 items-end max-w-4xl mx-auto">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={status === 'escalated' ? "Chat with your agent..." : "Ask about your account..."}
                  rows={1}
                  disabled={isLoading}
                  className="w-full px-4 py-3 pr-4 rounded-xl border border-slate-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 focus:outline-none resize-none text-slate-800 placeholder-slate-400 text-sm transition-all disabled:opacity-60 disabled:bg-slate-50"
                  style={{ minHeight: '48px', maxHeight: '120px' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                  }}
                />
              </div>
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="p-3 rounded-xl bg-[#0f1629] text-white hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 shadow-md hover:shadow-lg"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-center gap-4 mt-3 text-xs text-slate-400">
            <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Encrypted</span>
            <span>•</span>
            <span>Never share your full SSN or PIN</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Phone className="w-3 h-3" />
              1-800-NEXUS-01
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
