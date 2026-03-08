"use client";

import { useRef, useEffect } from "react";
import { Volume2 } from "lucide-react";

export default function AudioVisualizer({ isPlaying = false, analyserNode }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;

    function drawIdle() {
      ctx.clearRect(0, 0, w, h);
      const bars = 32;
      const barWidth = (w / bars) * 0.7;
      const gap = (w / bars) * 0.3;

      for (let i = 0; i < bars; i++) {
        const x = i * (barWidth + gap);
        const baseH = 2 + Math.sin(Date.now() * 0.002 + i * 0.3) * 2;
        const gradient = ctx.createLinearGradient(
          x,
          h / 2 - baseH,
          x,
          h / 2 + baseH,
        );
        gradient.addColorStop(0, "rgba(139, 92, 246, 0.3)");
        gradient.addColorStop(1, "rgba(6, 182, 212, 0.1)");
        ctx.fillStyle = gradient;
        ctx.fillRect(x, h / 2 - baseH, barWidth, baseH * 2);
      }
      animRef.current = requestAnimationFrame(drawIdle);
    }

    function drawActive() {
      ctx.clearRect(0, 0, w, h);
      const bars = 32;
      const barWidth = (w / bars) * 0.7;
      const gap = (w / bars) * 0.3;

      let dataArray;
      if (analyserNode) {
        dataArray = new Uint8Array(analyserNode.frequencyBinCount);
        analyserNode.getByteFrequencyData(dataArray);
      }

      for (let i = 0; i < bars; i++) {
        const x = i * (barWidth + gap);
        let barH;
        if (dataArray) {
          const idx = Math.floor((i / bars) * dataArray.length);
          barH = (dataArray[idx] / 255) * (h / 2 - 4);
        } else {
          barH = 4 + Math.sin(Date.now() * 0.005 + i * 0.4) * (h / 4);
        }
        barH = Math.max(barH, 2);

        const gradient = ctx.createLinearGradient(
          x,
          h / 2 - barH,
          x,
          h / 2 + barH,
        );
        gradient.addColorStop(0, "rgba(139, 92, 246, 0.8)");
        gradient.addColorStop(0.5, "rgba(6, 182, 212, 0.6)");
        gradient.addColorStop(1, "rgba(217, 70, 239, 0.4)");
        ctx.fillStyle = gradient;

        ctx.beginPath();
        ctx.roundRect(x, h / 2 - barH, barWidth, barH * 2, 2);
        ctx.fill();
      }
      animRef.current = requestAnimationFrame(drawActive);
    }

    if (isPlaying) drawActive();
    else drawIdle();

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, analyserNode]);

  return (
    <div className="glass-panel-sm flex items-center gap-3 px-4 py-3">
      <Volume2
        className={`h-4 w-4 shrink-0 transition-colors ${
          isPlaying ? "text-cyan-400" : "text-white/25"
        }`}
      />
      <canvas ref={canvasRef} width={256} height={40} className="h-6 w-full" />
    </div>
  );
}
