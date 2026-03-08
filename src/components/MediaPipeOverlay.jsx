"use client";

/**
 * MediaPipeOverlay — draws hand bounding boxes + landmarks and face emotion
 * on a canvas overlaid on top of the camera feed.
 */

import { useRef, useEffect } from "react";

const HAND_COLORS = ["#22d3ee", "#a78bfa"]; // cyan, violet
const SKELETON_CONNECTIONS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4], // thumb
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8], // index
  [0, 9],
  [9, 10],
  [10, 11],
  [11, 12], // middle
  [0, 13],
  [13, 14],
  [14, 15],
  [15, 16], // ring
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20], // pinky
  [5, 9],
  [9, 13],
  [13, 17], // palm
];

export default function MediaPipeOverlay({ hands, faceEmotion, isLoaded }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const glowPhaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const parent = canvas.parentElement;

    function draw() {
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      ctx.clearRect(0, 0, w, h);
      glowPhaseRef.current += 0.03;
      const glowAlpha = 0.4 + 0.3 * Math.sin(glowPhaseRef.current);

      // Draw hand landmarks and bounding boxes
      if (hands && hands.length > 0) {
        hands.forEach((hand, idx) => {
          const color = HAND_COLORS[idx % HAND_COLORS.length];

          // Camera is mirrored, so flip X
          const flipX = (x) => (1 - x) * w;

          // Draw skeleton connections
          ctx.lineWidth = 2;
          ctx.strokeStyle = color + "80"; // 50% alpha
          ctx.beginPath();
          for (const [a, b] of SKELETON_CONNECTIONS) {
            if (hand.landmarks[a] && hand.landmarks[b]) {
              const ax = flipX(hand.landmarks[a].x);
              const ay = hand.landmarks[a].y * h;
              const bx = flipX(hand.landmarks[b].x);
              const by = hand.landmarks[b].y * h;
              ctx.moveTo(ax, ay);
              ctx.lineTo(bx, by);
            }
          }
          ctx.stroke();

          // Draw landmark points
          ctx.fillStyle = color;
          for (const lm of hand.landmarks) {
            const x = flipX(lm.x);
            const y = lm.y * h;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
          }

          // Draw bounding box
          const bb = hand.boundingBox;
          const bx = flipX(bb.maxX); // flip
          const by = bb.minY * h;
          const bw = (bb.maxX - bb.minX) * w;
          const bh = (bb.maxY - bb.minY) * h;

          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 4]);
          ctx.shadowColor = color;
          ctx.shadowBlur = 10 * glowAlpha;
          ctx.strokeRect(bx, by, bw, bh);
          ctx.setLineDash([]);
          ctx.shadowBlur = 0;

          // Hand label
          const label = hand.handedness === "Left" ? "Right" : "Left"; // mirrored
          ctx.font = "bold 11px 'Outfit', sans-serif";
          ctx.fillStyle = color;
          const labelW = ctx.measureText(label).width + 12;
          ctx.fillStyle = "#000000aa";
          ctx.fillRect(bx, by - 20, labelW, 18);
          ctx.fillStyle = color;
          ctx.fillText(label, bx + 6, by - 6);
        });
      }

      // Face emotion badge (top-right of overlay)
      if (faceEmotion && faceEmotion !== "neutral") {
        const emotionEmoji = {
          happy: "😊",
          excited: "😄",
          sad: "😢",
          angry: "😠",
          surprised: "😲",
          concerned: "😟",
          confused: "🤔",
          urgent: "⚡",
          pain: "😣",
        };

        const emoji = emotionEmoji[faceEmotion] || "😐";
        const text = `${emoji} ${faceEmotion}`;

        ctx.font = "bold 12px 'Outfit', sans-serif";
        const tw = ctx.measureText(text).width + 16;

        // Draw badge background
        const badgeX = w - tw - 12;
        const badgeY = 12;
        ctx.fillStyle = "#00000088";
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, tw, 24, 12);
        ctx.fill();

        // Draw text
        ctx.fillStyle = "#ffffff";
        ctx.fillText(text, badgeX + 8, badgeY + 16);
      }

      // Loading indicator
      if (!isLoaded) {
        ctx.font = "11px 'Outfit', sans-serif";
        ctx.fillStyle = "#ffffff40";
        ctx.fillText("Loading MediaPipe…", 12, h - 12);
      }

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [hands, faceEmotion, isLoaded]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-10"
      style={{ transform: "scaleX(1)" }} // Already handling flip in draw
    />
  );
}
