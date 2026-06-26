"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Loader2, Shield, ChevronDown } from "lucide-react";
import Link from "next/link";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content: "Hi! I'm ARIA, your anonymous eSIM guide. Ask me about plans, countries, payment methods, or how to install your eSIM.",
};

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && !minimized) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [messages, open, minimized]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages([...newMessages, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) throw new Error("Chat unavailable");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: accumulated };
          return updated;
        });
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "I'm having trouble connecting right now. You can browse plans at [/shop](/shop) or try again shortly.",
        };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }, [input, messages, streaming]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="fixed bottom-6 right-4 sm:right-6 z-50 flex flex-col items-end gap-2">
      {open && (
        <div
          className="w-[calc(100vw-2rem)] sm:w-96 bg-[#0d0d20] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ maxHeight: minimized ? "auto" : "min(520px, calc(100vh - 120px))" }}
        >
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#ff6600]/15 to-transparent border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm font-semibold text-white">ARIA</span>
              <span className="text-xs text-gray-500">eSIM Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMinimized((m) => !m)}
                className="text-gray-500 hover:text-white p-1 transition-colors"
                aria-label="Minimize"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${minimized ? "rotate-180" : ""}`} />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-500 hover:text-white p-1 transition-colors"
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "assistant" && (
                      <div className="w-6 h-6 rounded-full bg-[#ff6600]/20 border border-[#ff6600]/30 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                        <Shield className="h-3 w-3 text-[#ff6600]" />
                      </div>
                    )}
                    <div
                      className={`max-w-[82%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-[#ff6600]/20 border border-[#ff6600]/25 text-white"
                          : "bg-white/6 text-gray-200 border border-white/5"
                      }`}
                    >
                      {msg.content ? (
                        <span
                          dangerouslySetInnerHTML={{
                            __html: msg.content
                              .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-[#ff6600] hover:underline">$1</a>')
                              .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
                              .replace(/\n/g, "<br/>"),
                          }}
                        />
                      ) : streaming && i === messages.length - 1 ? (
                        <span className="flex gap-1 py-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>

              {messages.length === 1 && (
                <div className="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0">
                  {[
                    "Which countries do you cover?",
                    "How do I pay with Monero?",
                    "How fast is delivery?",
                    "What devices work?",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => setInput(q)}
                      className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-[#ff6600]/30 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              <div className="px-4 py-1.5 flex items-center gap-1.5 border-t border-white/5 shrink-0">
                <Shield className="h-3 w-3 text-gray-600 shrink-0" />
                <p className="text-xs text-gray-600">Powered by Claude AI · No chat logs stored</p>
              </div>

              <div className="p-3 border-t border-white/10 flex gap-2 shrink-0">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Ask about eSIM plans…"
                  disabled={streaming}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#ff6600]/50 disabled:opacity-50 transition-colors"
                />
                <button
                  onClick={send}
                  disabled={streaming || !input.trim()}
                  className="bg-[#ff6600] hover:bg-[#e55c00] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl p-2 transition-all hover:scale-105 active:scale-95 shrink-0"
                  aria-label="Send message"
                >
                  {streaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <button
        onClick={() => { setOpen((o) => !o); setMinimized(false); }}
        className="bg-[#ff6600] hover:bg-[#e55c00] text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg shadow-[#ff6600]/25 transition-all hover:scale-105 active:scale-95"
        aria-label={open ? "Close chat" : "Open eSIM assistant"}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}
