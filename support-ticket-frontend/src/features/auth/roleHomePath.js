import { ROLES } from '../../constants/roles';

// Where to send a user right after login (or when they hit "/"), based on
// their role. Centralized here so LoginPage and the root redirect agree.
export function roleHomePath(role) {
  switch (role) {
    case ROLES.USER:
      return '/tickets/mine';
    case ROLES.AGENT:
      return '/agent/queue';
    case ROLES.ADMIN:
      return '/admin/stats';
    default:
      return '/login';
  }
}
