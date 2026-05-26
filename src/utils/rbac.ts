// utils/rbac.ts

export type Role = 'SuperAdmin' | 'Admin' | 'Project Manager' | 'Accounting';

export function hasAccess(userRoles: Role[], allowedRoles: Role[]): boolean {
  // If the user has no roles, deny access
  if (!userRoles || userRoles.length === 0) return false;
  
  // SuperAdmins bypass all checks and get access to EVERYTHING
  if (userRoles.includes('SuperAdmin')) return true;

  // Otherwise, check if ANY of the user's roles match the allowed roles
  return userRoles.some(role => allowedRoles.includes(role));
}

export function isStrictlyAccounting(userRoles: Role[]): boolean {
  if (!userRoles || userRoles.length === 0) return false;
  
  // If they have any of these operational roles, they are NOT strictly accounting
  const hasOperationalRole = userRoles.some(role => 
    ['SuperAdmin', 'Admin', 'Project Manager'].includes(role)
  );

  if (hasOperationalRole) return false;

  // Otherwise, if they have the Accounting role, they are strictly accounting
  return userRoles.includes('Accounting');
}