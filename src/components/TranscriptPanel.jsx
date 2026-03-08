"use client";

import { useRef, useEffect } from "react";
import { MessageSquare } from "lucide-react";

export default function TranscriptPanel({ messages = [] }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="glass-panel flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/5 px-5 py-3">
        <MessageSquare className="h-4 w-4 text-violet-400" />
        <h3 className="text-sm font-semibold text-white/80">Conversation</h3>
        <span className="ml-auto rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-300">
          {messages.length} messages
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <div className="rounded-full bg-white/5 p-3">
              <MessageSquare className="h-5 w-5 text-white/20" />
            </div>
            <p className="text-xs text-white/30">
              Start signing to begin the conversation
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "rounded-br-md bg-violet-600/25 text-violet-100"
                  : "rounded-bl-md bg-white/5 text-white/80"
              }`}
            >
              <div className="mb-1 flex items-center gap-1.5">
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider ${
                    msg.role === "user" ? "text-violet-300" : "text-cyan-300"
                  }`}
                >
                  {msg.role === "user" ? "Signed" : "SignPulse"}
                </span>
                {msg.emotion && (
                  <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] text-white/40">
                    {msg.emotion}
                  </span>
                )}
              </div>
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
