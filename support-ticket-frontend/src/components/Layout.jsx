import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout, selectCurrentUser } from '../features/auth/authSlice';
import { ROLES } from '../constants/roles';
import NotificationBell from './NotificationBell';

export default function Layout() {
  const user = useSelector(selectCurrentUser);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  function handleLogout() {
    dispatch(logout());
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">Support Tickets</div>
        <nav className="app-nav">
          {user?.role === ROLES.USER && (
            <>
              <NavLink to="/tickets/new">New Ticket</NavLink>
              <NavLink to="/tickets/mine">My Tickets</NavLink>
            </>
          )}
          {user?.role === ROLES.AGENT && (
            <>
              <NavLink to="/agent/queue">Queue</NavLink>
              <NavLink to="/agent/assigned">Assigned to Me</NavLink>
            </>
          )}
          {user?.role === ROLES.ADMIN && (
            <>
              <NavLink to="/admin/users">Users</NavLink>
              <NavLink to="/admin/tickets">Tickets</NavLink>
              <NavLink to="/admin/stats">Stats</NavLink>
              <NavLink to="/admin/kb-upload">Knowledge Base</NavLink>
              <NavLink to="/admin/insights">Weekly Insights</NavLink>
              <NavLink to="/admin/audit-log">Audit Log</NavLink>
            </>
          )}
        </nav>
        <div className="app-header__user">
          {user && (
            <>
              <NotificationBell />
              <span className="app-header__email">
                {user.email} <span className="badge">{user.role}</span>
              </span>
              <button type="button" onClick={handleLogout}>
                Log out
              </button>
            </>
          )}
        </div>
      </header>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
