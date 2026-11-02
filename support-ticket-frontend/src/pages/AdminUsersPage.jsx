import { useState } from 'react';
import {
  useGetUsersQuery,
  useUpdateUserRoleMutation,
  useDeactivateUserMutation,
} from '../features/admin/adminApi';
import { ROLES } from '../constants/roles';
import { Loading, ErrorText } from '../components/StatusMessage';
import { getErrorMessage } from '../utils/apiError';

const ASSIGNABLE_ROLES = [ROLES.USER, ROLES.AGENT, ROLES.ADMIN];

export default function AdminUsersPage() {
  const { data: users, isLoading, error } = useGetUsersQuery();
  const [updateUserRole, { isLoading: isUpdatingRole, error: roleError }] =
    useUpdateUserRoleMutation();
  const [deactivateUser, { isLoading: isDeactivating, error: deactivateError }] =
    useDeactivateUserMutation();

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

  async function handleDeactivate(userId) {
    if (!window.confirm('Deactivate this user? They will not be able to log in.')) {
      return;
    }
    setPendingUserId(userId);
    try {
      await deactivateUser(userId).unwrap();
    } catch {
      // surfaced via deactivateError
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
      {deactivateError && <ErrorText>{getErrorMessage(deactivateError)}</ErrorText>}

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
                pendingUserId === u.id && (isUpdatingRole || isDeactivating);

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
                      disabled={!u.isActive || isRowBusy}
                      onClick={() => handleDeactivate(u.id)}
                    >
                      Deactivate
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
