import { apiSlice } from '../../app/api/apiSlice';

// Endpoints wired to NotificationsController.cs (Phase 9).
export const notificationsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // GET /api/notifications - polled by NotificationBell so the badge
    // updates without a manual page refresh (see that component for why
    // polling, not a websocket push, is the right tradeoff here).
    getNotifications: builder.query({
      query: () => '/notifications',
      providesTags: ['Notification'],
    }),

    // PUT /api/notifications/{id}/read
    markNotificationRead: builder.mutation({
      query: (id) => ({ url: `/notifications/${id}/read`, method: 'PUT' }),
      invalidatesTags: ['Notification'],
    }),

    // PUT /api/notifications/read-all
    markAllNotificationsRead: builder.mutation({
      query: () => ({ url: '/notifications/read-all', method: 'PUT' }),
      invalidatesTags: ['Notification'],
    }),
  }),
});

export const {
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} = notificationsApi;
