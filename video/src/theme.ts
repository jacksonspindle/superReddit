// SuperReddit Demo Video Theme
export const COLORS = {
  bg: "#0a0a0a",
  bgCard: "#141414",
  bgCardHover: "#1a1a1a",
  bgMuted: "#1e1e1e",
  surface: "#111113",
  surface2: "#18181b",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.15)",
  fg: "#fafafa",
  fgMuted: "#a1a1a1",
  fgDim: "#737373",

  // Brand
  orange: "#f97316",
  orangeBg: "rgba(249,115,22,0.12)",
  orangeGlow: "rgba(249,115,22,0.3)",

  // Semantic
  hot: "#ef4444",
  hotBg: "rgba(239,68,68,0.15)",
  warm: "#f59e0b",
  warmBg: "rgba(245,158,11,0.12)",
  cold: "#6b7280",
  coldBg: "rgba(107,114,128,0.15)",
  green: "#22c55e",
  greenBg: "rgba(34,197,94,0.12)",
  blue: "#3b82f6",
  blueBg: "rgba(59,130,246,0.12)",
  purple: "#a855f7",
  purpleBg: "rgba(168,85,247,0.12)",
  cyan: "#06b6d4",
  red: "#ef4444",
  redBg: "rgba(239,68,68,0.12)",
  accent: "#a78bfa",
  accentBg: "rgba(167,139,250,0.08)",

  // Reddit
  reddit: "#ff4500",
} as const;

export const FONT = {
  family: "Inter",
  mono: "JetBrains Mono",
} as const;

export const COMP = {
  width: 1280,
  height: 1024,
  fps: 30,
  totalFrames: 1580,
} as const;

// Scene durations (adjusted for 15-frame cross-fades between scenes)
// Total visible = sum(durations) - 6*15 = 1670 - 90 = 1580
export const SCENES = {
  S01: { duration: 225, label: "Opening" },
  S02: { duration: 365, label: "Signals" },
  S03: { duration: 255, label: "Alerts" },
  S04: { duration: 255, label: "Swipe Queue" },
  S05: { duration: 255, label: "Chat Overlay" },
  S06: { duration: 195, label: "AI" },
  S07: { duration: 120, label: "CTA" },
} as const;

export const TRANSITION_DURATION = 15;
