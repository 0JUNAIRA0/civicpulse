import { hoursToHuman } from "@/lib/utils";
import { ProgressBar } from "../ui";

type Row = { id: string; name: string; code: string; total: number; open: number; resolved: number; overdue: number; staff: number; avgHours: number | null; resolutionRate: number; onTimeRate: number; avgRating: number | null; score: number | null; rank: number | null };

export function RankingTable({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-left text-xs font-semibold tracking-wide text-muted uppercase">
          <tr>
            <th className="px-4 py-3">Rank</th>
            <th className="px-4 py-3">Department</th>
            <th className="px-4 py-3 text-right">Issues</th>
            <th className="px-4 py-3 text-right">Open</th>
            <th className="px-4 py-3 text-right">Overdue</th>
            <th className="px-4 py-3">Resolution rate</th>
            <th className="px-4 py-3 text-right">On time</th>
            <th className="px-4 py-3">Avg. time</th>
            <th className="px-4 py-3 text-right">Rating</th>
            <th className="px-4 py-3 text-right">Staff</th>
            <th className="px-4 py-3 text-right">Score</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((d) => (
            <tr key={d.id}>
              <td className="px-4 py-3">
                <span className="font-semibold">{d.rank != null ? `#${d.rank}` : <span className="text-muted">–</span>}</span>
              </td>
              <td className="px-4 py-3"><p className="font-medium">{d.name}</p><p className="text-xs text-muted">{d.code}</p></td>
              <td className="px-4 py-3 text-right tabular-nums">{d.total}</td>
              <td className="px-4 py-3 text-right tabular-nums">{d.open}</td>
              <td className="px-4 py-3 text-right tabular-nums">{d.overdue ? <span className="font-semibold text-rose-600">{d.overdue}</span> : 0}</td>
              <td className="w-40 px-4 py-3"><div className="flex items-center gap-2"><ProgressBar value={d.resolutionRate * 100} /><span className="w-10 text-right text-xs tabular-nums">{Math.round(d.resolutionRate * 100)}%</span></div></td>
              <td className="px-4 py-3 text-right tabular-nums">{Math.round(d.onTimeRate * 100)}%</td>
              <td className="px-4 py-3 whitespace-nowrap text-muted">{hoursToHuman(d.avgHours)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{d.avgRating ? `${d.avgRating.toFixed(2)}★` : "—"}</td>
              <td className="px-4 py-3 text-right tabular-nums">{d.staff}</td>
              <td className="px-4 py-3 text-right">{d.score != null ? <span className="rounded-md bg-brand-700 px-2 py-1 text-xs font-bold text-white tabular-nums dark:bg-brand-500">{d.score}</span> : <span className="text-xs text-muted">No reports</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
