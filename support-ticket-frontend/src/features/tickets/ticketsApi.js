import { apiSlice } from '../../app/api/apiSlice';

// Endpoints wired to TicketController.cs (Phase 2 + Phase 3 Agent routes).
export const ticketsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // POST /api/tickets - User role
    createTicket: builder.mutation({
      query: (body) => ({ url: '/tickets', method: 'POST', body }),
      // 'Stats' too: a new ticket changes Total/Open counts on the
      // admin dashboard - without this the stats card keeps showing
      // the pre-creation numbers from RTK Query's cache.
      invalidatesTags: ['Ticket', 'Stats'],
    }),

    // GET /api/tickets/mine - User role
    getMyTickets: builder.query({
      query: () => '/tickets/mine',
      providesTags: ['Ticket'],
    }),

    // GET /api/tickets/{id} - any authenticated role, ownership-checked
    // server-side for Users.
    getTicketById: builder.query({
      query: (id) => `/tickets/${id}`,
      providesTags: (result, error, id) => [{ type: 'Ticket', id }],
    }),

    // GET /api/tickets/{id}/comments
    getComments: builder.query({
      query: (id) => `/tickets/${id}/comments`,
      providesTags: (result, error, id) => [{ type: 'Comment', id }],
    }),

    // POST /api/tickets/{id}/comments - User/Agent roles
    addComment: builder.mutation({
      query: ({ id, content }) => ({
        url: `/tickets/${id}/comments`,
        method: 'POST',
        body: { content },
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Comment', id }],
    }),

    // GET /api/tickets?status=&priority= - Admin/Agent roles. Unlike the
    // per-user lists, each row includes creatorEmail/assigneeEmail so an
    // admin can see who filed a ticket and who's working on it.
    getAllTickets: builder.query({
      query: ({ status, priority } = {}) => {
        const params = new URLSearchParams();
        // status is numeric (enums serialize as numbers in this API -
        // see StatusBadge's 0-3 mapping); '' means "no filter".
        if (status !== undefined && status !== '') params.set('status', status);
        if (priority) params.set('priority', priority);
        const qs = params.toString();
        return `/tickets${qs ? `?${qs}` : ''}`;
      },
      providesTags: ['Ticket'],
    }),

    // GET /api/tickets/queue - Agent role, unassigned tickets
    getQueue: builder.query({
      query: () => '/tickets/queue',
      providesTags: ['Ticket'],
    }),

    // GET /api/tickets/assigned-to-me - Agent role
    getAssignedToMe: builder.query({
      query: () => '/tickets/assigned-to-me',
      providesTags: ['Ticket'],
    }),

    // PUT /api/tickets/{id}/assign - Agent role
    assignTicket: builder.mutation({
      query: (id) => ({ url: `/tickets/${id}/assign`, method: 'PUT' }),
      invalidatesTags: (result, error, id) => ['Ticket', { type: 'Ticket', id }],
    }),

    // PUT /api/tickets/{id}/status - Agent/Admin roles
    updateTicketStatus: builder.mutation({
      query: ({ id, status }) => ({
        url: `/tickets/${id}/status`,
        method: 'PUT',
        body: { status },
      }),
      invalidatesTags: (result, error, { id }) => [
        'Ticket',
        // Status changes move a ticket between Open/Closed buckets on
        // the admin stats dashboard.
        'Stats',
        { type: 'Ticket', id },
      ],
    }),

    // PUT /api/tickets/{id}/classification - Agent/Admin roles.
    // category/priority are each optional - only send fields the caller
    // actually wants to correct, matching the backend's "only touch what
    // was sent" behavior.
    updateTicketClassification: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/tickets/${id}/classification`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [
        'Ticket',
        { type: 'Ticket', id },
      ],
    }),

    // POST /api/tickets/{id}/suggested-reply - Agent/Admin roles.
    // Modeled as a mutation (not a query) even though the first call
    // behaves like a normal data fetch, because the backend itself
    // decides whether to return a cached result or actually regenerate -
    // this is a single "get-or-generate" action, not a passive read, and
    // `regenerate: true` is how the "Regenerate" button forces a fresh
    // call through the Python RAG service instead of reusing the cache.
    getSuggestedReply: builder.mutation({
      query: ({ id, regenerate = false }) => ({
        url: `/tickets/${id}/suggested-reply${regenerate ? '?regenerate=true' : ''}`,
        method: 'POST',
      }),
    }),

    // PUT /api/tickets/{id}/auto-resolve - Agent/Admin roles.
    // The one-click "Accept & Resolve" action: backend posts the cached
    // suggested reply as a comment and sets status to Resolved in a
    // single transaction. Invalidates both the ticket (status changed)
    // and its comments (a new one was added) so the page reflects the
    // resolution without a manual refresh.
    autoResolveTicket: builder.mutation({
      query: (id) => ({ url: `/tickets/${id}/auto-resolve`, method: 'PUT' }),
      invalidatesTags: (result, error, id) => [
        'Ticket',
        'Stats',
        { type: 'Ticket', id },
        { type: 'Comment', id },
      ],
    }),
  }),
});

export const {
  useCreateTicketMutation,
  useGetMyTicketsQuery,
  useGetAllTicketsQuery,
  useGetTicketByIdQuery,
  useGetCommentsQuery,
  useAddCommentMutation,
  useGetQueueQuery,
  useGetAssignedToMeQuery,
  useAssignTicketMutation,
  useUpdateTicketStatusMutation,
  useUpdateTicketClassificationMutation,
  useGetSuggestedReplyMutation,
  useAutoResolveTicketMutation,
} = ticketsApi;
