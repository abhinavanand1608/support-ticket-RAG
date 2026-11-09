import { useGetTicketStatsQuery } from '../features/admin/adminApi';
import { statusLabel } from '../features/tickets/ticketStatus';
import { Loading, ErrorText } from '../components/StatusMessage';
import { getErrorMessage } from '../utils/apiError';
import Reveal from '../components/Reveal';

export default function AdminStatsPage() {
  const { data: stats, isLoading, error } = useGetTicketStatsQuery();

  return (
    <div className="page">
      <h1>Ticket Stats</h1>

      {isLoading && <Loading />}
      {error && <ErrorText>{getErrorMessage(error)}</ErrorText>}

      {stats && (
        <>
          <div className="stats-cards">
            <Reveal delay={0}>
              <StatCard label="Total" value={stats.total} />
            </Reveal>
            <Reveal delay={80}>
              <StatCard label="Open" value={stats.open} />
            </Reveal>
            <Reveal delay={160}>
              <StatCard label="Closed" value={stats.closed} />
            </Reveal>
          </div>

          <h2>By status</h2>
          <Reveal>
            <table className="ticket-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {stats.byStatus.map((row) => (
                  <tr key={row.status}>
                    <td>{statusLabel(row.status)}</td>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
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
