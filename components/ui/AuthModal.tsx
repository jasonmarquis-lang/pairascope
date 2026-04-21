'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Logo from './Logo'

interface AuthModalProps {
  isOpen:    boolean
  onClose:   () => void
  onSuccess: () => void
  message?:  string
}

export default function AuthModal({ isOpen, onClose, onSuccess, message }: AuthModalProps) {
  const [mode,     setMode]     = useState<'signin' | 'signup'>('signin')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  useEffect(() => {
    if (isOpen) { setEmail(''); setPassword(''); setError(''); setMode('signin') }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (data.user) {
          await fetch('/api/account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: data.user.id, email }),
          })
        }
      }
      onSuccess()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position:        'fixed',
        inset:           0,
        zIndex:          100,
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter:  'blur(6px)',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width:           '100%',
          maxWidth:        400,
          backgroundColor: 'var(--ps-surface)',
          border:          '0.5px solid var(--ps-border)',
          borderRadius:    16,
          padding:         36,
          position:        'relative',
          animation:       'slideUp 0.25s ease-out',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <Logo size="sm" />
        </div>

        {message && (
          <p style={{ fontSize: 14, color: 'var(--ps-text)', textAlign: 'center', marginBottom: 20, lineHeight: 1.6 }}>
            {message}
          </p>
        )}

        <div style={{ display: 'flex', backgroundColor: 'var(--ps-bg)', borderRadius: 8, padding: 3, marginBottom: 24 }}>
          {(['signin', 'signup'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError('') }}
              style={{
                flex:            1,
                padding:         '7px 0',
                borderRadius:    6,
                border:          'none',
                backgroundColor: mode === m ? 'var(--ps-surface)' : 'transparent',
                color:           mode === m ? 'var(--ps-white)' : 'var(--ps-muted)',
                fontSize:        13,
                cursor:          'pointer',
                fontFamily:      'inherit',
                transition:      'all 0.15s ease',
              }}
            >
              {m === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--ps-muted)', display: 'block', marginBottom: 5 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              style={{ width: '100%', backgroundColor: 'var(--ps-bg)', border: '0.5px solid var(--ps-border)', borderRadius: 8, padding: '9px 12px', fontSize: 14, color: 'var(--ps-text)', fontFamily: 'inherit', outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--ps-muted)', display: 'block', marginBottom: 5 }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={{ width: '100%', backgroundColor: 'var(--ps-bg)', border: '0.5px solid var(--ps-border)', borderRadius: 8, padding: '9px 12px', fontSize: 14, color: 'var(--ps-text)', fontFamily: 'inherit', outline: 'none' }}
            />
          </div>
          {error && <p style={{ fontSize: 13, color: '#E24B4A', margin: 0 }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '10px 0', backgroundColor: loading ? 'rgba(29,158,117,0.5)' : 'var(--ps-teal)', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', marginTop: 4 }}
          >
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--ps-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 4 }}
        >
          ×
        </button>
      </div>
    </div>
  )
}
