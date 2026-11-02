import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useLoginMutation } from '../features/auth/authApi';
import { setCredentials } from '../features/auth/authSlice';
import { parseUserFromToken } from '../features/auth/tokenUtils';
import { getErrorMessage } from '../utils/apiError';
import { roleHomePath } from '../features/auth/roleHomePath';
import { ErrorText } from '../components/StatusMessage';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [login, { isLoading, error }] = useLoginMutation();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const { token } = await login({ email, password }).unwrap();
      dispatch(setCredentials({ token }));

      const user = parseUserFromToken(token);
      navigate(roleHomePath(user?.role), { replace: true });
    } catch {
      // error state is already surfaced via the `error` from the hook
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>Log in</h1>

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
          />
        </label>

        {error && <ErrorText>{getErrorMessage(error)}</ErrorText>}

        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Logging in...' : 'Log in'}
        </button>

        <p className="auth-form__footer">
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </form>
    </div>
  );
}
