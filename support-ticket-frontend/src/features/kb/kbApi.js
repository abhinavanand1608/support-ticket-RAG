import { apiSlice } from '../../app/api/apiSlice';

// Endpoint wired to KnowledgeBaseController.cs (Phase 6 KB ingestion).
// Admin role only.
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
    }),
  }),
});

export const { useUploadDocumentMutation } = kbApi;
