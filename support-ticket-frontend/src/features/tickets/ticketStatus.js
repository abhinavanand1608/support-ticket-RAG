// Mirrors Models/TicketStatus.cs. System.Text.Json serializes the enum as
// its underlying int (0-3) by default, since no JsonStringEnumConverter is
// configured on the backend - so the frontend has to know this mapping too.
export const TICKET_STATUS_LABELS = {
  0: 'New',
  1: 'In Progress',
  2: 'Resolved',
  3: 'Closed',
};

export const TICKET_STATUS_OPTIONS = [
  { value: 0, label: 'New' },
  { value: 1, label: 'In Progress' },
  { value: 2, label: 'Resolved' },
  { value: 3, label: 'Closed' },
];

export function statusLabel(status) {
  return TICKET_STATUS_LABELS[status] ?? `Unknown (${status})`;
}
