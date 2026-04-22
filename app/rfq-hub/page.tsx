'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Nav from '@/components/ui/Nav'

interface RFQRecord {
  id:                string
  project_name:      string
  project_id:        string
  scope_document:    string
  status:            string
  vendors_contacted: number
  created_at:        string
}

export default function RFQHubPage() {
  const router = useRouter()
  const [rfqs,      setRfqs]      = useState<RFQRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error,     setError]     = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: session } = await supabase.auth.getSession()
      if (!session.session) { router.push('/'); return }

      try {
        const res  = await fetch('/api/rfq')
        const data = await res.json()
        setRfqs(data.rfqs ?? [])
      } catch {
        setError('Could not load your RFQs. Please try again.')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [router])

  const total    = rfqs.length
  const sent     = rfqs.filter((r) => r.status === 'Sent').length
  const received = rfqs.filter((r) => r.status === 'Estimates Received').length

  return (
    <>
      <Nav />
      <main style={{ paddingTop: 56, minHeight: '100vh' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 24px' }}>

          <div style={{ marginBottom: 36 }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 400, color: 'var(--ps-white)', margin: '0 0 8px' }}>My RFQs</h1>
            <p style={{ fontSize: 15, color: 'var(--ps-muted)', margin: 0 }}>
              Track your vendor outreach and proposal status.
            </p>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 32 }}>
            {[
              { label: 'Total RFQs',         value: total    },
              { label: 'Awaiting responses', value: sent     },
              { label: 'Proposals in',       value: received },
            ].map(({ label, value }) => (
              <div key={label} style={{ backgroundColor: 'var(--ps-surface)', border: '0.5px solid var(--ps-border)', borderRadius: 10, padding: '16px 20px' }}>
                <p style={{ fontSize: 11, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px' }}>{label}</p>
                <p style={{ fontSize: 28, fontWeight: 500, color: 'var(--ps-white)', margin: 0 }}>{value}</p>
              </div>
            ))}
          </div>

          {/* List */}
          {isLoading && <div style={{ color: 'var(--ps-muted)', textAlign: 'center', padding: 60 }}>Loading…</div>}
          {error    && <div style={{ color: '#E24B4A', textAlign: 'center', padding: 60 }}>{error}</div>}

          {!isLoading && !error && rfqs.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60, backgroundColor: 'var(--ps-surface)', border: '0.5px solid var(--ps-border)', borderRadius: 12 }}>
              <p style={{ fontSize: 16, color: 'var(--ps-text)', marginBottom: 8 }}>No RFQs yet</p>
              <p style={{ fontSize: 13, color: 'var(--ps-muted)', margin: '0 0 20px' }}>
                Complete a project conversation and click "Generate RFQ" to send your first one.
              </p>
              <button
                onClick={() => router.push('/')}
                style={{ padding: '9px 20px', backgroundColor: 'var(--ps-teal)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Start a project →
              </button>
            </div>
          )}

          {!isLoading && rfqs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rfqs.map((rfq) => <RFQRow key={rfq.id} rfq={rfq} />)}
            </div>
          )}
        </div>
      </main>
    </>
  )
}

const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  'Draft':         { color: 'var(--ps-muted)', bg: 'rgba(136,135,128,0.1)' },
  'Sent':          { color: '#EF9F27',          bg: 'rgba(239,159,39,0.1)'  },
  'Responses In':  { color: '#1D9E75',           bg: 'rgba(29,158,117,0.1)' },
  'Closed':        { color: 'var(--ps-muted)', bg: 'rgba(136,135,128,0.08)'},
}

function RFQRow({ rfq }: { rfq: RFQRecord }) {
  const [expanded, setExpanded] = useState(false)
  const style = STATUS_STYLES[rfq.status] ?? STATUS_STYLES['Draft']
  const date  = new Date(rfq.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div style={{ backgroundColor: 'var(--ps-surface)', border: '0.5px solid var(--ps-border)', borderRadius: 10, overflow: 'hidden' }}>

      {/* Row header */}
      <div
        onClick={() => setExpanded((e) => !e)}
        style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 500, color: style.color, backgroundColor: style.bg, padding: '3px 9px', borderRadius: 20, flexShrink: 0 }}>
            {rfq.status}
          </span>
          <span style={{ fontSize: 14, color: 'var(--ps-white)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {rfq.project_name || 'Untitled project'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: 'var(--ps-muted)' }}>
            {rfq.vendors_contacted} vendor{rfq.vendors_contacted !== 1 ? 's' : ''} contacted
          </span>
          <span style={{ fontSize: 12, color: 'var(--ps-muted)' }}>{date}</span>
          <span style={{ fontSize: 11, color: 'var(--ps-muted)', fontFamily: 'monospace' }}>
            {rfq.project_id}
          </span>
          <span style={{ color: 'var(--ps-muted)', fontSize: 12 }}>{expanded ? '▴' : '▾'}</span>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ borderTop: '0.5px solid var(--ps-border)' }}>

          {/* Scope document */}
          <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--ps-border)' }}>
            <p style={{ fontSize: 11, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
              Scope document sent to vendors
            </p>
            <pre style={{
              fontSize: 12, color: 'var(--ps-text)', lineHeight: 1.7,
              whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0,
              backgroundColor: 'var(--ps-bg)', padding: '12px 14px',
              borderRadius: 8, border: '0.5px solid var(--ps-border)',
              maxHeight: 400, overflowY: 'auto',
            }}>
              {rfq.scope_document || 'No scope document available.'}
            </pre>
          </div>

          {/* Meta */}
          <div style={{ padding: '12px 20px', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <MetaItem label="Reference" value={rfq.project_id} />
            <MetaItem label="Sent"      value={date} />
            <MetaItem label="Vendors"   value={String(rfq.vendors_contacted)} />
            <MetaItem label="Status"    value={rfq.status} />
          </div>
        </div>
      )}
    </div>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 3px' }}>{label}</p>
      <p style={{ fontSize: 13, color: 'var(--ps-text)', margin: 0 }}>{value}</p>
    </div>
  )
}
