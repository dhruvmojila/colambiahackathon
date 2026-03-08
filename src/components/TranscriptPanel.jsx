"use client";

import { useRef, useEffect, useState } from "react";
import { MessageSquare, Sparkles, AlertTriangle } from "lucide-react";

export default function TranscriptPanel({ messages = [] }) {
  const endRef = useRef(null);
  const [showTyping, setShowTyping] = useState(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });

    // Brief typing indicator when new messages arrive
    if (messages.length > 0) {
      setShowTyping(true);
      const t = setTimeout(() => setShowTyping(false), 600);
      return () => clearTimeout(t);
    }
  }, [messages]);

  const getEmotionEmoji = (emotion) => {
    const map = {
      neutral: "😐",
      happy: "😊",
      excited: "😄",
      concerned: "😟",
      urgent: "⚡",
      sad: "😢",
      confused: "🤔",
      angry: "😠",
      surprised: "😲",
      calm: "😌",
    };
    return map[emotion?.toLowerCase()] || null;
  };

  const getConfidenceColor = (confidence) => {
    if (confidence === "high") return "text-emerald-400";
    if (confidence === "medium") return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div className="glass-panel flex h-full w-full flex-col overflow-hidden">
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
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="rounded-full bg-white/5 p-4">
              <Sparkles className="h-6 w-6 text-violet-400/30" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/30">
                Ready to interpret
              </p>
              <p className="mt-1 text-[11px] text-white/20">
                Click &quot;Start Translating&quot; and begin signing
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={`${i}-${msg.timestamp || i}`}
            className="animate-fade-in-up"
            style={{ animationDuration: "0.3s", animationDelay: "0s" }}
          >
            <div
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed transition-all ${
                  msg.role === "user"
                    ? "rounded-br-md bg-violet-600/20 text-violet-100 border border-violet-500/10"
                    : "rounded-bl-md bg-white/[0.04] text-white/80 border border-white/5"
                }`}
              >
                {/* Header row */}
                <div className="mb-1.5 flex items-center gap-1.5">
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider ${
                      msg.role === "user" ? "text-violet-300" : "text-cyan-300"
                    }`}
                  >
                    {msg.role === "user" ? "✋ Signed" : "🔊 SignPulse"}
                  </span>

                  {/* Emotion badge */}
                  {msg.emotion && msg.emotion !== "neutral" && (
                    <span className="flex items-center gap-0.5 rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] text-white/45">
                      {getEmotionEmoji(msg.emotion)}
                      <span className="ml-0.5">{msg.emotion}</span>
                    </span>
                  )}

                  {/* Timestamp */}
                  {msg.timestamp && (
                    <span className="ml-auto text-[9px] text-white/15">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  )}
                </div>

                {/* Message text */}
                <div className="text-[13px]">{msg.text}</div>
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {showTyping && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-white/[0.04] px-4 py-3 border border-white/5">
              <div className="flex gap-1">
                <span
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-400/60"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-400/60"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-400/60"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>
    </div>
  );
}
