import { apiSlice } from '../../app/api/apiSlice';

// Endpoints wired to KnowledgeBaseController.cs (Phase 6 KB ingestion,
// Phase 9 document list/delete). Admin role only.
export const kbApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // POST /api/kb/upload - expects multipart/form-data (File, Title,
    // optional KbId). Passing a FormData instance as `body` here means
    // fetchBaseQuery sends it as-is instead of JSON-encoding it, so the
    // browser sets the correct multipart Content-Type/boundary itself.
    uploadDocument: builder.mutation({
      query: (formData) => ({
        url: '/kb/upload',
        method: 'POST',
        body: formData,
      }),
      invalidatesTags: ['KbDocument'],
    }),

    // GET /api/kb/documents - one row per ingested document.
    getDocuments: builder.query({
      query: () => '/kb/documents',
      providesTags: ['KbDocument'],
    }),

    // DELETE /api/kb/documents/{docId}
    deleteDocument: builder.mutation({
      query: (docId) => ({
        url: `/kb/documents/${docId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['KbDocument'],
    }),
  }),
});

export const {
  useUploadDocumentMutation,
  useGetDocumentsQuery,
  useDeleteDocumentMutation,
} = kbApi;
