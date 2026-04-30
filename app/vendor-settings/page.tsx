'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Nav from '@/components/ui/Nav'

export default function VendorSettingsPage() {
  const router = useRouter()
  const [email,       setEmail]       = useState('')
  const [newEmail,    setNewEmail]    = useState('')
  const [emailSent,   setEmailSent]   = useState(false)
  const [pwSent,      setPwSent]      = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [vendorName,  setVendorName]  = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user
      if (!u) { router.push('/vendor-portal'); return }
      setEmail(u.email || '')
      setVendorName(u.user_metadata?.vendor_name || '')
    })
  }, [router])

  const handleEmailChange = async () => {
    if (!newEmail.trim()) { setError('Enter a new email address.'); return }
    setLoading(true); setError('')
    try {
      const { error: err } = await supabase.auth.updateUser({ email: newEmail.trim() })
      if (err) throw err
      setEmailSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update email.')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordReset = async () => {
    setLoading(true); setError('')
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://www.pairascope.com/vendor-settings'
      })
      if (err) throw err
      setPwSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email.')
    } finally {
      setLoading(false)
    }
  }

  const sectionStyle = {
    backgroundColor: 'var(--ps-surface)', border: '0.5px solid var(--ps-border)',
    borderRadius: 12, padding: 24, marginBottom: 16,
  }
  const inputStyle = {
    width: '100%', backgroundColor: 'var(--ps-bg)', border: '0.5px solid var(--ps-border)',
    borderRadius: 8, padding: '10px 12px', fontSize: 14, color: 'var(--ps-text)',
    fontFamily: 'inherit', outline: 'none',
  }
  const labelStyle = {
    fontSize: 11, color: 'var(--ps-muted)', textTransform: 'uppercase' as const,
    letterSpacing: '0.07em', display: 'block', marginBottom: 6,
  }

  return (
    <>
      <Nav />
      <main style={{ paddingTop: 56, minHeight: '100vh' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '48px 24px' }}>
          <div style={{ marginBottom: 32 }}>
            <button onClick={() => router.push('/vendor')} style={{ fontSize: 13, color: 'var(--ps-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 16, fontFamily: 'inherit' }}>
              Back to dashboard
            </button>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 400, color: 'var(--ps-white)', margin: '0 0 6px' }}>Vendor Settings</h1>
            {vendorName && <p style={{ fontSize: 13, color: 'var(--ps-muted)', margin: 0 }}>{vendorName}</p>}
          </div>

          {error && <p style={{ fontSize: 13, color: '#E24B4A', marginBottom: 16 }}>{error}</p>}

          {/* Email */}
          <div style={sectionStyle}>
            <h2 style={{ fontSize: 14, fontWeight: 500, color: 'var(--ps-white)', margin: '0 0 16px' }}>Email address</h2>
            <p style={{ fontSize: 13, color: 'var(--ps-muted)', margin: '0 0 14px' }}>Current: <span style={{ color: 'var(--ps-text)' }}>{email}</span></p>
            {emailSent ? (
              <p style={{ fontSize: 13, color: 'var(--ps-teal)' }}>Confirmation sent to {newEmail}. Check both inboxes to complete the change.</p>
            ) : (
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>New email address</label>
                  <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="new@email.com" style={inputStyle} />
                </div>
                <button onClick={handleEmailChange} disabled={loading} style={{ alignSelf: 'flex-end', padding: '10px 18px', backgroundColor: 'var(--ps-teal)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  Update email
                </button>
              </div>
            )}
          </div>

          {/* Password */}
          <div style={sectionStyle}>
            <h2 style={{ fontSize: 14, fontWeight: 500, color: 'var(--ps-white)', margin: '0 0 8px' }}>Password</h2>
            <p style={{ fontSize: 13, color: 'var(--ps-muted)', margin: '0 0 16px' }}>We will send a password reset link to your email address.</p>
            {pwSent ? (
              <p style={{ fontSize: 13, color: 'var(--ps-teal)' }}>Password reset email sent to {email}.</p>
            ) : (
              <button onClick={handlePasswordReset} disabled={loading} style={{ padding: '10px 18px', backgroundColor: 'transparent', color: 'var(--ps-text)', border: '0.5px solid var(--ps-border)', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Send password reset
              </button>
            )}
          </div>

        </div>
      </main>
    </>
  )
}
