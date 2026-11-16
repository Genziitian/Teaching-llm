'use client'

// Native class-genz Employees manager (replaces the storefront-panel iframe "employees" tab).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Copy, Database, Pencil, Plus, Search, Trash2, UserRound } from 'lucide-react'
import PageShell, { LoadNotice } from '@/components/storefront/PageShell'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import EmployeesEditor, { empInputStyle } from './EmployeesEditor'
import { EMPLOYEES_SETUP_SQL } from './EmployeesSetupSql'
import { blankEmployee, employeeStatusBadge, filterEmployees, normalizeDepartment, type Employee } from './EmployeesTypes'
import { deleteEmployee, insertAuditLog, isMissingTable, loadEmployees, probePrivateAccess } from './EmployeesData'

const th: React.CSSProperties = { padding: '10px 16px', fontWeight: 600, whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '10px 16px', verticalAlign: 'middle' }

export default function EmployeesManager() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [photos, setPhotos] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [canSeePrivate, setCanSeePrivate] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [showSql, setShowSql] = useState(false)
  const [copiedSql, setCopiedSql] = useState(false)
  const { confirm, confirmDialog } = useConfirmDialog()

  const refresh = useCallback(async () => {
    setLoading(true)
    const r = await loadEmployees()
    if (r.error) {
      setError(isMissingTable(r.error)
        ? 'The employees table was not found in the storefront database. Run the database setup SQL below, then reload.'
        : r.error.message || 'Could not load employee records.')
      if (isMissingTable(r.error)) setShowSql(true)
      setEmployees([])
      setPhotos({})
    } else {
      setError('')
      setEmployees(r.employees)
      setPhotos(r.photos)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
    probePrivateAccess().then(setCanSeePrivate)
  }, [refresh])

  const filtered = useMemo(() => filterEmployees(employees, search), [employees, search])

  const copySql = async () => {
    try {
      await navigator.clipboard.writeText(EMPLOYEES_SETUP_SQL)
      setCopiedSql(true)
      setTimeout(() => setCopiedSql(false), 2000)
    } catch {
      setNotice('Copy failed. Select the SQL and copy it manually.')
    }
  }

  const remove = async (emp: Employee) => {
    if (!emp.id) return
    const ok = await confirm({
      title: 'Delete employee record?',
      message: `The record for ${emp.full_name} (${emp.employee_id}) will be permanently deleted, along with its photo and private details. This cannot be undone.`,
      confirmLabel: 'Delete record',
      tone: 'danger',
      strictDelete: true,
      entityType: 'employee',
      entityName: emp.full_name,
    })
    if (!ok) return
    const err = await deleteEmployee(emp.id)
    if (err) { setNotice(`Failed to delete employee record: ${err.message}`); return }
    await insertAuditLog('DELETE', emp.employee_id, emp.full_name, `Deleted record — Role: ${emp.role}, Status: ${emp.status}`)
    setNotice(`Deleted ${emp.full_name}.`)
    void refresh()
  }

  if (editing) {
    return (
      <PageShell
        title={editing.id ? 'Edit employee' : 'Add employee'}
        description={editing.full_name || 'Create or update an employee record'}
        actions={<button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>← Back to employees</button>}
      >
        {confirmDialog}
        <EmployeesEditor
          key={editing.id || 'new'}
          initial={editing}
          employees={employees}
          initialPhoto={(editing.employee_id && photos[editing.employee_id]) || ''}
          canSeePrivate={canSeePrivate}
          onCancel={() => setEditing(null)}
          onSaved={() => { setEditing(null); setNotice('Employee record saved.'); void refresh() }}
          onPhotoSaved={(employeeId, url) => setPhotos((p) => ({ ...p, [employeeId]: url }))}
        />
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Employees"
      description="Employee directory and ID card records: roles, tenure, photos and private details."
      backHref="/manage"
      backLabel="Manage"
      actions={
        <>
          <button type="button" className="btn btn-secondary" onClick={() => setShowSql((s) => !s)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Database size={16} /> Database setup
          </button>
          <button type="button" className="btn btn-primary" onClick={() => { setNotice(''); setEditing(blankEmployee()) }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Plus size={16} /> Add employee
          </button>
        </>
      }
    >
      {confirmDialog}
      {error && <div style={{ marginBottom: 12 }}><LoadNotice error={error} /></div>}
      {notice && (
        <div style={{ marginBottom: 12, fontSize: 14, color: 'var(--text-primary)', border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 12, padding: 12, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Dismiss" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
        </div>
      )}

      {showSql && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Employee ID card database setup</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)', maxWidth: 720 }}>
                Adds the employees table, private DOB and PAN/Aadhaar storage, employee photo permissions and the fixed department list. Run it in the storefront Supabase SQL editor.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={copySql} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {copiedSql ? <Check size={14} /> : <Copy size={14} />} {copiedSql ? 'Copied' : 'Copy SQL'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowSql(false)}>Hide</button>
            </div>
          </div>
          <pre style={{ margin: 0, maxHeight: 220, overflow: 'auto', padding: 12, borderRadius: 10, background: '#0f172a', color: '#e2e8f0', fontSize: 12, lineHeight: 1.5 }}>{EMPLOYEES_SETUP_SQL}</pre>
        </div>
      )}

      <div style={{ position: 'relative', maxWidth: 360, marginBottom: 16 }}>
        <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
        <input type="search" aria-label="Search employees" placeholder="Search name, ID, department, role…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...empInputStyle, paddingLeft: 36 }} />
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 860, fontSize: 14, borderCollapse: 'collapse', color: 'var(--text-primary)' }}>
          <thead>
            <tr style={{ textAlign: 'left', fontSize: 12, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
              {['ID', 'Employee', 'Department', 'Role', 'Tenure', 'Status', ''].map((h) => <th key={h || 'actions'} style={th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</td></tr>}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>{search ? 'No employee records match your search.' : 'No employee records yet.'}</td></tr>
            )}
            {!loading && filtered.map((emp) => (
              <tr key={emp.id || emp.employee_id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                <td style={td}><code style={{ fontSize: 12, color: 'var(--text-muted)' }}>{emp.employee_id}</code></td>
                <td style={td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {photos[emp.employee_id] ? <img src={photos[emp.employee_id]} alt={emp.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <UserRound size={18} color="var(--text-muted)" />}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{emp.full_name}</div>
                      {(emp.email || emp.phone) && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{[emp.email, emp.phone].filter(Boolean).join(' · ')}</div>}
                    </div>
                  </div>
                </td>
                <td style={td}>{normalizeDepartment(emp.department)}</td>
                <td style={td}>{emp.role}</td>
                <td style={{ ...td, fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{emp.tenure}</td>
                <td style={td}><span className={employeeStatusBadge(emp.status)}>{(emp.status || 'UNKNOWN').toUpperCase()}</span></td>
                <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setNotice(''); setEditing(emp) }} aria-label={`Edit ${emp.full_name}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Pencil size={14} /> Edit
                  </button>{' '}
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => { void remove(emp) }} aria-label={`Delete ${emp.full_name}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Trash2 size={14} /> Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loading && !error && (
        <p style={{ margin: '10px 2px 0', fontSize: 12, color: 'var(--text-muted)' }}>
          {filtered.length} of {employees.length} record{employees.length === 1 ? '' : 's'}
          {!canSeePrivate && ' · Date of birth and ID documents are visible to super managers only.'}
        </p>
      )}
    </PageShell>
  )
}
