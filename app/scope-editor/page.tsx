'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Nav from '@/components/ui/Nav'
import type { ProjectSnapshot } from '@/types'

interface MatchedVendor {
  id: string
  name: string
  city: string
  state: string
  country: string
  primaryServices: string[]
  secondaryServices: string[]
  shortBio: string
  rating: number
  reasoning: string
}

export default function ScopeEditorPage() {
  const router = useRouter()
  const [scope,           setScope]           = useState('')
  const [snapshot,        setSnapshot]        = useState<ProjectSnapshot | null>(null)
  const [conversationId,  setConversationId]  = useState('')
  const [projectName,     setProjectName]     = useState('')
  const [vendors,         setVendors]         = useState<MatchedVendor[]>([])
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set())
  const [loadingVendors,  setLoadingVendors]  = useState(false)
  const [vendorsLoaded,   setVendorsLoaded]   = useState(false)
  const [sending,         setSending]         = useState(false)
  const [sent,            setSent]            = useState(false)
  const [error,           setError]           = useState('')

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('ps_scope_editor')
      if (!raw) { router.push('/'); return }
      const parsed = JSON.parse(raw)
      setScope(parsed.scopeDocument || '')
      setSnapshot(parsed.snapshot || null)
      setConversationId(parsed.conversationId || '')
      const sn = parsed.snapshot as ProjectSnapshot
      const name = sn?.projectTitle ||
        [sn?.projectType, sn?.material, sn?.location].filter(Boolean).join(' - ') ||
        'Art Project'
      setProjectName(name)
    } catch {
      router.push('/')
    }
  }, [router])

  const handleRecommendVendors = async () => {
    if (!snapshot) return
    setLoadingVendors(true)
    setVendorsLoaded(false)
    setError('')
    try {
      const res  = await fetch('/api/vendors/match', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ snapshot, scopeDocument: scope }),
      })
      const data = await res.json()
      const v: MatchedVendor[] = data.vendors ?? []
      setVendors(v)
      setSelectedVendors(new Set(v.map((vd) => vd.id)))
      setVendorsLoaded(true)
    } catch {
      setError('Could not load vendor recommendations. Please try again.')
    } finally {
      setLoadingVendors(false)
    }
  }

  const toggleVendor = (id: string) => {
    setSelectedVendors((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSend = async () => {
    if (selectedVendors.size === 0) { setError('Please select at least one vendor.'); return }
    if (!scope.trim()) { setError('Scope document cannot be empty.'); return }
    setSending(true); setError('')
    try {
      const selectedList = vendors.filter((v) => selectedVendors.has(v.id))
      const unchecked    = vendors.filter((v) => !selectedVendors.has(v.id))
      for (const v of unchecked) {
        fetch('/api/vendor-feedback', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ vendorId: v.id, vendorName: v.name, action: 'Excluded', reason: 'Manually unchecked in Scope Editor', projectType: snapshot?.projectType || '' }),
        }).catch(() => {})
      }
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const res = await fetch('/api/rfq', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (token ?? '') },
        body:    JSON.stringify({
          conversationId,
          projectName,
          scopeDocument: scope,
          vendorIds:   Array.from(selectedVendors),
          vendorNames: selectedList.map((v) => v.name),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send RFQ')
      setSent(true)
      sessionStorage.removeItem('ps_scope_editor')
      setTimeout(() => router.push('/rfq-hub'), 2000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSending(false)
    }
  }

  const inputStyle = {
    backgroundColor: 'var(--ps-surface)',
    border:          '0.5px solid var(--ps-border)',
    borderRadius:    10,
    padding:         '16px 18px',
    fontSize:        13,
    color:           'var(--ps-text)',
    lineHeight:      1.8,
    fontFamily:      'inherit',
    outline:         'none',
    resize:          'vertical' as const,
    width:           '100%',
  }

  if (sent) return (
    <>
      <Nav />
      <main style={{ paddingTop: 56, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12, color: 'var(--ps-teal)' }}>&#10003;</div>
          <h2 style={{ fontSize: 18, fontWeight: 500, color: 'var(--ps-white)', margin: '0 0 8px' }}>RFQ sent</h2>
          <p style={{ fontSize: 14, color: 'var(--ps-muted)', margin: 0 }}>
            {selectedVendors.size} vendor{selectedVendors.size !== 1 ? 's' : ''} notified. Taking you to your dashboard...
          </p>
        </div>
      </main>
    </>
  )

  return (
    <>
      <Nav />
      <main style={{ paddingTop: 56, minHeight: '100vh' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '48px 24px' }}>

          <div style={{ marginBottom: 32 }}>
            <button onClick={() => router.back()} style={{ fontSize: 13, color: 'var(--ps-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 16, fontFamily: 'inherit' }}>
              Back
            </button>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 400, color: 'var(--ps-white)', margin: '0 0 6px' }}>Scope Editor</h1>
            <p style={{ fontSize: 13, color: 'var(--ps-muted)', margin: 0 }}>{projectName}</p>
          </div>

          {/* Scope document editor */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <p style={{ fontSize: 11, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>Scope document</p>
              <p style={{ fontSize: 11, color: 'var(--ps-muted)', margin: 0 }}>Edit before sending to vendors</p>
            </div>
            <textarea
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              style={{ ...inputStyle, minHeight: 400 }}
            />
          </div>

          {/* Recommend Vendors button */}
          {!vendorsLoaded && (
            <button
              onClick={handleRecommendVendors}
              disabled={loadingVendors || !scope.trim()}
              style={{ width: '100%', padding: '14px 0', backgroundColor: loadingVendors ? 'rgba(29,158,117,0.4)' : 'var(--ps-teal)', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: loadingVendors ? 'default' : 'pointer', fontFamily: 'inherit', marginBottom: 32 }}
            >
              {loadingVendors ? 'Matching vendors to your project...' : 'Recommend Vendors →'}
            </button>
          )}

          {/* Vendor cards */}
          {vendorsLoaded && (
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <p style={{ fontSize: 11, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>Recommended vendors</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <p style={{ fontSize: 11, color: 'var(--ps-muted)', margin: 0 }}>{selectedVendors.size} of {vendors.length} selected</p>
                  <button
                    onClick={handleRecommendVendors}
                    style={{ fontSize: 11, color: 'var(--ps-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', textDecoration: 'underline' }}
                  >
                    Re-run matching
                  </button>
                </div>
              </div>

              {vendors.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--ps-muted)' }}>No vendors matched. Check your Vendors table in Airtable.</p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {vendors.map((vendor) => {
                  const checked = selectedVendors.has(vendor.id)
                  return (
                    <div
                      key={vendor.id}
                      onClick={() => toggleVendor(vendor.id)}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 18px', backgroundColor: checked ? 'rgba(29,158,117,0.06)' : 'var(--ps-surface)', border: '0.5px solid ' + (checked ? 'rgba(29,158,117,0.35)' : 'var(--ps-border)'), borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s ease' }}
                    >
                      <div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 3, border: '1.5px solid ' + (checked ? 'var(--ps-teal)' : 'rgba(255,255,255,0.2)'), backgroundColor: checked ? 'var(--ps-teal)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}>
                        {checked && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                          <div>
                            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ps-white)', display: 'block', marginBottom: 3 }}>{vendor.name}</span>
                            {(vendor.city || vendor.state || vendor.country) && (
                              <span style={{ fontSize: 12, color: 'var(--ps-muted)' }}>
                                {[vendor.city, vendor.state, vendor.country].filter(Boolean).join(', ')}
                              </span>
                            )}
                          </div>
                          {vendor.rating > 0 && (
                            <span style={{ fontSize: 12, color: '#EF9F27', flexShrink: 0 }}>{'&#9733;'.repeat(Math.min(vendor.rating, 5))}</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                          {vendor.primaryServices.map((s, i) => (
                            <span key={i} style={{ fontSize: 11, color: 'var(--ps-teal)', backgroundColor: 'rgba(29,158,117,0.1)', padding: '2px 8px', borderRadius: 20 }}>{s}</span>
                          ))}
                          {vendor.secondaryServices.map((s, i) => (
                            <span key={i} style={{ fontSize: 11, color: 'var(--ps-muted)', backgroundColor: 'var(--ps-bg)', border: '0.5px solid var(--ps-border)', padding: '2px 8px', borderRadius: 20 }}>{s}</span>
                          ))}
                        </div>
                        {vendor.reasoning && (
                          <p style={{ fontSize: 12, color: 'var(--ps-teal)', margin: '0 0 6px', lineHeight: 1.6, fontStyle: 'italic', opacity: 0.9 }}>{vendor.reasoning}</p>
                        )}
                        {vendor.shortBio && (
                          <p style={{ fontSize: 12, color: 'var(--ps-muted)', margin: 0, lineHeight: 1.6 }}>{vendor.shortBio}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Send RFQ button */}
              <div style={{ marginTop: 24 }}>
                {error && <p style={{ fontSize: 12, color: '#E24B4A', marginBottom: 10 }}>{error}</p>}
                <button
                  onClick={handleSend}
                  disabled={sending || selectedVendors.size === 0}
                  style={{ width: '100%', padding: '14px 0', backgroundColor: sending || selectedVendors.size === 0 ? 'rgba(29,158,117,0.4)' : 'var(--ps-teal)', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: sending || selectedVendors.size === 0 ? 'default' : 'pointer', fontFamily: 'inherit' }}
                >
                  {sending ? 'Sending...' : 'Send RFQ to ' + selectedVendors.size + ' vendor' + (selectedVendors.size !== 1 ? 's' : '') + ' →'}
                </button>
              </div>
            </div>
          )}

          {error && !vendorsLoaded && <p style={{ fontSize: 12, color: '#E24B4A' }}>{error}</p>}

        </div>
      </main>
    </>
  )
}
