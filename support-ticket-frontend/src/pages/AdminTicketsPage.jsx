import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGetAllTicketsQuery } from '../features/tickets/ticketsApi';
import StatusBadge from '../components/StatusBadge';
import Reveal from '../components/Reveal';
import { Loading, ErrorText } from '../components/StatusMessage';
import { getErrorMessage } from '../utils/apiError';

// Status values are numeric because the API serializes enums as numbers
// (see StatusBadge's 0-3 mapping / ticketStatus.js).
const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: '0', label: 'New' },
  { value: '1', label: 'In Progress' },
  { value: '2', label: 'Resolved' },
  { value: '3', label: 'Closed' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'All priorities' },
  { value: 'Critical', label: 'Critical' },
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low', label: 'Low' },
];

export default function AdminTicketsPage() {
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');

  const { data: tickets, isLoading, error } = useGetAllTicketsQuery({ status, priority });

  return (
    <div className="page">
      <h1>All Tickets</h1>
      <p className="page-subtitle">
        Every ticket across all users - who filed it, its current status, and
        which agent (if any) it's assigned to.
      </p>

      <div className="field-row audit-filters">
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Priority
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            {PRIORITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading && <Loading />}
      {error && <ErrorText>{getErrorMessage(error)}</ErrorText>}

      {tickets && tickets.length === 0 && (
        <p className="status-message">No tickets match these filters.</p>
      )}

      {tickets && tickets.length > 0 && (
        <Reveal>
          <table className="ticket-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Category</th>
                <th>Created By</th>
                <th>Assigned Agent</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td>#{ticket.id}</td>
                  <td>
                    <Link to={`/tickets/${ticket.id}`}>{ticket.title}</Link>
                  </td>
                  <td>
                    <StatusBadge status={ticket.status} />
                  </td>
                  <td>{ticket.priority || '-'}</td>
                  <td>{ticket.category || '-'}</td>
                  <td>{ticket.creatorEmail || 'Unknown'}</td>
                  <td>{ticket.assigneeEmail || <em>Unassigned</em>}</td>
                  <td>{new Date(ticket.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      )}
    </div>
  );
}
