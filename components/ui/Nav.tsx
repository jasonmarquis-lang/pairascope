'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
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
  const router   = useRouter()
  const [user,     setUser]     = useState<User | null>(null)
  const [showAuth, setShowAuth] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Account'

  return (
    <>
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', backgroundColor: 'rgba(17,17,16,0.85)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid var(--ps-border)' }}>
        <Logo size="sm" />
        <div style={{ display: 'flex', gap: 4 }}>
          {navLinks.map(({ href, label }) => {
            const active = pathname === href
            return (
              <Link key={href} href={href} style={{ fontSize: 13, fontWeight: active ? 500 : 400, color: active ? 'var(--ps-white)' : 'var(--ps-muted)', padding: '6px 14px', borderRadius: 6, textDecoration: 'none', backgroundColor: active ? 'rgba(255,255,255,0.06)' : 'transparent', transition: 'all 0.15s ease' }}>
                {label}
              </Link>
            )
          })}
        </div>
        {user ? (
          <button
            onClick={() => router.push('/account')}
            style={{ fontSize: 13, color: 'var(--ps-teal)', background: 'none', border: '0.5px solid rgba(29,158,117,0.3)', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
            onMouseEnter={(e) => { e.cur
cat > ~/Desktop/pairascope/components/ui/Nav.tsx << 'ENDOFFILE'
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
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
  const router   = useRouter()
  const [user,     setUser]     = useState<User | null>(null)
  const [showAuth, setShowAuth] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Account'

  return (
    <>
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', backgroundColor: 'rgba(17,17,16,0.85)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid var(--ps-border)' }}>
        <Logo size="sm" />
        <div style={{ display: 'flex', gap: 4 }}>
          {navLinks.map(({ href, label }) => {
            const active = pathname === href
            return (
              <Link key={href} href={href} style={{ fontSize: 13, fontWeight: active ? 500 : 400, color: active ? 'var(--ps-white)' : 'var(--ps-muted)', padding: '6px 14px', borderRadius: 6, textDecoration: 'none', backgroundColor: active ? 'rgba(255,255,255,0.06)' : 'transparent', transition: 'all 0.15s ease' }}>
                {label}
              </Link>
            )
          })}
        </div>
        {user ? (
          <button
            onClick={() => router.push('/account')}
            style={{ fontSize: 13, color: 'var(--ps-teal)', background: 'none', border: '0.5px solid rgba(29,158,117,0.3)', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(29,158,117,0.08)' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--ps-teal)', display: 'inline-block' }} />
            Hi, {displayName}
          </button>
        ) : (
          <button
            onClick={() => setShowAuth(true)}
            style={{ fontSize: 13, color: 'var(--ps-muted)', background: 'none', padding: '6px 14px', borderRadius: 6, border: '0.5px solid var(--ps-border)', cursor: 'pointer', fontFamily: 'inherit' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ps-white)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ps-muted)'; e.currentTarget.style.borderColor = 'var(--ps-border)' }}
          >
            Sign in
          </button>
        )}
      </nav>
      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} onSuccess={() => setShowAuth(false)} />
    </>
  )
}
