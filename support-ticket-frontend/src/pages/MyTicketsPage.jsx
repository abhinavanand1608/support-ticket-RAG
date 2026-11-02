import { Link } from 'react-router-dom';
import { useGetMyTicketsQuery } from '../features/tickets/ticketsApi';
import TicketTable from '../components/TicketTable';
import { Loading, ErrorText } from '../components/StatusMessage';
import { getErrorMessage } from '../utils/apiError';

export default function MyTicketsPage() {
  const { data: tickets, isLoading, error } = useGetMyTicketsQuery();

  return (
    <div className="page">
      <div className="page-header">
        <h1>My Tickets</h1>
        <Link className="button-link" to="/tickets/new">
          + New Ticket
        </Link>
      </div>

      {isLoading && <Loading />}
      {error && <ErrorText>{getErrorMessage(error)}</ErrorText>}
      {tickets && (
        <TicketTable
          tickets={tickets}
          emptyMessage="You haven't created any tickets yet."
        />
      )}
    </div>
  );
}
