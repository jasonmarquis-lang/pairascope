'use client'

import { useEffect, useState } from 'react'
import Nav from '@/components/ui/Nav'

type RFQStatus = 'Draft' | 'Sent' | 'Responses In' | 'Closed'

interface RFQRecord {
  id:               string
  title:            string
  status:           RFQStatus
  dateIssued:       string
  responseDeadline: string
  scopeDocument:    string
  bidCount:         number
}

const STATUS_COLORS: Record<RFQStatus, { color: string; bg: string }> = {
  'Draft':        { color: 'var(--ps-muted)',  bg: 'rgba(136,135,128,0.1)' },
  'Sent':         { color: '#EF9F27',           bg: 'rgba(239,159,39,0.1)'  },
  'Responses In': { color: '#1D9E75',           bg: 'rgba(29,158,117,0.1)' },
  'Closed':       { color: 'var(--ps-muted)',  bg: 'rgba(136,135,128,0.08)'},
}

export default function RFQHubPage() {
  const [rfqs,      setRfqs]      = useState<RFQRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // In Phase 1, RFQ Hub shows placeholder state
    // Real data will come from Supabase/Airtable once auth is active
    setTimeout(() => {
      setRfqs([])
      setIsLoading(false)
    }, 400)
  }, [])

  return (
    <>
      <Nav />
      <main style={{ paddingTop: 56, minHeight: '100vh' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 24px' }}>

          {/* Header */}
          <div style={{ marginBottom: 36 }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 400, color: 'var(--ps-white)', margin: '0 0 8px' }}>
              RFQ Hub
            </h1>
            <p style={{ fontSize: 15, color: 'var(--ps-muted)', margin: 0 }}>
              Track your vendor outreach and proposal status.
            </p>
          </div>

          {/* Stats row */}
          <div
            style={{
              display:             'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap:                 12,
              marginBottom:        32,
            }}
          >
            {[
              { label: 'Active RFQs',       value: rfqs.filter((r) => r.status === 'Sent').length },
              { label: 'Responses received', value: rfqs.filter((r) => r.status === 'Responses In').length },
              { label: 'Closed',             value: rfqs.filter((r) => r.status === 'Closed').length },
            ].map(({ label, value }) => (
              <div
                key={label}
                style={{
                  backgroundColor: 'var(--ps-surface)',
                  border:          '0.5px solid var(--ps-border)',
                  borderRadius:    10,
                  padding:         '16px 20px',
                }}
              >
                <p style={{ fontSize: 11, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px' }}>
                  {label}
                </p>
                <p style={{ fontSize: 28, fontWeight: 500, color: 'var(--ps-white)', margin: 0 }}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* RFQ list */}
          {isLoading ? (
            <div style={{ color: 'var(--ps-muted)', textAlign: 'center', padding: 60 }}>
              Loading…
            </div>
          ) : rfqs.length === 0 ? (
            <div
              style={{
                textAlign:       'center',
                padding:         60,
                backgroundColor: 'var(--ps-surface)',
                border:          '0.5px solid var(--ps-border)',
                borderRadius:    12,
              }}
            >
              <p style={{ fontSize: 16, color: 'var(--ps-text)', marginBottom: 8 }}>
                No RFQs yet
              </p>
              <p style={{ fontSize: 13, color: 'var(--ps-muted)', margin: 0, lineHeight: 1.6 }}>
                Once your project scope is ready and vendors are assigned,
                <br />your RFQs will appear here.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rfqs.map((rfq) => (
                <RFQRow key={rfq.id} rfq={rfq} />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  )
}

function RFQRow({ rfq }: { rfq: RFQRecord }) {
  const [expanded, setExpanded] = useState(false)
  const statusStyle = STATUS_COLORS[rfq.status]

  return (
    <div
      style={{
        backgroundColor: 'var(--ps-surface)',
        border:          '0.5px solid var(--ps-border)',
        borderRadius:    10,
        overflow:        'hidden',
      }}
    >
      <div
        onClick={() => setExpanded((e) => !e)}
        style={{
          padding:        '16px 20px',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          cursor:         'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span
            style={{
              fontSize:        11,
              fontWeight:      500,
              color:           statusStyle.color,
              backgroundColor: statusStyle.bg,
              padding:         '3px 9px',
              borderRadius:    20,
            }}
          >
            {rfq.status}
          </span>
          <span style={{ fontSize: 14, color: 'var(--ps-text)', fontWeight: 500 }}>
            {rfq.title}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--ps-muted)' }}>
            {rfq.bidCount} bid{rfq.bidCount !== 1 ? 's' : ''}
          </span>
          <span style={{ fontSize: 12, color: 'var(--ps-muted)' }}>
            {rfq.dateIssued}
          </span>
          <span style={{ color: 'var(--ps-muted)', fontSize: 14 }}>
            {expanded ? '▴' : '▾'}
          </span>
        </div>
      </div>

      {expanded && rfq.scopeDocument && (
        <div
          style={{
            padding:    '0 20px 16px',
            borderTop:  '0.5px solid var(--ps-border)',
            paddingTop: 14,
          }}
        >
          <p style={{ fontSize: 11, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
            Scope document
          </p>
          <pre
            style={{
              fontSize:        12,
              color:           'var(--ps-text)',
              lineHeight:      1.7,
              whiteSpace:      'pre-wrap',
              fontFamily:      'inherit',
              margin:          0,
              backgroundColor: 'var(--ps-bg)',
              padding:         '12px 14px',
              borderRadius:    8,
              border:          '0.5px solid var(--ps-border)',
            }}
          >
            {rfq.scopeDocument}
          </pre>
        </div>
      )}
    </div>
  )
}
