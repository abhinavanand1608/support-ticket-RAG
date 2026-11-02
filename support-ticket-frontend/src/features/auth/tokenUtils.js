import { jwtDecode } from 'jwt-decode';

// ASP.NET Core Identity issues JWTs with legacy XML-schema claim URIs instead
// of short names (e.g. "name" comes back as
// "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"). This maps
// the handful of claims AuthController.Login actually puts in the token
// (see Controllers/AuthController.cs) to a plain object the rest of the app
// can use.
const CLAIM_TYPES = {
  name: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
  email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
  nameIdentifier: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
  role: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
};

// Returns { userId, email, role } from a raw JWT, or null if the token is
// missing/malformed/expired. A user only ever has one role in this app
// (AdminController.UpdateUserRole replaces roles rather than adding to them),
// but the role claim can still legally be a string or an array, so both are
// handled defensively.
export function parseUserFromToken(token) {
  if (!token) return null;

  try {
    const decoded = jwtDecode(token);

    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      return null;
    }

    const rawRole = decoded[CLAIM_TYPES.role];
    const role = Array.isArray(rawRole) ? rawRole[0] : rawRole;

    return {
      userId: decoded[CLAIM_TYPES.nameIdentifier],
      email: decoded[CLAIM_TYPES.email] || decoded[CLAIM_TYPES.name],
      role,
    };
  } catch {
    return null;
  }
}
