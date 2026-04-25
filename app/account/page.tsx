'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Nav from '@/components/ui/Nav'

const HOW_FOUND_OPTIONS = [
  'Word of mouth',
  'Google search',
  'Social media',
  'Art fair or event',
  'Referred by a vendor',
  'Referred by a colleague',
  'Press or media',
  'Direct outreach',
  'Other',
]

export default function AccountPage() {
  const router = useRouter()
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [error,       setError]       = useState('')
  const [email,       setEmail]       = useState('')
  const [pwSaving,    setPwSaving]    = useState(false)
  const [pwSaved,     setPwSaved]     = useState(false)
  const [pwError,     setPwError]     = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPw,   setConfirmPw]   = useState('')

  const [firstName,  setFirstName]  = useState('')
  const [lastName,   setLastName]   = useState('')
  const [company,    setCompany]    = useState('')
  const [phone,      setPhone]      = useState('')
  const [street,     setStreet]     = useState('')
  const [city,       setCity]       = useState('')
  const [state,      setState]      = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [country,    setCountry]    = useState('')
  const [website,    setWebsite]    = useState('')
  const [howFoundUs, setHowFoundUs] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) { router.push('/'); return }

      const user  = sessionData.session.user
      const token = sessionData.session.access_token
      setEmail(user.email ?? '')

      const meta = user.user_metadata ?? {}
      setFirstName(meta.first_name ?? '')
      setLastName(meta.last_name  ?? '')

      try {
        const res  = await fetch('/api/account', {
          headers: { 'Authorization': 'Bearer ' + token },
        })
        const data = await res.json()
        if (data.account) {
          const a = data.account
          if (a.company)    setCompany(a.company)
          if (a.phone)      setPhone(a.phone)
          if (a.website)    setWebsite(a.website)
          if (a.howFoundUs) setHowFoundUs(a.howFoundUs)
          if (a.street)     setStreet(a.street)
          if (a.city)       setCity(a.city)
          if (a.state)      setState(a.state)
          if (a.postalCode) setPostalCode(a.postalCode)
          if (a.country)    setCountry(a.country)
        }
      } catch { /* silently fail */ }

      setLoading(false)
    }
    load()
  }, [router])

  const handleSave = async () => {
    setSaving(true); setSaved(false); setError('')
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token  = sessionData.session?.access_token
      const userId = sessionData.session?.user.id

      const displayName = [firstName, lastName].filter(Boolean).join(' ')
      await supabase.auth.updateUser({
        data: { first_name: firstName, last_name: lastName, display_name: displayName || email.split('@')[0] }
      })

      const res = await fetch('/api/account', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body:    JSON.stringify({ userId, email, fullName: displayName, company, phone, street, city, state, postalCode, country, website, howFoundUs }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordReset = async () => {
    setPwError(''); setPwSaved(false)
    if (!newPassword)              { setPwError('Please enter a new password.'); return }
    if (newPassword.length < 8)    { setPwError('Password must be at least 8 characters.'); return }
    if (newPassword !== confirmPw) { setPwError('Passwords do not match.'); return }
    setPwSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setPwSaved(true)
      setNewPassword(''); setConfirmPw('')
      setTimeout(() => setPwSaved(false), 3000)
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : 'Failed to update password.')
    } finally {
      setPwSaving(false)
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
    borderRadius: 12, padding: '24px', marginBottom: 20,
  }

  if (loading) return (
    <>
      <Nav />
      <div style={{ paddingTop: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--ps-muted)' }}>Loading...</div>
    </>
  )

  return (
    <>
      <Nav />
      <main style={{ paddingTop: 56, minHeight: '100vh' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px' }}>

          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 400, color: 'var(--ps-white)', margin: '0 0 8px' }}>Account settings</h1>
            <p style={{ fontSize: 15, color: 'var(--ps-muted)', margin: 0 }}>{email}</p>
          </div>

          {/* Personal info */}
          <div style={sectionStyle}>
            <h2 style={{ fontSize: 14, fontWeight: 500, color: 'var(--ps-white)', margin: '0 0 20px' }}>Personal information</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>First name</label>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Last name</label>
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Smith" style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Company / Studio</label>
                <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Studio name or company" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Phone</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Website</label>
                <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://yourwebsite.com" style={inputStyle} />
              </div>
            </div>
          </div>

          {/* Address */}
          <div style={sectionStyle}>
            <h2 style={{ fontSize: 14, fontWeight: 500, color: 'var(--ps-white)', margin: '0 0 20px' }}>Address</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Street address</label>
                <input type="text" value={street} onChange={(e) => setStreet(e.target.value)} placeholder="123 Main St" style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>City</label>
                  <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="New York" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>State / Province</label>
                  <input type="text" value={state} onChange={(e) => setState(e.target.value)} placeholder="NY" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Postal code</label>
                  <input type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="10001" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Country</label>
                  <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="United States" style={inputStyle} />
                </div>
              </div>
            </div>
          </div>

          {/* How they found us */}
          <div style={sectionStyle}>
            <h2 style={{ fontSize: 14, fontWeight: 500, color: 'var(--ps-white)', margin: '0 0 20px' }}>How did you find Pairascope?</h2>
            <div>
              <label style={labelStyle}>Source <span style={{ color: 'rgba(136,135,128,0.5)' }}>optional</span></label>
              <select value={howFoundUs} onChange={(e) => setHowFoundUs(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="">Select an option...</option>
                {HOW_FOUND_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Change password */}
          <div style={sectionStyle}>
            <h2 style={{ fontSize: 14, fontWeight: 500, color: 'var(--ps-white)', margin: '0 0 20px' }}>Change password</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>New password</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Confirm new password</label>
                <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Repeat new password" style={inputStyle} />
              </div>
              {pwError && <p style={{ fontSize: 13, color: '#E24B4A', margin: 0 }}>{pwError}</p>}
              {pwSaved && <p style={{ fontSize: 13, color: 'var(--ps-teal)', margin: 0 }}>Password updated successfully.</p>}
              <button
                onClick={handlePasswordReset}
                disabled={pwSaving}
                style={{ padding: '10px 20px', backgroundColor: 'transparent', color: 'var(--ps-text)', border: '0.5px solid var(--ps-border)', borderRadius: 8, fontSize: 13, cursor: pwSaving ? 'default' : 'pointer', fontFamily: 'inherit', alignSelf: 'flex-start' }}
              >
                {pwSaving ? 'Updating...' : 'Update password'}
              </button>
            </div>
          </div>

          {/* Save all changes — at the bottom */}
          {error && <p style={{ fontSize: 13, color: '#E24B4A', marginBottom: 12 }}>{error}</p>}
          {saved && <p style={{ fontSize: 13, color: 'var(--ps-teal)', marginBottom: 12 }}>Changes saved successfully.</p>}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ width: '100%', padding: '12px 0', backgroundColor: saving ? 'rgba(29,158,117,0.5)' : 'var(--ps-teal)', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>

        </div>
      </main>
    </>
  )
}
