"use client";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { IssueCategory } from "@/db/schema";
import { CATEGORY_COLORS, CATEGORY_LABELS, STATUS_LABELS } from "@/lib/constants";

const BRAND = "#123B5D";
const ACCENT = "#00A6A6";
const tick = { fill: "currentColor", fontSize: 12 };

function TooltipBox({ active, payload, label, suffix = "" }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; suffix?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink shadow-md">
      {label && <p className="mb-1 font-semibold">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-semibold tabular-nums">{p.value}{suffix}</span>
        </p>
      ))}
    </div>
  );
}

export function TrendChart({ data, height = 280 }: { data: { label: string; reported: number; resolved: number }[]; height?: number }) {
  return (
    <div className="text-muted" style={{ height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="gRep" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={BRAND} stopOpacity={0.35} />
              <stop offset="1" stopColor={BRAND} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gRes" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={ACCENT} stopOpacity={0.35} />
              <stop offset="1" stopColor={ACCENT} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} vertical={false} />
          <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} />
          <YAxis tick={tick} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip content={<TooltipBox />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="reported" name="Reported" stroke={BRAND} strokeWidth={2} fill="url(#gRep)" className="dark:[&_path]:stroke-brand-300" />
          <Area type="monotone" dataKey="resolved" name="Resolved" stroke={ACCENT} strokeWidth={2} fill="url(#gRes)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryDonut({ data, height = 260, stacked }: { data: { category: string; total: number }[]; height?: number; stacked?: boolean }) {
  const rows = data.map((d) => ({ name: CATEGORY_LABELS[d.category as IssueCategory] ?? d.category, value: d.total, color: CATEGORY_COLORS[d.category as IssueCategory] ?? "#888" }));
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <div className={stacked ? "grid gap-4" : "grid items-center gap-4 sm:grid-cols-2"}>
      <div className="relative" style={{ height }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="90%" paddingAngle={2} stroke="none">
              {rows.map((r) => (
                <Cell key={r.name} fill={r.color} />
              ))}
            </Pie>
            <Tooltip content={<TooltipBox />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-2xl font-bold tabular-nums">{total}</p>
            <p className="text-xs text-muted">issues</p>
          </div>
        </div>
      </div>
      <ul className="space-y-2 text-sm">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: r.color }} />{r.name}</span>
            <span className="tabular-nums text-muted">{r.value} · {total ? Math.round((r.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StackedDeptBar({ data, height = 300 }: { data: { name: string; open: number; resolved: number }[]; height?: number }) {
  return (
    <div className="text-muted" style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} horizontal={false} />
          <XAxis type="number" tick={tick} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="name" tick={tick} tickLine={false} axisLine={false} width={150} />
          <Tooltip content={<TooltipBox />} cursor={{ fill: "currentColor", fillOpacity: 0.06 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="resolved" name="Resolved" stackId="a" fill={ACCENT} radius={[0, 0, 0, 0]} />
          <Bar dataKey="open" name="Open" stackId="a" fill={BRAND} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SimpleBar({ data, dataKey, nameKey, color = ACCENT, height = 260, suffix = "", name = "Value" }: { data: Record<string, unknown>[]; dataKey: string; nameKey: string; color?: string; height?: number; suffix?: string; name?: string }) {
  return (
    <div className="text-muted" style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} vertical={false} />
          <XAxis dataKey={nameKey} tick={{ ...tick, fontSize: 11 }} tickLine={false} axisLine={false} interval={0} angle={data.length > 6 ? -30 : 0} textAnchor={data.length > 6 ? "end" : "middle"} height={data.length > 6 ? 60 : 30} />
          <YAxis tick={tick} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip content={<TooltipBox suffix={suffix} />} cursor={{ fill: "currentColor", fillOpacity: 0.06 }} />
          <Bar dataKey={dataKey} name={name} fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: "#94A3B8",
  UNDER_REVIEW: "#E8A400",
  ASSIGNED: "#1C7ED6",
  IN_PROGRESS: "#5C5FEF",
  RESOLVED: "#00A6A6",
  CLOSED: "#2F9E44",
  REJECTED: "#E03131",
};
export function StatusBars({ data, height = 260 }: { data: { status: string; total: number }[]; height?: number }) {
  const order = ["SUBMITTED", "UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "REJECTED"];
  const rows = order.map((s) => ({ name: STATUS_LABELS[s as keyof typeof STATUS_LABELS], total: data.find((d) => d.status === s)?.total ?? 0, color: STATUS_COLORS[s] }));
  return (
    <div className="text-muted" style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} vertical={false} />
          <XAxis dataKey="name" tick={{ ...tick, fontSize: 11 }} tickLine={false} axisLine={false} interval={0} />
          <YAxis tick={tick} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip content={<TooltipBox />} cursor={{ fill: "currentColor", fillOpacity: 0.06 }} />
          <Bar dataKey="total" name="Issues" radius={[4, 4, 0, 0]}>
            {rows.map((r) => (
              <Cell key={r.name} fill={r.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ScoreGauge({ value, label, height = 160 }: { value: number; label: string; height?: number }) {
  const color = value >= 75 ? "#2F9E44" : value >= 55 ? ACCENT : value >= 40 ? "#E8A400" : "#E03131";
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer>
        <RadialBarChart innerRadius="72%" outerRadius="100%" data={[{ value, fill: color }]} startAngle={210} endAngle={-30}>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar dataKey="value" cornerRadius={8} background={{ fill: "rgba(148,163,184,.2)" }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <p className="text-[11px] text-muted">{label}</p>
        </div>
      </div>
    </div>
  );
}
