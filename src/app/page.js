"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Activity, Globe, Mic, Eye, ArrowRight, Sparkles } from "lucide-react";

const HeroScene = dynamic(() => import("@/components/three/HeroScene"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[#0a0a18]" />,
});

const features = [
  {
    icon: Eye,
    title: "Environmental Awareness",
    desc: "Sees the room, not just hands. Context-aware translation that understands surroundings.",
    color: "from-cyan-400 to-blue-500",
  },
  {
    icon: Mic,
    title: "Emotive Speech",
    desc: "Tonal, expressive voice matching the signer's facial expressions and intensity.",
    color: "from-violet-400 to-purple-600",
  },
  {
    icon: Globe,
    title: "Multilingual",
    desc: "Instantly translate signs into 20+ spoken languages. A universal communication bridge.",
    color: "from-pink-400 to-rose-500",
  },
  {
    icon: Activity,
    title: "Live Agent",
    desc: "Real-time bidirectional flow with interruption handling for natural conversations.",
    color: "from-emerald-400 to-teal-500",
  },
];

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a18]">
      {/* Three.js Background */}
      <HeroScene />

      {/* Content overlay */}
      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Nav */}
        <nav className="flex items-center justify-between px-6 py-5 md:px-12">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">
              Sign<span className="glow-text">Pulse</span>
            </span>
          </div>
          <div className="hidden items-center gap-6 text-sm text-white/60 md:flex">
            <a href="#features" className="transition hover:text-white">
              Features
            </a>
            <a href="#tech" className="transition hover:text-white">
              Technology
            </a>
          </div>
        </nav>

        {/* Hero */}
        <main className="flex flex-1 flex-col items-center justify-center px-5 text-center md:px-6">
          <div className="animate-fade-in-up opacity-0">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70 backdrop-blur-sm md:px-4 md:py-1.5 md:text-xs">
              <Sparkles className="h-3 w-3 text-violet-400 md:h-3.5 md:w-3.5" />
              Powered by Google ADK &amp; Gemini
            </div>
          </div>

          <h1 className="animate-fade-in-up opacity-0 delay-100 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl md:text-7xl">
            Give Every Sign <span className="glow-text">a Voice</span>
          </h1>

          <p className="animate-fade-in-up opacity-0 delay-200 mt-4 max-w-xl text-base leading-relaxed text-white/55 md:mt-6 md:text-xl">
            Real-time, context-aware sign language translation with emotive
            speech. Your camera becomes a conversational partner.
          </p>

          <div className="animate-fade-in-up opacity-0 delay-300 mt-8 flex flex-col items-center gap-3 sm:flex-row md:mt-10 md:gap-4">
            <Link
              href="/session"
              className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-xl hover:shadow-violet-500/35 hover:scale-105 md:px-8 md:py-3.5"
            >
              Start Translating
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#features"
              className="rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white/70 backdrop-blur-sm transition hover:bg-white/5 hover:text-white md:px-8 md:py-3.5"
            >
              Learn More
            </a>
          </div>
        </main>

        {/* Features */}
        <section id="features" className="px-6 pb-24 pt-12 md:px-12">
          <div className="mx-auto grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="glass-panel group cursor-default p-6 transition-all duration-300 hover:scale-[1.03] hover:border-white/20"
                style={{ animationDelay: `${0.3 + i * 0.1}s` }}
              >
                <div
                  className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${f.color} shadow-lg`}
                >
                  <f.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="mb-2 text-sm font-semibold text-white">
                  {f.title}
                </h3>
                <p className="text-xs leading-relaxed text-white/50">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Tech badges */}
        <section id="tech" className="px-6 pb-16 md:px-12">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-3">
            {[
              "Gemini 3 Flash",
              "Google ADK",
              "Three.js",
              "Cloud Run",
              "WebSocket",
              "Multilingual TTS",
            ].map((t) => (
              <span
                key={t}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-white/50 backdrop-blur-sm"
              >
                {t}
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
