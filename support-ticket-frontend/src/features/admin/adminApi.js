import { apiSlice } from '../../app/api/apiSlice';

// Endpoints wired to AdminController.cs (Phase 3 Admin routes).
export const adminApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // GET /api/admin/users
    getUsers: builder.query({
      query: () => '/admin/users',
      providesTags: ['User'],
    }),

    // PUT /api/admin/users/{id}/role
    updateUserRole: builder.mutation({
      query: ({ id, role }) => ({
        url: `/admin/users/${id}/role`,
        method: 'PUT',
        body: { role },
      }),
      invalidatesTags: ['User'],
    }),

    // PUT /api/admin/users/{id}/deactivate
    deactivateUser: builder.mutation({
      query: (id) => ({
        url: `/admin/users/${id}/deactivate`,
        method: 'PUT',
      }),
      invalidatesTags: ['User'],
    }),

    // GET /api/admin/tickets/stats
    getTicketStats: builder.query({
      query: () => '/admin/tickets/stats',
      providesTags: ['Stats'],
    }),

    // GET /api/admin/insights/weekly - modeled as a mutation for the same
    // reason getSuggestedReply is (see ticketsApi.js): the backend itself
    // decides whether to serve its 1-hour cache or actually regenerate,
    // so this is a single "get-or-generate" action rather than a passive
    // read. `regenerate: true` is how the "Regenerate" button forces a
    // fresh LLM summary instead of reusing the cached one.
    getWeeklyInsights: builder.mutation({
      query: (regenerate = false) => ({
        url: `/admin/insights/weekly${regenerate ? '?regenerate=true' : ''}`,
        method: 'GET',
      }),
    }),

    // GET /api/admin/audit-log - all filters are optional and combine
    // with AND server-side (see AdminController.GetAuditLog).
    getAuditLog: builder.query({
      query: ({ action, from, to } = {}) => {
        const params = new URLSearchParams();
        if (action) params.set('action', action);
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        const qs = params.toString();
        return `/admin/audit-log${qs ? `?${qs}` : ''}`;
      },
    }),
  }),
});

export const {
  useGetUsersQuery,
  useUpdateUserRoleMutation,
  useDeactivateUserMutation,
  useGetTicketStatsQuery,
  useGetWeeklyInsightsMutation,
  useGetAuditLogQuery,
} = adminApi;
