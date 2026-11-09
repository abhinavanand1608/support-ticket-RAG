import { useEffect } from 'react';
import { useGetWeeklyInsightsMutation } from '../features/admin/adminApi';
import { Loading, ErrorText } from '../components/StatusMessage';
import { getErrorMessage } from '../utils/apiError';
import Reveal from '../components/Reveal';

// No charting library is added for this page - the stack doesn't already
// depend on one (see package.json), and these are simple single-series
// breakdowns, so a handful of styled CSS bars (width = count / max count)
// gives the same at-a-glance read as a bar chart without a new
// dependency. If the breakdowns grow more complex later (multi-series,
// time trends over many weeks), that's the point to reach for a real
// charting library instead.
export default function AdminWeeklyInsightsPage() {
  const [getWeeklyInsights, { data, isLoading, error }] = useGetWeeklyInsightsMutation();

  // Fetch (or serve-from-cache, decided server-side) once on page load -
  // same "call on open, cache server-side, regenerate only on demand"
  // pattern as the Agent ticket-detail AI assist.
  useEffect(() => {
    getWeeklyInsights(false).catch(() => {
      // surfaced via error
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRegenerate() {
    try {
      await getWeeklyInsights(true).unwrap();
    } catch {
      // surfaced via error
    }
  }

  const stats = data?.stats;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Weekly Insights</h1>
        <button type="button" onClick={handleRegenerate} disabled={isLoading}>
          {isLoading ? 'Generating...' : 'Regenerate'}
        </button>
      </div>

      {isLoading && !data && <Loading label="Generating this week's insights..." />}
      {error && <ErrorText>{getErrorMessage(error)}</ErrorText>}

      {data && (
        <>
          <Reveal>
            <div className="insights-summary">
              <p>{data.summary}</p>
              <span className="insights-summary__meta">
                Generated {new Date(data.generatedAt).toLocaleString()}
              </span>
            </div>
          </Reveal>

          <div className="stats-cards">
            <Reveal delay={0}>
              <StatCard label="Tickets Created" value={stats.totalCreated} />
            </Reveal>
            <Reveal delay={60}>
              <StatCard label="Resolved" value={stats.resolvedCount} />
            </Reveal>
            <Reveal delay={120}>
              <StatCard label="Still Open" value={stats.openCount} />
            </Reveal>
            <Reveal delay={180}>
              <StatCard
                label="Avg Resolution"
                value={
                  stats.averageResolutionHours != null
                    ? `${stats.averageResolutionHours.toFixed(1)}h`
                    : 'N/A'
                }
              />
            </Reveal>
            <Reveal delay={240}>
              <StatCard label="Auto-Resolved" value={stats.autoResolvedCount} />
            </Reveal>
            <Reveal delay={300}>
              <StatCard label="Manually Resolved" value={stats.manuallyResolvedCount} />
            </Reveal>
          </div>

          <div className="insights-breakdowns">
            <Reveal delay={0}>
              <BreakdownChart title="By Category" data={stats.byCategory} />
            </Reveal>
            <Reveal delay={100}>
              <BreakdownChart title="By Priority" data={stats.byPriority} />
            </Reveal>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-card__value">{value}</div>
      <div className="stat-card__label">{label}</div>
    </div>
  );
}

function BreakdownChart({ title, data }) {
  const maxCount = Math.max(1, ...data.map((row) => row.count));

  return (
    <div className="breakdown-chart">
      <h2>{title}</h2>
      {data.length === 0 && <p className="status-message">No tickets this week.</p>}
      {data.map((row) => (
        <div key={row.name} className="breakdown-chart__row">
          <span className="breakdown-chart__label">{row.name}</span>
          <div className="breakdown-chart__bar-track">
            <div
              className="breakdown-chart__bar"
              style={{ width: `${(row.count / maxCount) * 100}%` }}
            />
          </div>
          <span className="breakdown-chart__count">{row.count}</span>
        </div>
      ))}
    </div>
  );
}
