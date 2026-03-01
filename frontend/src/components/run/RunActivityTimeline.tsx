import { useMemo, useState, useCallback } from "react";
import { ChartLineUp } from "@phosphor-icons/react";
import type { DaySnapshot } from "../../types/api";
import { formatCurrency } from "../../lib/format";

/* ── Swim-lane category config ── */

type LaneConfig = {
  label: string;
  color: string;
  tools: string[];
};

const LANES: LaneConfig[] = [
  {
    label: "Listings",
    color: "#14b8a6", // teal
    tools: ["create_draft_listing", "update_listing", "publish_listing"],
  },
  {
    label: "Market",
    color: "#8b5cf6", // violet
    tools: ["get_active_listings", "get_taxonomy_nodes"],
  },
  {
    label: "Memory",
    color: "#f59e0b", // amber
    tools: ["add_journal_entry", "set_reminder", "complete_reminder"],
  },
  {
    label: "Sales",
    color: "#10b981", // emerald
    tools: ["get_shop_receipts", "get_shop_reviews"],
  },
];

function classifyToolCalls(
  toolCalls: string[],
): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>();

  for (const lane of LANES) {
    const counts = new Map<string, number>();
    for (const tool of toolCalls) {
      if (lane.tools.includes(tool)) {
        counts.set(tool, (counts.get(tool) ?? 0) + 1);
      }
    }
    if (counts.size > 0) {
      result.set(lane.label, counts);
    }
  }

  return result;
}

/* ── Chart constants ── */

