"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Video, VideoOff } from "lucide-react";

export default function CameraFeed({ onFrame, active = true }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const [hasCamera, setHasCamera] = useState(false);
  const [error, setError] = useState(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setHasCamera(true);
      setError(null);
    } catch (err) {
      setError("Camera access denied. Please grant permission.");
      setHasCamera(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setHasCamera(false);
  }, []);

  // Capture frames for the backend
  useEffect(() => {
    if (!hasCamera || !active || !onFrame) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");

    intervalRef.current = setInterval(() => {
      if (video.readyState >= 2) {
        canvas.width = 640;
        canvas.height = 480;
        ctx.drawImage(video, 0, 0, 640, 480);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
        // Strip the data URL prefix to get raw base64
        const base64 = dataUrl.split(",")[1];
        onFrame(base64);
      }
    }, 1000); // 1 frame per second for Gemini Live API

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [hasCamera, active, onFrame]);

  useEffect(() => {
    if (active) startCamera();
    return () => stopCamera();
  }, [active, startCamera, stopCamera]);

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black/50">
      {/* Video feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`h-full w-full object-cover ${hasCamera ? "opacity-100" : "opacity-0"} transition-opacity duration-500`}
        style={{ transform: "scaleX(-1)" }}
      />

      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Overlay when no camera */}
      {!hasCamera && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="rounded-full bg-white/5 p-4">
            <VideoOff className="h-8 w-8 text-white/30" />
          </div>
          <p className="text-sm text-white/40">
            {error || "Initializing camera..."}
          </p>
        </div>
      )}

      {/* Status indicator */}
      {hasCamera && (
        <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/40 px-3 py-1 backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="text-xs text-white/70">Live</span>
        </div>
      )}

      {/* Scanning overlay */}
      {hasCamera && active && (
        <div className="pointer-events-none absolute inset-0">
          {/* Corner brackets */}
          <div className="absolute left-4 top-4 h-8 w-8 border-l-2 border-t-2 border-cyan-400/50 rounded-tl-lg" />
          <div className="absolute right-4 top-4 h-8 w-8 border-r-2 border-t-2 border-cyan-400/50 rounded-tr-lg" />
          <div className="absolute bottom-4 left-4 h-8 w-8 border-b-2 border-l-2 border-cyan-400/50 rounded-bl-lg" />
          <div className="absolute bottom-4 right-4 h-8 w-8 border-b-2 border-r-2 border-cyan-400/50 rounded-br-lg" />
        </div>
      )}
    </div>
  );
}
