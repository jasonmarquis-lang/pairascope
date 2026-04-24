'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Nav from '@/components/ui/Nav'

interface RFQDetail {
  id:             string
  project_name:   string
  project_id:     string
  scope_document: string
  status:         string
  created_at:     string
}

interface Bid {
  id:          string
  price_low:   number
  price_high:  number
  timeline:    string
  assumptions: string
  notes:       string
  created_at:  string
}

export default function VendorRFQPage() {
  const params  = useParams()
  const router  = useRouter()
  const rfqId   = params.id as string

  const [rfq,         setRfq]         = useState<RFQDetail | null>(null)
  const [existingBid, setExistingBid] = useState<Bid | null>(null)
  const [isLoading,   setIsLoading]   = useState(true)
  const [submitting,  setSubmitting]  = useState(false)
  const [submitted,   setSubmitted]   = useState(false)
  const [error,       setError]       = useState('')

  const [priceLow,    setPriceLow]    = useState('')
  const [priceHigh,   setPriceHigh]   = useState('')
  const [timeline,    setTimeline]    = useState('')
  const [assumptions, setAssumptions] = useState('')
  const [notes,       setNotes]       = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) { router.push('/auth?redirect=/vendor'); return }

      try {
        const token = sessionData.session.access_token
        const res   = await fetch('/api/bids?rfqId=' + rfqId, {
          headers: { 'Authorization': 'Bearer ' + token },
        })
        const data = await res.json()
        setRfq(data.rfq ?? null)
        if (data.bid) {
          setExistingBid(data.bid)
          setPriceLow(String(data.bid.price_low ?? ''))
          setPriceHigh(String(data.bid.price_high ?? ''))
          setTimeline(data.bid.timeline ?? '')
          setAssumptions(data.bid.assumptions ?? '')
          setNotes(data.bid.notes ?? '')
        }
      } catch {
        setError('Could not load this RFQ.')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [rfqId, router])

  const handleSubmit = async () => {
    if (!timeline.trim()) { setError('Please include an estimated timeline.'); return }
    setSubmitting(true); setError('')
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const res = await fetch('/api/bids', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessionData.session?.access_token },
        body: JSON.stringify({ rfqId, priceLow: Number(priceLow) || null, priceHigh: Number(priceHigh) || null, timeline, assumptions, notes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit')
      setSubmitted(true)
      setExistingBid(data.bid)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', backgroundColor: 'var(--ps-bg)', border: '0.5px solid var(--ps-border)',
    borderRadius: 8, padding: '10px 12px', fontSize: 14, color: 'var(--ps-text)',
    fontFamily: 'inherit', outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11, color: 'var(--ps-muted)', textTransform: 'uppercase' as const,
    letterSpacing: '0.07em', display: 'block', marginBottom: 6,
  }

  if (isLoading) return (
    <>
      <Nav />
      <div style={{ paddingTop: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--ps-muted)' }}>Loading...</div>
    </>
  )

  return (
    <>
      <Nav />
      <main style={{ paddingTop: 56, minHeight: '100vh' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px' }}>

          <button onClick={() => router.push('/vendor')}
            style={{ fontSize: 13, color: 'var(--ps-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 24, fontFamily: 'inherit' }}>
            Back to dashboard
          </button>

          {!rfq && !isLoading && <p style={{ color: 'var(--ps-muted)' }}>RFQ not found.</p>}

          {rfq && (
            <>
              <div style={{ marginBottom: 32 }}>
                <p style={{ fontSize: 11, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>
                  Project inquiry · {rfq.project_id}
                </p>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 400, color: 'var(--ps-white)', margin: '0 0 8px' }}>
                  {rfq.project_name || 'Art Project'}
                </h1>
                <p style={{ fontSize: 13, color: 'var(--ps-muted)', margin: 0 }}>
                  Received {new Date(rfq.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>

              <div style={{ marginBottom: 40 }}>
                <p style={{ fontSize: 11, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Scope of work</p>
                <pre style={{ fontSize: 13, color: 'var(--ps-text)', lineHeight: 1.8, whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0, backgroundColor: 'var(--ps-surface)', padding: '20px 24px', borderRadius: 10, border: '0.5px solid var(--ps-border)' }}>
                  {rfq.scope_document}
                </pre>
              </div>

              {submitted || existingBid ? (
                <div style={{ backgroundColor: 'rgba(29,158,117,0.06)', border: '0.5px solid rgba(29,158,117,0.3)', borderRadius: 12, padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <span style={{ fontSize: 20, color: 'var(--ps-teal)' }}>✓</span>
                    <h2 style={{ fontSize: 16, fontWeight: 500, color: 'var(--ps-white)', margin: 0 }}>Estimate submitted</h2>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    {(priceLow || priceHigh) && (
                      <div>
                        <p style={labelStyle}>Price range</p>
                        <p style={{ fontSize: 14, color: 'var(--ps-text)', margin: 0 }}>${Number(priceLow).toLocaleString()} - ${Number(priceHigh).toLocaleString()}</p>
                      </div>
                    )}
                    {timeline && (
                      <div>
                        <p style={labelStyle}>Timeline</p>
                        <p style={{ fontSize: 14, color: 'var(--ps-text)', margin: 0 }}>{timeline}</p>
                      </div>
                    )}
                    {assumptions && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <p style={labelStyle}>Assumptions</p>
                        <p style={{ fontSize: 14, color: 'var(--ps-text)', margin: 0, lineHeight: 1.6 }}>{assumptions}</p>
                      </div>
                    )}
                    {notes && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <p style={labelStyle}>Notes</p>
                        <p style={{ fontSize: 14, color: 'var(--ps-text)', margin: 0, lineHeight: 1.6 }}>{notes}</p>
                      </div>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--ps-muted)', margin: '16px 0 0' }}>
                    The artist has been notified and will reach out through Pairascope if they want to proceed.
                  </p>
                </div>
              ) : (
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 500, color: 'var(--ps-white)', margin: '0 0 24px' }}>Submit your estimate</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div>
                        <label style={labelStyle}>Price low ($) <span style={{ color: 'rgba(136,135,128,0.5)' }}>optional</span></label>
                        <input type="number" value={priceLow} onChange={(e) => setPriceLow(e.target.value)} placeholder="15000" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Price high ($) <span style={{ color: 'rgba(136,135,128,0.5)' }}>optional</span></label>
                        <input type="number" value={priceHigh} onChange={(e) => setPriceHigh(e.target.value)} placeholder="25000" style={inputStyle} />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Timeline *</label>
                      <input type="text" value={timeline} onChange={(e) => setTimeline(e.target.value)} placeholder="e.g. 10-12 weeks from deposit" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Key assumptions <span style={{ color: 'rgba(136,135,128,0.5)' }}>optional</span></label>
                      <textarea value={assumptions} onChange={(e) => setAssumptions(e.target.value)} placeholder="What is your estimate based on? What's included or excluded?" rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
                    </div>
                    <div>
                      <label style={labelStyle}>Additional notes <span style={{ color: 'rgba(136,135,128,0.5)' }}>optional</span></label>
                      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Questions, concerns, or additional context for the artist?" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                    </div>
                    {error && <p style={{ fontSize: 13, color: '#E24B4A', margin: 0 }}>{error}</p>}
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      style={{ padding: '12px 24px', backgroundColor: submitting ? 'rgba(29,158,117,0.5)' : 'var(--ps-teal)', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: submitting ? 'default' : 'pointer', fontFamily: 'inherit', alignSelf: 'flex-start' }}
                    >
                      {submitting ? 'Submitting...' : 'Submit estimate ->'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </>
  )
}
