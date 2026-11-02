// The backend returns errors in a few different shapes depending on the
// endpoint:
//   - a plain string, e.g. Unauthorized("Invalid Credentials")
//   - ASP.NET Core's default ProblemDetails for [ApiController] model
//     validation failures, e.g. { title, errors: { field: ["msg"] } }
//   - an array of IdentityResult.Errors, e.g. [{ code, description }]
// This normalizes all of them into a single displayable string.
export function getErrorMessage(error, fallback = 'Something went wrong.') {
  if (!error) return fallback;

  // RTK Query network-level errors (server unreachable, CORS, etc).
  if (error.status === 'FETCH_ERROR') {
    return 'Could not reach the server. Is the API running?';
  }

  const data = error.data;

  if (typeof data === 'string') return data;

  if (Array.isArray(data)) {
    return data.map((e) => e.description || JSON.stringify(e)).join(', ');
  }

  if (data?.errors) {
    if (Array.isArray(data.errors)) {
      return data.errors.map((e) => e.description || String(e)).join(', ');
    }
    return Object.values(data.errors).flat().join(' ');
  }

  if (data?.title) return data.title;

  return fallback;
}
