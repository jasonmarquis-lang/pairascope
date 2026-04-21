'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Nav from '@/components/ui/Nav'
import type { User } from '@supabase/supabase-js'

export default function AccountPage() {
  const router = useRouter()
  const [user,        setUser]        = useState<User | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [saving,      setSaving]      = useState(false)
  const [message,     setMessage]     = useState('')
  const [error,       setError]       = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session?.user) { router.push('/'); return }
      setUser(data.session.user)
      setDisplayName(data.session.user.user_metadata?.display_name || '')
    })
  }, [router])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setMessage(''); setError('')
    try {
      const { error } = await supabase.auth.updateUser({ data: { display_name: displayName } })
      if (error) throw error
      setMessage('Profile updated successfully.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Update failed.')
    } finally { setSaving(false) }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPass) { setError('Passwords do not match.'); return }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return }
    setSaving(true); setMessage(''); setError('')
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setMessage('Password updated successfully.')
      setNewPassword(''); setConfirmPass('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Password update failed.')
    } finally { setSaving(false) }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (!user) return null

  const inputStyle = { width: '100%', backgroundColor: 'var(--ps-bg)', border: '0.5px solid var(--ps-border)', borderRadius: 8, padding: '9px 12px', fontSize: 14, color: 'var(--ps-text)', fontFamily: 'inherit', outline: 'none' }
  const cardStyle  = { backgroundColor: 'var(--ps-surface)', border: '0.5px solid var(--ps-border)', borderRadius: 12, padding: 24, marginBottom: 16 }
  const btnStyle   = { alignSelf: 'flex-start' as const, padding: '8px 20px', backgroundColor: 'var(--ps-teal)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }

  return (
    <>
      <Nav />
      <main style={{ paddingTop: 56, minHeight: '100vh' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '48px 24px' }}>

          <div style={{ marginBottom: 40 }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 400, color: 'var(--ps-white)', margin: '0 0 6px' }}>Account</h1>
            <p style={{ fontSize: 14, color: 'var(--ps-muted)', margin: 0 }}>{user.email}</p>
          </div>

          {message && <div style={{ backgroundColor: 'rgba(29,158,117,0.1)', border: '0.5px solid rgba(29,158,117,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#1D9E75' }}>{message}</div>}
          {error   && <div style={{ backgroundColor: 'rgba(226,75,74,0.1)',   border: '0.5px solid rgba(226,75,74,0.3)',   borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#E24B4A' }}>{error}</div>}

          <div style={cardStyle}>
            <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--ps-white)', margin: '0 0 20px' }}>Profile</h2>
            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--ps-muted)', display: 'block', marginBottom: 5 }}>Display name</label>
                <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--ps-muted)', display: 'block', marginBottom: 5 }}>Email</label>
                <input type="text" value={user.email || ''} disabled style={{ ...inputStyle, color: 'var(--ps-muted)', cursor: 'not-allowed', backgroundColor: 'rgba(255,255,255,0.03)' }} />
                <p style={{ fontSize: 11, color: 'var(--ps-muted)', margin: '5px 0 0' }}>Email cannot be changed.</p>
              </div>
              <button type="submit" disabled={saving} style={{ ...btnStyle, opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Save profile'}
              </button>
            </form>
          </div>

          <div style={cardStyle}>
            <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--ps-white)', margin: '0 0 20px' }}>Change password</h2>
            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--ps-muted)', display: 'block', marginBottom: 5 }}>New password</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--ps-muted)', display: 'block', marginBottom: 5 }}>Confirm password</label>
                <input type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} placeholder="••••••••" style={inputStyle} />
              </div>
              <button type="submit" disabled={saving} style={{ ...btnStyle, opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Update password'}
              </button>
            </form>
          </div>

          <div style={cardStyle}>
            <h2 style={{ fontSize: 15, fontWeight: 500, color: 'var(--ps-white)', margin: '0 0 8px' }}>Sign out</h2>
            <p style={{ fontSize: 13, color: 'var(--ps-muted)', margin: '0 0 16px' }}>You will be returned to the home page.</p>
            <button onClick={handleSignOut} style={{ padding: '8px 20px', backgroundColor: 'transparent', color: '#E24B4A', border: '0.5px solid rgba(226,75,74,0.4)', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              Sign out
            </button>
          </div>

        </div>
      </main>
    </>
  )
}
