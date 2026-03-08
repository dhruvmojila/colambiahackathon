"use client";

import { MapPin } from "lucide-react";

const envIcons = {
  hospital: "🏥",
  cafe: "☕",
  office: "🏢",
  school: "🏫",
  store: "🛒",
  restaurant: "🍽️",
  home: "🏠",
  outdoor: "🌳",
  transit: "🚌",
  default: "📍",
};

export default function EnvironmentBadge({ environment }) {
  if (!environment) {
    return (
      <div className="glass-panel-sm flex items-center gap-2 px-4 py-2.5">
        <MapPin className="h-3.5 w-3.5 text-white/30" />
        <span className="text-xs text-white/30">Analyzing environment…</span>
      </div>
    );
  }

  const emoji = envIcons[environment.type?.toLowerCase()] || envIcons.default;

  return (
    <div className="glass-panel-sm flex items-center gap-2.5 px-4 py-2.5 transition-all duration-300">
      <span className="text-base">{emoji}</span>
      <div>
        <p className="text-xs font-semibold text-white/80">
          {environment.label || environment.type}
        </p>
        {environment.detail && (
          <p className="text-[10px] text-white/40">{environment.detail}</p>
        )}
      </div>
    </div>
  );
}
