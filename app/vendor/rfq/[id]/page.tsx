'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Nav from '@/components/ui/Nav'

export default function VendorRFQPage({ params }: { params: { id: string } }) {
  const router   = useRouter()
  const rfqId    = params.id

  const [rfq,        setRfq]        = useState<Record<string, unknown> | null>(null)
  const [bid,        setBid]        = useState<Record<string, unknown> | null>(null)
  const [isLoading,  setIsLoading]  = useState(true)
  const [isSaving,   setIsSaving]   = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [error,      setError]      = useState('')

  // Form fields
  const [bidType,            setBidType]            = useState<'ROM' | 'Proposal'>('ROM')
  const [priceLow,           setPriceLow]           = useState('')
  const [priceHigh,          setPriceHigh]          = useState('')
  const [firmPrice,          setFirmPrice]          = useState('')
  const [depositAmount,      setDepositAmount]      = useState('')
  const [depositPercentage,  setDepositPercentage]  = useState('')
  const [timeline,           setTimeline]           = useState('')
  const [assumptions,        setAssumptions]        = useState('')
  const [notes,              setNotes]              = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) { router.push('/'); return }

      const userId = sessionData.session.user.id
      const token  = sessionData.session.access_token

      try {
        const res  = await fetch('/api/bids?rfqId=' + rfqId, {
          headers: { 'Authorization': 'Bearer ' + token },
        })
        const data = await res.json()
        setRfq(data.rfq)
        if (data.bid) {
          setBid(data.bid)
          setBidType(data.bid.bid_type || 'ROM')
          setPriceLow(data.bid.price_low?.toString() || '')
          setPriceHigh(data.bid.price_high?.toString() || '')
          setFirmPrice(data.bid.firm_price?.toString() || '')
          setDepositAmount(data.bid.deposit_amount?.toString() || '')
          setDepositPercentage(data.bid.deposit_percentage?.toString() || '')
          setTimeline(data.bid.timeline || '')
          setAssumptions(data.bid.assumptions || '')
          setNotes(data.bid.notes || '')
        }
      } catch (err) {
        console.error('[VendorRFQ] Load error:', err)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [rfqId, router])

  const handleSubmit = async () => {
    if (!timeline.trim()) { setError('Timeline is required.'); return }
    if (bidType === 'ROM' && !priceLow && !priceHigh) { setError('Please enter a price range.'); return }
    if (bidType === 'Proposal' && !firmPrice) { setError('Please enter a firm price.'); return }

    setIsSaving(true); setError('')
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      const res = await fetch('/api/bids', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (token ?? '') },
        body: JSON.stringify({
          rfqId,
          bidType,
          priceLow:          bidType === 'ROM' ? Number(priceLow) || null  : null,
          priceHigh:         bidType === 'ROM' ? Number(priceHigh) || null : null,
          firmPrice:         bidType === 'Proposal' ? Number(firmPrice) || null : null,
          depositAmount:     bidType === 'Proposal' ? Number(depositAmount) || null : null,
          depositPercentage: bidType === 'Proposal' ? Number(depositPercentage) || null : null,
          timeline,
          assumptions,
          notes,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit')
      setSaved(true)
      setTimeout(() => router.push('/vendor'), 2000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', backgroundColor: 'var(--ps-bg)',
    border: '0.5px solid var(--ps-border)', borderRadius: 8,
    padding: '10px 12px', fontSize: 14, color: 'var(--ps-text)',
    fontFamily: 'inherit', outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 11, color: 'var(--ps-muted)', textTransform: 'uppercase',
    letterSpacing: '0.07em', display: 'block', marginBottom: 6,
  }
  const sectionStyle: React.CSSProperties = {
    backgroundColor: 'var(--ps-surface)', border: '0.5px solid var(--ps-border)',
    borderRadius: 12, padding: 24, marginBottom: 20,
  }

  if (isLoading) return (
    <>
      <Nav />
      <div style={{ paddingTop: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--ps-muted)' }}>Loading...</div>
    </>
  )

  if (!rfq) return (
    <>
      <Nav />
      <div style={{ paddingTop: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--ps-muted)' }}>RFQ not found.</div>
    </>
  )

  return (
    <>
      <Nav />
      <main style={{ paddingTop: 56, minHeight: '100vh' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 24px' }}>

          <div style={{ marginBottom: 32 }}>
            <button onClick={() => router.push('/vendor')} style={{ fontSize: 13, color: 'var(--ps-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 16, fontFamily: 'inherit' }}>
              ← Back to dashboard
            </button>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 400, color: 'var(--ps-white)', margin: '0 0 8px' }}>
              {rfq.project_name as string || 'Project Inquiry'}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--ps-muted)', margin: 0 }}>
              {rfq.project_id as string} · Received {new Date(rfq.created_at as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>

          {/* Scope document */}
          <div style={sectionStyle}>
            <h2 style={{ fontSize: 14, fontWeight: 500, color: 'var(--ps-white)', margin: '0 0 16px' }}>Scope document</h2>
            <pre style={{ fontSize: 12, color: 'var(--ps-text)', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0, maxHeight: 300, overflowY: 'auto' }}>
              {rfq.scope_document as string || 'No scope document available.'}
            </pre>
          </div>

          {/* Bid type toggle */}
          <div style={sectionStyle}>
            <h2 style={{ fontSize: 14, fontWeight: 500, color: 'var(--ps-white)', margin: '0 0 16px' }}>Response type</h2>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {(['ROM', 'Proposal'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setBidType(type)}
                  style={{
                    padding: '8px 20px',
                    borderRadius: 8,
                    border: '0.5px solid',
                    borderColor: bidType === type ? 'var(--ps-teal)' : 'var(--ps-border)',
                    backgroundColor: bidType === type ? 'rgba(29,158,117,0.1)' : 'transparent',
                    color: bidType === type ? 'var(--ps-teal)' : 'var(--ps-muted)',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {type === 'ROM' ? 'ROM (Rough Order of Magnitude)' : 'Proposal (Firm Price)'}
                </button>
              ))}
            </div>

            {/* ROM fields */}
            {bidType === 'ROM' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Price range low ($)</label>
                  <input type="number" value={priceLow} onChange={(e) => setPriceLow(e.target.value)} placeholder="45000" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Price range high ($)</label>
                  <input type="number" value={priceHigh} onChange={(e) => setPriceHigh(e.target.value)} placeholder="65000" style={inputStyle} />
                </div>
              </div>
            )}

            {/* Proposal fields */}
            {bidType === 'Proposal' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Firm price ($)</label>
                  <input type="number" value={firmPrice} onChange={(e) => setFirmPrice(e.target.value)} placeholder="55000" style={inputStyle} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Deposit amount ($) <span style={{ color: 'rgba(136,135,128,0.5)' }}>optional</span></label>
                    <input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="10000" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Deposit % <span style={{ color: 'rgba(136,135,128,0.5)' }}>optional</span></label>
                    <input type="number" value={depositPercentage} onChange={(e) => setDepositPercentage(e.target.value)} placeholder="20" style={inputStyle} />
                  </div>
                </div>
                <p style={{ fontSize: 12, color: 'var(--ps-muted)', margin: 0 }}>Enter either a fixed deposit amount or a percentage — not both.</p>
              </div>
            )}
          </div>

          {/* Timeline + details */}
          <div style={sectionStyle}>
            <h2 style={{ fontSize: 14, fontWeight: 500, color: 'var(--ps-white)', margin: '0 0 16px' }}>Timeline & details</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Estimated timeline *</label>
                <input type="text" value={timeline} onChange={(e) => setTimeline(e.target.value)} placeholder="12–16 weeks from approved design" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Assumptions & exclusions</label>
                <textarea value={assumptions} onChange={(e) => setAssumptions(e.target.value)} placeholder="List your key assumptions and exclusions..." rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div>
                <label style={labelStyle}>Additional notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any other notes for the artist..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>
          </div>

          {error && <p style={{ fontSize: 13, color: '#E24B4A', marginBottom: 12 }}>{error}</p>}
          {saved && <p style={{ fontSize: 13, color: 'var(--ps-teal)', marginBottom: 12 }}>Response submitted successfully. Redirecting...</p>}

          <button
            onClick={handleSubmit}
            disabled={isSaving || saved}
            style={{ width: '100%', padding: '13px 0', backgroundColor: isSaving || saved ? 'rgba(29,158,117,0.5)' : 'var(--ps-teal)', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: isSaving || saved ? 'default' : 'pointer', fontFamily: 'inherit' }}
          >
            {saved ? 'Submitted' : isSaving ? 'Submitting...' : bid ? 'Update response' : 'Submit response'}
          </button>

        </div>
      </main>
    </>
  )
}