const W = 800;
const CHART_H = 200;
const LANES_H = 60;
const TOTAL_H = CHART_H + LANES_H;
const PAD = { top: 16, right: 24, bottom: 28, left: 56 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = CHART_H - PAD.top - PAD.bottom;

/* ── Component ── */

export function RunActivityTimeline({
  days,
  selectedDay,
  onSelectDay,
}: {
  days: DaySnapshot[];
  selectedDay: number;
  onSelectDay: (day: number) => void;
}) {
  const [hoveredDayIdx, setHoveredDayIdx] = useState<number | null>(null);

  const sorted = useMemo(
    () => [...days].sort((a, b) => a.day - b.day),
    [days],
  );

  const { minBal, maxBal, maxRev, dayRange, minDay, maxDay, colW } =
    useMemo(() => {
      const balances = sorted.map((d) => d.available_balance);
      const revenues = sorted.map((d) => d.yesterday_revenue ?? 0);
      const min = Math.min(...balances);
      const max = Math.max(...balances);
      const pad = (max - min) * 0.1 || 10;
      const mDay = sorted[0]?.day ?? 1;
      const xDay = sorted[sorted.length - 1]?.day ?? 1;
      const range = xDay - mDay || 1;

      return {
        minBal: min - pad,
        maxBal: max + pad,
        maxRev: Math.max(...revenues, 1),
        dayRange: range,
        minDay: mDay,
        maxDay: xDay,
        colW: PLOT_W / Math.max(sorted.length - 1, 1),
      };
    }, [sorted]);

  const x = useCallback(
    (day: number) => PAD.left + ((day - minDay) / dayRange) * PLOT_W,
    [minDay, dayRange],
  );

  const yBal = useCallback(
    (bal: number) =>
      PAD.top + (1 - (bal - minBal) / (maxBal - minBal)) * PLOT_H,
    [minBal, maxBal],
  );

  const yRev = useCallback(
    (rev: number) => {
      const barMaxH = PLOT_H * 0.4;
      return CHART_H - PAD.bottom - (rev / maxRev) * barMaxH;
    },
    [maxRev],
  );

  /* Build balance path */
  const balancePath = useMemo(() => {
    if (sorted.length === 0) return "";
    return sorted
      .map(
        (d, i) =>
          `${i === 0 ? "M" : "L"}${x(d.day).toFixed(1)},${yBal(d.available_balance).toFixed(1)}`,
      )
      .join(" ");
  }, [sorted, x, yBal]);

  /* Y-axis ticks */
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let i = 0; i <= 4; i++) {
      ticks.push(minBal + (i / 4) * (maxBal - minBal));
    }
    return ticks;
  }, [minBal, maxBal]);

  /* X-axis ticks */
  const xTicks = useMemo(() => {
    const step = Math.max(1, Math.ceil(dayRange / 10));
    const ticks: number[] = [];
    for (let d = minDay; d <= maxDay; d += step) ticks.push(d);
    if (ticks[ticks.length - 1] !== maxDay) ticks.push(maxDay);
    return ticks;
  }, [minDay, maxDay, dayRange]);

  /* Swim lane data per day */
  const laneData = useMemo(
    () =>
      sorted.map((d) => ({
        day: d.day,
        lanes: classifyToolCalls(d.tool_calls ?? []),
      })),
    [sorted],
  );

  /* Hover logic */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const svgX = ((e.clientX - rect.left) / rect.width) * W;
      const dayFloat = minDay + ((svgX - PAD.left) / PLOT_W) * dayRange;

      // Find closest day index
      let closest = 0;
      let closestDist = Infinity;
      for (let i = 0; i < sorted.length; i++) {
        const dist = Math.abs(sorted[i].day - dayFloat);
        if (dist < closestDist) {
          closestDist = dist;
          closest = i;
        }
      }
      setHoveredDayIdx(closest);
    },
    [sorted, minDay, dayRange],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const svgX = ((e.clientX - rect.left) / rect.width) * W;
      const dayFloat = minDay + ((svgX - PAD.left) / PLOT_W) * dayRange;

      let closest = 0;
      let closestDist = Infinity;
      for (let i = 0; i < sorted.length; i++) {
        const dist = Math.abs(sorted[i].day - dayFloat);
        if (dist < closestDist) {
          closestDist = dist;
          closest = i;
        }
      }
      onSelectDay(sorted[closest].day);
    },
    [sorted, minDay, dayRange, onSelectDay],
  );

  if (sorted.length === 0) return null;

  const hoveredDay = hoveredDayIdx !== null ? sorted[hoveredDayIdx] : null;
  const selectedIdx = sorted.findIndex((d) => d.day === selectedDay);

  return (
    <div className="tech-card overflow-hidden">
      <div className="px-5 py-3 border-b border-rule flex items-center gap-2">
        <ChartLineUp size={14} weight="duotone" className="text-orange" />
        <span className="font-pixel-grid text-[10px] text-orange uppercase tracking-widest">
          Activity Timeline
        </span>
      </div>

      <div className="relative px-3 py-3">
        <svg
          viewBox={`0 0 ${W} ${TOTAL_H}`}
          className="w-full h-auto cursor-crosshair select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredDayIdx(null)}
          onClick={handleClick}
        >
          {/* ── Panel 1: Balance + Revenue ── */}

          {/* Grid lines */}
          {yTicks.map((tick) => (
            <line
              key={tick}
              x1={PAD.left}
              x2={W - PAD.right}
              y1={yBal(tick)}
              y2={yBal(tick)}
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
              x={PAD.left - 8}
              y={yBal(tick) + 3}
              textAnchor="end"
              className="fill-muted"
              fontSize={9}
              fontFamily="var(--font-mono)"
            >
              ${tick.toFixed(0)}
            </text>
          ))}

          {/* Revenue bars */}
          {sorted.map((d) => {
            const rev = d.yesterday_revenue ?? 0;
            if (rev <= 0) return null;
            const barTop = yRev(rev);
            const barBottom = CHART_H - PAD.bottom;
            const barH = barBottom - barTop;
            const barW = Math.max(colW * 0.5, 4);
            return (
              <rect
                key={`rev-${d.day}`}
                x={x(d.day) - barW / 2}
                y={barTop}
                width={barW}
                height={barH}
                fill="#10b981"
                opacity={0.2}
                rx={1}
              />
            );
          })}

          {/* Balance line */}
          <path
            d={balancePath}
            fill="none"
            stroke="#f97316"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Balance dots */}
          {sorted.map((d) => (
            <circle
              key={`dot-${d.day}`}
              cx={x(d.day)}
              cy={yBal(d.available_balance)}
              r={3}
              fill="#f97316"
              opacity={0.6}
            />
          ))}

          {/* Selected day highlight band */}
          {selectedIdx >= 0 && (
            <rect
              x={x(sorted[selectedIdx].day) - colW * 0.35}
              y={PAD.top}
              width={Math.max(colW * 0.7, 6)}
              height={TOTAL_H - PAD.top}
              fill="#f97316"
              opacity={0.08}
            />
          )}

          {/* Hover crosshair */}
          {hoveredDay && (
            <>
              <line
                x1={x(hoveredDay.day)}
                x2={x(hoveredDay.day)}
                y1={PAD.top}
                y2={TOTAL_H}
                stroke="currentColor"
                className="text-muted"
                strokeWidth={0.5}
                strokeDasharray="3 2"
              />
              <circle
                cx={x(hoveredDay.day)}
                cy={yBal(hoveredDay.available_balance)}
                r={5}
                fill="#f97316"
                stroke="white"
                strokeWidth={2}
              />
            </>
          )}

          {/* X-axis labels */}
          {xTicks.map((tick) => (
            <text
              key={tick}
              x={x(tick)}
              y={CHART_H - PAD.bottom + 16}
              textAnchor="middle"
              className="fill-muted"
              fontSize={9}
              fontFamily="var(--font-mono)"
            >
              Day {tick}
            </text>
          ))}

          {/* ── Panel 2: Swim Lanes ── */}
          {LANES.map((lane, li) => {
            const laneY = CHART_H + li * (LANES_H / LANES.length);
            const laneH = LANES_H / LANES.length;
            const cy = laneY + laneH / 2;

            return (
              <g key={lane.label}>
                {/* Lane label */}
                <text
                  x={PAD.left - 8}
                  y={cy + 3}
                  textAnchor="end"
                  fontSize={8}
                  fontFamily="var(--font-mono)"
                  className="fill-muted"
                >
                  {lane.label}
                </text>

                {/* Lane separator */}
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={laneY}
                  y2={laneY}
                  stroke="currentColor"
                  className="text-rule"
                  strokeWidth={0.3}
                />

                {/* Activity dots */}
                {laneData.map(({ day, lanes }) => {
                  const laneCounts = lanes.get(lane.label);
                  if (!laneCounts) return null;
                  const total = [...laneCounts.values()].reduce(
                    (a, b) => a + b,
                    0,
                  );
                  const r = Math.min(2 + total * 1.2, 7);

                  return (
                    <circle
                      key={`${lane.label}-${day}`}
                      cx={x(day)}
                      cy={cy}
                      r={r}
                      fill={lane.color}
                      opacity={0.7}
                    >
                      <title>
                        {lane.label} day {day}: {[...laneCounts.entries()].map(([t, c]) => `${t} x${c}`).join(", ")}
                      </title>
                    </circle>
                  );
                })}
              </g>
            );
          })}
        </svg>

        {/* Hover tooltip */}
        {hoveredDay && (
          <div
            className="absolute top-4 right-4 bg-white border border-rule px-3 py-2 shadow-sm pointer-events-none z-10"
            style={{ minWidth: 160 }}
          >
            <div className="text-[10px] font-mono text-muted mb-1">
              Day {hoveredDay.day}
            </div>
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-orange" />
                <span className="text-secondary">Balance</span>
              </span>
              <span className="num font-semibold text-ink">
                {formatCurrency(hoveredDay.available_balance)}
              </span>
            </div>
            {(hoveredDay.yesterday_revenue ?? 0) > 0 && (
              <div className="flex items-center justify-between gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald" />
                  <span className="text-secondary">Revenue</span>
                </span>
                <span className="num font-semibold text-ink">
                  {formatCurrency(hoveredDay.yesterday_revenue ?? 0)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-secondary">Sales</span>
              <span className="num text-ink">
                {hoveredDay.total_sales_count}
              </span>
            </div>
            {hoveredDay.turn_count != null && (
              <div className="flex items-center justify-between gap-4 text-xs">
                <span className="text-secondary">Turns</span>
                <span className="num text-ink">{hoveredDay.turn_count}</span>
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="mt-2 flex flex-wrap items-center gap-4 px-1">
          <span className="flex items-center gap-1.5 text-[10px] font-mono text-secondary">
            <span className="inline-block w-3 h-0.5 bg-orange" />
            Balance
          </span>
          <span className="flex items-center gap-1.5 text-[10px] font-mono text-secondary">
            <span className="inline-block w-3 h-3 bg-emerald/20 border border-emerald/30" />
            Revenue
          </span>
          {LANES.map((lane) => (
            <span
              key={lane.label}
              className="flex items-center gap-1.5 text-[10px] font-mono text-secondary"
            >
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: lane.color, opacity: 0.7 }}
              />
              {lane.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
