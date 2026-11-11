'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DynamicPromptBlocker() {
  const router = useRouter()
  const [prompt, setPrompt] = useState<any>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function checkActivePrompt() {
      // Don't show if checked in session or user just completed profile
      if (typeof window !== 'undefined') {
        if (
          sessionStorage.getItem('profileJustCompleted') === 'true' ||
          sessionStorage.getItem('prompts_checked_session') === 'true'
        ) {
          setLoading(false)
          return
        }
      }

      try {
        const res = await fetch('/api/prompts/active')
        if (res.ok) {
          const data = await res.json()
          if (data.prompt) {
            setPrompt(data.prompt)
          }
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('prompts_checked_session', 'true')
          }
        }
      } catch (err) {
        console.error('Failed to fetch active prompt:', err)
      } finally {
        setLoading(false)
      }
    }
    checkActivePrompt()
  }, [])

  if (loading || !prompt) return null

  let questions = []
  try {
    questions = JSON.parse(prompt.questions)
  } catch (e) {}

  const handleAnswerChange = (questionId: string, val: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: val }))
    setError('')
  }

  const submitResponse = async (finalAnswers: Record<string, string>) => {
    setSubmitting(true)
    setError('')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    try {
      const res = await fetch('/api/prompts/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptId: prompt.id, answers: finalAnswers }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!res.ok) throw new Error('Failed to submit response')
      
      setPrompt(null) // Dismiss modal
      router.refresh()
    } catch (err: any) {
      clearTimeout(timeoutId)
      console.error('Prompt submit error:', err)
      if (err.name === 'AbortError') {
        setError('Request timed out. Please check your connection and try again.')
      } else {
        setError('Something went wrong. Please try again.')
      }
      setSubmitting(false)
    }
  }

  const handleCTAClick = async (questionId: string) => {
    // Immediately dismiss modal and save response
    const newAnswers = { ...answers, [questionId]: 'CLICKED' }
    setAnswers(newAnswers)
    await submitResponse(newAnswers)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    for (const q of questions) {
      if (q.type !== 'CTA_ONLY' && !answers[q.id]) {
        setError('Please answer all questions before continuing.')
        return
      }
    }

    await submitResponse(answers)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '20px'
    }}>
      <div className="fade-in" style={{
        background: 'var(--surface)', width: '100%', maxWidth: '650px',
        padding: '40px', borderRadius: '24px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '8px' }}>
            {prompt.title}
          </h1>
          {prompt.description && (
            <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {prompt.description}
            </p>
          )}
        </div>

        {error && (
          <div style={{
            background: 'var(--danger-light)', color: 'var(--danger)', padding: '12px 16px',
            borderRadius: '12px', fontSize: '13px', fontWeight: 600,
            marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {questions.map((q: any) => (
            <div key={q.id}>
              <label style={{ display: 'block', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)', fontSize: '15px' }}>
                {q.text}
              </label>

              {q.type === 'YES_NO' && (
                <div style={{ display: 'flex', gap: '12px' }}>
                  {['Yes', 'No'].map(opt => (
                    <div key={opt} onClick={() => handleAnswerChange(q.id, opt)} style={{
                      flex: 1, padding: '12px', borderRadius: '12px', textAlign: 'center', cursor: 'pointer',
                      fontSize: '14px', fontWeight: 700,
                      border: answers[q.id] === opt ? '2px solid var(--primary)' : '2px solid #e0e3ea',
                      background: answers[q.id] === opt ? '#eff0fe' : 'var(--surface)',
                      color: answers[q.id] === opt ? 'var(--accent)' : 'var(--text-secondary)',
                      transition: 'all 0.2s'
                    }}>
                      {opt}
                    </div>
                  ))}
                </div>
              )}

              {q.type === 'MULTIPLE_CHOICE' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(q.options || []).map((opt: string) => (
                    <div key={opt} onClick={() => handleAnswerChange(q.id, opt)} style={{
                      padding: '12px 16px', borderRadius: '12px', cursor: 'pointer',
                      fontSize: '14px', fontWeight: 600,
                      border: answers[q.id] === opt ? '2px solid var(--primary)' : '2px solid #e0e3ea',
                      background: answers[q.id] === opt ? '#eff0fe' : 'var(--surface)',
                      color: answers[q.id] === opt ? 'var(--accent)' : 'var(--text-primary)',
                      transition: 'all 0.2s'
                    }}>
                      {opt}
                    </div>
                  ))}
                </div>
              )}

              {q.type === 'CTA_ONLY' && q.link && (
                <a href={q.link} target="_blank" rel="noopener noreferrer" onClick={() => handleCTAClick(q.id)} style={{
                  display: 'block', textAlign: 'center', padding: '12px', borderRadius: '12px',
                  background: 'var(--text-primary)', color: '#fff', fontSize: '15px', fontWeight: 700, textDecoration: 'none'
                }}>
                  {q.linkText || 'Click Here'}
                </a>
              )}
            </div>
          ))}

          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary"
            style={{
              marginTop: '10px', width: '100%', padding: '12px',
              fontSize: '15px', fontWeight: 800,
              boxShadow: '0 8px 20px color-mix(in srgb, var(--primary) 30%, transparent)',
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              opacity: submitting ? 0.7 : 1
            }}
          >
            {submitting ? 'Saving...' : 'Submit & Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
