import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useLang } from '../../i18n/LangContext.jsx';
import { PLATFORM_COLORS, PLATFORM_LABELS } from './dashboardUtils.js';

// Platform pie chart + accompanying breakdown list with per-channel
// progress bars. Caller passes the already-aggregated platformData array.
export default function PlatformCharts({ platformData }) {
  const { t, formatCurrency } = useLang();
  if (platformData.length === 0) return null;

  const topRevenue = platformData[0].revenue;

  return (
    <div className="chart-row">
      <div className="chart-card">
        <h4 className="chart-title">{t.dashRevByPlatform}</h4>
        <p className="chart-sub">{t.dashWhereFrom}</p>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={platformData} dataKey="revenue" nameKey="name"
              cx="50%" cy="50%" outerRadius={80}
              label={({ name, percent }) => `${PLATFORM_LABELS[name] || name} ${(percent * 100).toFixed(0)}%`}
              labelLine={false}>
              {platformData.map((entry, i) => (
                <Cell key={i} fill={PLATFORM_COLORS[entry.name] || '#888'} opacity={0.9} />
              ))}
            </Pie>
            <Tooltip formatter={(val) => formatCurrency(val)} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h4 className="chart-title">{t.dashPlatformBreakdown}</h4>
        <p className="chart-sub">{t.dashOrdersRevPerChannel}</p>
        <div className="platform-breakdown-list">
          {platformData.map(p => (
            <div key={p.name} className="pb-row">
              <div className="pb-info">
                <span className="pb-dot" style={{ background: PLATFORM_COLORS[p.name] || '#888' }} />
                <span className="pb-name">{PLATFORM_LABELS[p.name] || p.name}</span>
                <span className="pb-count">{p.count} {t.dashOrdersUnit}</span>
              </div>
              <div className="pb-right">
                <span className="pb-rev">{formatCurrency(p.revenue)}</span>
                <div className="pb-bar-track">
                  <div className="pb-bar-fill" style={{
                    width: `${topRevenue > 0 ? (p.revenue / topRevenue) * 100 : 0}%`,
                    background: PLATFORM_COLORS[p.name] || '#888'
                  }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
