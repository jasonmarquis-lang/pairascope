'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Logo from './Logo'
import AuthModal from './AuthModal'
import type { User } from '@supabase/supabase-js'

const navLinks = [
  { href: '/',             label: 'Create'       },
  { href: '/how-it-works', label: 'How it Works' },
]

export default function Nav() {
  const pathname = usePathname()
  const router   = useRouter()
  const [user,        setUser]        = useState<User | null>(null)
  const [showAuth,    setShowAuth]    = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)

    })
    return () => subscription.unsubscribe()
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setShowDropdown(false)
    router.push('/')
  }

  const firstName   = user?.user_metadata?.first_name
  const displayName = firstName || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Account'

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
        backgroundColor: 'rgba(17,17,16,0.85)',
        backdropFilter:  'blur(12px)',
        borderBottom:    '0.5px solid var(--ps-border)',
      }}>
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}><Logo size="sm" /></Link>

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
              }}>
                {label}
              </Link>
            )
          })}
        </div>

        {user ? (
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            {/* Trigger button */}
            <button
              onClick={() => setShowDropdown((v) => !v)}
              style={{
                fontSize:        13,
                color:           'var(--ps-teal)',
                background:      'none',
                border:          '0.5px solid rgba(29,158,117,0.3)',
                borderRadius:    6,
                padding:         '6px 14px',
                cursor:          'pointer',
                fontFamily:      'inherit',
                display:         'flex',
                alignItems:      'center',
                gap:             6,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(29,158,117,0.08)' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--ps-teal)', display: 'inline-block', flexShrink: 0 }} />
              Hi, {displayName}
              <span style={{ fontSize: 9, color: 'var(--ps-teal)', opacity: 0.7 }}>▾</span>
            </button>

            {/* Dropdown menu */}
            {showDropdown && (
              <div style={{
                position:        'absolute',
                top:             'calc(100% + 8px)',
                right:           0,
                backgroundColor: 'var(--ps-surface)',
                border:          '0.5px solid var(--ps-border)',
                borderRadius:    10,
                overflow:        'hidden',
                minWidth:        180,
                boxShadow:       '0 8px 24px rgba(0,0,0,0.4)',
                zIndex:          60,
              }}>
                {/* User info */}
                <div style={{ padding: '12px 14px', borderBottom: '0.5px solid var(--ps-border)' }}>
                  <p style={{ fontSize: 12, color: 'var(--ps-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.email}
                  </p>
                </div>

                {/* Menu items */}
                {[
                  { label: 'My RFQs',          href: '/rfq-hub',  icon: '📋' },
                  { label: 'Account settings',  href: '/account',  icon: '⚙️' },
                ].map(({ label, href, icon }) => (
                  <button
                    key={href}
                    onClick={() => { router.push(href); setShowDropdown(false) }}
                    style={{
                      width:           '100%',
                      display:         'flex',
                      alignItems:      'center',
                      gap:             10,
                      padding:         '10px 14px',
                      background:      'none',
                      border:          'none',
                      color:           'var(--ps-text)',
                      fontSize:        13,
                      cursor:          'pointer',
                      fontFamily:      'inherit',
                      textAlign:       'left',
                      transition:      'background 0.1s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                  >
                    <span style={{ fontSize: 14 }}>{icon}</span>
                    {label}
                  </button>
                ))}

                {/* Sign out */}
                <div style={{ borderTop: '0.5px solid var(--ps-border)' }}>
                  <button
                    onClick={handleSignOut}
                    style={{
                      width:      '100%',
                      display:    'flex',
                      alignItems: 'center',
                      gap:        10,
                      padding:    '10px 14px',
                      background: 'none',
                      border:     'none',
                      color:      '#E24B4A',
                      fontSize:   13,
                      cursor:     'pointer',
                      fontFamily: 'inherit',
                      textAlign:  'left',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(226,75,74,0.06)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                  >
                    <span style={{ fontSize: 14 }}>🚪</span>
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowAuth(true)}
            style={{
              fontSize:   13,
              color:      'var(--ps-muted)',
              background: 'none',
              padding:    '6px 14px',
              borderRadius: 6,
              border:     '0.5px solid var(--ps-border)',
              cursor:     'pointer',
              fontFamily: 'inherit',
            }}
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
