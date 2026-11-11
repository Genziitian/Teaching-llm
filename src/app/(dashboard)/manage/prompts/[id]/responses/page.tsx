'use client'

import { useParams, useRouter } from 'next/navigation'
import useSWR from 'swr'
import { ArrowLeft, Users, Download, Calendar, Mail, User } from 'lucide-react'
import UserAvatar from '@/components/UserAvatar'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function PromptResponsesPage() {
  const { id } = useParams()
  const router = useRouter()
  const { data, isLoading } = useSWR(`/api/admin/prompts/${id}`, fetcher)

  if (isLoading) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading responses...</div>
  if (!data?.prompt) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--danger)' }}>Prompt not found</div>

  const prompt = data.prompt
  const questions = JSON.parse(prompt.questions)
  const responses = prompt.responses || []

  const handleExport = () => {
    // Basic CSV export
    const headers = ['User Name', 'User Email', 'Submitted At', ...questions.map((q: any) => q.text)]
    const rows = responses.map((r: any) => {
      const answers = JSON.parse(r.answers)
      return [
        r.user.name,
        r.user.email,
        new Date(r.createdAt).toLocaleString(),
        ...questions.map((q: any) => answers[q.id] || 'N/A')
      ]
    })

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `responses_${prompt.title.replace(/\s+/g, '_')}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="page-container fade-in" style={{ paddingBottom: '80px' }}>
      <button 
        onClick={() => router.back()}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', marginBottom: '24px', fontSize: '14px' }}
      >
        <ArrowLeft size={18} /> Back to Prompts
      </button>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '40px', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '8px' }}>{prompt.title}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Viewing all student responses for this prompt.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ padding: '12px 24px', borderRadius: '16px', background: 'var(--surface)', boxShadow: '4px 4px 10px rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={20} color="var(--primary)" />
            <div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)' }}>{responses.length}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Responses</div>
            </div>
          </div>
          <button 
            onClick={handleExport}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}
          >
            <Download size={18} /> Export CSV
          </button>
        </div>
      </div>

      {responses.length === 0 ? (
        <div className="card" style={{ padding: '80px 20px', textAlign: 'center' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#f3f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Users size={30} color="var(--neu-dark)" />
          </div>
          <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>No Responses Yet</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>When students answer this prompt, their details will appear here.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          {responses.map((r: any) => {
            let answers = {}
            try { answers = JSON.parse(r.answers) } catch(e){}
            
            return (
              <div key={r.id} className="card" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 24px', background: 'var(--surface)', borderBottom: '1px solid #f0f1f5' }}>
                  <UserAvatar user={r.user} size={40} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-primary)' }}>{r.user.name}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>•</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Mail size={12} /> {r.user.email}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                    <Calendar size={14} /> {new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
                  {questions.map((q: any) => (
                    <div key={q.id}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '8px' }}>
                        {q.text}
                      </div>
                      <div style={{ 
                        padding: '12px 16px', borderRadius: '12px', 
                        background: '#f3f4f8', color: 'var(--text-primary)', fontWeight: 700, fontSize: '14px',
                        border: '1px solid #e0e3ea'
                      }}>
                        {answers[q.id as keyof typeof answers] || 'N/A'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
