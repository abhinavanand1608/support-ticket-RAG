import { apiSlice } from '../../app/api/apiSlice';

// AuthController.Register/Login (see Controllers/AuthController.cs) return
// plain strings on success/failure ("Registration Successful",
// "Invalid Credentials") rather than JSON objects - ASP.NET Core's default
// formatter still serializes those as valid JSON string literals, so
// fetchBaseQuery's default 'json' response handler parses them fine.
export const authApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
    }),
    // `role` is intentionally omitted from the public RegisterPage - the
    // backend defaults to "User" when it's absent. Promoting someone to
    // Agent/Admin is done through the Admin > Users page instead, which is
    // the safer place for that capability to live.
    register: builder.mutation({
      query: (payload) => ({
        url: '/auth/register',
        method: 'POST',
        body: payload,
      }),
    }),
  }),
});

export const { useLoginMutation, useRegisterMutation } = authApi;
