"use client";

import { useMemo } from "react";

type Props = {
  current: number;
  total: number;
  sizePx?: number;
  strokeWidth?: number;
  className?: string;
};

export default function MiniStepRing({ current, total, sizePx = 52, strokeWidth = 3.5, className }: Props) {
  const safeTotal = Math.max(1, total);
  const safeCurrent = Math.min(Math.max(0, current), safeTotal);

  const progress = safeCurrent / safeTotal;

  const radius = (sizePx - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const dashoffset = useMemo(() => circumference * (1 - progress), [circumference, progress]);

  return (
    <div
      className={className}
      role="img"
      aria-label={`Étape ${safeCurrent} sur ${safeTotal}`}
      aria-live="polite"
    >
      <svg width={sizePx} height={sizePx} viewBox={`0 0 ${sizePx} ${sizePx}`} className="block">
        <circle
          cx={sizePx / 2}
          cy={sizePx / 2}
          r={radius}
          fill="none"
          stroke="rgb(226 232 240)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={sizePx / 2}
          cy={sizePx / 2}
          r={radius}
          fill="none"
          stroke="var(--dogshift-blue)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          style={{ transition: "stroke-dashoffset 280ms ease" }}
          transform={`rotate(-90 ${sizePx / 2} ${sizePx / 2})`}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          className="fill-slate-700 text-[11px] font-semibold"
        >
          {safeCurrent} / {safeTotal}
        </text>
      </svg>
    </div>
  );
}
