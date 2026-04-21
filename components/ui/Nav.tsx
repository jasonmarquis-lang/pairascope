'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Logo from './Logo'
import AuthModal from './AuthModal'
import type { User } from '@supabase/supabase-js'

const navLinks = [
  { href: '/',             label: 'Create' },
  { href: '/how-it-works', label: 'How it Works' },
]

export default function Nav() {
  const pathname = usePathname()
  const [user,     setUser]     = useState<User | null>(null)
  const [showAuth, setShowAuth] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <>
      <nav style={{
        position:        'fixed',
        top:             0,
        left:            0,
        right:           0,
        zIndex:          50,
        height:          56,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'space-between',
        padding:         '0 24px',
        backgroundColor: 'rgba(17, 17, 16, 0.85)',
        backdropFilter:  'blur(12px)',
        borderBottom:    '0.5px solid var(--ps-border)',
      }}>
        <Logo size="sm" />

        <div style={{ display: 'flex', gap: 4 }}>
          {navLinks.map(({ href, label }) => {
            const active = pathname === href
            return (
              <Link key={href} href={href} style={{
                fontSize:        13,
                fontWeight:      active ? 500 : 400,
                color:           active ? 'var(--ps-white)' : 'var(--ps-muted)',
                padding:         '6px 14px',
                borderRadius:    6,
                textDecoration:  'none',
                backgroundColor: active ? 'rgba(255,255,255,0.06)' : 'transparent',
                transition:      'all 0.15s ease',
              }}>
                {label}
              </Link>
            )
          })}
        </div>

        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--ps-muted)' }}>
              {user.email?.split('@')[0]}
            </span>
            <button
              onClick={handleSignOut}
              style={{ fontSize: 13, color: 'var(--ps-muted)', background: 'none', border: '0.5px solid var(--ps-border)', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ps-white)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ps-muted)' }}
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAuth(true)}
            style={{ fontSize: 13, color: 'var(--ps-muted)', background: 'none', padding: '6px 14px', borderRadius: 6, border: '0.5px solid var(--ps-border)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ps-white)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ps-muted)'; e.currentTarget.style.borderColor = 'var(--ps-border)' }}
          >
            Sign in
          </button>
        )}
      </nav>

      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        onSuccess={() => setShowAuth(false)}
      />
    </>
  )
}
