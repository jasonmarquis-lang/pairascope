'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Nav from '@/components/ui/Nav'
import type { Vendor } from '@/types'

export default function VendorsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh' }} />}>
      <VendorsContent />
    </Suspense>
  )
}

function VendorsContent() {
  const searchParams = useSearchParams()
  const conversationId = searchParams.get('conversationId') ?? ''
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const endpoint = conversationId ? `/api/vendors?conversationId=${conversationId}` : '/api/vendors'
        const res = await fetch(endpoint)
        const data = await res.json()
        setVendors(data.vendors ?? [])
      } catch {
        setError('Could not load vendors. Please try again.')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [conversationId])

  return (
    <>
      <Nav />
      <main style={{ paddingTop: 56, minHeight: '100vh' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px' }}>
          <div style={{ marginBottom: 40, textAlign: 'center' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 400, color: 'var(--ps-white)', margin: '0 0 10px' }}>Recommended vendors</h1>
            <p style={{ fontSize: 15, color: 'var(--ps-muted)', margin: 0 }}>
              {conversationId ? 'These vendors are matched to your project scope.' : 'Our curated network of fabricators, shippers, and installers.'}
            </p>
          </div>
          {isLoading && <div style={{ textAlign: 'center', color: 'var(--ps-muted)', padding: 60 }}>Loading vendors…</div>}
          {error && <div style={{ textAlign: 'center', color: '#E24B4A', padding: 60 }}>{error}</div>}
          {!isLoading && !error && vendors.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60, backgroundColor: 'var(--ps-surface)', border: '0.5px solid var(--ps-border)', borderRadius: 12 }}>
              <p style={{ fontSize: 15, color: 'var(--ps-text)', marginBottom: 8 }}>No vendors assigned yet.</p>
              <p style={{ fontSize: 13, color: 'var(--ps-muted)', margin: 0 }}>Check back soon — your project is being reviewed and vendors will be matched shortly.</p>
            </div>
          )}
          {!isLoading && vendors.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
              {vendors.map((vendor, i) => <VendorCard key={vendor.id} vendor={vendor} featured={i === 0} />)}
            </div>
          )}
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--ps-muted)', marginTop: 40, lineHeight: 1.6 }}>
            Contact us at <a href="mailto:pairascope.projects@gmail.com" style={{ color: 'var(--ps-teal)', textDecoration: 'none' }}>pairascope.projects@gmail.com</a> with any questions.
          </p>
        </div>
      </main>
    </>
  )
}

function VendorCard({ vendor, featured }: { vendor: Vendor; featured: boolean }) {
  return (
    <div style={{ backgroundColor: 'var(--ps-surface)', border: featured ? '1px solid rgba(29,158,117,0.4)' : '0.5px solid var(--ps-border)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 16, position: 'relative' }}>
      {featured && <div style={{ position: 'absolute', top: -1, left: 20, backgroundColor: 'var(--ps-teal)', color: 'white', fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: '0 0 6px 6px' }}>Best match</div>}
      <div style={{ paddingTop: featured ? 12 : 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--ps-white)', margin: 0 }}>{vendor.name}</h3>
          {vendor.rating && <div style={{ display: 'flex', gap: 2 }}>{Array.from({ length: 5 }).map((_, i) => <span key={i} style={{ color: i < vendor.rating! ? '#EF9F27' : 'rgba(255,255,255,0.1)', fontSize: 12 }}>★</span>)}</div>}
        </div>
        <span style={{ fontSize: 11, color: 'var(--ps-teal)', backgroundColor: 'var(--ps-teal-dim)', padding: '2px 8px', borderRadius: 20 }}>{vendor.primaryService}</span>
      </div>
      <p style={{ fontSize: 13, color: 'var(--ps-muted)', lineHeight: 1.6, margin: 0 }}>{vendor.shortBio}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {vendor.location && <div style={{ display: 'flex', gap: 7, fontSize: 12, color: 'var(--ps-muted)' }}><span>📍</span><span>{vendor.location}</span></div>}
        {vendor.materials && <div style={{ display: 'flex', gap: 7, fontSize: 12, color: 'var(--ps-muted)' }}><span>🔩</span><span>{vendor.materials}</span></div>}
        {vendor.website && <div style={{ display: 'flex', gap: 7, fontSize: 12, color: 'var(--ps-muted)' }}><span>🌐</span><a href={vendor.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ps-teal)', textDecoration: 'none' }}>{vendor.website.replace(/^https?:\/\//, '')}</a></div>}
      </div>
      <div style={{ borderTop: '0.5px solid var(--ps-border)', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ fontSize: 12, color: 'var(--ps-muted)', margin: '0 0 2px' }}>Contact</p>
          <p style={{ fontSize: 13, color: 'var(--ps-text)', margin: 0 }}>{vendor.contactName}</p>
        </div>
        <a href={`mailto:${vendor.email}`} style={{ fontSize: 13, color: 'var(--ps-teal)', backgroundColor: 'var(--ps-teal-dim)', padding: '7px 14px', borderRadius: 8, textDecoration: 'none', border: '0.5px solid rgba(29,158,117,0.3)' }}>Get in touch</a>
      </div>
    </div>
  )
}
