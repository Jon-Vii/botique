import { useMemo } from "react";

type GaugeSize = "sm" | "md" | "lg";
type GaugeColor = "orange" | "emerald" | "teal" | "violet" | "rose" | "amber";

interface GaugeProps {
  /** Percentage value from 0 to 100 */
  value: number;
  /** Diameter of the gauge */
  size?: GaugeSize;
  /** Accent color for the progress arc */
  color?: GaugeColor;
  /** Whether to display the numeric value in the center */
  showValue?: boolean;
  /** Optional label shown below the value */
  label?: string;
}

const sizeConfig: Record<GaugeSize, { px: number; stroke: number; fontSize: number; labelSize: number }> = {
  sm: { px: 48, stroke: 3, fontSize: 12, labelSize: 8 },
  md: { px: 64, stroke: 4, fontSize: 16, labelSize: 9 },
  lg: { px: 96, stroke: 5, fontSize: 22, labelSize: 10 },
};

const colorMap: Record<GaugeColor, string> = {
  orange: "var(--color-orange)",
  emerald: "var(--color-emerald)",
  teal: "var(--color-teal)",
  violet: "var(--color-violet)",
  rose: "var(--color-rose)",
  amber: "var(--color-amber)",
};

export function Gauge({
  value,
  size = "md",
  color = "orange",
  showValue = true,
  label,
}: GaugeProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const config = sizeConfig[size];
  const accentColor = colorMap[color];

  const { radius, circumference, offset } = useMemo(() => {
    const r = (config.px - config.stroke) / 2;
    const c = 2 * Math.PI * r;
    const o = c - (clamped / 100) * c;
    return { radius: r, circumference: c, offset: o };
  }, [config.px, config.stroke, clamped]);

  const center = config.px / 2;

  return (
    <div
      className="inline-flex flex-col items-center"
      role="meter"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? `${clamped}%`}
    >
      <svg
        width={config.px}
        height={config.px}
        viewBox={`0 0 ${config.px} ${config.px}`}
        fill="none"
      >
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="var(--color-gray-3)"
          strokeWidth={config.stroke}
          strokeLinecap="round"
          fill="none"
        />
        {/* Progress arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke={accentColor}
          strokeWidth={config.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          fill="none"
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        {/* Center text */}
        {showValue && (
          <text
            x={center}
            y={label ? center - (config.labelSize * 0.4) : center}
            textAnchor="middle"
            dominantBaseline="central"
            fill={accentColor}
            fontFamily="var(--font-mono)"
            fontWeight={700}
            fontSize={config.fontSize}
          >
            {Math.round(clamped)}
          </text>
        )}
        {/* Label text */}
        {showValue && label && (
          <text
            x={center}
            y={center + config.fontSize * 0.55}
            textAnchor="middle"
            dominantBaseline="central"
            fill="var(--color-muted)"
            fontFamily="var(--font-mono)"
            fontWeight={500}
            fontSize={config.labelSize}
          >
            {label}
          </text>
        )}
      </svg>
    </div>
  );
}
