"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { Activity, ArrowLeft, Wifi, WifiOff, Hand, Zap } from "lucide-react";
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
  const sessionIdRef = useRef("session-" + Date.now());
  const processingRef = useRef(false);
  const analyserRef = useRef(null);

  // Send a frame to the backend for analysis
  const handleFrame = useCallback(
    async (base64Frame) => {
      if (!sessionActive || processingRef.current) return;
      processingRef.current = true;
      setIsProcessing(true);
      setStatusText("Analyzing…");

      try {
        const res = await fetch("/api/live", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "frame",
            data: base64Frame,
            language,
            sessionId: sessionIdRef.current,
          }),
        });

        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }

        const data = await res.json();

        if (data.results) {
          for (const result of data.results) {
            if (result.type === "transcript") {
              setMessages((prev) => [
                ...prev,
                {
                  role: result.role,
                  text: result.text,
                  emotion: result.emotion,
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
        setStatusText("Error — retrying…");
      } finally {
        processingRef.current = false;
        setIsProcessing(false);
      }
    },
    [sessionActive, language],
  );

  // Start session
  const startSession = useCallback(async () => {
    sessionIdRef.current = "session-" + Date.now();
    setMessages([]);
    setEnvironment(null);

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
      }
    } catch {
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
      // ignore
    }
    setIsConnected(false);
    setSessionActive(false);
    setStatusText("Session ended");
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

          {/* Status text when not processing */}
          {!isProcessing && sessionActive && (
            <span className="text-[10px] text-cyan-300/60">{statusText}</span>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 gap-4 overflow-hidden p-4 md:p-6">
        {/* Left: Camera + controls */}
        <div className="flex w-full flex-col gap-4 md:w-1/2 lg:w-[45%]">
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

          {/* Start / Stop button */}
          <button
            onClick={toggleSession}
            className={`group flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition-all duration-300 ${
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
