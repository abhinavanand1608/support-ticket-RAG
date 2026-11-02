import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';

// Shared list rendering for MyTicketsPage / AgentQueuePage / AgentAssignedPage.
// `renderActions` lets each page add its own row-level buttons (e.g. "Assign
// to me" only makes sense in the queue) without duplicating the table markup.
export default function TicketTable({ tickets, renderActions, emptyMessage }) {
  if (tickets.length === 0) {
    return <p className="status-message">{emptyMessage || 'No tickets found.'}</p>;
  }

  return (
    <table className="ticket-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Title</th>
          <th>Status</th>
          <th>Priority</th>
          <th>Created</th>
          {renderActions && <th>Actions</th>}
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
            <td>{new Date(ticket.createdAt).toLocaleString()}</td>
            {renderActions && <td>{renderActions(ticket)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
