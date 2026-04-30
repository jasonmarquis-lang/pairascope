'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { ProjectSnapshot } from '@/types'

interface MatchedVendor {
  id: string
  name: string
  primaryService: string
  shortBio: string
  rating: number
  reasoning: string
}

interface RFQReviewProps {
  snapshot:       ProjectSnapshot
  scopeDocument:  string
  conversationId: string
  onClose:        () => void
}

export default function RFQReview({ snapshot, scopeDocument, conversationId, onClose }: RFQReviewProps) {
  const router = useRouter()
  const [scope,           setScope]           = useState(scopeDocument)
  const [vendors,         setVendors]         = useState<MatchedVendor[]>([])
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set())
  const [loadingVendors,  setLoadingVendors]  = useState(true)
  const [sending,         setSending]         = useState(false)
  const [sent,            setSent]            = useState(false)
  const [error,           setError]           = useState('')

  const projectName = snapshot.projectTitle || [snapshot.projectType, snapshot.material, snapshot.location]
    .filter(Boolean).join(' \u2013 ') || 'Art Project'

  useEffect(() => {
    const load = async () => {
      try {
        const res  = await fetch('/api/vendors/match', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ snapshot }),
        })
        const data = await res.json()
        const v: MatchedVendor[] = data.vendors ?? []
        setVendors(v)
        setSelectedVendors(new Set(v.map((vd) => vd.id)))
      } catch {
        try {
          const res  = await fetch('/api/vendors')
          const data = await res.json()
          const v = (data.vendors ?? []).slice(0, 5).map((vd: MatchedVendor) => ({ ...vd, reasoning: '' }))
          setVendors(v)
          setSelectedVendors(new Set(v.map((vd: MatchedVendor) => vd.id)))
        } catch { /* fail silently */ }
      } finally {
        setLoadingVendors(false)
      }
    }
    load()
  }, [snapshot])

  const toggleVendor = (id: string) => {
    setSelectedVendors((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSend = async () => {
    if (selectedVendors.size === 0) {
      setError('Please select at least one vendor.')
      return
    }
    setSending(true)
    setError('')
    try {
      const selectedList = vendors.filter((v) => selectedVendors.has(v.id))
      const unchecked    = vendors.filter((v) => !selectedVendors.has(v.id))
      for (const v of unchecked) {
        fetch('/api/vendor-feedback', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ vendorId: v.id, vendorName: v.name, action: 'Excluded', reason: 'Manually unchecked in RFQ Review', projectType: snapshot.projectType || '' }),
        }).catch(() => {})
      }
      const { data: sessionData } = await (await import('@/lib/supabase')).supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const res = await fetch('/api/rfq', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (token ?? '') },
        body:    JSON.stringify({ conversationId, projectName, scopeDocument: scope, vendorIds: Array.from(selectedVendors), vendorNames: selectedList.map((v) => v.name) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send RFQ')
      setSent(true)
      setTimeout(() => router.push('/rfq-hub'), 2000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12, color: 'var(--ps-teal)' }}>✓</div>
        <h2 style={{ fontSize: 18, fontWeight: 500, color: 'var(--ps-white)', margin: '0 0 8px' }}>RFQ sent</h2>
        <p style={{ fontSize: 14, color: 'var(--ps-muted)', margin: 0 }}>
          {selectedVendors.size} vendor{selectedVendors.size !== 1 ? 's' : ''} notified. Taking you to your RFQ dashboard...
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      <div style={{ padding: '20px 20px 16px', borderBottom: '0.5px solid var(--ps-border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 11, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>Generate RFQ</p>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--ps-white)', margin: 0 }}>{projectName}</h2>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ps-muted)', fontSize: 20, cursor: 'pointer', padding: 4 }}>x</button>
      </div>

      <div style={{ padding: '12px 20px', borderBottom: '0.5px solid var(--ps-border)', display: 'flex', flexWrap: 'wrap', gap: 6, flexShrink: 0 }}>
        {[snapshot.projectType, snapshot.material, snapshot.scale, snapshot.location, snapshot.timeline, snapshot.budgetRange]
          .filter(Boolean).map((val, i) => (
            <span key={i} style={{ fontSize: 11, color: 'var(--ps-muted)', backgroundColor: 'var(--ps-surface)', border: '0.5px solid var(--ps-border)', borderRadius: 20, padding: '3px 10px' }}>{val}</span>
          ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <p style={{ fontSize: 11, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>Scope document</p>
            <p style={{ fontSize: 11, color: 'var(--ps-muted)', margin: 0 }}>Editable before sending</p>
          </div>
          <textarea
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            style={{ width: '100%', minHeight: 240, backgroundColor: 'var(--ps-surface)', border: '0.5px solid var(--ps-border)', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: 'var(--ps-text)', lineHeight: 1.7, fontFamily: 'inherit', outline: 'none', resize: 'vertical' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p style={{ fontSize: 11, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>Recommended vendors</p>
            <p style={{ fontSize: 11, color: 'var(--ps-muted)', margin: 0 }}>{selectedVendors.size} of {vendors.length} selected</p>
          </div>

          {loadingVendors && (
            <div style={{ padding: '20px 0', textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--ps-muted)', margin: 0 }}>Matching vendors to your project...</p>
            </div>
          )}

          {!loadingVendors && vendors.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--ps-muted)' }}>No vendors matched. Check your Vendors table in Airtable.</p>
          )}

          {!loadingVendors && vendors.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {vendors.map((vendor) => {
                const checked = selectedVendors.has(vendor.id)
                return (
                  <div
                    key={vendor.id}
                    onClick={() => toggleVendor(vendor.id)}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', backgroundColor: checked ? 'rgba(29,158,117,0.06)' : 'var(--ps-surface)', border: `0.5px solid ${checked ? 'rgba(29,158,117,0.35)' : 'var(--ps-border)'}`, borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s ease' }}
                  >
                    <div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 2, border: `1.5px solid ${checked ? 'var(--ps-teal)' : 'rgba(255,255,255,0.2)'}`, backgroundColor: checked ? 'var(--ps-teal)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}>
                      {checked && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ps-white)' }}>{vendor.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--ps-teal)', backgroundColor: 'var(--ps-teal-dim)', padding: '1px 7px', borderRadius: 20 }}>{vendor.primaryService}</span>
                        {vendor.rating > 0 && (
                          <span style={{ fontSize: 11, color: '#EF9F27' }}>{'★'.repeat(Math.min(vendor.rating, 5))}</span>
                        )}
                      </div>
                      {vendor.reasoning && (
                        <p style={{ fontSize: 12, color: 'var(--ps-teal)', margin: '0 0 4px', lineHeight: 1.5, fontStyle: 'italic', opacity: 0.9 }}>{vendor.reasoning}</p>
                      )}
                      <p style={{ fontSize: 12, color: 'var(--ps-muted)', margin: 0, lineHeight: 1.5 }}>{vendor.shortBio}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <p style={{ fontSize: 11, color: 'var(--ps-muted)', margin: 0, lineHeight: 1.5 }}>
          For the best results and guidance keep your conversation going on Pairascope.
        </p>
      </div>

      <div style={{ padding: '14px 20px', borderTop: '0.5px solid var(--ps-border)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {error && <p style={{ fontSize: 12, color: '#E24B4A', margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px 0', backgroundColor: 'transparent', color: 'var(--ps-muted)', border: '0.5px solid var(--ps-border)', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !scope.trim() || selectedVendors.size === 0}
            style={{ flex: 2, padding: '10px 0', backgroundColor: sending ? 'rgba(29,158,117,0.5)' : 'var(--ps-teal)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: sending ? 'default' : 'pointer', fontFamily: 'inherit' }}
          >
            {sending ? 'Sending...' : `Send RFQ to ${selectedVendors.size} vendor${selectedVendors.size !== 1 ? 's' : ''} ->`}
          </button>
        </div>
      </div>

    </div>
  )
}
