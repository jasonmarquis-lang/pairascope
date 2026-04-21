'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface RFQReviewProps {
  snapshot:       { aiSummary?: string; projectType?: string; material?: string; scale?: string; location?: string; services?: string[]; timeline?: string; budgetRange?: string }
  scopeDocument:  string
  conversationId: string
  onClose:        () => void
}

export default function RFQReview({ snapshot, scopeDocument, conversationId, onClose }: RFQReviewProps) {
  const router = useRouter()
  const [scope,    setScope]    = useState(scopeDocument)
  const [sending,  setSending]  = useState(false)
  const [sent,     setSent]     = useState(false)
  const [error,    setError]    = useState('')

  const projectName = [
    snapshot.projectType,
    snapshot.material,
    snapshot.location,
  ].filter(Boolean).join(' – ') || 'Art Project'

  const handleSend = async () => {
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/rfq', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          conversationId,
          projectName,
          scopeDocument: scope,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send RFQ')
      setSent(true)
      setTimeout(() => {
        router.push('/rfq-hub')
      }, 2000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
        <h2 style={{ fontSize: 18, fontWeight: 500, color: 'var(--ps-white)', margin: '0 0 8px' }}>RFQ sent</h2>
        <p style={{ fontSize: 14, color: 'var(--ps-muted)', margin: 0 }}>
          Vendors have been notified. Taking you to your RFQ dashboard…
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '0.5px solid var(--ps-border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 11, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>
            Generate RFQ
          </p>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--ps-white)', margin: 0 }}>
            {projectName}
          </h2>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ps-muted)', fontSize: 20, cursor: 'pointer', padding: 4 }}>×</button>
      </div>

      {/* Project summary pills */}
      <div style={{ padding: '12px 20px', borderBottom: '0.5px solid var(--ps-border)', display: 'flex', flexWrap: 'wrap', gap: 6, flexShrink: 0 }}>
        {[
          snapshot.projectType,
          snapshot.material,
          snapshot.scale,
          snapshot.location,
          snapshot.timeline,
          snapshot.budgetRange,
        ].filter(Boolean).map((val, i) => (
          <span key={i} style={{ fontSize: 11, color: 'var(--ps-muted)', backgroundColor: 'var(--ps-surface)', border: '0.5px solid var(--ps-border)', borderRadius: 20, padding: '3px 10px' }}>
            {val}
          </span>
        ))}
      </div>

      {/* Editable scope document */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: 11, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>
            Scope document
          </p>
          <p style={{ fontSize: 11, color: 'var(--ps-muted)', margin: 0 }}>
            Edit before sending
          </p>
        </div>
        <textarea
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          style={{
            flex:            1,
            minHeight:       300,
            backgroundColor: 'var(--ps-surface)',
            border:          '0.5px solid var(--ps-border)',
            borderRadius:    8,
            padding:         '12px 14px',
            fontSize:        13,
            color:           'var(--ps-text)',
            lineHeight:      1.7,
            fontFamily:      'inherit',
            outline:         'none',
            resize:          'vertical',
          }}
        />
        <p style={{ fontSize: 11, color: 'var(--ps-muted)', margin: 0, lineHeight: 1.5 }}>
          This document will be sent to matched vendors via Pairascope. Vendor and artist contact information is kept private until a deposit is secured.
        </p>
      </div>

      {/* Footer */}
      <div style={{ padding: '14px 20px', borderTop: '0.5px solid var(--ps-border)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {error && (
          <p style={{ fontSize: 12, color: '#E24B4A', margin: 0 }}>{error}</p>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '10px 0', backgroundColor: 'transparent', color: 'var(--ps-muted)', border: '0.5px solid var(--ps-border)', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !scope.trim()}
            style={{ flex: 2, padding: '10px 0', backgroundColor: sending ? 'rgba(29,158,117,0.5)' : 'var(--ps-teal)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: sending ? 'default' : 'pointer', fontFamily: 'inherit' }}
          >
            {sending ? 'Sending to vendors…' : 'Send RFQ to vendors →'}
          </button>
        </div>
      </div>
    </div>
  )
}
