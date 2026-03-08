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
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
import CameraFeed from "@/components/CameraFeed";
import TranscriptPanel from "@/components/TranscriptPanel";
import EnvironmentBadge from "@/components/EnvironmentBadge";
import AudioVisualizer from "@/components/AudioVisualizer";
import LanguageSelector from "@/components/LanguageSelector";
import SignDetectionBadge from "@/components/SignDetectionBadge";
import EmoticonBurst from "@/components/EmoticonBurst";
import { captureAndPredict } from "@/lib/sign-api-client";

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
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [signPrediction, setSignPrediction] = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [faceEmotion, setFaceEmotion] = useState("neutral");

  const sessionIdRef = useRef("session-" + Date.now());
  const processingRef = useRef(false);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const timerRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const streamRef = useRef(null);
  const detectIntervalRef = useRef(null);
  const maxRetries = 3;

  // --- Audio context ---
  const ensureAudioContext = useCallback(() => {
    if (audioContextRef.current) return audioContextRef.current;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.8;
    analyser.connect(ctx.destination);
    audioContextRef.current = ctx;
    analyserRef.current = analyser;
    return ctx;
  }, []);

  // --- Audio playback ---
  const playAudio = useCallback(
    async (base64Audio) => {
      if (!audioEnabled) return;
      try {
        const ctx = ensureAudioContext();
        if (ctx.state === "suspended") await ctx.resume();
        const binaryStr = atob(base64Audio);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++)
          bytes[i] = binaryStr.charCodeAt(i);
        const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(analyserRef.current);
        setIsAudioPlaying(true);
        isPlayingRef.current = true;
        source.onended = () => {
          setIsAudioPlaying(false);
          isPlayingRef.current = false;
          processAudioQueue();
        };
        source.start();
      } catch (err) {
        console.error("Audio playback error:", err);
        setIsAudioPlaying(false);
        isPlayingRef.current = false;
        processAudioQueue();
      }
    },
    [audioEnabled, ensureAudioContext],
  );

  const queueAudio = useCallback(
    (base64Audio) => {
      if (!audioEnabled) return;
      audioQueueRef.current.push(base64Audio);
      if (!isPlayingRef.current) processAudioQueue();
    },
    [audioEnabled],
  );

  const processAudioQueue = useCallback(() => {
    if (audioQueueRef.current.length === 0) return;
    const next = audioQueueRef.current.shift();
    playAudio(next);
  }, [playAudio]);

  // --- Timer ---
  useEffect(() => {
    if (sessionActive) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionActive]);

  const fmtTime = (s) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // --- Stream ready ---
  const handleStreamReady = useCallback((s) => {
    streamRef.current = s;
  }, []);

  // --- Sign-API loop ---
  useEffect(() => {
    if (!sessionActive || !streamRef.current) {
      if (detectIntervalRef.current) {
        clearInterval(detectIntervalRef.current);
        detectIntervalRef.current = null;
      }
      return;
    }
    const run = async () => {
      if (isDetecting || !streamRef.current) return;
      setIsDetecting(true);
      try {
        const pred = await captureAndPredict(streamRef.current, 2000);
        setSignPrediction(pred);
        if (pred?.intent && pred.confidence > 0.3) {
          setMessages((prev) => [
            ...prev,
            {
              role: "user",
              text: `[ASL: "${pred.intent}" — ${Math.round(pred.confidence * 100)}%]`,
              emotion: "neutral",
              timestamp: Date.now(),
              isDetection: true,
            },
          ]);
        }
      } catch (err) {
        console.error("Sign detection:", err.message);
      } finally {
        setIsDetecting(false);
      }
    };
    const t = setTimeout(run, 1000);
    detectIntervalRef.current = setInterval(run, 3500);
    return () => {
      clearTimeout(t);
      clearInterval(detectIntervalRef.current);
      detectIntervalRef.current = null;
    };
  }, [sessionActive, isDetecting]);

  // --- Gemini frames ---
  const handleFrame = useCallback(
    async (base64Frame) => {
      if (!sessionActive || processingRef.current) return;
      processingRef.current = true;
      setIsProcessing(true);
      setStatusText("Analyzing…");
      setError(null);
      try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 30000);
        const signContext = signPrediction
          ? `Detected ASL sign: "${signPrediction.intent}" (${Math.round(signPrediction.confidence * 100)}%)`
          : null;
        const res = await fetch("/api/live", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "frame",
            data: base64Frame,
            language,
            sessionId: sessionIdRef.current,
            signContext,
            faceEmotion,
          }),
          signal: controller.signal,
        });
        clearTimeout(tid);
        if (!res.ok) {
          const ed = await res.json().catch(() => ({}));
          throw new Error(ed.details || ed.error || `API ${res.status}`);
        }
        const data = await res.json();
        setRetryCount(0);
        setFramesSent((c) => c + 1);
        if (data.results) {
          for (const r of data.results) {
            if (r.type === "transcript") {
              setMessages((prev) => [
                ...prev,
                {
                  role: r.role,
                  text: r.text,
                  emotion: r.emotion,
                  timestamp: Date.now(),
                },
              ]);
            }
            if (r.type === "environment") setEnvironment(r.environment);
            if (r.type === "audio" && r.audioData) queueAudio(r.audioData);
          }
        }
        setStatusText("Listening…");
      } catch (err) {
        console.error("Frame error:", err);
        if (err.name === "AbortError") setError("Timed out — retrying…");
        else setError(err.message || "Frame analysis failed");
        setRetryCount((c) => c + 1);
        if (retryCount >= maxRetries) {
          setStatusText("Paused — too many errors");
          setError("Check API credentials and enabled APIs.");
        } else {
          setStatusText("Retrying…");
        }
      } finally {
        processingRef.current = false;
        setIsProcessing(false);
      }
    },
    [
      sessionActive,
      language,
      retryCount,
      queueAudio,
      signPrediction,
      faceEmotion,
    ],
  );

  // --- Session controls ---
  const startSession = useCallback(async () => {
    sessionIdRef.current = "session-" + Date.now();
    setMessages([]);
    setEnvironment(null);
    setError(null);
    setFramesSent(0);
    setRetryCount(0);
    setSignPrediction(null);
    audioQueueRef.current = [];
    ensureAudioContext();
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
      } else throw new Error("Session init failed");
    } catch (err) {
      setError(err.message || "Connection failed");
      setStatusText("Connection failed");
    }
  }, [language, ensureAudioContext]);

  const endSession = useCallback(async () => {
    try {
      await fetch("/api/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "end", sessionId: sessionIdRef.current }),
      });
    } catch {}
    setIsConnected(false);
    setSessionActive(false);
    setStatusText("Session ended");
    setError(null);
    processingRef.current = false;
    audioQueueRef.current = [];
    setIsAudioPlaying(false);
    setSignPrediction(null);
  }, []);

  const toggleSession = useCallback(() => {
    sessionActive ? endSession() : startSession();
  }, [sessionActive, startSession, endSession]);

  const clearTranscript = useCallback(() => setMessages([]), []);
  const dismissError = useCallback(() => {
    setError(null);
    setRetryCount(0);
  }, []);

  useEffect(() => {
    return () => {
      audioContextRef.current?.close().catch(() => {});
    };
  }, []);

  return (
    <div className="flex h-[100dvh] flex-col bg-[#0a0a18]">
      {/* ===== HEADER — compact, mobile-safe ===== */}
      <header className="flex shrink-0 items-center gap-2 border-b border-white/5 px-3 py-2.5 md:px-6 md:py-3">
        <Link
          href="/"
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 transition hover:bg-white/10"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-white/60" />
        </Link>

        <div className="flex items-center gap-1.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-cyan-400">
            <Activity className="h-3 w-3 text-white" />
          </div>
          <span className="text-xs font-bold text-white md:text-sm">
            Sign<span className="glow-text">Pulse</span>
          </span>
        </div>

        {/* Right side controls */}
        <div className="ml-auto flex items-center gap-2">
          {sessionActive && (
            <div className="hidden items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 sm:flex">
              <Clock className="h-2.5 w-2.5 text-white/40" />
              <span className="font-mono text-[9px] text-white/50">
                {fmtTime(elapsed)}
              </span>
              <span className="text-[8px] text-white/20">•</span>
              <span className="text-[9px] text-white/30">{framesSent}f</span>
            </div>
          )}

          <button
            onClick={() => setAudioEnabled((v) => !v)}
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 transition ${
              audioEnabled
                ? "bg-violet-500/15 text-violet-300"
                : "bg-white/5 text-white/25"
            }`}
          >
            {audioEnabled ? (
              <Volume2 className="h-3 w-3" />
            ) : (
              <VolumeX className="h-3 w-3" />
            )}
            <span className="hidden text-[9px] sm:inline">
              {audioEnabled ? "Voice" : "Muted"}
            </span>
          </button>

          <div className="flex items-center gap-1">
            {isConnected ? (
              <Wifi className="h-3 w-3 text-emerald-400" />
            ) : (
              <WifiOff className="h-3 w-3 text-white/25" />
            )}
          </div>

          {isProcessing && (
            <Zap className="h-3 w-3 animate-pulse text-yellow-400" />
          )}
        </div>
      </header>

      {/* ===== ERROR ===== */}
      {error && (
        <div className="mx-3 mt-2 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 md:mx-6">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
          <p className="flex-1 text-[11px] text-red-200/80 line-clamp-2">
            {error}
          </p>
          <button
            onClick={dismissError}
            className="shrink-0 text-[10px] text-red-300 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ===== MAIN LAYOUT ===== */}
      {/* Desktop: side-by-side | Mobile: scrollable column */}
      <div className="flex flex-1 flex-col overflow-hidden md:flex-row md:gap-4 md:p-6">
        {/* ---- LEFT COLUMN: Camera + controls ---- */}
        <div className="flex flex-col md:w-1/2 lg:w-[45%] md:shrink-0">
          {/* Camera with emoji overlay */}
          <div className="relative p-3 pb-0 md:p-0">
            <div className="glow-border rounded-2xl">
              <CameraFeed
                onFrame={handleFrame}
                onStreamReady={handleStreamReady}
                onEmotionChange={setFaceEmotion}
                active={sessionActive}
              />
            </div>
            {/* Emoji graffiti overlay */}
            <EmoticonBurst emotion={faceEmotion} active={sessionActive} />
          </div>

          {/* Controls strip */}
          <div className="flex gap-2 px-3 pt-2 md:px-0 md:pt-3">
            <div className="flex-1">
              <LanguageSelector value={language} onChange={setLanguage} />
            </div>
            <div className="flex-1">
              <EnvironmentBadge environment={environment} />
            </div>
          </div>

          {/* Sign detection */}
          <div className="px-3 pt-2 md:px-0 md:pt-2">
            <SignDetectionBadge prediction={signPrediction} />
          </div>

          {/* Audio visualizer — hidden on mobile to save space */}
          <div className="hidden px-3 pt-2 md:block md:px-0 md:pt-2">
            <AudioVisualizer
              isPlaying={isAudioPlaying}
              analyserNode={analyserRef.current}
            />
          </div>

          {/* ===== ACTION BUTTON — always visible ===== */}
          <div className="flex gap-2 px-3 py-2 md:px-0 md:py-3">
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
            {messages.length > 0 && (
              <button
                onClick={clearTranscript}
                className="flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 transition hover:bg-white/10"
              >
                <Trash2 className="h-4 w-4 text-white/40" />
              </button>
            )}
          </div>
        </div>

        {/* ---- RIGHT COLUMN: Transcript ---- */}
        {/* Desktop */}
        <div className="hidden flex-1 overflow-hidden md:flex">
          <TranscriptPanel messages={messages} />
        </div>

        {/* Mobile — fills remaining space below button */}
        <div className="min-h-0 flex-1 overflow-hidden px-3 pb-3 md:hidden">
          <TranscriptPanel messages={messages} />
        </div>
      </div>
    </div>
  );
}
