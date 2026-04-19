'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import type { ChangeEvent } from 'react'

interface ChatInputProps {
  onSend:         (content: string, file?: File) => void
  onNewProject:   () => void
  isLoading:      boolean
  started:        boolean
  placeholder:    string
}

export default function ChatInput({ onSend, onNewProject, isLoading, started, placeholder }: ChatInputProps) {
  const [input,        setInput]        = useState('')
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed && !attachedFile) return
    onSend(trimmed, attachedFile ?? undefined)
    setInput('')
    setAttachedFile(null)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setAttachedFile(file)
  }

  const removeFile = () => {
    setAttachedFile(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div
      style={{
        padding:         '12px 16px 16px',
        borderTop:       started ? '0.5px solid var(--ps-border)' : 'none',
        backgroundColor: 'var(--ps-bg)',
      }}
    >
      {/* Attached file pill */}
      {attachedFile && (
        <div
          style={{
            display:         'flex',
            alignItems:      'center',
            gap:             8,
            marginBottom:    8,
            padding:         '6px 12px',
            backgroundColor: 'var(--ps-surface)',
            borderRadius:    8,
            border:          '0.5px solid var(--ps-border)',
            fontSize:        13,
            color:           'var(--ps-muted)',
            maxWidth:        400,
          }}
        >
          <span style={{ color: 'var(--ps-teal)', fontSize: 12 }}>📎</span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {attachedFile.name}
          </span>
          <button
            onClick={removeFile}
            style={{
              background:  'none',
              border:      'none',
              color:       'var(--ps-muted)',
              cursor:      'pointer',
              fontSize:    16,
              lineHeight:  1,
              padding:     0,
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Input container */}
      <div
        style={{
          display:         'flex',
          alignItems:      'flex-end',
          gap:             8,
          backgroundColor: 'var(--ps-surface)',
          border:          '0.5px solid var(--ps-border)',
          borderRadius:    12,
          padding:         '8px 8px 8px 14px',
          maxWidth:        800,
          margin:          '0 auto',
          transition:      'border-color 0.15s ease',
        }}
        onFocus={() => {}}
      >
        {/* Attach button */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          title="Attach file (JPG, PNG, PDF)"
          style={{
            background:  'none',
            border:      'none',
            cursor:      'pointer',
            color:       'var(--ps-muted)',
            padding:     '4px 6px',
            borderRadius: 6,
            display:     'flex',
            alignItems:  'center',
            flexShrink:  0,
            transition:  'color 0.15s ease',
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--ps-white)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--ps-muted)'}
        >
          {/* Paperclip icon */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>

        <input
          ref={fileRef}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf,.gif,.webp"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {/* Textarea */}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={isLoading}
          style={{
            flex:            1,
            background:      'none',
            border:          'none',
            outline:         'none',
            color:           'var(--ps-text)',
            fontSize:        15,
            lineHeight:      1.6,
            maxHeight:       180,
            overflowY:       'auto',
            fontFamily:      'inherit',
          }}
          onInput={(e) => {
            const el = e.currentTarget
            el.style.height = 'auto'
            el.style.height = `${Math.min(el.scrollHeight, 180)}px`
          }}
        />

        {/* Send button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={isLoading || (!input.trim() && !attachedFile)}
          style={{
            width:           34,
            height:          34,
            borderRadius:    8,
            border:          'none',
            backgroundColor: (input.trim() || attachedFile) && !isLoading
              ? 'var(--ps-teal)'
              : 'rgba(255,255,255,0.06)',
            color:           (input.trim() || attachedFile) && !isLoading
              ? 'white'
              : 'var(--ps-muted)',
            cursor:          (input.trim() || attachedFile) && !isLoading ? 'pointer' : 'default',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            flexShrink:      0,
            transition:      'all 0.15s ease',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>

      {/* New project button — only shown when conversation started */}
      {started && (
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <button
            onClick={onNewProject}
            style={{
              background:      'none',
              border:          'none',
              color:           'var(--ps-muted)',
              fontSize:        12,
              cursor:          'pointer',
              display:         'inline-flex',
              alignItems:      'center',
              gap:             5,
              padding:         '4px 8px',
              borderRadius:    6,
              transition:      'color 0.15s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--ps-text)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--ps-muted)'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New project
          </button>
        </div>
      )}
    </div>
  )
}
