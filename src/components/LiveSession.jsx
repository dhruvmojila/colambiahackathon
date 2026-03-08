"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  Wifi,
  WifiOff,
  Hand,
  Zap,
  Clock,
  AlertCircle,
  RefreshCw,
  Trash2,
} from "lucide-react";
import CameraFeed from "@/components/CameraFeed";
import TranscriptPanel from "@/components/TranscriptPanel";
import EnvironmentBadge from "@/components/EnvironmentBadge";
import AudioVisualizer from "@/components/AudioVisualizer";
import LanguageSelector from "@/components/LanguageSelector";

export default function LiveSession() {
  const [messages, setMessages] = useState([]);
  const [environment, setEnvironment] = useState(null);
  const [language, setLanguage] = useState("en");
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [statusText, setStatusText] = useState("Ready");
  const [error, setError] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [framesSent, setFramesSent] = useState(0);
  const [retryCount, setRetryCount] = useState(0);

  const sessionIdRef = useRef("session-" + Date.now());
  const processingRef = useRef(false);
  const analyserRef = useRef(null);
  const timerRef = useRef(null);
  const maxRetries = 3;

  // Session timer
  useEffect(() => {
    if (sessionActive) {
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((e) => e + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionActive]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // Send a frame to the backend for analysis
  const handleFrame = useCallback(
    async (base64Frame) => {
      if (!sessionActive || processingRef.current) return;
      processingRef.current = true;
      setIsProcessing(true);
      setStatusText("Analyzing…");
      setError(null);

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const res = await fetch("/api/live", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "frame",
            data: base64Frame,
            language,
            sessionId: sessionIdRef.current,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(
            errData.details || errData.error || `API error ${res.status}`,
          );
        }

        const data = await res.json();
        setRetryCount(0); // Reset retry on success
        setFramesSent((c) => c + 1);

        if (data.results) {
          for (const result of data.results) {
            if (result.type === "transcript") {
              setMessages((prev) => [
                ...prev,
                {
                  role: result.role,
                  text: result.text,
                  emotion: result.emotion,
                  timestamp: Date.now(),
                },
              ]);
            }
            if (result.type === "environment") {
              setEnvironment(result.environment);
            }
          }
        }

        setStatusText("Listening…");
      } catch (err) {
        console.error("Frame analysis error:", err);

        if (err.name === "AbortError") {
          setError("Request timed out. The API is slow — retrying…");
        } else {
          setError(err.message || "Failed to analyze frame");
        }

        setRetryCount((c) => c + 1);

        if (retryCount >= maxRetries) {
          setStatusText("Too many errors — pausing");
          setError(
            "Multiple failures detected. Check your API credentials and service account.",
          );
        } else {
          setStatusText("Error — will retry…");
        }
      } finally {
        processingRef.current = false;
        setIsProcessing(false);
      }
    },
    [sessionActive, language, retryCount],
  );

  // Start session
  const startSession = useCallback(async () => {
    sessionIdRef.current = "session-" + Date.now();
    setMessages([]);
    setEnvironment(null);
    setError(null);
    setFramesSent(0);
    setRetryCount(0);

    try {
      const res = await fetch("/api/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "config",
          language,
          sessionId: sessionIdRef.current,
        }),
      });

      if (res.ok) {
        setIsConnected(true);
        setSessionActive(true);
        setStatusText("Connected — start signing!");
      } else {
        throw new Error("Failed to initialize session");
      }
    } catch (err) {
      setError(err.message || "Connection failed. Is the server running?");
      setStatusText("Connection failed");
    }
  }, [language]);

  // End session
  const endSession = useCallback(async () => {
    try {
      await fetch("/api/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "end",
          sessionId: sessionIdRef.current,
        }),
      });
    } catch {
      // ignore cleanup errors
    }
    setIsConnected(false);
    setSessionActive(false);
    setStatusText("Session ended");
    setError(null);
    processingRef.current = false;
  }, []);

  // Toggle session
  const toggleSession = useCallback(() => {
    if (sessionActive) {
      endSession();
    } else {
      startSession();
    }
  }, [sessionActive, startSession, endSession]);

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setMessages([]);
  }, []);

  // Dismiss error
  const dismissError = useCallback(() => {
    setError(null);
    setRetryCount(0);
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0a0a18]">
      {/* Top bar */}
      <header className="flex items-center gap-3 border-b border-white/5 px-4 py-3 md:px-6">
        <Link
          href="/"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 transition hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4 text-white/60" />
        </Link>

        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-cyan-400">
            <Activity className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-bold text-white">
            Sign<span className="glow-text">Pulse</span>
          </span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Session timer */}
          {sessionActive && (
            <div className="flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1">
              <Clock className="h-3 w-3 text-white/40" />
              <span className="font-mono text-[10px] text-white/50">
                {formatTime(elapsed)}
              </span>
              <span className="text-[9px] text-white/25">•</span>
              <span className="text-[10px] text-white/35">
                {framesSent} frames
              </span>
            </div>
          )}

          {/* Connection status */}
          <div className="flex items-center gap-1.5">
            {isConnected ? (
              <Wifi className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-white/25" />
            )}
            <span
              className={`text-[10px] font-medium ${
                isConnected ? "text-emerald-300" : "text-white/30"
              }`}
            >
              {isConnected ? "Connected" : "Offline"}
            </span>
          </div>

          {/* Processing indicator */}
          {isProcessing && (
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 animate-pulse text-yellow-400" />
              <span className="text-[10px] text-yellow-300">{statusText}</span>
            </div>
          )}

          {/* Status text when idle */}
          {!isProcessing && sessionActive && (
            <span className="text-[10px] text-cyan-300/60">{statusText}</span>
          )}
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 md:mx-6">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <p className="flex-1 text-xs text-red-200/80">{error}</p>
          <button
            onClick={dismissError}
            className="shrink-0 rounded-md bg-red-500/20 px-2.5 py-1 text-[10px] text-red-300 transition hover:bg-red-500/30"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 gap-4 overflow-hidden p-4 md:p-6">
        {/* Left: Camera + controls */}
        <div className="flex w-full flex-col gap-3 md:w-1/2 lg:w-[45%]">
          {/* Camera feed */}
          <div className="glow-border rounded-2xl">
            <CameraFeed onFrame={handleFrame} active={sessionActive} />
          </div>

          {/* Controls row */}
          <div className="grid grid-cols-2 gap-3">
            <LanguageSelector value={language} onChange={setLanguage} />
            <EnvironmentBadge environment={environment} />
          </div>

          {/* Audio visualizer */}
          <AudioVisualizer
            isPlaying={isAudioPlaying}
            analyserNode={analyserRef.current}
          />

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={toggleSession}
              className={`group flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all duration-300 ${
                sessionActive
                  ? "bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-500/20"
                  : "bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-lg shadow-violet-500/20 hover:shadow-xl hover:shadow-violet-500/30 hover:scale-[1.02]"
              }`}
            >
              {sessionActive ? (
                <>
                  <Hand className="h-4 w-4" />
                  End Session
                </>
              ) : (
                <>
                  <Hand className="h-4 w-4 transition-transform group-hover:rotate-12" />
                  Start Translating
                </>
              )}
            </button>

            {/* Clear transcript */}
            {messages.length > 0 && (
              <button
                onClick={clearTranscript}
                className="flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 transition hover:bg-white/10"
                title="Clear transcript"
              >
                <Trash2 className="h-4 w-4 text-white/40" />
              </button>
            )}
          </div>
        </div>

        {/* Right: Transcript */}
        <div className="hidden flex-1 md:flex">
          <TranscriptPanel messages={messages} />
        </div>
      </div>

      {/* Mobile transcript (bottom sheet style) */}
      <div className="flex-1 overflow-hidden px-4 pb-4 md:hidden">
        <TranscriptPanel messages={messages} />
      </div>
    </div>
  );
}
