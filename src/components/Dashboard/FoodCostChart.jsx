import {
  AreaChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useLang } from '../../i18n/LangContext.jsx';
import CustomTooltip from './CustomTooltip.jsx';

// Revenue vs Food Cost overlay. Only rendered when `hasFoodCost` so the
// caller can keep this chart out of the layout entirely on empty days.
export default function FoodCostChart({ chartData, comparisonMode, hasFoodCost, C }) {
  const { t } = useLang();
  return (
    <div className="chart-card">
      <h4 className="chart-title">{t.dashFoodCostVsRev || 'Revenue vs Food Cost'}</h4>
      <p className="chart-sub">{t.dashFoodCostVsRevSub || 'Gap between the lines is gross profit'}</p>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={C.accent} stopOpacity={0.35}/>
              <stop offset="95%" stopColor={C.accent} stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="gFoodCost" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={C.foodCost} stopOpacity={0.45}/>
              <stop offset="95%" stopColor={C.foodCost} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
          <XAxis dataKey="date" tick={{ fill: C.tick, fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis tickFormatter={v => `$${v}`} tick={{ fill: C.tick, fontSize: 11 }} width={55} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '12px', color: '#888' }} />
          <Area type="monotone" dataKey="revenue" name={t.totalRevenue} stroke={C.accent} fill="url(#gRevenue)" strokeWidth={2} dot={false} />
          <Area type="monotone" dataKey="foodCost" name={t.chartFoodCost || 'Food Cost'} stroke={C.foodCost} fill="url(#gFoodCost)" strokeWidth={2} dot={false} />
          {comparisonMode !== 'none' && (
            <>
              <Line
                type="monotone"
                dataKey="prevRevenue"
                name={t.comparePriorPeriod || 'Prior Period'}
                stroke={C.accent}
                strokeWidth={1.5}
                strokeDasharray="5 3"
                strokeOpacity={0.5}
                dot={false}
                connectNulls={false}
              />
              {hasFoodCost && (
                <Line
                  type="monotone"
                  dataKey="prevFoodCost"
                  name={t.compareFoodCostPrior || 'Prior Food Cost'}
                  stroke={C.foodCost}
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  strokeOpacity={0.5}
                  dot={false}
                  connectNulls={false}
                />
              )}
            </>
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
