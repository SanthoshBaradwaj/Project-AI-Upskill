"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import type { VerifiedSkill } from "@/lib/types";

/**
 * The signature visual (P0-13): claimed vs verified, side by side.
 * Sized and coloured to stay legible from fifteen feet — the projector test.
 */
export function ClaimedVsVerified({ verified }: { verified: VerifiedSkill[] }) {
  const rows = [...verified]
    .sort((a, b) => {
      const dropA = a.claimed_level - a.verified_level;
      const dropB = b.claimed_level - b.verified_level;
      return dropB - dropA || b.claimed_level - a.claimed_level;
    })
    .slice(0, 10)
    .map((v) => ({
      name: v.display_name,
      claimed: v.claimed_level,
      verified: v.verified_level,
      tested: v.tested,
      corrected: v.verified_level !== v.claimed_level,
    }));

  const height = Math.max(240, rows.length * 46);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-claim" />
          <span className="text-fog">What your résumé claims</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-verified" />
          <span className="text-fog">What you demonstrated</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-warn" />
          <span className="text-fog">Untested — discounted by evidence quality</span>
        </span>
      </div>

      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 40, top: 4, bottom: 4 }}>
            <XAxis type="number" domain={[0, 4]} ticks={[0, 1, 2, 3, 4]} hide />
            <YAxis
              type="category"
              dataKey="name"
              width={150}
              tick={{ fill: "#e8eef5", fontSize: 13 }}
              axisLine={false}
              tickLine={false}
            />
            <Bar dataKey="claimed" fill="#7c8da3" radius={[0, 3, 3, 0]} barSize={11} />
            <Bar dataKey="verified" radius={[0, 3, 3, 0]} barSize={11}>
              {rows.map((r) => (
                <Cell key={r.name} fill={r.tested ? "#34d399" : "#fbbf24"} />
              ))}
              <LabelList
                dataKey="verified"
                position="right"
                fill="#e8eef5"
                fontSize={13}
                fontWeight={600}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-fog">
        Levels run 0–4. Green bars are levels you proved just now. Amber bars are claims we
        never tested, discounted by how well your résumé evidenced them and how long ago you
        last used them.
      </p>
    </div>
  );
}
