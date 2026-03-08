"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { VideoOff, Camera } from "lucide-react";

export default function CameraFeed({ onFrame, active = false }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const mountedRef = useRef(true);
  const [hasCamera, setHasCamera] = useState(false);
  const [error, setError] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);

  // Start camera
  const startCamera = useCallback(async () => {
    if (streamRef.current) return; // already running
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(() => {});
          if (mountedRef.current) {
            setHasCamera(true);
            setCameraReady(true);
          }
        };
      }
      setError(null);
    } catch {
      if (mountedRef.current) {
        setError("Camera access denied. Please grant permission.");
        setHasCamera(false);
      }
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setHasCamera(false);
    setCameraReady(false);
  }, []);

  // Start frame capture when active and camera ready
  useEffect(() => {
    if (!cameraReady || !active || !onFrame) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");

    intervalRef.current = setInterval(() => {
      if (video.readyState >= 2) {
        canvas.width = 640;
        canvas.height = 480;
        ctx.drawImage(video, 0, 0, 640, 480);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.5);
        const base64 = dataUrl.split(",")[1];
        if (base64) onFrame(base64);
      }
    }, 1500); // 1 frame every 1.5s

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [cameraReady, active, onFrame]);

  // Lifecycle: start camera immediately for preview, stop on unmount
  useEffect(() => {
    mountedRef.current = true;
    startCamera();
    return () => {
      mountedRef.current = false;
      stopCamera();
    };
  }, []);

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black/50">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`h-full w-full object-cover transition-opacity duration-500 ${
          hasCamera ? "opacity-100" : "opacity-0"
        }`}
        style={{ transform: "scaleX(-1)" }}
      />

      <canvas ref={canvasRef} className="hidden" />

      {/* Overlay when no camera */}
      {!hasCamera && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="rounded-full bg-white/5 p-4">
            {error ? (
              <VideoOff className="h-8 w-8 text-red-400/50" />
            ) : (
              <Camera className="h-8 w-8 text-white/20 animate-pulse" />
            )}
          </div>
          <p className="text-sm text-white/40 px-6 text-center">
            {error || "Starting camera..."}
          </p>
          {error && (
            <button
              onClick={startCamera}
              className="mt-1 rounded-full bg-white/10 px-4 py-1.5 text-xs text-white/60 transition hover:bg-white/15"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Live indicator */}
      {hasCamera && (
        <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/50 px-3 py-1 backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="text-xs text-white/70">Live</span>
        </div>
      )}

      {/* Active scanning overlay */}
      {hasCamera && active && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-4 top-4 h-8 w-8 border-l-2 border-t-2 border-cyan-400/50 rounded-tl-lg" />
          <div className="absolute right-4 top-4 h-8 w-8 border-r-2 border-t-2 border-cyan-400/50 rounded-tr-lg" />
          <div className="absolute bottom-4 left-4 h-8 w-8 border-b-2 border-l-2 border-cyan-400/50 rounded-bl-lg" />
          <div className="absolute bottom-4 right-4 h-8 w-8 border-b-2 border-r-2 border-cyan-400/50 rounded-br-lg" />
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 backdrop-blur-sm">
            <span className="text-[10px] text-cyan-300">Analyzing signs…</span>
          </div>
        </div>
      )}
    </div>
  );
}
