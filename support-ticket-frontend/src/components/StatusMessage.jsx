// Small shared components for the loading/error states every RTK Query
// page needs to handle. Kept dumb/presentational on purpose.
export function Loading({ label = 'Loading...' }) {
  return <p className="status-message">{label}</p>;
}

export function ErrorText({ children }) {
  return <p className="status-message status-message--error">{children}</p>;
}
