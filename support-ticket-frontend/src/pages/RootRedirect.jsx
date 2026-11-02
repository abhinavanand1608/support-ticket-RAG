import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../features/auth/authSlice';
import { roleHomePath } from '../features/auth/roleHomePath';

// Sends "/" to whichever page makes sense for the logged-in user's role,
// or to /login if nobody is logged in.
export default function RootRedirect() {
  const user = useSelector(selectCurrentUser);
  return <Navigate to={roleHomePath(user?.role)} replace />;
}
