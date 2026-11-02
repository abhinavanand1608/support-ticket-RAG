import { statusLabel } from '../features/tickets/ticketStatus';

const STATUS_CLASS = {
  0: 'status-new',
  1: 'status-in-progress',
  2: 'status-resolved',
  3: 'status-closed',
};

export default function StatusBadge({ status }) {
  return (
    <span className={`status-badge ${STATUS_CLASS[status] || ''}`}>
      {statusLabel(status)}
    </span>
  );
}
