'use client'

// Add / edit form for one employee record, including the super-manager-only DOB and
// government ID fields, multi-period tenure, and the cropped employee photo.
import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Camera, Eye, EyeOff, Loader2, Lock, Plus, UserRound } from 'lucide-react'
import EmployeesPhotoCrop from './EmployeesPhotoCrop'
import {
  AVAILABLE_DEPARTMENTS, AVAILABLE_ROLES, AVAILABLE_STATUSES, GOVERNMENT_ID_TYPES, MAX_PHOTO_BYTES,
  blankTenure, describeEmployeeChanges, formatTenure, getNextEmployeeId, normalizeDepartment, parseTenurePeriods, validateTenure,
  type Employee, type EmployeePayload, type TenurePeriod,
} from './EmployeesTypes'
import { insertAuditLog, insertEmployee, loadPhoto, loadPrivateDetails, savePhoto, savePrivateDetails, updateEmployee } from './EmployeesData'

export const empInputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return <div><label htmlFor={htmlFor} style={labelStyle}>{label}</label>{children}</div>
}

type Props = {
  initial: Employee
  employees: Employee[]
  initialPhoto: string
  canSeePrivate: boolean
  onCancel: () => void
  onSaved: () => void
  onPhotoSaved: (employeeId: string, photoUrl: string) => void
}

