import { ShieldCheck } from 'lucide-react'

export function getStaffRoleLabel(role?: string | null) {
  const normalizedRole = role?.toUpperCase()
  if (normalizedRole === 'MANAGER') return 'Manager'
  if (normalizedRole === 'ADMIN') return 'Admin'
  if (normalizedRole === 'MODERATOR') return 'Moderator'
  return null
}

export default function StaffRoleBadge({ role }: { role?: string | null }) {
  const label = getStaffRoleLabel(role)
  if (!label) return null

  const roleClass = role ? `staff-role-badge--${role.toLowerCase()}` : ''

  return (
    <span className={`staff-role-badge ${roleClass}`} aria-label={label}>
      <ShieldCheck className="staff-role-badge__icon" size={12} strokeWidth={2.4} />
      <span className="staff-role-badge__label">{label}</span>
    </span>
  )
}
