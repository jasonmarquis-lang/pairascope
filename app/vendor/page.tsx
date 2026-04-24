'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Nav from '@/components/ui/Nav'

interface VendorRFQ {
  id:             string
  project_name:   string
  project_id:     string
  scope_document: string
  status:         string
  created_at:     string
  bid_submitted:  boolean
}

export default function VendorPage() {
  const router = useRouter()
  const [rfqs,      setRfqs]      = useState<VendorRFQ[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error,     setError]     = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) { router.push('/'); return }

      const userId = sessionData.session.user.id
      try {
        const res  = await fetch('/api/bids?vendorId=' + userId)
        const data = await res.json()
        setRfqs(data.rfqs ?? [])
      } catch {
        setError('Could not load your RFQs.')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [router])

  return (
    <>
      <Nav />
      <main style={{ paddingTop: 56, minHeight: '100vh' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 24px' }}>

          <div style={{ marginBottom: 36 }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 400, color: 'var(--ps-white)', margin: '0 0 8px' }}>
              Vendor Dashboard
            </h1>
            <p style={{ fontSize: 15, color: 'var(--ps-muted)', margin: 0 }}>
              Review project inquiries and submit your estimates.
            </p>
          </div>

          {isLoading && <div style={{ color: 'var(--ps-muted)', textAlign: 'center', padding: 60 }}>Loading...</div>}
          {error    && <div style={{ color: '#E24B4A', textAlign: 'center', padding: 60 }}>{error}</div>}

          {!isLoading && !error && rfqs.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60, backgroundColor: 'var(--ps-surface)', border: '0.5px solid var(--ps-border)', borderRadius: 12 }}>
              <p style={{ fontSize: 16, color: 'var(--ps-text)', marginBottom: 8 }}>No project inquiries yet</p>
              <p style={{ fontSize: 13, color: 'var(--ps-muted)', margin: 0 }}>
                When artists send you RFQs through Pairascope, they will appear here.
              </p>
            </div>
          )}

          {!isLoading && rfqs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rfqs.map((rfq) => (
                <div
                  key={rfq.id}
                  onClick={() => router.push('/vendor/rfq/' + rfq.id)}
                  style={{ backgroundColor: 'var(--ps-surface)', border: '0.5px solid var(--ps-border)', borderRadius: 10, padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, transition: 'border-color 0.15s ease' }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--ps-border)'}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--ps-white)', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {rfq.project_name || 'Art Project'}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--ps-muted)', margin: 0, fontFamily: 'monospace' }}>
                      {rfq.project_id} · {new Date(rfq.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    {rfq.bid_submitted ? (
                      <span style={{ fontSize: 11, color: '#1D9E75', backgroundColor: 'rgba(29,158,117,0.1)', padding: '3px 9px', borderRadius: 20, fontWeight: 500 }}>
                        Estimate submitted
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: '#EF9F27', backgroundColor: 'rgba(239,159,39,0.1)', padding: '3px 9px', borderRadius: 20, fontWeight: 500 }}>
                        Awaiting estimate
                      </span>
                    )}
                    <span style={{ color: 'var(--ps-muted)', fontSize: 12 }}>→</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
