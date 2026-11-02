import { useState } from 'react';
import { useGetAuditLogQuery } from '../features/admin/adminApi';
import { Loading, ErrorText } from '../components/StatusMessage';
import { getErrorMessage } from '../utils/apiError';

// Mirrors the AuditActions constants in AuditLog.cs - kept as a plain
// list here (not fetched from the backend) since these values change
// rarely and a static dropdown avoids an extra round-trip just to
// populate a filter.
const ACTION_TYPES = [
  { value: '', label: 'All actions' },
  { value: 'TicketAutoResolved', label: 'Ticket Auto-Resolved' },
  { value: 'TicketStatusChanged', label: 'Ticket Status Changed' },
  { value: 'UserRoleChanged', label: 'User Role Changed' },
  { value: 'UserDeactivated', label: 'User Deactivated' },
];

export default function AdminAuditLogPage() {
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data: logs, isLoading, error } = useGetAuditLogQuery({ action, from, to });

  return (
    <div className="page">
      <h1>Audit Log</h1>
      <p className="page-subtitle">
        A consistent record of every sensitive action across the app - ticket
        auto-resolutions, manual status changes, role changes, and
        deactivations.
      </p>

      <div className="field-row audit-filters">
        <label>
          Action
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            {ACTION_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      {isLoading && <Loading />}
      {error && <ErrorText>{getErrorMessage(error)}</ErrorText>}

      {logs && logs.length === 0 && (
        <p className="status-message">No audit log entries match these filters.</p>
      )}

      {logs && logs.length > 0 && (
        <table className="ticket-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Action</th>
              <th>Performed By</th>
              <th>Target</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.createdAt).toLocaleString()}</td>
                <td>{log.action}</td>
                <td>{log.performedByEmail || 'Unknown'}</td>
                <td>{log.targetId || '-'}</td>
                <td>{log.details || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
