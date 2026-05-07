"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function RevenueChart({
  data
}: {
  data: Array<{ month: string; revenue: number; average: number }>;
}) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="month" stroke="#64748b" />
          <YAxis stroke="#64748b" />
          <Tooltip />
          <Line dataKey="revenue" stroke="#ec6f16" strokeWidth={3} />
          <Line dataKey="average" stroke="#0f172a" strokeDasharray="4 4" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
