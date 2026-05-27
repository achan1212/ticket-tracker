import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useLang } from '../../i18n/LangContext.jsx';
import CustomTooltip from './CustomTooltip.jsx';

// Order count (bars) + Avg order value (line) shown side-by-side in a
// chart-row. The line chart only renders dots on short ranges so dense
// 90-day views stay readable.
export default function OrderCharts({ chartData, spanDays, isAggregated, C }) {
  const { t } = useLang();
  return (
    <div className="chart-row">
      <div className="chart-card">
        <h4 className="chart-title">{t.dashOrderCountTitle}</h4>
        <p className="chart-sub">{isAggregated ? t.dashMonthly : t.dashDaily} {t.dashOrdersUnit}</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
            <XAxis dataKey="date" tick={{ fill: C.tick, fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fill: C.tick, fontSize: 10 }} width={30} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="orders" name={t.chartOrders} fill={C.accent} radius={[3, 3, 0, 0]} opacity={0.85} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h4 className="chart-title">{t.dashAvgOrderValue}</h4>
        <p className="chart-sub">{t.dashAvgPerOrder}</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
            <XAxis dataKey="date" tick={{ fill: C.tick, fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tickFormatter={v => `$${v}`} tick={{ fill: C.tick, fontSize: 10 }} width={45} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="avg" name={t.chartAvgValue} stroke={C.accent} strokeWidth={2} dot={spanDays <= 30} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
