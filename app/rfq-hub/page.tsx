'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Nav from '@/components/ui/Nav'

interface BidRecord {
  id:                 string
  vendor_name:        string
  quote_type:         string | null
  price_low:          number | null
  price_high:         number | null
  firm_price:         number | null
  deposit_amount:     number | null
  deposit_percentage: number | null
  timeline:           string | null
  assumptions:        string | null
  notes:              string | null
  status:             string
  created_at:         string
  proposal_file_name: string | null
}

interface ScopeVersion {
  id:             string
  version_number: number
  scope_notes:    string
  what_changed:   string
}

interface RFQRecord {
  id:                  string
  project_name:        string
  project_id:          string
  scope_document:      string
  status:              string
  vendors_contacted:   number
  vendor_names:        string
  vendor_ids:          string[]
  vendor_statuses:     Record<string, string> | null
  conversation_id:     string
  created_at:          string
  last_meeting_date:   string | null
  action_items:        string | null
  what_changed:        string | null
  airtable_project_id: string | null
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
  'Awarded':   { color: '#1D9E75', bg: 'rgba(29,158,117,0.2)'   },
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

        const signing = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('signing') : null
        if (signing === 'complete' || signing === 'cancelled') {
          router.replace('/rfq-hub')
        }
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
  const received = rfqs.reduce((acc, r) => acc + Object.values(r.vendor_statuses ?? {}).filter((s) => s === 'Responded' || s === 'Selected').length, 0)

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
  const [expanded,       setExpanded]       = useState(false)
  const [bidMap,         setBidMap]         = useState<Record<string, BidRecord>>({})
  const [bidsLoaded,     setBidsLoaded]     = useState(false)
  const [selecting,      setSelecting]      = useState<string | null>(null)
  const [dealDone,       setDealDone]       = useState(false)
  const [depositUrl,     setDepositUrl]     = useState<string | null>(null)
  const [payingDeposit,  setPayingDeposit]  = useState(false)
  const [comparison,     setComparison]     = useState<string | null>(null)
  const [loadingComp,    setLoadingComp]    = useState(false)
  const [bidCount,       setBidCount]       = useState(0)
  const [scopeVersions,  setScopeVersions]  = useState<ScopeVersion[]>([])
  const [hoveredVersion, setHoveredVersion] = useState<string | null>(null)
  const [signingBid,     setSigningBid]     = useState<BidRecord | null>(null)
  const [signingUrl,     setSigningUrl]     = useState<string | null>(null)
  const [loadingSigning, setLoadingSigning] = useState(false)

  const style      = STATUS_STYLES[rfq.status] ?? STATUS_STYLES['Draft']
  const date       = new Date(rfq.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const vendorList = rfq.vendor_names ? rfq.vendor_names.split(',').map((v) => v.trim()).filter(Boolean) : []

  const handleExpand = async () => {
    const nowExpanded = !expanded
    setExpanded(nowExpanded)
    if (nowExpanded && !bidsLoaded) {
      try {
        if (rfq.airtable_project_id) {
          fetch('/api/scope-versions?projectId=' + rfq.airtable_project_id)
            .then(r => r.json())
            .then(d => setScopeVersions(d.versions ?? []))
            .catch(() => {})
        }
        const res = await fetch('/api/rfq-bids?rfqId=' + rfq.id)
        if (res.ok) {
          const data    = await res.json()
          const allBids = data.bids ?? []
          const map: Record<string, BidRecord> = {}
          for (const b of allBids) {
            map[b.vendor_name.trim().toLowerCase()] = b
          }
          setBidMap(map)
          setBidCount(allBids.length)
        }
      } catch (e) {
        console.error('[RFQ Hub] bid fetch error:', e)
      }
      setBidsLoaded(true)
    }
  }

  useEffect(() => {
    if (bidCount >= 2) {
      setLoadingComp(true)
      fetch('/api/bids/compare?rfqId=' + rfq.id)
        .then(r => r.json())
        .then(d => { if (d.comparison) setComparison(d.comparison) })
        .catch(() => {})
        .finally(() => setLoadingComp(false))
    }
  }, [bidCount, rfq.id])

  const handleAcceptProposal = async (bid: BidRecord) => {
    setLoadingSigning(true)
    setSigningBid(bid)
    try {
      const token = await getSessionToken()
      const { data: { user } } = await (await import('@/lib/supabase')).supabase.auth.getUser()
      const res  = await fetch('/api/docusign/sign', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({
          bidId:       bid.id,
          signerName:  user?.user_metadata?.full_name ?? user?.email ?? 'Artist',
          signerEmail: user?.email ?? '',
        }),
      })
      const data = await res.json()
      if (data.signingUrl) {
        setSigningUrl(data.signingUrl)
      } else {
        console.error('[accept proposal]', data.error)
        setSigningBid(null)
      }
    } catch (err) {
      console.error('[accept proposal]', err)
      setSigningBid(null)
    } finally {
      setLoadingSigning(false)
    }
  }

