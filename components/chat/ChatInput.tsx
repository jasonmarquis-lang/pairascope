'use client'

import { useState, useRef, KeyboardEvent } from 'react'

interface ChatInputProps {
  onSend:       (message: string, file?: File) => void
  onNewProject: () => void
  isLoading:    boolean
  started:      boolean
  placeholder?: string
}

const MAX_FILE_SIZE = 4.5 * 1024 * 1024 // 4.5MB — safely under Anthropic's 5MB limit

export default function ChatInput({ onSend, onNewProject, isLoading, started, placeholder }: ChatInputProps) {
  const [value,    setValue]    = useState('')
  const [file,     setFile]     = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSend = () => {
    if ((!value.trim() && !file) || isLoading) return
    onSend(value.trim(), file ?? undefined)
    setValue('')
    setFile(null)
    setFileError('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.focus()
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    setFileError('')
    if (selected.size > MAX_FILE_SIZE) {
      setFileError(`File too large — maximum size is 4.5MB. Your file is ${(selected.size / 1024 / 1024).toFixed(1)}MB.`)
      e.target.value = ''
      return
    }
    setFile(selected)
  }

  const removeFile = () => {
    setFile(null)
    setFileError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div style={{ width: '100%', maxWidth: 800, margin: '0 auto', padding: '0 24px' }}>
      {fileError && (
        <div style={{ marginBottom: 8, padding: '8px 12px', backgroundColor: 'rgba(226,75,74,0.1)', border: '0.5px solid rgba(226,75,74,0.3)', borderRadius: 8, fontSize: 12, color: '#E24B4A' }}>
          {fileError}
        </div>
      )}

      {file && (
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', backgroundColor: 'var(--ps-surface)', border: '0.5px solid var(--ps-border)', borderRadius: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--ps-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
          <span style={{ fontSize: 11, color: 'var(--ps-muted)', flexShrink: 0 }}>{(file.size / 1024 / 1024).toFixed(1)}MB</span>
          <button onClick={removeFile} style={{ background: 'none', border: 'none', color: 'var(--ps-muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px' }}>×</button>
        </div>
      )}

      <div style={{
        display:         'flex',
        alignItems:      'flex-end',
        gap:             8,
        backgroundColor: 'var(--ps-surface)',
        border:          '0.5px solid var(--ps-border)',
        borderRadius:    14,
        padding:         '10px 12px',
        transition:      'border-color 0.2s ease',
      }}>
        {/* File upload button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Attach image or PDF"
          style={{ background: 'none', border: 'none', color: 'var(--ps-muted)', cursor: 'pointer', padding: '4px 6px', borderRadius: 6, flexShrink: 0, fontSize: 16, lineHeight: 1, transition: 'color 0.15s ease' }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--ps-text)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--ps-muted)'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); handleInput() }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Tell me about your project…'}
          autoFocus
          rows={1}
          style={{
            flex:            1,
            backgroundColor: 'transparent',
            border:          'none',
            outline:         'none',
            color:           'var(--ps-text)',
            fontSize:        15,
            lineHeight:      1.6,
            resize:          'none',
            fontFamily:      'inherit',
            overflowY:       'hidden',
            padding:         '2px 0',
          }}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={(!value.trim() && !file) || isLoading}
          style={{
            width:           36,
            height:          36,
            borderRadius:    10,
            backgroundColor: (!value.trim() && !file) || isLoading ? 'rgba(29,158,117,0.3)' : 'var(--ps-teal)',
            border:          'none',
            color:           'white',
            cursor:          (!value.trim() && !file) || isLoading ? 'default' : 'pointer',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            flexShrink:      0,
            transition:      'background-color 0.15s ease',
          }}
        >
          {isLoading ? (
            <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 13V3M3 8l5-5 5 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </div>

      {/* New project button — centered below input */}
      {started && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
          <button
            onClick={onNewProject}
            title="Start a new project"
            style={{ background: 'none', border: '0.5px solid var(--ps-border)', color: 'var(--ps-muted)', cursor: 'pointer', padding: '6px 16px', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', transition: 'all 0.15s ease', whiteSpace: 'nowrap' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ps-text)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ps-muted)'; e.currentTarget.style.borderColor = 'var(--ps-border)' }}
          >
            New project
          </button>
        </div>
      )}
    </div>
  )
}
