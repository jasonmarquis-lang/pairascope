'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import Nav from '@/components/ui/Nav'
import RFQReview from '@/components/rfq/RFQReview'

interface MatchedVendor {
  id:             string
  name:           string
  primaryService: string
  contactName:    string
  email:          string
  shortBio:       string
  website:        string
  rating:         number
  reasoning:      string
  capabilities:   string
  outsourcedServices?: string[]
  attachments?:   { url: string; filename: string }[]
}

function VendorsContent() {
  const searchParams    = useSearchParams()
  const router          = useRouter()
  const conversationId  = searchParams.get('conversationId') ?? ''
  const fromScope       = searchParams.get('fromScope') === 'true'

  const [vendors,         setVendors]         = useState<MatchedVendor[]>([])
  const [isLoading,       setIsLoading]       = useState(true)
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set())
  const [showRFQ,         setShowRFQ]         = useState(false)
  const [snapshot,        setSnapshot]        = useState<Record<string, unknown> | null>(null)
  const [expandedCards,   setExpandedCards]   = useState<Set<string>>(new Set())
  const [error,           setError]           = useState('')

  // Load snapshot from sessionStorage and fetch matched vendors
  const load = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      let snap: Record<string, unknown> | null = null
      try {
        const raw = sessionStorage.getItem('ps_conversation')
        if (raw) {
          const parsed = JSON.parse(raw)
          snap = parsed.snapshot ?? null
          setSnapshot(snap)
        }
      } catch { /* ignore */ }

      // Use AI matching if we have a snapshot, otherwise fall back to all vendors
      if (snap) {
        const res  = await fetch('/api/vendors/match', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ snapshot: snap }),
        })
        const data = await res.json()
        const matched = (data.vendors ?? []).slice(0, 3) as MatchedVendor[]
        setVendors(matched)
        setSelectedVendors(new Set(matched.map((v) => v.id)))
      } else {
        const res  = await fetch('/api/vendors')
        const data = await res.json()
        const all  = (data.vendors ?? []).slice(0, 3) as MatchedVendor[]
        setVendors(all)
        setSelectedVendors(new Set(all.map((v) => v.id)))
      }
    } catch {
      setError('Could not load vendors. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const toggleVendor = (id: string) => {
    setSelectedVendors((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (showRFQ && snapshot) {
    const buildScope = () => {
      const s = snapshot as Record<string, unknown>
      const lines: string[] = []
      if (s.aiSummary) { lines.push('PROJECT OVERVIEW'); lines.push('────────────────'); lines.push(s.aiSummary as string); lines.push('') }
      lines.push('SCOPE DETAILS'); lines.push('────────────────')
      if (s.projectType) lines.push(`Type: ${s.projectType}`)
      if (s.material)    lines.push(`Material: ${s.material}`)
      if (s.scale)       lines.push(`Scale: ${s.scale}`)
      if (s.location)    lines.push(`Location: ${s.location}`)
      if (s.timeline)    lines.push(`Timeline: ${s.timeline}`)
      if (s.budgetRange) lines.push(`Budget: ${s.budgetRange}`)
      lines.push(''); lines.push('REQUEST'); lines.push('────────────────')
      lines.push('• ROM price or proposal'); lines.push('• Estimated timeline'); lines.push('• Key assumptions'); lines.push('• Questions or concerns')
      return lines.join('\n')
    }

    return (
      <div style={{ paddingTop: 56, height: '100vh', overflow: 'hidden' }}>
        <Nav />
        <div style={{ height: 'calc(100vh - 56px)', maxWidth: 600, margin: '0 auto', padding: '0 24px' }}>
          <RFQReview
            snapshot={snapshot as unknown as Parameters<typeof RFQReview>[0]['snapshot']}
            scopeDocument={buildScope()}
            conversationId={conversationId}
            onClose={() => setShowRFQ(false)}
          />
        </div>
      </div>
    )
  }

  return (
    <>
      <Nav />
      <main style={{ paddingTop: 56, minHeight: '100vh' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 24px' }}>

          {/* Header */}
          <div style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 400, color: 'var(--ps-white)', margin: '0 0 8px' }}>
                {fromScope ? 'Recommended Vendors' : 'Our Network'}
              </h1>
              <p style={{ fontSize: 15, color: 'var(--ps-muted)', margin: 0 }}>
                {fromScope
                  ? 'AI-matched vendors for your project. Select and send an RFQ directly.'
                  : 'Vetted fabricators, shippers, installers, and conservators.'}
              </p>
            </div>
            {fromScope && (
              <button
                onClick={() => router.back()}
                style={{ fontSize: 13, color: 'var(--ps-muted)', background: 'none', border: '0.5px solid var(--ps-border)', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                ← Back to scope
              </button>
            )}
          </div>

          {isLoading && (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--ps-muted)' }}>
              {fromScope ? 'Matching vendors to your project…' : 'Loading vendors…'}
            </div>
          )}

          {error && (
            <div style={{ textAlign: 'center', padding: 60, color: '#E24B4A' }}>{error}</div>
          )}

          {!isLoading && !error && vendors.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--ps-muted)' }}>
              No vendors found. Add vendors to your Airtable Vendors table to get started.
            </div>
          )}

          {!isLoading && vendors.length > 0 && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
                {vendors.map((vendor) => {
                  const checked   = selectedVendors.has(vendor.id)
                  const expanded  = expandedCards.has(vendor.id)

                  return (
                    <div
                      key={vendor.id}
                      style={{
                        backgroundColor: checked ? 'rgba(29,158,117,0.04)' : 'var(--ps-surface)',
                        border:          `0.5px solid ${checked ? 'rgba(29,158,117,0.3)' : 'var(--ps-border)'}`,
                        borderRadius:    12,
                        overflow:        'hidden',
                        transition:      'border-color 0.15s ease',
                      }}
                    >
                      {/* Card header — always visible */}
                      <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>

                        {/* Checkbox */}
                        <div
                          onClick={() => toggleVendor(vendor.id)}
                          style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0, marginTop: 2, border: `1.5px solid ${checked ? 'var(--ps-teal)' : 'rgba(255,255,255,0.2)'}`, backgroundColor: checked ? 'var(--ps-teal)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s ease' }}
                        >
                          {checked && (
                            <svg width="11" height="9" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>

                        {/* Vendor info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--ps-white)' }}>{vendor.name}</span>
                            <span style={{ fontSize: 11, color: 'var(--ps-teal)', backgroundColor: 'rgba(29,158,117,0.1)', padding: '2px 8px', borderRadius: 20 }}>
                              {vendor.primaryService}
                            </span>
                          </div>

                          {/* AI Reasoning */}
                          {vendor.reasoning && (
                            <p style={{ fontSize: 13, color: 'var(--ps-teal)', margin: '0 0 8px', lineHeight: 1.6, fontStyle: 'italic', opacity: 0.9 }}>
                              {vendor.reasoning}
                            </p>
                          )}

                          <p style={{ fontSize: 13, color: 'var(--ps-muted)', margin: 0, lineHeight: 1.6 }}>
                            {vendor.shortBio}
                          </p>
                        </div>

                        {/* Expand toggle */}
                        <button
                          onClick={() => toggleExpand(vendor.id)}
                          style={{ background: 'none', border: '0.5px solid var(--ps-border)', color: 'var(--ps-muted)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, whiteSpace: 'nowrap' }}
                        >
                          {expanded ? 'Less ▴' : 'More ▾'}
                        </button>
                      </div>

                      {/* Expanded detail */}
                      {expanded && (
                        <div style={{ borderTop: '0.5px solid var(--ps-border)', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

                          {vendor.capabilities && (
                            <DetailSection label="Capabilities" value={vendor.capabilities} />
                          )}

                          {vendor.outsourcedServices && vendor.outsourcedServices.length > 0 && (
                            <DetailSection label="Outsourced Services" value={vendor.outsourcedServices.join(', ')} />
                          )}

                          {vendor.website && (
                            <div>
                              <p style={{ fontSize: 11, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>Website</p>
                              <a href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`} target="_blank" rel="noopener noreferrer"
                                style={{ fontSize: 13, color: 'var(--ps-teal)', textDecoration: 'none' }}>
                                {vendor.website}
                              </a>
                            </div>
                          )}

                          {vendor.attachments && vendor.attachments.length > 0 && (
                            <div>
                              <p style={{ fontSize: 11, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>Portfolio</p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {vendor.attachments.map((att, i) => (
                                  <a key={i} href={att.url} target="_blank" rel="noopener noreferrer"
                                    style={{ fontSize: 12, color: 'var(--ps-teal)', backgroundColor: 'rgba(29,158,117,0.08)', border: '0.5px solid rgba(29,158,117,0.2)', borderRadius: 6, padding: '4px 10px', textDecoration: 'none' }}>
                                    {att.filename}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Send RFQ bar */}
              <div style={{ position: 'sticky', bottom: 24, backgroundColor: 'var(--ps-surface)', border: '0.5px solid var(--ps-border)', borderRadius: 12, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
                <p style={{ fontSize: 13, color: 'var(--ps-muted)', margin: 0 }}>
                  {selectedVendors.size} vendor{selectedVendors.size !== 1 ? 's' : ''} selected
                </p>
                <button
                  onClick={() => setShowRFQ(true)}
                  disabled={selectedVendors.size === 0}
                  style={{ padding: '10px 24px', backgroundColor: selectedVendors.size === 0 ? 'rgba(29,158,117,0.3)' : 'var(--ps-teal)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: selectedVendors.size === 0 ? 'default' : 'pointer', fontFamily: 'inherit' }}
                >
                  Send RFQ to {selectedVendors.size} vendor{selectedVendors.size !== 1 ? 's' : ''} →
                </button>
              </div>
            </>
          )}

          {/* Contact */}
          <p style={{ fontSize: 13, color: 'var(--ps-muted)', textAlign: 'center', marginTop: 48 }}>
            Contact us at <a href="mailto:create@pairascope.com" style={{ color: 'var(--ps-teal)', textDecoration: 'none' }}>create@pairascope.com</a> with any questions.
          </p>
        </div>
      </main>
    </>
  )
}

function DetailSection({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px' }}>{label}</p>
      <p style={{ fontSize: 13, color: 'var(--ps-text)', margin: 0, lineHeight: 1.7 }}>{value}</p>
    </div>
  )
}

export default function VendorsPage() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--ps-muted)', padding: 60, textAlign: 'center' }}>Loading…</div>}>
      <VendorsContent />
    </Suspense>
  )
}
