export const MODEL_COLORS = [
  { stroke: "#f97316", fill: "#f97316", label: "orange" },
  { stroke: "#8b5cf6", fill: "#8b5cf6", label: "violet" },
  { stroke: "#10b981", fill: "#10b981", label: "emerald" },
  { stroke: "#06b6d4", fill: "#06b6d4", label: "sky" },
  { stroke: "#f43f5e", fill: "#f43f5e", label: "rose" },
  { stroke: "#f59e0b", fill: "#f59e0b", label: "amber" },
] as const;

export type ModelCurve = {
  model: string;
  color: (typeof MODEL_COLORS)[number];
  points: { day: number; balance: number }[];
  runCurves: { runId: string; points: { day: number; balance: number }[] }[];
};
