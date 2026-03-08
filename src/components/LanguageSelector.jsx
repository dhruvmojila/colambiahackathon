"use client";

import { Globe } from "lucide-react";

const languages = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "ko", label: "한국어", flag: "🇰🇷" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
];

export default function LanguageSelector({ value, onChange }) {
  return (
    <div className="glass-panel-sm flex items-center gap-2 px-4 py-2">
      <Globe className="h-3.5 w-3.5 text-cyan-400" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 appearance-none bg-transparent text-xs text-white/80 outline-none cursor-pointer"
      >
        {languages.map((lang) => (
          <option
            key={lang.code}
            value={lang.code}
            className="bg-zinc-900 text-white"
          >
            {lang.flag} {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
}
