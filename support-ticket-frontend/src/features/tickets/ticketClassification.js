// Mirrors the allowed values enforced by SupportTicketAI's Pydantic models
// (ClassifyResponse) and SupportTicketSystem's CreateTicketDto validation.
// Kept in one place so the UI can't offer a value the backend would reject.
export const TICKET_CATEGORIES = ['Billing', 'Technical', 'Bug', 'Feature'];

export const TICKET_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
