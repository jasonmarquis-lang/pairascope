'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Logo from './Logo'

const navLinks = [
  { href: '/',            label: 'Create' },
  { href: '/how-it-works', label: 'How it Works' },
]

export default function Nav() {
  const pathname = usePathname()

  return (
    <nav
      style={{
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
      }}
    >
      {/* Left — Logo */}
      <Logo size="sm" />

      {/* Center — Nav links */}
      <div style={{ display: 'flex', gap: 4 }}>
        {navLinks.map(({ href, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              style={{
                fontSize:        13,
                fontWeight:      active ? 500 : 400,
                color:           active ? 'var(--ps-white)' : 'var(--ps-muted)',
                padding:         '6px 14px',
                borderRadius:    6,
                textDecoration:  'none',
                backgroundColor: active ? 'rgba(255,255,255,0.06)' : 'transparent',
                transition:      'all 0.15s ease',
              }}
            >
              {label}
            </Link>
          )
        })}
      </div>

      {/* Right — Auth */}
      <Link
        href="/auth"
        style={{
          fontSize:        13,
          fontWeight:      400,
          color:           'var(--ps-muted)',
          textDecoration:  'none',
          padding:         '6px 14px',
          borderRadius:    6,
          border:          '0.5px solid var(--ps-border)',
          transition:      'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--ps-white)'
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--ps-muted)'
          e.currentTarget.style.borderColor = 'var(--ps-border)'
        }}
      >
        Sign in
      </Link>
    </nav>
  )
}
