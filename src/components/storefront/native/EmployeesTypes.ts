// Shared types and pure helpers for the native Employees manager (ported from storefront-panel EmployeesManager).

export interface Employee {
  id?: string
  employee_id: string
  full_name: string
  email?: string | null
  phone?: string | null
  secondary_email?: string | null
  secondary_phone?: string | null
  department: string
  role: string
  tenure: string
  status: string
  created_at?: string
}

export type EmployeePayload = {
  employee_id: string
  full_name: string
  email: string
  phone: string
  secondary_email: string
  secondary_phone: string
  department: string
  role: string
  tenure: string
  status: string
}

export type TenurePeriod = { startDate: string; endDate: string; isPresent: boolean }

export const AVAILABLE_ROLES = ['Manager', 'Owner', 'Founder', 'CEO', 'CTO', 'Educator', 'Intern', 'Campus Leader']
export const AVAILABLE_STATUSES = ['ACTIVE', 'INACTIVE', 'RESIGNED', 'REMOVED']
export const AVAILABLE_DEPARTMENTS = ['Academic', 'Support', 'Marketing', 'Programming', 'Core']
export const GOVERNMENT_ID_TYPES = ['PAN', 'Aadhaar']
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024

export const blankEmployee = (): Employee => ({
  employee_id: '',
  full_name: '',
  email: '',
  phone: '',
  secondary_email: '',
  secondary_phone: '',
  department: 'Core',
  role: 'Educator',
  tenure: '',
  status: 'ACTIVE',
})

export const blankTenure = (): TenurePeriod => ({ startDate: '', endDate: '', isPresent: true })

export function normalizeDepartment(department: string): string {
  const normalized = (department || '').trim().toLowerCase()
  if (['academic', 'academics', 'temporary teacher', 'temporary teaching', 'fixed teacher', 'permanent teacher', 'permanent teaching'].includes(normalized)) return 'Academic'
  if (normalized === 'operations') return 'Support'
  return AVAILABLE_DEPARTMENTS.find((option) => option.toLowerCase() === normalized) || 'Core'
}

/** DD/MM/YYYY -> YYYY-MM-DD */
export function parseDateToYmd(dateStr: string): string {
  if (!dateStr) return ''
  const parts = dateStr.trim().split('/')
  if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
  return ''
}

/** YYYY-MM-DD -> DD/MM/YYYY */
export function formatYmdToDdMmYyyy(ymd: string): string {
  if (!ymd) return ''
  const parts = ymd.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return ''
}

export function parseTenurePeriods(tenure: string): TenurePeriod[] {
  const periods = String(tenure || '')
    .split(';')
    .map((period) => period.trim())
    .filter(Boolean)
    .map((period) => {
      const [start, end] = period.split(' - ')
      const isPresent = (end || '').trim().toLowerCase() === 'present'
      return { startDate: parseDateToYmd(start || ''), endDate: isPresent ? '' : parseDateToYmd(end || ''), isPresent }
    })
  return periods.length ? periods : [blankTenure()]
}

export function formatTenure(periods: TenurePeriod[]): string {
  return periods
    .map((period) => `${formatYmdToDdMmYyyy(period.startDate)} - ${period.isPresent ? 'Present' : formatYmdToDdMmYyyy(period.endDate)}`)
    .join('; ')
}

/** Validates tenure periods; returns an error message or '' when valid. */
export function validateTenure(periods: TenurePeriod[]): string {
  if (periods.some((period) => !period.startDate)) return 'A start date is required for every tenure period.'
  if (periods.some((period) => !period.isPresent && !period.endDate)) return 'Add an end date for each tenure period that is not marked present.'
  if (periods.some((period) => !period.isPresent && period.endDate && period.endDate < period.startDate)) return 'A tenure end date cannot be before its start date.'
  return ''
}

/** Next sequential employee ID: GENZ-EMP-0000, GENZ-INT-0000X (intern), GENZ-CLS-0000X (campus leader). */
export function getNextEmployeeId(employees: Employee[], role: string, name: string): string {
  const initial = name ? name.trim().charAt(0).toUpperCase() : 'X'
  const roleLower = (role || '').toLowerCase()
  let prefix = 'GENZ-EMP'
  let suffix = ''
  if (roleLower === 'intern') {
    prefix = 'GENZ-INT'
    suffix = initial || 'X'
  } else if (roleLower === 'campus leader') {
    prefix = 'GENZ-CLS'
    suffix = initial || 'X'
  }
  let maxNum = -1
  const pattern = new RegExp(`^${prefix}-(\\d{4})`, 'i')
  for (const emp of employees) {
    const match = emp?.employee_id?.match(pattern)
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10))
  }
  return `${prefix}-${String(maxNum + 1).padStart(4, '0')}${suffix}`
}

export function describeEmployeeChanges(oldEmp: Employee, payload: EmployeePayload): string {
  const changes: string[] = []
  if (oldEmp.full_name !== payload.full_name) changes.push(`Name: ${oldEmp.full_name} → ${payload.full_name}`)
  if (oldEmp.department !== payload.department) changes.push(`Dept: ${oldEmp.department} → ${payload.department}`)
  if (oldEmp.role !== payload.role) changes.push(`Role: ${oldEmp.role} → ${payload.role}`)
  if (oldEmp.status !== payload.status) changes.push(`Status: ${oldEmp.status} → ${payload.status}`)
  if (oldEmp.tenure !== payload.tenure) changes.push(`Tenure: ${oldEmp.tenure} → ${payload.tenure}`)
  if ((oldEmp.email || '') !== payload.email) changes.push(`Email: ${oldEmp.email || 'N/A'} → ${payload.email || 'N/A'}`)
  if ((oldEmp.phone || '') !== payload.phone) changes.push(`Phone: ${oldEmp.phone || 'N/A'} → ${payload.phone || 'N/A'}`)
  if ((oldEmp.secondary_email || '') !== payload.secondary_email) changes.push('Secondary email updated')
  if ((oldEmp.secondary_phone || '') !== payload.secondary_phone) changes.push('Secondary phone updated')
  return changes.length > 0 ? changes.join(', ') : 'No field changes'
}

export function employeeStatusBadge(status: string): string {
  switch ((status || '').toUpperCase()) {
    case 'ACTIVE': return 'badge badge-success'
    case 'RESIGNED': return 'badge badge-warning'
    case 'REMOVED': return 'badge badge-danger'
    default: return 'badge badge-gray'
  }
}

export function filterEmployees(employees: Employee[], query: string): Employee[] {
  const q = query.toLowerCase().trim()
  return employees.filter((emp) => {
    if (!emp || typeof emp !== 'object') return false
    if (!q) return true
    return (
      (emp.full_name || '').toLowerCase().includes(q) ||
      (emp.employee_id || '').toLowerCase().includes(q) ||
      (emp.department || '').toLowerCase().includes(q) ||
      (emp.role || '').toLowerCase().includes(q) ||
      (emp.email || '').toLowerCase().includes(q) ||
      (emp.phone || '').includes(q) ||
      (emp.status || '').toLowerCase().includes(q)
    )
  })
}
