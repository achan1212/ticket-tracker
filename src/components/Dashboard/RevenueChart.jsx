import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useLang } from '../../i18n/LangContext.jsx';
import CustomTooltip from './CustomTooltip.jsx';

// Revenue-over-time area chart (delivery + pickup stacked, optional
// prior-period comparison line) plus the side-by-side Delivery vs Pickup
// bar chart. Both are revenue visualizations and stay together.
export default function RevenueChart({ chartData, comparisonMode, isAggregated, C }) {
  const { t } = useLang();
  return (
    <>
      <div className="chart-card">
        <h4 className="chart-title">{t.dashRevenueOverTime}</h4>
        <p className="chart-sub">{t.dashDeliveryVsPickupLabel} {isAggregated ? t.dashMonthly : t.dashDaily} {t.dashBreakdownSuffix}</p>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gDelivery" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.delivery} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={C.delivery} stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="gPickup" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.pickup} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={C.pickup} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
            <XAxis dataKey="date" tick={{ fill: C.tick, fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tickFormatter={v => `$${v}`} tick={{ fill: C.tick, fontSize: 11 }} width={55} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px', color: '#888' }} />
            <Area type="monotone" dataKey="delivery" name={t.chartDelivery} stroke={C.delivery} fill="url(#gDelivery)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="pickup" name={t.chartPickup} stroke={C.pickup} fill="url(#gPickup)" strokeWidth={2} dot={false} />
            {comparisonMode !== 'none' && (
              <Line
                type="monotone"
                dataKey="prevRevenue"
                name={t.comparePriorPeriod || 'Prior Period'}
                stroke={C.delivery}
                strokeWidth={1.5}
                strokeDasharray="5 3"
                strokeOpacity={0.55}
                dot={false}
                connectNulls={false}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h4 className="chart-title">{t.dashDeliveryVsPickupRevTitle}</h4>
        <p className="chart-sub">{t.dashSideBySide} {isAggregated ? t.dashMonthly : t.dashDaily} {t.dashComparisonSuffix}</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
            <XAxis dataKey="date" tick={{ fill: C.tick, fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tickFormatter={v => `$${v}`} tick={{ fill: C.tick, fontSize: 11 }} width={55} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px', color: '#888' }} />
            <Bar dataKey="delivery" name={t.chartDelivery} fill={C.delivery} radius={[3, 3, 0, 0]} opacity={0.85} />
            <Bar dataKey="pickup" name={t.chartPickup} fill={C.pickup} radius={[3, 3, 0, 0]} opacity={0.85} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
