import { Link } from 'react-router-dom';

export default function UnauthorizedPage() {
  return (
    <div className="centered-page">
      <h1>403 - Not allowed</h1>
      <p>Your account doesn't have access to this page.</p>
      <Link to="/">Go home</Link>
    </div>
  );
}
