'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Nav from '@/components/ui/Nav'

interface BidRecord {
  id:          string
  vendor_name: string
  price_low:   number | null
  price_high:  number | null
  timeline:    string | null
  assumptions: string | null
  notes:       string | null
  status:      string
  created_at:  string
}

interface RFQRecord {
  id:                string
  project_name:      string
  project_id:        string
  scope_document:    string
  status:            string
  vendors_contacted: number
  vendor_names:      string
  vendor_ids:        string[]
  vendor_statuses:   Record<string, string> | null
  conversation_id:   string
  created_at:        string
}

const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  'Draft':              { color: 'var(--ps-muted)', bg: 'rgba(136,135,128,0.1)'  },
  'Sent':               { color: '#EF9F27',          bg: 'rgba(239,159,39,0.1)'   },
  'Estimates Received': { color: '#1D9E75',           bg: 'rgba(29,158,117,0.1)'  },
  'Closed':             { color: 'var(--ps-muted)',  bg: 'rgba(136,135,128,0.08)' },
}

const VENDOR_STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  'Pending':   { color: '#EF9F27', bg: 'rgba(239,159,39,0.08)'  },
  'Responded': { color: '#1D9E75', bg: 'rgba(29,158,117,0.08)'  },
  'Declined':  { color: '#E24B4A', bg: 'rgba(226,75,74,0.08)'   },
  'Selected':  { color: '#1D9E75', bg: 'rgba(29,158,117,0.15)'  },
}

