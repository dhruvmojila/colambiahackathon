"use client";

/**
 * SignPulse AI — Sign detection result overlay.
 * Shows the detected ASL sign, confidence, and top alternatives.
 */

import { Hand, TrendingUp } from "lucide-react";

export default function SignDetectionBadge({ prediction }) {
  if (!prediction) {
    return (
      <div className="glass-panel-sm flex items-center gap-2 px-4 py-2.5">
        <Hand className="h-3.5 w-3.5 text-white/20 animate-pulse" />
        <span className="text-xs text-white/25">Detecting signs…</span>
      </div>
    );
  }

  const { intent, confidence, top5 } = prediction;
  const confPercent = Math.round(confidence * 100);

  const confColor =
    confPercent >= 80
      ? "text-emerald-400"
      : confPercent >= 50
        ? "text-yellow-400"
        : "text-red-400";

  const confBg =
    confPercent >= 80
      ? "bg-emerald-500/10"
      : confPercent >= 50
        ? "bg-yellow-500/10"
        : "bg-red-500/10";

  return (
    <div className="glass-panel-sm space-y-2.5 px-4 py-3 transition-all duration-500">
      {/* Main detection */}
      <div className="flex items-center gap-2.5">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${confBg}`}
        >
          <Hand className={`h-4 w-4 ${confColor}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold capitalize text-white/90">{intent}</p>
          <div className="flex items-center gap-1.5">
            <div className="h-1 flex-1 rounded-full bg-white/10">
              <div
                className={`h-1 rounded-full transition-all duration-700 ${
                  confPercent >= 80
                    ? "bg-emerald-400"
                    : confPercent >= 50
                      ? "bg-yellow-400"
                      : "bg-red-400"
                }`}
                style={{ width: `${confPercent}%` }}
              />
            </div>
            <span className={`text-[10px] font-semibold ${confColor}`}>
              {confPercent}%
            </span>
          </div>
        </div>
      </div>

      {/* Top alternatives */}
      {top5 && top5.length > 1 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <TrendingUp className="h-2.5 w-2.5 text-white/20" />
            <span className="text-[9px] uppercase tracking-wider text-white/25">
              Alternatives
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {top5.slice(1, 4).map((alt, i) => (
              <span
                key={i}
                className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] text-white/40"
              >
                {alt.word}{" "}
                <span className="text-white/20">
                  {Math.round(alt.confidence * 100)}%
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
