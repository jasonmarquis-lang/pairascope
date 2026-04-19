'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Logo from '@/components/ui/Logo'

export default function AuthPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const redirect     = searchParams.get('redirect') ?? '/'
  const [mode,     setMode]     = useState<'signin' | 'signup'>('signin')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
      }
      router.push(redirect)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight:      '100vh',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        24,
      }}
    >
      <div
        style={{
          width:           '100%',
          maxWidth:        400,
          backgroundColor: 'var(--ps-surface)',
          border:          '0.5px solid var(--ps-border)',
          borderRadius:    16,
          padding:         36,
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <Logo size="md" />
        </div>

        {/* Mode toggle */}
        <div
          style={{
            display:         'flex',
            backgroundColor: 'var(--ps-bg)',
            borderRadius:    8,
            padding:         3,
            marginBottom:    28,
          }}
        >
          {(['signin', 'signup'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError('') }}
              style={{
                flex:            1,
                padding:         '8px 0',
                borderRadius:    6,
                border:          'none',
                backgroundColor: mode === m ? 'var(--ps-surface)' : 'transparent',
                color:           mode === m ? 'var(--ps-white)' : 'var(--ps-muted)',
                fontSize:        14,
                cursor:          'pointer',
                fontFamily:      'inherit',
                transition:      'all 0.15s ease',
              }}
            >
              {m === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--ps-muted)', display: 'block', marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              style={{
                width:           '100%',
                backgroundColor: 'var(--ps-bg)',
                border:          '0.5px solid var(--ps-border)',
                borderRadius:    8,
                padding:         '10px 14px',
                fontSize:        14,
                color:           'var(--ps-text)',
                fontFamily:      'inherit',
                outline:         'none',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--ps-muted)', display: 'block', marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={{
                width:           '100%',
                backgroundColor: 'var(--ps-bg)',
                border:          '0.5px solid var(--ps-border)',
                borderRadius:    8,
                padding:         '10px 14px',
                fontSize:        14,
                color:           'var(--ps-text)',
                fontFamily:      'inherit',
                outline:         'none',
              }}
            />
          </div>

          {error && (
            <p style={{ fontSize: 13, color: '#E24B4A', margin: 0 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width:           '100%',
              padding:         '11px 0',
              backgroundColor: loading ? 'rgba(29,158,117,0.5)' : 'var(--ps-teal)',
              color:           'white',
              border:          'none',
              borderRadius:    8,
              fontSize:        14,
              fontWeight:      500,
              cursor:          loading ? 'default' : 'pointer',
              fontFamily:      'inherit',
              marginTop:       4,
              transition:      'opacity 0.15s ease',
            }}
          >
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p style={{ fontSize: 12, color: 'var(--ps-muted)', textAlign: 'center', marginTop: 20, lineHeight: 1.6 }}>
          By continuing, you agree to Pairascope&apos;s terms of service.
        </p>
      </div>
    </div>
  )
}
