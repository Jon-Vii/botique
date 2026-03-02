// Unified Botique design tokens
// Supports both dark "agent POV" scenes and light "product showcase" scenes
import { FONT } from "./fonts";

export { FONT };

// ── Dark snippet theme (agent's inner experience) ──────
// Primary palette for the agent-POV video
export const C = {
  // Dark mode core
  bg: "#1A1918",
  bgLighter: "#242220",
  text: "#E8E4DE",
  muted: "#A8A099",
  dim: "#6B6560",

  // Orange — the agent's "attention"
  orange: "#FF7000",
  orangeDark: "#E56200",
  orangeLight: "#FF8F33",
  orange50: "#FFF4EB",
  orangeDim: "rgba(255, 112, 0, 0.15)",
  orangeGlow: "rgba(255, 112, 0, 0.25)",
  orangeFaint: "rgba(255, 112, 0, 0.06)",

  // Borders
  border: "rgba(255, 255, 255, 0.08)",
  borderOrange: "rgba(255, 112, 0, 0.3)",

  // Accent colors
  green: "#10B981",
  greenDim: "rgba(16, 185, 129, 0.15)",
  red: "#F43F5E",
  redDim: "rgba(244, 63, 94, 0.15)",
  violet: "#8B5CF6",
  violetDim: "rgba(139, 92, 246, 0.10)",
  teal: "#0EA5E9",
  tealDim: "rgba(14, 165, 233, 0.10)",
  amber: "#F59E0B",
  amberDim: "rgba(245, 158, 11, 0.10)",
  emerald: "#10B981",
  emeraldDim: "rgba(16, 185, 129, 0.10)",
  rose: "#F43F5E",

  // Light theme aliases (for showcase scenes)
  cream: "#FAFAF6",
  white: "#FFFFFF",
  warm50: "#F5F3EE",
  warm100: "#ECEADE",
  ink: "#2D2B2A",
  secondary: "#6B6560",
  rule: "rgba(160, 150, 140, 0.20)",
  gray2: "#F5F3EE",
  gray3: "#ECEADE",
  gray4: "#E0DDD5",

  // Snippet aliases
  snippetBg: "#1A1918",
  snippetText: "#E8E4DE",
} as const;

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const TOTAL_FRAMES = 2100; // 70 seconds

// Agent-POV scene frame map (dark mode narrative)
export const SCENE = {
  boot:        { from: 0,    duration: 90  },   //  3.0s
  briefing:    { from: 90,   duration: 270 },   //  9.0s
  reasoning:   { from: 360,  duration: 210 },   //  7.0s
  toolCalls:   { from: 570,  duration: 510 },   // 17.0s
  dayResolves: { from: 1080, duration: 300 },   // 10.0s
  reveal:      { from: 1380, duration: 390 },   // 13.0s
  titleCard:   { from: 1770, duration: 330 },   // 11.0s
} as const;

// Showcase scene durations (light mode, if used in alt composition)
export const DUR = {
  title: 135,
  whatIsIt: 270,
  agentDay: 390,
  simEngine: 330,
  tournament: 360,
  capabilities: 240,
  closing: 240,
  bridge: 120,
} as const;

export const T = 12; // transition overlap frames
