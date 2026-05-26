export type Role = 'SuperAdmin' | 'Admin' | 'Project Manager' | 'Accounting';

// Helper to handle Supabase formatting quirks (converts strings like "{SuperAdmin}" to clean arrays)
export function normalizeRoles(roles: any): string[] {
  if (!roles) return [];
  if (typeof roles === 'string') {
    return roles.replace(/[{}]/g, '').split(',').map(r => r.trim());
  }
  if (Array.isArray(roles)) return roles.map(r => String(r).trim());
  return [];
}

export function hasAccess(rawRoles: any, allowedRoles: string[]): boolean {
  const userRoles = normalizeRoles(rawRoles);
  if (userRoles.length === 0) return false;
  
  // 1. SuperAdmins bypass ALL checks and get access to everything. (Case-insensitive check)
  if (userRoles.some(r => r.toLowerCase() === 'superadmin')) return true;

  // 2. Otherwise, check if they have a permitted role
  return userRoles.some(role => allowedRoles.includes(role));
}

export function isStrictlyAccounting(rawRoles: any): boolean {
  const userRoles = normalizeRoles(rawRoles);
  if (userRoles.length === 0) return false;
  
  // If they have any operational role, they are NOT strictly accounting
  const hasOperationalRole = userRoles.some(role => 
    ['superadmin', 'admin', 'project manager'].includes(role.toLowerCase())
  );

  if (hasOperationalRole) return false;

  // Otherwise, check if they are accounting
  return userRoles.some(r => r.toLowerCase() === 'accounting');
}