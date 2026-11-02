import { useGetQueueQuery, useAssignTicketMutation } from '../features/tickets/ticketsApi';
import TicketTable from '../components/TicketTable';
import { Loading, ErrorText } from '../components/StatusMessage';
import { getErrorMessage } from '../utils/apiError';

export default function AgentQueuePage() {
  const { data: tickets, isLoading, error } = useGetQueueQuery();
  const [assignTicket, { isLoading: isAssigning, error: assignError }] =
    useAssignTicketMutation();

  async function handleAssign(id) {
    try {
      await assignTicket(id).unwrap();
    } catch {
      // 409 (already assigned) or other errors surfaced via `assignError`
    }
  }

  return (
    <div className="page">
      <h1>Unassigned Queue</h1>
      <p className="page-subtitle">
        Sorted oldest-first (priority-based sorting will come once AI sets it).
      </p>

      {isLoading && <Loading />}
      {error && <ErrorText>{getErrorMessage(error)}</ErrorText>}
      {assignError && <ErrorText>{getErrorMessage(assignError)}</ErrorText>}

      {tickets && (
        <TicketTable
          tickets={tickets}
          emptyMessage="The queue is empty - nice work."
          renderActions={(ticket) => (
            <button
              type="button"
              disabled={isAssigning}
              onClick={() => handleAssign(ticket.id)}
            >
              Assign to me
            </button>
          )}
        />
      )}
    </div>
  );
}
