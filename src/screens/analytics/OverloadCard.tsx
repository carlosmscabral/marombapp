/**
 * Dual-axis progressive overload chart card (`OverloadCard`).
 * Plots top weight and total kg volume across sessions for a selected exercise.
 */

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import type { Exercise } from '../../types';

const PRIMARY = '#6ab2ff';
const TERTIARY = '#ffeb3b';
const AXIS_COLOR = '#97abd4';
const GRID_COLOR = '#34486b';

export interface OverloadPoint {
  date: string;
  ts: number;
  topWeight: number;
  volume: number;
}

export interface OverloadCardProps {
  exercises: Exercise[];
  selectedExerciseId: string;
  onSelectExercise: (id: string) => void;
  data: OverloadPoint[];
}

/**
 * Renders the exercise selector and dual-axis top-weight / volume trend chart.
 */
export function OverloadCard({
  exercises,
  selectedExerciseId,
  onSelectExercise,
  data,
}: OverloadCardProps) {
  return (
    <section className="bg-surface-container-low rounded-xl overflow-hidden border-t-4 border-tertiary-fixed">
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-headline text-lg font-semibold">Progressive overload</h2>
            <p className="text-xs font-label uppercase tracking-widest text-on-surface-variant mt-0.5">
              Top set & total volume over time
            </p>
          </div>
          <TrendingUp className="text-tertiary-fixed w-5 h-5" />
        </div>

        {exercises.length === 0 ? (
          <p className="text-sm font-body text-on-surface-variant py-6 text-center">
            Log some completed sets to start tracking progress per exercise.
          </p>
        ) : (
          <>
            <label className="block">
              <span className="sr-only">Pick exercise</span>
              <select
                value={selectedExerciseId}
                onChange={(e) => onSelectExercise(e.target.value)}
                className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 text-sm font-body text-on-surface focus:outline-none focus:border-primary"
              >
                {exercises.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>

            {data.length === 0 ? (
              <p className="text-sm font-body text-on-surface-variant py-6 text-center">
                No completed sets recorded for this exercise yet.
              </p>
            ) : data.length === 1 ? (
              <div className="bg-surface-container rounded-lg p-4 text-sm font-body text-on-surface-variant">
                <p>
                  One session logged so far ({data[0].date}). Top weight{' '}
                  <span className="text-on-surface font-headline font-semibold">
                    {data[0].topWeight} kg
                  </span>
                  , volume{' '}
                  <span className="text-on-surface font-headline font-semibold">
                    {Math.round(data[0].volume).toLocaleString()} kg
                  </span>
                  . Log another to see a trend.
                </p>
              </div>
            ) : (
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={data}
                    margin={{ top: 10, right: 12, bottom: 0, left: -12 }}
                  >
                    <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke={AXIS_COLOR}
                      tick={{ fill: AXIS_COLOR, fontSize: 11, fontFamily: 'Plus Jakarta Sans' }}
                      tickLine={false}
                      axisLine={{ stroke: GRID_COLOR }}
                    />
                    <YAxis
                      yAxisId="left"
                      stroke={PRIMARY}
                      tick={{ fill: AXIS_COLOR, fontSize: 11, fontFamily: 'Plus Jakarta Sans' }}
                      tickLine={false}
                      axisLine={{ stroke: GRID_COLOR }}
                      width={40}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke={TERTIARY}
                      tick={{ fill: AXIS_COLOR, fontSize: 11, fontFamily: 'Plus Jakarta Sans' }}
                      tickLine={false}
                      axisLine={{ stroke: GRID_COLOR }}
                      width={48}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: '#001f46',
                        border: '1px solid #34486b',
                        borderRadius: 8,
                        color: '#dbe5ff',
                        fontFamily: 'Plus Jakarta Sans, sans-serif',
                        fontSize: 12,
                      }}
                      formatter={(value: number, name: string) => {
                        if (name === 'Top weight') return [`${value} kg`, name];
                        if (name === 'Volume') {
                          return [`${Math.round(value).toLocaleString()} kg`, name];
                        }
                        return [value, name];
                      }}
                    />
                    <Legend
                      wrapperStyle={{
                        fontFamily: 'Plus Jakarta Sans, sans-serif',
                        fontSize: 12,
                        color: AXIS_COLOR,
                      }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="topWeight"
                      name="Top weight"
                      stroke={PRIMARY}
                      strokeWidth={2}
                      dot={{ fill: PRIMARY, r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="volume"
                      name="Volume"
                      stroke={TERTIARY}
                      strokeWidth={2}
                      dot={{ fill: TERTIARY, r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
