import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectCurrentToken, selectCurrentUser } from '../features/auth/authSlice';

// Guards a group of nested routes. Usage:
//   <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]} />}>
//     <Route path="/admin/users" element={<AdminUsersPage />} />
//   </Route>
// - No token/user at all -> redirect to /login.
// - Logged in but role isn't in `allowedRoles` -> redirect to /unauthorized.
// - `allowedRoles` omitted -> any authenticated user may pass through.
export default function ProtectedRoute({ allowedRoles }) {
  const token = useSelector(selectCurrentToken);
  const user = useSelector(selectCurrentUser);

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
