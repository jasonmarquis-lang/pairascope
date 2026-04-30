'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Nav from '@/components/ui/Nav'
import Logo from '@/components/ui/Logo'

export default function VendorPortalPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [vendorId, setVendorId] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [sent,     setSent]     = useState(false)
  const [error,    setError]    = useState('')
  const [vendorName, setVendorName] = useState('')

  const handleSubmit = async () => {
    if (!email.trim() || !vendorId.trim()) { setError('Both fields are required.'); return }
    setLoading(true); setError('')
    try {
      const res  = await fetch('/api/vendor-portal', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim(), vendorId: vendorId.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong.')
      setVendorName(data.vendorName || '')
      setSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', backgroundColor: 'var(--ps-surface)', border: '0.5px solid var(--ps-border)',
    borderRadius: 8, padding: '12px 14px', fontSize: 14, color: 'var(--ps-text)',
    fontFamily: 'inherit', outline: 'none',
  }

  return (
    <>
      <Nav />
      <main style={{ paddingTop: 56, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 400, padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <Logo size="md" />
            <h1 style={{ fontSize: '1.25rem', fontWeight: 400, color: 'var(--ps-white)', margin: '20px 0 8px' }}>Vendor Portal</h1>
            <p style={{ fontSize: 13, color: 'var(--ps-muted)', margin: 0 }}>Enter your email and Vendor ID to access your portal.</p>
          </div>

          {sent ? (
            <div style={{ backgroundColor: 'rgba(29,158,117,0.08)', border: '0.5px solid rgba(29,158,117,0.3)', borderRadius: 12, padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✉️</div>
              <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--ps-white)', margin: '0 0 8px' }}>Check your email</h2>
              <p style={{ fontSize: 13, color: 'var(--ps-muted)', margin: 0, lineHeight: 1.6 }}>
                {vendorName ? `Hi ${vendorName} — we` : 'We'} sent a login link to <strong style={{ color: 'var(--ps-text)' }}>{email}</strong>. Click the link to access your vendor dashboard.
              </p>
            </div>
          ) : (
            <div style={{ backgroundColor: 'var(--ps-surface)', border: '0.5px solid var(--ps-border)', borderRadius: 12, padding: 28 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@yourcompany.com"
                    style={inputStyle}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>Vendor ID</label>
                  <input
                    type="text"
                    value={vendorId}
                    onChange={(e) => setVendorId(e.target.value)}
                    placeholder="V-001"
                    style={inputStyle}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  />
                  <p style={{ fontSize: 11, color: 'var(--ps-muted)', margin: '6px 0 0' }}>Your Vendor ID was provided by Pairascope when you were onboarded.</p>
                </div>

                {error && <p style={{ fontSize: 12, color: '#E24B4A', margin: 0 }}>{error}</p>}

                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  style={{ width: '100%', padding: '12px 0', backgroundColor: loading ? 'rgba(29,158,117,0.5)' : 'var(--ps-teal)', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit' }}
                >
                  {loading ? 'Verifying...' : 'Send login link'}
                </button>
              </div>
            </div>
          )}

          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--ps-muted)', marginTop: 20 }}>
            Not a vendor? <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: 'var(--ps-teal)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, padding: 0 }}>Go to Pairascope</button>
          </p>
        </div>
      </main>
    </>
  )
}
