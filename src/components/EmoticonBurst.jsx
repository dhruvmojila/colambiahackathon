"use client";

/**
 * EmoticonBurst — Single emoji bubble that pops up in the bottom-right
 * corner when the detected emotion changes.
 */

import { useRef, useEffect, useState } from "react";

const EMOTION_EMOJI = {
  happy: "😊",
  excited: "🤩",
  sad: "😢",
  angry: "😠",
  surprised: "😲",
  concerned: "😟",
  confused: "🤔",
  pain: "😣",
  urgent: "⚡",
  neutral: "🤟",
};

export default function EmoticonBurst({ emotion = "neutral", active = false }) {
  const [particles, setParticles] = useState([]);
  const idRef = useRef(0);
  const lastRef = useRef("neutral");

  // Spawn a single emoji when emotion changes
  useEffect(() => {
    if (!active) return;
    if (emotion === lastRef.current) return;
    lastRef.current = emotion;

    const emoji = EMOTION_EMOJI[emotion] || EMOTION_EMOJI.neutral;

    setParticles((prev) => [
      ...prev.slice(-6),
      {
        id: idRef.current++,
        emoji,
        x: 70 + Math.random() * 25, // bottom-right area
        startY: 75 + Math.random() * 15,
        size: 22 + Math.random() * 10,
        duration: 2.5 + Math.random() * 1,
        drift: -10 + Math.random() * 20,
        rotation: -30 + Math.random() * 60,
      },
    ]);
  }, [emotion, active]);

  // Clean up old particles
  useEffect(() => {
    if (particles.length === 0) return;
    const t = setTimeout(() => setParticles((p) => p.slice(-4)), 4000);
    return () => clearTimeout(t);
  }, [particles]);

  if (!active) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute animate-emoji-float"
          style={{
            left: `${p.x}%`,
            bottom: `${100 - p.startY}%`,
            fontSize: `${p.size}px`,
            "--drift": `${p.drift}px`,
            "--rot-start": `${p.rotation}deg`,
            "--rot-end": `${p.rotation + 40}deg`,
            animationDuration: `${p.duration}s`,
          }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}