async function getSessionToken(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

export default function RFQHubPage() {
  const router = useRouter()
  const [rfqs,      setRfqs]      = useState<RFQRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error,     setError]     = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) { router.push('/'); return }

      try {
        const token = sessionData.session.access_token
        const res   = await fetch('/api/rfq', { headers: { 'Authorization': 'Bearer ' + token } })
        const data  = await res.json()
        let rfqList: RFQRecord[] = data.rfqs ?? []

        if (rfqList.length === 0) {
          try {
            const raw    = sessionStorage.getItem('ps_conversation')
            const parsed = raw ? JSON.parse(raw) : null
            const convId = parsed?.conversationId
            if (convId) {
              const res2  = await fetch('/api/rfq?conversationId=' + convId)
              const data2 = await res2.json()
              rfqList = data2.rfqs ?? []
            }
          } catch { /* ignore */ }
        }
        setRfqs(rfqList)
      } catch {
        setError('Could not load your RFQs.')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [router])

  const handleContinue = (rfq: RFQRecord) => {
    try {
      sessionStorage.setItem('ps_conversation', JSON.stringify({
        conversationId: rfq.conversation_id,
        messages: [], snapshot: null, started: false,
      }))
    } catch { /* ignore */ }
    router.push('/?conversationId=' + rfq.conversation_id)
  }

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
            <p style={{ fontSize: 15, color: 'var(--ps-muted)', margin: 0 }}>Track your vendor outreach and proposal status.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 32 }}>
            {[
              { label: 'Total RFQs',        value: total    },
              { label: 'Awaiting responses', value: sent     },
              { label: 'Estimates received', value: received },
            ].map(({ label, value }) => (
              <div key={label} style={{ backgroundColor: 'var(--ps-surface)', border: '0.5px solid var(--ps-border)', borderRadius: 10, padding: '16px 20px' }}>
                <p style={{ fontSize: 11, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px' }}>{label}</p>
                <p style={{ fontSize: 28, fontWeight: 500, color: 'var(--ps-white)', margin: 0 }}>{value}</p>
              </div>
            ))}
          </div>

          {isLoading && <div style={{ color: 'var(--ps-muted)', textAlign: 'center', padding: 60 }}>Loading...</div>}
          {error    && <div style={{ color: '#E24B4A', textAlign: 'center', padding: 60 }}>{error}</div>}

          {!isLoading && !error && rfqs.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60, backgroundColor: 'var(--ps-surface)', border: '0.5px solid var(--ps-border)', borderRadius: 12 }}>
              <p style={{ fontSize: 16, color: 'var(--ps-text)', marginBottom: 8 }}>No RFQs yet</p>
              <p style={{ fontSize: 13, color: 'var(--ps-muted)', margin: '0 0 20px' }}>Complete a project conversation and click Generate RFQ to send your first one.</p>
              <button onClick={() => router.push('/')} style={{ padding: '9px 20px', backgroundColor: 'var(--ps-teal)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Start a project
              </button>
            </div>
          )}

          {!isLoading && rfqs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rfqs.map((rfq) => (
                <RFQRow key={rfq.id} rfq={rfq} onContinue={() => handleContinue(rfq)} />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  )
}

function RFQRow({ rfq, onContinue }: { rfq: RFQRecord; onContinue: () => void }) {
  const [expanded,   setExpanded]   = useState(false)
  const [bidMap,     setBidMap]     = useState<Record<string, BidRecord>>({})
  const [bidsLoaded, setBidsLoaded] = useState(false)
  const [selecting,  setSelecting]  = useState<string | null>(null)
  const [dealDone,   setDealDone]   = useState(false)

  const style      = STATUS_STYLES[rfq.status] ?? STATUS_STYLES['Draft']
  const date       = new Date(rfq.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const vendorList = rfq.vendor_names
    ? rfq.vendor_names.split(',').map((v) => v.trim()).filter(Boolean)
    : []

  const handleExpand = async () => {
    const nowExpanded = !expanded
    setExpanded(nowExpanded)
    if (nowExpanded && !bidsLoaded) {
      try {
        const res = await fetch('/api/rfq-bids?rfqId=' + rfq.id)
        if (res.ok) {
          const data = await res.json()

          const map: Record<string, BidRecord> = {}
          for (const b of (data.bids ?? [])) {
            map[b.vendor_name.trim().toLowerCase()] = b
          }
          setBidMap(map)
        }
      } catch (e) {
        console.error('[RFQ Hub] bid fetch error:', e)
      }
      setBidsLoaded(true)
    }
  }

  const handleSelectVendor = async (bid: BidRecord) => {
    setSelecting(bid.id)
    try {
      const token = await getSessionToken()
      const res   = await fetch('/api/deals', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body:    JSON.stringify({
          rfqId:         rfq.id,
          vendorName:    bid.vendor_name,
          bidId:         bid.id,
          projectName:   rfq.project_name,
          priceAccepted: bid.price_high,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setDealDone(true)
    } catch (err) {
      console.error('[RFQ Hub] select vendor error:', err)
    } finally {
      setSelecting(null)
    }
  }

  return (
    <div style={{ backgroundColor: 'var(--ps-surface)', border: '0.5px solid var(--ps-border)', borderRadius: 10, overflow: 'hidden' }}>

      <div onClick={handleExpand} style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 500, color: style.color, backgroundColor: style.bg, padding: '3px 9px', borderRadius: 20, flexShrink: 0 }}>
            {rfq.status}
          </span>
          <span style={{ fontSize: 14, color: 'var(--ps-white)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {rfq.project_name || 'Untitled project'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: 'var(--ps-muted)' }}>{rfq.vendors_contacted} vendor{rfq.vendors_contacted !== 1 ? 's' : ''}</span>
          <span style={{ fontSize: 12, color: 'var(--ps-muted)' }}>{date}</span>
          <span style={{ fontSize: 11, color: 'var(--ps-muted)', fontFamily: 'monospace' }}>{rfq.project_id}</span>
          <span style={{ color: 'var(--ps-muted)', fontSize: 12 }}>{expanded ? '▴' : '▾'}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '0.5px solid var(--ps-border)' }}>

          {vendorList.length > 0 && (
            <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--ps-border)' }}>
              <p style={{ fontSize: 11, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Vendors</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {vendorList.map((vendorName, i) => {
                  const vendorStatusKey = Object.keys(rfq.vendor_statuses ?? {}).find(k => k.trim().toLowerCase() === vendorName.trim().toLowerCase())
                  const vendorStatus = vendorStatusKey ? rfq.vendor_statuses![vendorStatusKey] : 'Pending'
                  const vsBg         = VENDOR_STATUS_STYLES[vendorStatus]?.bg ?? 'rgba(136,135,128,0.08)'
                  const vsColor      = VENDOR_STATUS_STYLES[vendorStatus]?.color ?? 'var(--ps-muted)'
                  const vendorBid    = bidMap[vendorName.trim().toLowerCase()]
                  const bidId        = vendorBid?.id ?? ''
                  return (
                    <div key={i} style={{ backgroundColor: 'var(--ps-bg)', borderRadius: 8, border: '0.5px solid var(--ps-border)', overflow: 'hidden' }}>
                      <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, color: 'var(--ps-text)' }}>{vendorName}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, color: vsColor, backgroundColor: vsBg, padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>
                            {vendorStatus}
                          </span>
                          {vendorBid && !dealDone && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSelectVendor(vendorBid) }}
                              disabled={selecting === bidId}
                              style={{ padding: '4px 12px', backgroundColor: selecting === bidId ? 'rgba(29,158,117,0.4)' : 'var(--ps-teal)', color: 'white', border: 'none', borderRadius: 6, fontSize: 11, cursor: selecting === bidId ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
                            >
                              {selecting === bidId ? 'Selecting...' : 'Select this vendor'}
                            </button>
                          )}
                          {(vendorStatus === 'Selected' || dealDone) && (
                            <span style={{ fontSize: 11, color: 'var(--ps-teal)' }}>Deal created</span>
                          )}
                        </div>
                      </div>
                      {vendorBid != null && (
                        <div style={{ padding: '10px 14px', borderTop: '0.5px solid var(--ps-border)', backgroundColor: 'rgba(29,158,117,0.03)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                          {(vendorBid.price_low || vendorBid.price_high) && (
                            <div>
                              <p style={{ fontSize: 10, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 3px' }}>Price range</p>
                              <p style={{ fontSize: 13, color: 'var(--ps-white)', margin: 0 }}>
                                {vendorBid.price_low ? '$' + Number(vendorBid.price_low).toLocaleString() : ''}{vendorBid.price_low && vendorBid.price_high ? ' - ' : ''}{vendorBid.price_high ? '$' + Number(vendorBid.price_high).toLocaleString() : ''}
                              </p>
                            </div>
                          )}
                          {vendorBid.timeline && (
                            <div>
                              <p style={{ fontSize: 10, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 3px' }}>Timeline</p>
                              <p style={{ fontSize: 13, color: 'var(--ps-white)', margin: 0 }}>{vendorBid.timeline}</p>
                            </div>
                          )}
                          {vendorBid.assumptions && (
                            <div style={{ gridColumn: '1 / -1' }}>
                              <p style={{ fontSize: 10, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 3px' }}>Assumptions</p>
                              <p style={{ fontSize: 12, color: 'var(--ps-text)', margin: 0, lineHeight: 1.5 }}>{vendorBid.assumptions}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--ps-border)' }}>
            <p style={{ fontSize: 11, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Scope document</p>
            <pre style={{ fontSize: 12, color: 'var(--ps-text)', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0, backgroundColor: 'var(--ps-bg)', padding: '12px 14px', borderRadius: 8, border: '0.5px solid var(--ps-border)', maxHeight: 300, overflowY: 'auto' }}>
              {rfq.scope_document || 'No scope document available.'}
            </pre>
          </div>

          <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <MetaItem label="Reference" value={rfq.project_id} />
              <MetaItem label="Sent"      value={date} />
              <MetaItem label="Status"    value={rfq.status} />
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onContinue() }}
              style={{ padding: '8px 16px', backgroundColor: 'transparent', color: 'var(--ps-teal)', border: '0.5px solid rgba(29,158,117,0.4)', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(29,158,117,0.08)' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              Continue conversation
            </button>
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
