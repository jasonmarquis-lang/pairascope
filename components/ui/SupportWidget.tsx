'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

interface Message {
  role: 'user' | 'bot'
  text: string
  escalated?: boolean
}

export default function SupportWidget() {
  const [open, setOpen]           = useState(false)
  const [messages, setMessages]   = useState<Message[]>([])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [userType, setUserType]   = useState('')
  const [loggedIn, setLoggedIn]   = useState(false)
  const bottomRef                 = useRef<HTMLDivElement>(null)

  // On mount: check session, get email + account type
  useEffect(() => {
    const init = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) return

      const user  = sessionData.session.user
      const token = sessionData.session.access_token
      setUserEmail(user.email ?? '')
      setLoggedIn(true)

      try {
        const res  = await fetch('/api/account', {
          headers: { Authorization: 'Bearer ' + token },
        })
        const data = await res.json()
        if (data.account?.accountType) setUserType(data.account.accountType)
      } catch { /* silently fail */ }
    }
    init()
  }, [])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Open widget with greeting
  const handleOpen = () => {
    setOpen(true)
    if (messages.length === 0) {
      setMessages([{
        role: 'bot',
        text: `Hi${userEmail ? '' : ' there'}! I'm the Pairascope support assistant. What can I help you with today?`,
      }])
    }
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return

    setMessages(prev => [...prev, { role: 'user', text }])
    setInput('')
    setLoading(true)

    try {
      const res  = await fetch('/api/support', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: text, userType, userEmail }),
      })
      const data = await res.json()

      if (data.answer) {
        setMessages(prev => [...prev, { role: 'bot', text: data.answer }])
      } else if (data.escalate) {
        setMessages(prev => [...prev, { role: 'bot', text: data.message, escalated: true }])
      } else {
        setMessages(prev => [...prev, { role: 'bot', text: "Something went wrong. Please try again or email help@pairascope.com." }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: "Something went wrong. Please try again or email help@pairascope.com." }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!loggedIn) return null

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div style={{
          position:        'fixed',
          bottom:          88,
          right:           24,
          width:           360,
          maxHeight:       520,
          backgroundColor: 'var(--ps-surface)',
          border:          '0.5px solid var(--ps-border)',
          borderRadius:    16,
          display:         'flex',
          flexDirection:   'column',
          zIndex:          9999,
          boxShadow:       '0 24px 48px rgba(0,0,0,0.4)',
          overflow:        'hidden',
        }}>

          {/* Header */}
          <div style={{
            padding:         '14px 16px',
            borderBottom:    '0.5px solid var(--ps-border)',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'space-between',
            backgroundColor: 'var(--ps-bg)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <SubmarineSVG size={22} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ps-white)' }}>Pairascope Support</div>
                <div style={{ fontSize: 11, color: 'var(--ps-muted)' }}>Ask me anything</div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ps-muted)', fontSize: 18, lineHeight: 1, padding: 4 }}
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div style={{
            flex:      1,
            overflowY: 'auto',
            padding:   '16px',
            display:   'flex',
            flexDirection: 'column',
            gap:       12,
          }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display:       'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth:        '82%',
                  padding:         '9px 13px',
                  borderRadius:    msg.role === 'user' ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                  backgroundColor: msg.role === 'user'
                    ? 'var(--ps-teal)'
                    : msg.escalated
                      ? 'rgba(226,75,74,0.12)'
                      : 'rgba(255,255,255,0.06)',
                  border:          msg.escalated ? '0.5px solid rgba(226,75,74,0.3)' : 'none',
                  fontSize:        13,
                  lineHeight:      1.5,
                  color:           msg.role === 'user' ? '#fff' : 'var(--ps-text)',
                }}>
                  {msg.text}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  padding:         '9px 13px',
                  borderRadius:    '12px 12px 12px 3px',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  display:         'flex',
                  gap:             4,
                  alignItems:      'center',
                }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{
                      width:           6,
                      height:          6,
                      borderRadius:    '50%',
                      backgroundColor: 'var(--ps-muted)',
                      display:         'inline-block',
                      animation:       `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding:      '12px',
            borderTop:    '0.5px solid var(--ps-border)',
            display:      'flex',
            gap:          8,
            alignItems:   'flex-end',
            backgroundColor: 'var(--ps-bg)',
          }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your question..."
              rows={1}
              style={{
                flex:            1,
                backgroundColor: 'var(--ps-surface)',
                border:          '0.5px solid var(--ps-border)',
                borderRadius:    8,
                padding:         '8px 12px',
                fontSize:        13,
                color:           'var(--ps-text)',
                fontFamily:      'inherit',
                outline:         'none',
                resize:          'none',
                lineHeight:      1.5,
              }}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              style={{
                backgroundColor: loading || !input.trim() ? 'rgba(29,158,117,0.3)' : 'var(--ps-teal)',
                border:          'none',
                borderRadius:    8,
                width:           34,
                height:          34,
                cursor:          loading || !input.trim() ? 'default' : 'pointer',
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                flexShrink:      0,
                color:           '#fff',
                fontSize:        16,
              }}
            >
              ↑
            </button>
          </div>
        </div>
      )}

      {/* Floating trigger button */}
      <button
        onClick={open ? () => setOpen(false) : handleOpen}
        style={{
          position:        'fixed',
          bottom:          24,
          right:           24,
          width:           52,
          height:          52,
          borderRadius:    '50%',
          backgroundColor: 'var(--ps-teal)',
          border:          'none',
          cursor:          'pointer',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          zIndex:          9999,
          boxShadow:       '0 4px 24px rgba(29,158,117,0.35)',
          transition:      'transform 0.15s ease, box-shadow 0.15s ease',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.transform   = 'scale(1.08)'
          ;(e.currentTarget as HTMLButtonElement).style.boxShadow  = '0 6px 28px rgba(29,158,117,0.5)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.transform   = 'scale(1)'
          ;(e.currentTarget as HTMLButtonElement).style.boxShadow  = '0 4px 24px rgba(29,158,117,0.35)'
        }}
      >
        {open
          ? <span style={{ color: '#fff', fontSize: 20, lineHeight: 1 }}>×</span>
          : <SubmarineSVG size={26} color="#fff" />
        }
      </button>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40%            { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </>
  )
}

function SubmarineSVG({ size = 28, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg height={size} viewBox="0 0 120 72" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color }}>
      <rect x="52" y="6" width="18" height="16" rx="4" fill="currentColor" opacity="0.9" />
      <rect x="63" y="2" width="3" height="8" rx="1.5" fill="currentColor" opacity="0.7" />
      <circle cx="64.5" cy="2" r="2.5" fill="currentColor" opacity="0.7" />
      <ellipse cx="62" cy="42" rx="52" ry="18" fill="currentColor" />
      <ellipse cx="14" cy="34" rx="4" ry="10" fill="currentColor" opacity="0.85" transform="rotate(-20 14 34)" />
      <ellipse cx="14" cy="50" rx="4" ry="10" fill="currentColor" opacity="0.85" transform="rotate(20 14 50)" />
      <rect x="18" y="41" width="88" height="2" rx="1" fill="white" opacity="0.15" />
      <polygon points="110,42 120,32 120,52" fill="currentColor" opacity="0.8" />
    </svg>
  )
}
