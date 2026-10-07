export function canBypassMaintenance(role: unknown): boolean {
  return role === 'MANAGER' || (role === 'ADMIN' || role === 'MODERATOR')
}
