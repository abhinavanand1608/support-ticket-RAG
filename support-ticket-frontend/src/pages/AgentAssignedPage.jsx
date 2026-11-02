import { useGetAssignedToMeQuery } from '../features/tickets/ticketsApi';
import TicketTable from '../components/TicketTable';
import { Loading, ErrorText } from '../components/StatusMessage';
import { getErrorMessage } from '../utils/apiError';

export default function AgentAssignedPage() {
  const { data: tickets, isLoading, error } = useGetAssignedToMeQuery();

  return (
    <div className="page">
      <h1>Assigned to Me</h1>

      {isLoading && <Loading />}
      {error && <ErrorText>{getErrorMessage(error)}</ErrorText>}
      {tickets && (
        <TicketTable
          tickets={tickets}
          emptyMessage="You don't have any tickets assigned yet. Grab one from the queue."
        />
      )}
    </div>
  );
}
