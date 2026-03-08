"use client";

import {
  MapPin,
  Building2,
  Coffee,
  Stethoscope,
  GraduationCap,
  ShoppingCart,
  TreePine,
  Bus,
  Utensils,
  Home,
} from "lucide-react";

const envConfig = {
  hospital: {
    icon: Stethoscope,
    color: "text-red-400",
    bg: "bg-red-500/10",
    label: "Medical",
  },
  cafe: {
    icon: Coffee,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    label: "Café",
  },
  office: {
    icon: Building2,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    label: "Office",
  },
  school: {
    icon: GraduationCap,
    color: "text-green-400",
    bg: "bg-green-500/10",
    label: "School",
  },
  store: {
    icon: ShoppingCart,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    label: "Store",
  },
  restaurant: {
    icon: Utensils,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    label: "Restaurant",
  },
  home: {
    icon: Home,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    label: "Home",
  },
  outdoor: {
    icon: TreePine,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    label: "Outdoor",
  },
  transit: {
    icon: Bus,
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
    label: "Transit",
  },
};

export default function EnvironmentBadge({ environment }) {
  if (!environment) {
    return (
      <div className="glass-panel-sm flex items-center gap-2 px-4 py-2.5">
        <MapPin className="h-3.5 w-3.5 text-white/20 animate-pulse" />
        <span className="text-xs text-white/25">Analyzing environment…</span>
      </div>
    );
  }

  const type = environment.type?.toLowerCase() || "unknown";
  const config = envConfig[type] || {
    icon: MapPin,
    color: "text-white/50",
    bg: "bg-white/5",
    label: "Unknown",
  };
  const Icon = config.icon;

  return (
    <div
      className={`glass-panel-sm flex items-center gap-2.5 px-4 py-2.5 transition-all duration-500`}
    >
      <div
        className={`flex h-7 w-7 items-center justify-center rounded-lg ${config.bg}`}
      >
        <Icon className={`h-3.5 w-3.5 ${config.color}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-white/80">
          {environment.label || config.label}
        </p>
        {environment.detail && (
          <p className="truncate text-[10px] text-white/35">
            {environment.detail}
          </p>
        )}
      </div>
    </div>
  );
}
