'use client'

import Link from 'next/link'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showWordmark?: boolean
}

export default function Logo({ size = 'md', showWordmark = true }: LogoProps) {
  const heights = { sm: 24, md: 32, lg: 44 }
  const h = heights[size]
  const fontSize = { sm: 15, md: 20, lg: 28 }[size]

  return (
    <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
      <svg height={h} viewBox="0 0 120 72" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: 'var(--ps-teal)' }}>
        <rect x="52" y="6" width="18" height="16" rx="4" fill="currentColor" opacity="0.9" />
        <rect x="63" y="2" width="3" height="8" rx="1.5" fill="currentColor" opacity="0.7" />
        <circle cx="64.5" cy="2" r="2.5" fill="currentColor" opacity="0.7" />
        <ellipse cx="62" cy="42" rx="52" ry="18" fill="currentColor" />
        <ellipse cx="14" cy="34" rx="4" ry="10" fill="currentColor" opacity="0.85" transform="rotate(-20 14 34)" />
        <ellipse cx="14" cy="50" rx="4" ry="10" fill="currentColor" opacity="0.85" transform="rotate(20 14 50)" />
        <rect x="18" y="41" width="88" height="2" rx="1" fill="white" opacity="0.15" />
        <polygon points="110,42 120,32 120,52" fill="currentColor" opacity="0.8" />
      </svg>
      {showWordmark && (
        <span style={{ fontSize, fontWeight: 400, color: 'var(--ps-white)', letterSpacing: '-0.01em', lineHeight: 1 }}>
          Pairascope
        </span>
      )}
    </Link>
  )
}