  const handleSelectVendor = async (bid: BidRecord) => {
    setSelecting(bid.id)
    try {
      const token = await getSessionToken()
      const res   = await fetch('/api/deals', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({
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

  const handlePayDeposit = async (bid: BidRecord) => {
    setPayingDeposit(true)
    try {
      const token         = await getSessionToken()
      const depositAmount = bid.price_high || bid.price_low || 0
      const res = await fetch('/api/stripe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({
          dealId:        rfq.id,
          dealName:      rfq.project_name,
          depositAmount,
          projectName:   rfq.project_name,
          vendorName:    bid.vendor_name,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setDepositUrl(data.url)
      window.open(data.url, '_blank')
    } catch (err) {
      console.error('[RFQ Hub] pay deposit error:', err)
    } finally {
      setPayingDeposit(false)
    }
  }

  return (
    <>
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

            {(loadingComp || comparison) && (
              <div style={{ margin: '16px 20px 0', padding: '14px 16px', backgroundColor: 'rgba(29,158,117,0.06)', border: '0.5px solid rgba(29,158,117,0.25)', borderRadius: 10 }}>
                <p style={{ fontSize: 11, color: 'var(--ps-teal)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px', fontWeight: 500 }}>Bid comparison</p>
                {loadingComp && <p style={{ fontSize: 12, color: 'var(--ps-muted)', margin: 0 }}>Analyzing bids...</p>}
                {comparison && <div style={{ fontSize: 12, color: 'var(--ps-text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{comparison}</div>}
              </div>
            )}

            {vendorList.length > 0 && (
              <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--ps-border)' }}>
                <p style={{ fontSize: 11, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Vendors</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {vendorList.map((vendorName, i) => {
                    const vendorStatusKey = Object.keys(rfq.vendor_statuses ?? {}).find(k => k.trim().toLowerCase() === vendorName.trim().toLowerCase())
                    const vendorStatus    = vendorStatusKey ? rfq.vendor_statuses![vendorStatusKey] : 'Pending'
                    const vsBg            = VENDOR_STATUS_STYLES[vendorStatus]?.bg ?? 'rgba(136,135,128,0.08)'
                    const vsColor         = VENDOR_STATUS_STYLES[vendorStatus]?.color ?? 'var(--ps-muted)'
                    const vendorBid       = bidMap[vendorName.trim().toLowerCase()]
                    const bidId           = vendorBid?.id ?? ''
                    return (
                      <div key={i} style={{ backgroundColor: 'var(--ps-bg)', borderRadius: 8, border: '0.5px solid var(--ps-border)', overflow: 'hidden' }}>
                        <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 13, color: 'var(--ps-text)' }}>{vendorName}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>

                            {vendorBid && !dealDone && (vendorStatus === 'Responded' || vendorStatus === 'Selected') && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleAcceptProposal(vendorBid) }}
                                disabled={loadingSigning && signingBid?.id === bidId}
                                style={{ padding: '4px 12px', backgroundColor: loadingSigning && signingBid?.id === bidId ? 'rgba(29,158,117,0.4)' : 'var(--ps-teal)', color: 'white', border: 'none', borderRadius: 6, fontSize: 11, cursor: loadingSigning && signingBid?.id === bidId ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
                              >
                                {loadingSigning && signingBid?.id === bidId ? 'Loading...' : 'Accept Proposal'}
                              </button>
                            )}

                            {(vendorStatus === 'Selected' || vendorStatus === 'Awarded' || dealDone) && !depositUrl && (
                              <button
                                onClick={(e) => { e.stopPropagation(); if (vendorBid) handlePayDeposit(vendorBid) }}
                                disabled={payingDeposit}
                                style={{ padding: '4px 12px', backgroundColor: 'transparent', color: 'var(--ps-teal)', border: '0.5px solid rgba(29,158,117,0.4)', borderRadius: 6, fontSize: 11, cursor: payingDeposit ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
                              >
                                {payingDeposit ? 'Generating...' : 'Make Deposit'}
                              </button>
                            )}

                            <button
                              onClick={async (e) => {
                                e.stopPropagation()
                                const vendorId = rfq.vendor_ids?.[i] ?? ''
                                if (!vendorId) return
                                const res = await fetch('/api/meeting/prepare', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ rfqId: rfq.id, vendorId }),
                                })
                                const { calendarUrl, error } = await res.json()
                                if (calendarUrl) window.open(calendarUrl, '_blank')
                                else console.error('[schedule meeting]', error)
                              }}
                              style={{ padding: '4px 12px', backgroundColor: 'transparent', color: 'var(--ps-teal)', border: '0.5px solid rgba(29,158,117,0.4)', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
                            >
                              Schedule briefing
                            </button>

                            <span style={{ fontSize: 11, color: vsColor, backgroundColor: vsBg, padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>
                              {vendorStatus}
                            </span>

                            {vendorStatus === 'Awarded' && bidId && (
                              
                                href={'/api/docusign/document?bidId=' + bidId}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{ fontSize: 11, color: '#1D9E75', textDecoration: 'none' }}
                              >
                                ✓ Signed agreement
                              </a>
                            )}

                            {depositUrl && (
                              <a href={depositUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--ps-teal)', textDecoration: 'none' }}>
                                Make Deposit →
                              </a>
                            )}

                            {depositUrl && rfq.vendor_ids?.[i] && (
                              
                                href={'/api/vendor/w9?vendorId=' + rfq.vendor_ids[i]}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{ fontSize: 11, color: 'var(--ps-muted)', textDecoration: 'none' }}
                              >
                                ↓ W9
                              </a>
                            )}

                          </div>
                        </div>

                        {(vendorStatus === 'Awarded' || vendorStatus === 'Selected') && depositUrl && (
                          <div style={{ padding: '10px 14px', borderTop: '0.5px solid var(--ps-border)', backgroundColor: 'rgba(239,159,39,0.05)' }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: '#EF9F27', margin: 0 }}>Your project requires a deposit before commencement</p>
                          </div>
                        )}

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

                        {(rfq.last_meeting_date || rfq.action_items || rfq.what_changed) && (
                          <div style={{ padding: '10px 14px', borderTop: '0.5px solid var(--ps-border)', backgroundColor: 'rgba(136,135,128,0.04)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <p style={{ fontSize: 10, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>Last Meeting</p>
                            {rfq.last_meeting_date && (
                              <p style={{ fontSize: 12, color: 'var(--ps-text)', margin: 0 }}>{new Date(rfq.last_meeting_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                            )}
                            {rfq.what_changed && (
                              <div>
                                <p style={{ fontSize: 10, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 3px' }}>What Changed</p>
                                <p style={{ fontSize: 12, color: 'var(--ps-text)', margin: 0, lineHeight: 1.5 }}>{rfq.what_changed}</p>
                              </div>
                            )}
                            {rfq.action_items && (
                              <div>
                                <p style={{ fontSize: 10, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 3px' }}>Action Items</p>
                                <p style={{ fontSize: 12, color: 'var(--ps-text)', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{rfq.action_items}</p>
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

            {scopeVersions.length > 0 && (
              <div style={{ padding: '12px 20px', borderBottom: '0.5px solid var(--ps-border)' }}>
                <p style={{ fontSize: 11, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Scope versions</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {scopeVersions.map((v, i) => (
                    <div
                      key={v.id}
                      style={{ position: 'relative' }}
                      onMouseEnter={() => setHoveredVersion(v.id)}
                      onMouseLeave={() => setHoveredVersion(null)}
                    >
                      <div style={{ padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: i === 0 ? 600 : 400, color: i === 0 ? 'var(--ps-teal)' : 'var(--ps-muted)', backgroundColor: i === 0 ? 'rgba(29,158,117,0.1)' : 'rgba(136,135,128,0.08)', border: i === 0 ? '0.5px solid rgba(29,158,117,0.4)' : '0.5px solid var(--ps-border)', cursor: 'default', userSelect: 'none' }}>
                        V{v.version_number}{i === 0 ? ' · Latest' : ''}
                      </div>
                      {hoveredVersion === v.id && v.what_changed && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 6, backgroundColor: 'var(--ps-surface)', border: '0.5px solid var(--ps-border)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--ps-text)', lineHeight: 1.5, width: 260, zIndex: 10, whiteSpace: 'pre-wrap' }}>
                          <p style={{ fontSize: 10, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px' }}>What Changed</p>
                          {v.what_changed}
                        </div>
                      )}
                    </div>
                  ))}
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

      {signingUrl && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'var(--ps-surface)', borderRadius: 12, border: '0.5px solid var(--ps-border)', width: '90vw', maxWidth: 900, height: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '0.5px solid var(--ps-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ps-white)' }}>Sign Proposal</span>
              <button onClick={() => { setSigningUrl(null); setSigningBid(null) }} style={{ background: 'none', border: 'none', color: 'var(--ps-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            <iframe src={signingUrl} style={{ flex: 1, border: 'none', width: '100%' }} allow="camera" />
          </div>
        </div>
      )}
    </>
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
