import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useMediaQuery } from '../hooks/useMediaQuery.js';

const ROW_HEIGHT = 34;

function RateTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const group = payload[0].payload;

  return (
    <div className="chart-tooltip">
      <strong>{group.value}</strong>
      <div>Response rate: {Math.round(group.rate * 100)}%</div>
      <div>
        {group.responses} responses from {group.applications} applications
      </div>
    </div>
  );
}

export default function RateChart({ groups }) {
  const isPhone = useMediaQuery('(max-width: 640px)');

  return (
    <ResponsiveContainer width="100%" height={groups.length * ROW_HEIGHT + 16}>
      <BarChart data={groups} layout="vertical" margin={{ top: 0, right: isPhone ? 4 : 16, bottom: 0, left: 0 }}>
        <XAxis type="number" domain={[0, 1]} hide />
        <YAxis
          type="category"
          dataKey="value"
          width={isPhone ? 96 : 120}
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'var(--ink-soft)', fontSize: 13 }}
        />
        <Tooltip content={<RateTooltip />} cursor={{ fill: 'var(--hover)' }} />
        <Bar dataKey="rate" fill="var(--chart)" barSize={14} radius={[0, 4, 4, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
