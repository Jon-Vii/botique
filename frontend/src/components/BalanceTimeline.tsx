import { useState } from "react";
import { formatCurrency } from "../lib/format";

/* ── Colors per model (stable rotation) ── */

export const MODEL_COLORS = [
  { stroke: "#f97316", fill: "#f97316", label: "orange" },   // orange
  { stroke: "#8b5cf6", fill: "#8b5cf6", label: "violet" },   // violet
  { stroke: "#10b981", fill: "#10b981", label: "emerald" },   // emerald
  { stroke: "#06b6d4", fill: "#06b6d4", label: "sky" },      // sky/cyan
  { stroke: "#f43f5e", fill: "#f43f5e", label: "rose" },     // rose
  { stroke: "#f59e0b", fill: "#f59e0b", label: "amber" },    // amber
];

export type ModelCurve = {
  model: string;
  color: (typeof MODEL_COLORS)[number];
  /** Averaged balance at each day index (0-based) */
  points: { day: number; balance: number }[];
  /** Individual run curves for ghost lines */
  runCurves: { runId: string; points: { day: number; balance: number }[] }[];
};

/* ── SVG Balance Timeline ── */

const CHART_H = 280;
const CHART_PAD = { top: 20, right: 24, bottom: 36, left: 64 };

export function BalanceTimeline({
  curves,
  ghostLines = true,
}: {
  curves: ModelCurve[];
  ghostLines?: boolean;
}) {
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  // Compute bounds
  const allPoints = curves.flatMap((c) => c.points);
  if (allPoints.length === 0) return null;

  const minDay = Math.min(...allPoints.map((p) => p.day));
  const maxDay = Math.max(...allPoints.map((p) => p.day));

  const allBalances = [
    ...allPoints.map((p) => p.balance),
    ...curves.flatMap((c) =>
      c.runCurves.flatMap((rc) => rc.points.map((p) => p.balance)),
    ),
  ];
  const minBal = Math.min(...allBalances);
  const maxBal = Math.max(...allBalances);
  const balPad = (maxBal - minBal) * 0.08 || 10;
  const yMin = minBal - balPad;
  const yMax = maxBal + balPad;

  const dayRange = maxDay - minDay || 1;

  const W = 800;
  const plotW = W - CHART_PAD.left - CHART_PAD.right;
  const plotH = CHART_H - CHART_PAD.top - CHART_PAD.bottom;

  const x = (day: number) =>
    CHART_PAD.left + ((day - minDay) / dayRange) * plotW;
  const y = (bal: number) =>
    CHART_PAD.top + (1 - (bal - yMin) / (yMax - yMin)) * plotH;

  function pathD(pts: { day: number; balance: number }[]): string {
    if (pts.length === 0) return "";
    return pts
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.day).toFixed(1)},${y(p.balance).toFixed(1)}`)
      .join(" ");
  }

  // Y-axis ticks
  const yTickCount = 5;
  const yTicks: number[] = [];
  for (let i = 0; i <= yTickCount; i++) {
    yTicks.push(yMin + (i / yTickCount) * (yMax - yMin));
  }

  // X-axis ticks
  const xStep = Math.max(1, Math.ceil(dayRange / 10));
  const xTicks: number[] = [];
  for (let d = minDay; d <= maxDay; d += xStep) {
    xTicks.push(d);
  }
  if (xTicks[xTicks.length - 1] !== maxDay) xTicks.push(maxDay);

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const dayFloat = minDay + ((svgX - CHART_PAD.left) / plotW) * dayRange;
    const closest = Math.round(dayFloat);
    if (closest >= minDay && closest <= maxDay) {
      setHoveredDay(closest);
    } else {
      setHoveredDay(null);
    }
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${CHART_H}`}
        className="w-full h-auto"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredDay(null)}
      >
        {/* Grid lines */}
        {yTicks.map((tick) => (
          <line
            key={tick}
            x1={CHART_PAD.left}
            x2={W - CHART_PAD.right}
            y1={y(tick)}
            y2={y(tick)}
            stroke="currentColor"
            className="text-rule"
            strokeWidth={0.5}
            strokeDasharray="4 3"
          />
        ))}

        {/* Y-axis labels */}
        {yTicks.map((tick) => (
          <text
            key={tick}
            x={CHART_PAD.left - 8}
            y={y(tick) + 3}
            textAnchor="end"
            className="fill-muted"
            fontSize={9}
            fontFamily="var(--font-mono)"
          >
            ${tick.toFixed(0)}
          </text>
        ))}

        {/* X-axis labels */}
        {xTicks.map((tick) => (
          <text
            key={tick}
            x={x(tick)}
            y={CHART_H - CHART_PAD.bottom + 18}
            textAnchor="middle"
            className="fill-muted"
            fontSize={9}
            fontFamily="var(--font-mono)"
          >
            Day {tick}
          </text>
        ))}

        {/* Ghost lines: individual runs, very faint */}
        {ghostLines && curves.map((curve) =>
          curve.runCurves.map((rc) => (
            <path
              key={rc.runId}
              d={pathD(rc.points)}
              fill="none"
              stroke={curve.color.stroke}
              strokeWidth={1}
              opacity={0.12}
            />
          )),
        )}

        {/* Main model curves */}
        {curves.map((curve) => (
          <path
            key={curve.model}
            d={pathD(curve.points)}
            fill="none"
            stroke={curve.color.stroke}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* Hover crosshair */}
        {hoveredDay !== null && (
          <line
            x1={x(hoveredDay)}
            x2={x(hoveredDay)}
            y1={CHART_PAD.top}
            y2={CHART_H - CHART_PAD.bottom}
            stroke="currentColor"
            className="text-muted"
            strokeWidth={0.5}
            strokeDasharray="3 2"
          />
        )}

        {/* Hover dots */}
        {hoveredDay !== null &&
          curves.map((curve) => {
            const pt = curve.points.reduce((best, p) =>
              Math.abs(p.day - hoveredDay) < Math.abs(best.day - hoveredDay)
                ? p
                : best,
            );
            if (Math.abs(pt.day - hoveredDay) > 2) return null;
            return (
              <circle
                key={curve.model}
                cx={x(pt.day)}
                cy={y(pt.balance)}
                r={4}
                fill={curve.color.stroke}
                stroke="white"
                strokeWidth={1.5}
              />
            );
          })}
      </svg>

      {/* Hover tooltip */}
      {hoveredDay !== null && (
        <div
          className="absolute top-2 right-2 bg-white border border-rule px-3 py-2 shadow-sm pointer-events-none"
          style={{ minWidth: 140 }}
        >
          <div className="text-[10px] font-mono text-muted mb-1">
            Day {hoveredDay}
          </div>
          {curves.map((curve) => {
            const pt = curve.points.reduce((best, p) =>
              Math.abs(p.day - hoveredDay) < Math.abs(best.day - hoveredDay)
                ? p
                : best,
            );
            if (Math.abs(pt.day - hoveredDay) > 2) return null;
            return (
              <div
                key={curve.model}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: curve.color.stroke }}
                  />
                  <span className="font-mono text-secondary truncate max-w-[120px]">
                    {curve.model}
                  </span>
                </span>
                <span className="num font-semibold text-ink">
                  {formatCurrency(pt.balance)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-4 px-1">
        {curves.map((curve) => (
          <span
            key={curve.model}
            className="flex items-center gap-1.5 text-xs font-mono text-secondary"
          >
            <span
              className="inline-block w-3 h-0.5"
              style={{ backgroundColor: curve.color.stroke }}
            />
            {curve.model}
            {curve.runCurves.length > 1 && (
              <span className="text-muted">
                ({curve.runCurves.length} runs)
              </span>
            )}
          </span>
        ))}
        {curves.some((c) => c.runCurves.length > 1) && ghostLines && (
          <span className="text-[10px] text-muted italic">
            faint lines = individual runs, bold = average
          </span>
        )}
      </div>
    </div>
  );
}
