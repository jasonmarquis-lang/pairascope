'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { v4 as uuidv4 } from 'uuid'
import Nav from '@/components/ui/Nav'
import ChatInput from '@/components/chat/ChatInput'
import MessageList from '@/components/chat/MessageList'
import ScopePanel from '@/components/scope/ScopePanel'
import type { Message, ProjectSnapshot } from '@/types'

const PLACEHOLDERS = [
  'Tell me about your design.',
  'Tell me about your project.',
  'Tell me about your shipment.',
  'Tell me about your installation.',
]

const SESSION_KEY = 'ps_conversation'

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { messages: [], snapshot: null, conversationId: '', started: false }
}

function saveSession(data: { messages: Message[]; snapshot: ProjectSnapshot | null; conversationId: string; started: boolean }) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(data)) } catch { /* ignore */ }
}

function HomeContent() {
  const searchParams = useSearchParams()
  const urlConvId    = searchParams.get('conversationId')

  const [hydrated,       setHydrated]       = useState(false)
  const [started,        setStarted]        = useState(false)
  const [messages,       setMessages]       = useState<Message[]>([])
  const [isLoading,      setIsLoading]      = useState(false)
  const [snapshot,       setSnapshot]       = useState<ProjectSnapshot | null>(null)
  const [showScope,      setShowScope]      = useState(false)
  const [conversationId, setConversationId] = useState<string>('')
  const [placeholder,    setPlaceholder]    = useState(PLACEHOLDERS[0])
  const [restoring,      setRestoring]      = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Hydrate from sessionStorage, or restore from URL conversationId
  useEffect(() => {
    const saved = loadSession()

    if (urlConvId) {
      // Came from RFQ Hub — restore this conversation from Supabase
      if (saved.conversationId === urlConvId && saved.messages?.length > 0) {
        // Already in session — just restore it
        setStarted(true)
        setMessages(saved.messages)
        setConversationId(saved.conversationId)
        setSnapshot(saved.snapshot)
        setShowScope(!!saved.snapshot)
      } else {
        // Need to load from Supabase
        setConversationId(urlConvId)
        setRestoring(true)
        fetch(`/api/chat/history?conversationId=${urlConvId}`)
          .then((r) => r.json())
          .then((data) => {
            if (data.messages?.length > 0) {
              setMessages(data.messages)
              setSnapshot(data.snapshot ?? null)
              setShowScope(!!data.snapshot)
              setStarted(true)
              saveSession({ messages: data.messages, snapshot: data.snapshot ?? null, conversationId: urlConvId, started: true })
            }
          })
          .catch(() => { /* silently fail — start fresh */ })
          .finally(() => setRestoring(false))
      }
    } else if (saved.started && saved.messages?.length > 0) {
      setStarted(saved.started)
      setMessages(saved.messages)
      setConversationId(saved.conversationId)
      setSnapshot(saved.snapshot)
      setShowScope(saved.snapshot?.confidenceLevel === 'yellow' || saved.snapshot?.confidenceLevel === 'green')
    }

    setHydrated(true)
  }, [urlConvId])

  // Persist session on every change
  useEffect(() => {
    if (hydrated) saveSession({ messages, snapshot, conversationId, started })
  }, [messages, snapshot, conversationId, started, hydrated])

  // Rotate placeholder
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholder((p) => {
        const idx  = PLACEHOLDERS.indexOf(p)
        return PLACEHOLDERS[(idx + 1) % PLACEHOLDERS.length]
      })
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (snapshot && (snapshot.confidenceLevel === 'yellow' || snapshot.confidenceLevel === 'green')) {
      setShowScope(true)
    }
  }, [snapshot])

  const sendMessage = useCallback(async (content: string, file?: File) => {
    if (!content.trim() && !file) return

    const userMessage: Message = { id: uuidv4(), role: 'user', content: content.trim() }
    const nextMessages = [...messages, userMessage]
    setStarted(true)
    setMessages(nextMessages)
    setIsLoading(true)

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    try {
      const body = new FormData()
      body.append('messages', JSON.stringify(nextMessages))
      body.append('conversationId', conversationId)
      if (file) body.append('file', file)

      const res = await fetch('/api/chat', { method: 'POST', body, signal: abortRef.current.signal })
      if (!res.ok || !res.body) throw new Error(`API error: ${res.status}`)

      const assistantId = uuidv4()
      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }])

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const raw = line.slice(6).trim()
            if (raw === '[DONE]') continue
            try {
              const parsed = JSON.parse(raw)
              if (parsed.type === 'text') {
                setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: m.content + parsed.text } : m))
              }
              if (parsed.type === 'snapshot')       setSnapshot(parsed.snapshot)
              if (parsed.type === 'conversationId') setConversationId(parsed.conversationId)
            } catch { /* skip */ }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setMessages((prev) => [...prev, { id: uuidv4(), role: 'assistant', content: 'Something went wrong. Please refresh and try again.' }])
    } finally {
      setIsLoading(false)
    }
  }, [messages, conversationId])

  const handleNewProject = () => {
    abortRef.current?.abort()
    setStarted(false)
    setMessages([])
    setSnapshot(null)
    setShowScope(false)
    setConversationId('')
    setIsLoading(false)
    try { sessionStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
  }

  if (!hydrated) return null

  if (restoring) {
    return (
      <>
        <Nav />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--ps-muted)', fontSize: 14 }}>
          Restoring conversation…
        </div>
      </>
    )
  }

  return (
    <>
      <Nav />
      <main style={{ display: 'flex', height: '100vh', paddingTop: 56, overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {!started ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '100%', maxWidth: 800, padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 32 }}>
                <div style={{ textAlign: 'center' }}>
                  <h1 style={{ fontSize: '2rem', fontWeight: 400, color: 'var(--ps-white)', margin: '0 0 10px', lineHeight: 1.2 }}>
                    Scope. Pair. Create.
                  </h1>
                  <p style={{ fontSize: 16, color: 'var(--ps-muted)', margin: 0 }}>
                    Fabrication, shipping, installation, and more.
                  </p>
                </div>
                <ChatInput onSend={sendMessage} onNewProject={handleNewProject} isLoading={isLoading} started={started} placeholder={placeholder} />
              </div>
            </div>
          ) : (
            <>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <MessageList messages={messages} isLoading={isLoading} />
              </div>
              <div style={{ paddingBottom: 30 }}>
                <ChatInput onSend={sendMessage} onNewProject={handleNewProject} isLoading={isLoading} started={started} placeholder={placeholder} />
              </div>
            </>
          )}
        </div>

        {showScope && snapshot && (
          <div style={{ width: 400, borderLeft: '0.5px solid var(--ps-border)', overflowY: 'auto', flexShrink: 0 }}>
            <ScopePanel snapshot={snapshot} conversationId={conversationId} />
          </div>
        )}
      </main>
    </>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  )
}
