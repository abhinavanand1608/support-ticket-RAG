import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateTicketMutation } from '../features/tickets/ticketsApi';
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from '../features/tickets/ticketClassification';
import { getErrorMessage } from '../utils/apiError';
import { ErrorText } from '../components/StatusMessage';

export default function CreateTicketPage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [createTicket, { isLoading, error }] = useCreateTicketMutation();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const ticket = await createTicket({
        title,
        description,
        // Category/Priority are nullable strings on the backend (no fixed
        // set yet - that's expected to come from a future AI phase), so
        // empty inputs are sent as null rather than "".
        category: category || null,
        priority: priority || null,
      }).unwrap();

      navigate(`/tickets/${ticket.id}`);
    } catch {
      // surfaced via `error`
    }
  }

  return (
    <div className="page">
      <h1>Create a ticket</h1>
      <form className="card-form" onSubmit={handleSubmit}>
        <label>
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />
        </label>

        <label>
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            required
          />
        </label>

        <div className="field-row">
          <label>
            Category (optional - leave blank to let AI classify)
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Auto-detect</option>
              {TICKET_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <label>
            Priority (optional - leave blank to let AI classify)
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="">Auto-detect</option>
              {TICKET_PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
        </div>

        {error && <ErrorText>{getErrorMessage(error)}</ErrorText>}

        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Creating...' : 'Create ticket'}
        </button>
      </form>
    </div>
  );
}
