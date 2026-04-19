'use client'

import { useEffect, useRef } from 'react'
import type { Message } from '@/types'
import Logo from '@/components/ui/Logo'

interface MessageListProps {
  messages:  Message[]
  isLoading: boolean
}

export default function MessageList({ messages, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  return (
    <div style={{ padding: '24px 16px 8px', maxWidth: 800, margin: '0 auto', width: '100%' }}>
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {/* Loading indicator — Pairascope logo pulse */}
      {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 24 }}>
          <LogoAvatar />
          <div style={{ paddingTop: 6, display: 'flex', gap: 4, alignItems: 'center' }}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  width:            6,
                  height:           6,
                  borderRadius:     '50%',
                  backgroundColor:  'var(--ps-muted)',
                  display:          'inline-block',
                  animation:        `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      <div ref={bottomRef} />

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40%            { opacity: 1;   transform: scale(1);   }
        }
      `}</style>
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div
        style={{
          display:        'flex',
          justifyContent: 'flex-end',
          marginBottom:   20,
        }}
      >
        <div
          style={{
            maxWidth:        '70%',
            backgroundColor: 'var(--ps-surface)',
            border:          '0.5px solid var(--ps-border)',
            borderRadius:    '16px 16px 4px 16px',
            padding:         '10px 16px',
            fontSize:        15,
            color:           'var(--ps-white)',
            lineHeight:      1.6,
            whiteSpace:      'pre-wrap',
            wordBreak:       'break-word',
          }}
        >
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        display:       'flex',
        alignItems:    'flex-start',
        gap:           12,
        marginBottom:  24,
      }}
    >
      <LogoAvatar />
      <div
        style={{
          flex:       1,
          fontSize:   15,
          color:      'var(--ps-text)',
          lineHeight: 1.7,
          paddingTop: 2,
          whiteSpace: 'pre-wrap',
          wordBreak:  'break-word',
        }}
      >
        {message.content}
      </div>
    </div>
  )
}

function LogoAvatar() {
  return (
    <div
      style={{
        width:           32,
        height:          32,
        borderRadius:    8,
        backgroundColor: 'var(--ps-teal-dim)',
        border:          '0.5px solid rgba(29,158,117,0.3)',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        flexShrink:      0,
        marginTop:       2,
      }}
    >
      {/* Mini submarine icon */}
      <svg width="16" height="10" viewBox="0 0 120 72" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="52" y="6" width="18" height="16" rx="4" fill="#1D9E75" opacity="0.9" />
        <rect x="63" y="2" width="3" height="8" rx="1.5" fill="#1D9E75" opacity="0.7" />
        <ellipse cx="62" cy="42" rx="52" ry="18" fill="#1D9E75" />
        <polygon points="110,42 120,32 120,52" fill="#1D9E75" opacity="0.8" />
      </svg>
    </div>
  )
}
