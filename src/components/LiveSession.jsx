"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  Wifi,
  WifiOff,
  Hand,
  Settings,
  Zap,
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
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);

  // Connect to our backend WebSocket proxy
  const connectWebSocket = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/live`);

    ws.onopen = () => {
      setIsConnected(true);
      // Send initial config
      ws.send(
        JSON.stringify({
          type: "config",
          language,
        }),
      );
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "transcript") {
          setMessages((prev) => [
            ...prev,
            {
              role: data.role,
              text: data.text,
              emotion: data.emotion,
            },
          ]);
          setIsProcessing(false);
        }

        if (data.type === "environment") {
          setEnvironment(data.environment);
        }

        if (data.type === "audio") {
          playAudio(data.audioData);
        }

        if (data.type === "processing") {
          setIsProcessing(data.active);
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    ws.onerror = () => {
      setIsConnected(false);
    };

    wsRef.current = ws;
  }, [language]);

  const disconnectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Send camera frames to backend
  const handleFrame = useCallback((base64Frame) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "frame",
          data: base64Frame,
        }),
      );
    }
  }, []);

  // Play emotive audio from backend
  const playAudio = useCallback(async (base64Audio) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (
          window.AudioContext || window.webkitAudioContext
        )();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 64;
      }

      const audioData = Uint8Array.from(atob(base64Audio), (c) =>
        c.charCodeAt(0),
      );
      const audioBuffer = await audioContextRef.current.decodeAudioData(
        audioData.buffer,
      );
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);

      setIsAudioPlaying(true);
      source.onended = () => setIsAudioPlaying(false);
      source.start();
    } catch {
      setIsAudioPlaying(false);
    }
  }, []);

  // Toggle session
  const toggleSession = useCallback(() => {
    if (sessionActive) {
      disconnectWebSocket();
      setSessionActive(false);
    } else {
      connectWebSocket();
      setSessionActive(true);
    }
  }, [sessionActive, connectWebSocket, disconnectWebSocket]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectWebSocket();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [disconnectWebSocket]);

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
              <span className="text-[10px] text-yellow-300">Processing…</span>
            </div>
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
