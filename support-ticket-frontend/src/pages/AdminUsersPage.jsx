import { useState } from 'react';
import {
  useGetUsersQuery,
  useUpdateUserRoleMutation,
  useUpdateUserActiveStatusMutation,
} from '../features/admin/adminApi';
import { ROLES } from '../constants/roles';
import { Loading, ErrorText } from '../components/StatusMessage';
import { getErrorMessage } from '../utils/apiError';

const ASSIGNABLE_ROLES = [ROLES.USER, ROLES.AGENT, ROLES.ADMIN];

export default function AdminUsersPage() {
  const { data: users, isLoading, error } = useGetUsersQuery();
  const [updateUserRole, { isLoading: isUpdatingRole, error: roleError }] =
    useUpdateUserRoleMutation();
  const [updateActiveStatus, { isLoading: isUpdatingActiveStatus, error: activeStatusError }] =
    useUpdateUserActiveStatusMutation();

  // Tracks which row's role dropdown is mid-change, so only that row shows
  // a disabled state instead of the whole table locking up.
  const [pendingUserId, setPendingUserId] = useState(null);

  async function handleRoleChange(userId, role) {
    setPendingUserId(userId);
    try {
      await updateUserRole({ id: userId, role }).unwrap();
    } catch {
      // surfaced via roleError
    } finally {
      setPendingUserId(null);
    }
  }

  async function handleToggleActive(userId, nextIsActive) {
    if (
      !nextIsActive &&
      !window.confirm('Deactivate this user? They will not be able to log in.')
    ) {
      return;
    }
    setPendingUserId(userId);
    try {
      await updateActiveStatus({ id: userId, isActive: nextIsActive }).unwrap();
    } catch {
      // surfaced via activeStatusError
    } finally {
      setPendingUserId(null);
    }
  }

  return (
    <div className="page">
      <h1>Users</h1>

      {isLoading && <Loading />}
      {error && <ErrorText>{getErrorMessage(error)}</ErrorText>}
      {roleError && <ErrorText>{getErrorMessage(roleError)}</ErrorText>}
      {activeStatusError && <ErrorText>{getErrorMessage(activeStatusError)}</ErrorText>}

      {users && users.length === 0 && (
        <p className="status-message">No users found.</p>
      )}

      {users && users.length > 0 && (
        <table className="ticket-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Status</th>
              <th>Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isRowBusy =
                pendingUserId === u.id && (isUpdatingRole || isUpdatingActiveStatus);

              return (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>
                    <span className={u.isActive ? 'badge badge--active' : 'badge badge--inactive'}>
                      {u.isActive ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td>
                    <select
                      value={u.roles[0] || ''}
                      disabled={isRowBusy}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    >
                      {ASSIGNABLE_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button
                      type="button"
                      disabled={isRowBusy}
                      onClick={() => handleToggleActive(u.id, !u.isActive)}
                    >
                      {u.isActive ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
