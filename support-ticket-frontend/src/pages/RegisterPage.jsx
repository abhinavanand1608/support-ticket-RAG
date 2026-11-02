import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRegisterMutation } from '../features/auth/authApi';
import { getErrorMessage } from '../utils/apiError';
import { ErrorText } from '../components/StatusMessage';

// Public self-registration always creates a "User" account (the `role`
// field is simply never sent). Promoting someone to Agent/Admin is an
// Admin-only action on the Users page - see AdminController.UpdateUserRole -
// keeping the public form from being able to mint privileged accounts.
export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [register, { isLoading, error }] = useRegisterMutation();
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await register({ email, password }).unwrap();
      setSuccess(true);
      setTimeout(() => navigate('/login', { replace: true }), 1200);
    } catch {
      // surfaced via `error`
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>Create account</h1>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </label>

        {error && <ErrorText>{getErrorMessage(error)}</ErrorText>}
        {success && (
          <p className="status-message status-message--success">
            Account created! Redirecting to login...
          </p>
        )}

        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Creating account...' : 'Register'}
        </button>

        <p className="auth-form__footer">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
