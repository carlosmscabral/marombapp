/**
 * Weekly muscle distribution donut chart and set breakdown card (`WeeklySplitCard`).
 * Visualizes completed sets per primary muscle group across the last 7 days.
 */

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { BarChart2 } from 'lucide-react';
import { SignatureBar } from '../../components/Layout';
import type { MuscleGroup } from '../../types';

export interface MuscleSplitRow {
  muscle: MuscleGroup;
  sets: number;
  color: string;
}

export interface WeeklySplitCardProps {
  rows: MuscleSplitRow[];
  totalSets: number;
}

/**
 * Renders the 7-day muscle group donut chart and proportional progress bars.
 */
export function WeeklySplitCard({ rows, totalSets }: WeeklySplitCardProps) {
  return (
    <section className="bg-surface-container-low rounded-xl overflow-hidden border-t-4 border-primary">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-headline text-lg font-semibold">Weekly muscle split</h2>
            <p className="text-xs font-label uppercase tracking-widest text-on-surface-variant mt-0.5">
              Last 7 days · {totalSets} sets
            </p>
          </div>
          <BarChart2 className="text-primary w-5 h-5" />
        </div>

        {rows.length === 0 ? (
          <p className="text-sm font-body text-on-surface-variant py-6 text-center">
            Complete a few sets this week to see your muscle split.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="w-full h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={rows}
                    dataKey="sets"
                    nameKey="muscle"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {rows.map((row) => (
                      <Cell key={row.muscle} fill={row.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#001f46',
                      border: '1px solid #34486b',
                      borderRadius: 8,
                      color: '#dbe5ff',
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      fontSize: 12,
                    }}
                    formatter={(value: number, name: string) => [`${value} sets`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <ul className="space-y-2">
              {rows.map((row) => {
                const pct = totalSets > 0 ? (row.sets / totalSets) * 100 : 0;
                return (
                  <li key={row.muscle} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: row.color }}
                        />
                        <span className="capitalize">{row.muscle}</span>
                      </div>
                      <span className="font-headline font-semibold tabular-nums">
                        {row.sets}
                        <span className="text-xs font-label text-on-surface-variant ml-1">
                          sets
                        </span>
                      </span>
                    </div>
                    <div className="w-full h-1 rounded-full bg-surface-container-highest overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: row.color }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
      <SignatureBar />
    </section>
  );
}
