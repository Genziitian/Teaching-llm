'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { Plus, Trash, Users, ChevronDown, ChevronUp } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function PromptsAdminPage() {
  const { data, mutate, isLoading } = useSWR('/api/admin/prompts', fetcher)
  const prompts = data?.prompts || []

  const [isCreating, setIsCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [questions, setQuestions] = useState<any[]>([])
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null)

  const addQuestion = (type: string) => {
    setQuestions([...questions, { id: `q_${Date.now()}`, text: '', type, options: [], link: '', linkText: '' }])
  }

  const updateQuestion = (id: string, updates: any) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, ...updates } : q))
  }

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id))
  }

  const startEdit = (prompt: any) => {
    setEditingPromptId(prompt.id)
    setNewTitle(prompt.title)
    setNewDesc(prompt.description || '')
    setQuestions(JSON.parse(prompt.questions))
    setIsCreating(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelCreate = () => {
    setEditingPromptId(null)
    setNewTitle('')
    setNewDesc('')
    setQuestions([])
    setIsCreating(false)
  }

  const handleSave = async () => {
    if (!newTitle || questions.length === 0) return alert('Title and at least 1 question are required.')
    
    // Clean up empty options
    const cleanedQuestions = questions.map(q => {
      if (q.type === 'MULTIPLE_CHOICE') {
        return { ...q, options: Array.isArray(q.options) ? q.options.filter((o: string) => o.trim() !== '') : [] }
      }
      return q
    })

    const url = editingPromptId ? `/api/admin/prompts/${editingPromptId}` : '/api/admin/prompts'
    const method = editingPromptId ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle,
        description: newDesc,
        isActive: editingPromptId ? undefined : false, // Don't change active state on edit unless requested
        questions: cleanedQuestions
      })
    })

    if (res.ok) {
      cancelCreate()
      mutate()
    } else {
      alert('Failed to save prompt')
    }
  }

  const toggleActive = async (id: string, currentState: boolean) => {
    await fetch(`/api/admin/prompts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !currentState })
    })
    mutate()
  }

  const deletePrompt = async (id: string) => {
    if (!confirm('Are you sure you want to delete this prompt and all its responses?')) return
    await fetch(`/api/admin/prompts/${id}`, { method: 'DELETE' })
    mutate()
  }

  return (
    <div className="page-container fade-in">
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '30px' }}>
        <button 
          onClick={() => isCreating ? cancelCreate() : setIsCreating(true)}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={18} /> {isCreating ? 'Cancel' : 'Create New Prompt'}
        </button>
      </div>

      {isCreating && (
        <div className="card" style={{ padding: '24px', marginBottom: '30px', borderTop: '4px solid var(--primary)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>{editingPromptId ? 'Edit Prompt' : 'Create New Prompt'}</h2>
          
          <div className="form-group">
            <label className="form-label">Title (Required)</label>
            <input type="text" className="form-input" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g. Please give us feedback" />
          </div>

          <div className="form-group">
            <label className="form-label">Description (Optional)</label>
            <textarea className="form-input" rows={2} value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Explain why you are asking this..." />
          </div>

          <div style={{ marginTop: '24px' }}>
            <label className="form-label">Questions / CTAs (Max 3)</label>
            {questions.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', background: 'var(--surface)', borderRadius: '12px', border: '1px dashed var(--neu-dark)', color: 'var(--text-muted)', fontSize: '14px' }}>
                No questions added yet. Add one below. (Max 3)
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {questions.map((q, i) => (
                <div key={q.id} style={{ background: 'var(--surface)', padding: '16px', borderRadius: '12px', position: 'relative' }}>
                  <button onClick={() => removeQuestion(q.id)} style={{ position: 'absolute', top: '16px', right: '16px', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    <Trash size={18} />
                  </button>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--accent)', marginBottom: '8px' }}>
                    {q.type === 'YES_NO' ? 'Yes / No Question' : q.type === 'MULTIPLE_CHOICE' ? 'Multiple Choice' : 'CTA Button'}
                  </div>

                  <input 
                    type="text" 
                    className="form-input" 
                    style={{ marginBottom: '12px', background: 'var(--surface)' }}
                    value={q.text} 
                    onChange={e => updateQuestion(q.id, { text: e.target.value })} 
                    placeholder={q.type === 'CTA_ONLY' ? "Message above button (e.g. Please click here to review us)" : "Question text..."}
                  />

                  {q.type === 'MULTIPLE_CHOICE' && (
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Options (Comma separated)</div>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ background: 'var(--surface)' }}
                        value={q.options.join(', ')} 
                        onChange={e => updateQuestion(q.id, { options: e.target.value.split(',').map(s => s.trim()) })} 
                        placeholder="e.g. Class 11, Class 12, Dropper"
                      />
                    </div>
                  )}

                  {q.type === 'CTA_ONLY' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Button Text</div>
                        <input type="text" className="form-input" style={{ background: 'var(--surface)' }} value={q.linkText} onChange={e => updateQuestion(q.id, { linkText: e.target.value })} placeholder="e.g. Give Feedback" />
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>URL</div>
                        <input type="url" className="form-input" style={{ background: 'var(--surface)' }} value={q.link} onChange={e => updateQuestion(q.id, { link: e.target.value })} placeholder="https://..." />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button disabled={questions.length >= 3} onClick={() => addQuestion('YES_NO')} className="btn btn-ghost" style={{ fontSize: '13px', opacity: questions.length >= 3 ? 0.5 : 1 }}>+ Add Yes/No</button>
              <button disabled={questions.length >= 3} onClick={() => addQuestion('MULTIPLE_CHOICE')} className="btn btn-ghost" style={{ fontSize: '13px', opacity: questions.length >= 3 ? 0.5 : 1 }}>+ Add Multiple Choice</button>
              <button disabled={questions.length >= 3} onClick={() => addQuestion('CTA_ONLY')} className="btn btn-ghost" style={{ fontSize: '13px', opacity: questions.length >= 3 ? 0.5 : 1 }}>+ Add CTA Button</button>
            </div>
            {questions.length >= 3 && <p style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '8px' }}>Maximum limit of 3 questions reached.</p>}
          </div>

          <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            {editingPromptId && <button onClick={cancelCreate} className="btn btn-ghost">Cancel Edit</button>}
            <button onClick={handleSave} className="btn btn-primary">{editingPromptId ? 'Update Prompt' : 'Save Prompt'}</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
      ) : prompts.length === 0 ? (
        <div className="card" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>No Prompts Found</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Create your first prompt to start collecting responses.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {prompts.map((p: any) => (
            <div key={p.id} className="card" style={{ padding: '24px', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{p.title}</h3>
                    <span style={{ 
                      padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                      background: p.isActive ? 'var(--success-light)' : '#f3f4f8', 
                      color: p.isActive ? 'var(--success)' : 'var(--text-secondary)' 
                    }}>
                      {p.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {p.description && <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>{p.description}</p>}
                </div>
                
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button 
                    onClick={() => toggleActive(p.id, p.isActive)} 
                    className="btn btn-ghost"
                    style={{ fontSize: '12px', padding: '6px 12px', fontWeight: 600, color: p.isActive ? 'var(--warning)' : 'var(--success)' }}
                  >
                    {p.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button 
                    onClick={() => startEdit(p)}
                    className="btn btn-ghost"
                    style={{ fontSize: '12px', padding: '6px 12px', color: 'var(--accent)' }}
                  >
                    Edit
                  </button>
                  <button onClick={() => deletePrompt(p.id)} className="btn btn-ghost" style={{ padding: '6px', color: 'var(--danger)' }}>
                    <Trash size={18} />
                  </button>
                </div>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f3f4f8', paddingTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', fontWeight: 600, fontSize: '14px' }}>
                  <Users size={18} /> {p._count?.responses || 0} Responses
                </div>
                
                <Link 
                  href={`/manage/prompts/${p.id}/responses`}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px' }}
                >
                  View All Responses
                  <ChevronDown size={16} style={{ transform: 'rotate(-90deg)' }}/>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