export default function EmployeesEditor({ initial, employees, initialPhoto, canSeePrivate, onCancel, onSaved, onPhotoSaved }: Props) {
  const [form, setForm] = useState<Employee>(() => ({ ...initial, department: normalizeDepartment(initial.department), status: (initial.status || 'ACTIVE').toUpperCase() }))
  const [tenurePeriods, setTenurePeriods] = useState<TenurePeriod[]>(() => (initial.id ? parseTenurePeriods(initial.tenure) : [blankTenure()]))
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [idType, setIdType] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [showIdNumber, setShowIdNumber] = useState(false)
  const [privateAllowed, setPrivateAllowed] = useState(canSeePrivate)
  const [privateLoading, setPrivateLoading] = useState(Boolean(initial.id && canSeePrivate))
  const [photo, setPhoto] = useState(initialPhoto)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [savingPhoto, setSavingPhoto] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const photoInput = useRef<HTMLInputElement>(null)

  const isNew = !form.id
  const set = <K extends keyof Employee>(key: K, value: Employee[K]) => setForm((f) => ({ ...f, [key]: value }))
  const previewId = isNew ? getNextEmployeeId(employees, form.role, form.full_name) : form.employee_id

  useEffect(() => {
    if (!initial.id) return
    let cancelled = false
    loadPhoto(initial.employee_id).then((url) => { if (!cancelled && url) setPhoto(url) })
    if (canSeePrivate) {
      loadPrivateDetails(initial.employee_id).then((r) => {
        if (cancelled) return
        if (r.forbidden) setPrivateAllowed(false)
        else {
          setDateOfBirth(r.dateOfBirth)
          setIdType(r.documentType)
          setIdNumber(r.documentNumber)
          if (r.error) setError(`Private details could not be loaded: ${r.error.message}`)
        }
        setPrivateLoading(false)
      })
    }
    return () => { cancelled = true }
  }, [initial.id, initial.employee_id, canSeePrivate])

  const choosePhoto = (file?: File) => {
    if (!file || !form.id) return
    if (!file.type.startsWith('image/')) { setError('Choose an image file for the employee photo.'); return }
    if (file.size > MAX_PHOTO_BYTES) { setError('Choose an image smaller than 2 MB.'); return }
    setError('')
    setCropFile(file)
  }

  const saveCroppedPhoto = async (photoUrl: string) => {
    if (!form.id) return
    setCropFile(null)
    setSavingPhoto(true)
    setError('')
    const err = await savePhoto(form.employee_id, photoUrl)
    if (err) setError(err.message || 'The employee photo could not be saved.')
    else {
      setPhoto(photoUrl)
      onPhotoSaved(form.employee_id, photoUrl)
    }
    setSavingPhoto(false)
  }

  const updateTenure = (index: number, patch: Partial<TenurePeriod>) =>
    setTenurePeriods((periods) => periods.map((p, i) => (i === index ? { ...p, ...patch } : p)))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving || privateLoading) return
    const empId = isNew ? getNextEmployeeId(employees, form.role, form.full_name) : form.employee_id.trim()
    const fullName = form.full_name.trim()
    const department = (form.department || '').trim()
    const tenureError = validateTenure(tenurePeriods)
    if (tenureError) { setError(tenureError); return }
    if (!empId || !fullName || !department) { setError('All marked fields are required.'); return }
    if (privateAllowed && (!dateOfBirth || !idType || !idNumber.trim())) { setError('Date of birth and government ID details are required.'); return }

    const payload: EmployeePayload = {
      employee_id: empId,
      full_name: fullName,
      email: (form.email || '').trim(),
      phone: (form.phone || '').trim(),
      secondary_email: (form.secondary_email || '').trim(),
      secondary_phone: (form.secondary_phone || '').trim(),
      department,
      role: form.role,
      tenure: formatTenure(tenurePeriods),
      status: (form.status || 'ACTIVE').toUpperCase(),
    }

    setSaving(true)
    setError('')
    try {
      if (form.id) {
        const oldEmp = employees.find((x) => x.id === form.id) || initial
        const err = await updateEmployee(form.id, payload)
        if (err) throw err
        await insertAuditLog('UPDATE', payload.employee_id, payload.full_name, describeEmployeeChanges(oldEmp, payload))
      } else {
        const { id, error: err } = await insertEmployee(payload)
        if (err) {
          if (err.code === '23505') { setError('An employee with this ID already exists in the database.'); return }
          throw err
        }
        // Keep the new row's id so a retry after a failed private-details save becomes an update.
        if (id) setForm((f) => ({ ...f, id, employee_id: empId }))
        await insertAuditLog('CREATE', payload.employee_id, payload.full_name, `Created new record — Role: ${payload.role}, Dept: ${payload.department}, Status: ${payload.status}`)
      }
      if (privateAllowed) {
        const err = await savePrivateDetails(empId, dateOfBirth, idType, idNumber.trim())
        if (err) throw err
      }
      onSaved()
    } catch (err: any) {
      setError(err?.message || 'An error occurred while saving the record.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="card" style={{ padding: 20, display: 'grid', gap: 20 }}>
      {error && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, background: 'var(--danger-light)', color: 'var(--danger)', fontSize: 14, fontWeight: 600 }}>
          <AlertCircle size={16} /> <span>{error}</span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: 16, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '2px solid var(--bg)' }}>
          {photo ? <img src={photo} alt={`${form.full_name || 'Employee'} photo`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <UserRound size={30} color="var(--text-muted)" />}
        </div>
        <div style={{ flex: '1 1 220px' }}>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Employee photo</div>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>Upload a photo or view the one the employee added to their ID card. Images must be under 2 MB.</p>
        </div>
        <input ref={photoInput} type="file" accept="image/*" hidden onChange={(e) => { choosePhoto(e.target.files?.[0]); e.currentTarget.value = '' }} />
        <button type="button" className="btn btn-secondary" disabled={isNew || savingPhoto} onClick={() => photoInput.current?.click()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {savingPhoto ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
          {isNew ? 'Save record first' : savingPhoto ? 'Saving photo…' : 'Upload photo'}
        </button>
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        <Field label="Full name *" htmlFor="emp-name">
          <input id="emp-name" required style={empInputStyle} value={form.full_name} placeholder="e.g. Raj Singh" onChange={(e) => set('full_name', e.target.value)} />
        </Field>
        <Field label="Employee ID">
          <input disabled style={{ ...empInputStyle, fontFamily: 'monospace', color: 'var(--text-muted)' }} value={previewId} />
        </Field>
        <Field label="Email address" htmlFor="emp-email">
          <input id="emp-email" type="email" style={empInputStyle} value={form.email || ''} placeholder="e.g. raj@genziitian.in" onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Phone number" htmlFor="emp-phone">
          <input id="emp-phone" type="tel" style={empInputStyle} value={form.phone || ''} placeholder="e.g. +91 98765 43210" onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="Secondary email (optional)" htmlFor="emp-email2">
          <input id="emp-email2" type="email" style={empInputStyle} value={form.secondary_email || ''} placeholder="e.g. personal@email.com" onChange={(e) => set('secondary_email', e.target.value)} />
        </Field>
        <Field label="Secondary phone (optional)" htmlFor="emp-phone2">
          <input id="emp-phone2" type="tel" style={empInputStyle} value={form.secondary_phone || ''} placeholder="Optional alternate number" onChange={(e) => set('secondary_phone', e.target.value)} />
        </Field>
        <Field label="Department *" htmlFor="emp-dept">
          <select id="emp-dept" required style={empInputStyle} value={normalizeDepartment(form.department)} onChange={(e) => set('department', e.target.value)}>
            {AVAILABLE_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Role *" htmlFor="emp-role">
          <select id="emp-role" style={empInputStyle} value={form.role || 'Educator'} onChange={(e) => set('role', e.target.value)}>
            {!AVAILABLE_ROLES.includes(form.role) && form.role && <option value={form.role}>{form.role}</option>}
            {AVAILABLE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Current status *" htmlFor="emp-status">
          <select id="emp-status" style={empInputStyle} value={(form.status || 'ACTIVE').toUpperCase()} onChange={(e) => set('status', e.target.value)}>
            {AVAILABLE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>

      <section style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Lock size={15} color="var(--text-secondary)" />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Private details</span>
          <span className="badge badge-gray">Super managers only</span>
        </div>
        {!privateAllowed ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>Date of birth and PAN/Aadhaar details are visible only to super managers. Other fields can still be saved.</p>
        ) : privateLoading ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}><Loader2 size={14} className="animate-spin" /> Loading private details…</p>
        ) : (
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <Field label="Date of birth *" htmlFor="emp-dob">
              <input id="emp-dob" required type="date" style={{ ...empInputStyle, background: 'var(--bg)' }} value={dateOfBirth} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDateOfBirth(e.target.value)} />
            </Field>
            <Field label="ID document *" htmlFor="emp-idtype">
              <select id="emp-idtype" required style={{ ...empInputStyle, background: 'var(--bg)' }} value={idType} onChange={(e) => setIdType(e.target.value)}>
                <option value="">Select</option>
                {GOVERNMENT_ID_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="ID number *" htmlFor="emp-idnum">
              <div style={{ display: 'flex', gap: 6 }}>
                <input id="emp-idnum" required type={showIdNumber ? 'text' : 'password'} autoComplete="off" style={{ ...empInputStyle, background: 'var(--bg)', flex: 1, minWidth: 0 }} value={idNumber} placeholder="PAN or Aadhaar number" onChange={(e) => setIdNumber(e.target.value)} />
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowIdNumber((s) => !s)} aria-label={showIdNumber ? 'Hide ID number' : 'Show ID number'}>
                  {showIdNumber ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>
          </div>
        )}
      </section>

      <section style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Tenure / duration</div>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>Add a period each time they return to work.</p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            onClick={() => setTenurePeriods((periods) => [...periods.map((p) => ({ ...p, isPresent: false })), blankTenure()])}>
            <Plus size={14} /> Add period
          </button>
        </div>
        {tenurePeriods.map((period, index) => (
          <div key={index} style={{ padding: 12, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Period {index + 1}</span>
              {tenurePeriods.length > 1 && (
                <button type="button" onClick={() => setTenurePeriods((periods) => periods.filter((_, i) => i !== index))} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--danger)' }}>Remove</button>
              )}
            </div>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
              <Field label="Start date *" htmlFor={`emp-start-${index}`}>
                <input id={`emp-start-${index}`} required type="date" style={empInputStyle} value={period.startDate} onChange={(e) => updateTenure(index, { startDate: e.target.value })} />
              </Field>
              <Field label="End date" htmlFor={`emp-end-${index}`}>
                <input id={`emp-end-${index}`} type="date" disabled={period.isPresent} required={!period.isPresent} min={period.startDate || undefined} style={{ ...empInputStyle, opacity: period.isPresent ? 0.5 : 1 }} value={period.endDate} onChange={(e) => updateTenure(index, { endDate: e.target.value })} />
              </Field>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13, color: 'var(--text-secondary)', cursor: index < tenurePeriods.length - 1 ? 'not-allowed' : 'pointer' }}>
              <input type="checkbox" checked={period.isPresent} disabled={index < tenurePeriods.length - 1}
                onChange={(e) => updateTenure(index, { isPresent: e.target.checked, endDate: e.target.checked ? '' : period.endDate })} />
              Currently working here (Present)
            </label>
          </div>
        ))}
      </section>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving || privateLoading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {saving && <Loader2 size={16} className="animate-spin" />} {saving ? 'Saving…' : 'Save record'}
        </button>
      </div>

      {cropFile && <EmployeesPhotoCrop file={cropFile} onCancel={() => setCropFile(null)} onSave={(url) => { void saveCroppedPhoto(url) }} />}
    </form>
  )
}
