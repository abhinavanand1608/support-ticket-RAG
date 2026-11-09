import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { logout } from '../../features/auth/authSlice';

// Base fetchBaseQuery: attaches the JWT (if present) to every outgoing request.
// `getState().auth.token` is populated by authSlice after a successful login.
const rawBaseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5228/api',
  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth.token;
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

// Wraps the base query so that any 401 (expired/invalid token) anywhere in the
// app automatically logs the user out client-side, instead of every page having
// to handle that case individually.
const baseQueryWithReauth = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    api.dispatch(logout());
  }

  return result;
};

// Single base API slice. Feature slices (authApi, ticketsApi, adminApi) call
// `apiSlice.injectEndpoints(...)` instead of creating their own `createApi`
// instance - this way every endpoint shares one cache/store slice ("api") and
// can invalidate/refetch each other's tags (e.g. assigning a ticket can
// invalidate the same 'Ticket' tag the queue and stats views use).
export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Ticket', 'Comment', 'User', 'Stats', 'Notification', 'KbDocument'],
  endpoints: () => ({}),
});
