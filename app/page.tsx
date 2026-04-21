'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
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

export default function HomePage() {
  const [started,        setStarted]        = useState(false)
  const [messages,       setMessages]       = useState<Message[]>([])
  const [isLoading,      setIsLoading]      = useState(false)
  const [snapshot,       setSnapshot]       = useState<ProjectSnapshot | null>(null)
  const [showScope,      setShowScope]      = useState(false)
  const [conversationId, setConversationId] = useState<string>('')
  const [placeholder,    setPlaceholder]    = useState(PLACEHOLDERS[0])
  const [phaseIdx,       setPhaseIdx]       = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      setPhaseIdx((i) => {
        const next = (i + 1) % PLACEHOLDERS.length
        setPlaceholder(PLACEHOLDERS[next])
        return next
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

      const res = await fetch('/api/chat', {
        method: 'POST',
        body,
        signal: abortRef.current.signal,
      })

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
                setMessages((prev) =>
                  prev.map((m) => m.id === assistantId ? { ...m, content: m.content + parsed.text } : m)
                )
              }
              if (parsed.type === 'snapshot') setSnapshot(parsed.snapshot)
              if (parsed.type === 'conversationId') setConversationId(parsed.conversationId)
            } catch { /* skip */ }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setMessages((prev) => [...prev, {
        id: uuidv4(), role: 'assistant',
        content: "Something went wrong on our end. Please refresh and try again in a moment.",
      }])
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
  }

  return (
    <>
      <Nav />
      <main style={{ display: 'flex', height: '100vh', paddingTop: 56, overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', transition: 'all 0.4s ease', minWidth: 0 }}>

          {/* Messages / Hero */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {!started ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: '8vh' }}>
                <LandingHero />
              </div>
            ) : (
              <MessageList messages={messages} isLoading={isLoading} />
            )}
          </div>

          {/* Input — 30px from bottom when in chat */}
          <div style={{ paddingBottom: started ? 30 : 0 }}>
            <ChatInput
              onSend={sendMessage}
              onNewProject={handleNewProject}
              isLoading={isLoading}
              started={started}
              placeholder={placeholder}
            />
          </div>
        </div>

        {/* Scope panel */}
        {showScope && snapshot && (
          <div style={{
            width: 400, borderLeft: '0.5px solid var(--ps-border)',
            overflowY: 'auto', flexShrink: 0, animation: 'slideLeft 0.4s ease-out',
          }}>
            <ScopePanel snapshot={snapshot} conversationId={conversationId} />
          </div>
        )}
      </main>
    </>
  )
}

function LandingHero() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 24px 24px', gap: 10, textAlign: 'center' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 400, color: 'var(--ps-white)', margin: 0, lineHeight: 1.2 }}>
        Scope. Pair. Create.
      </h1>
      <p style={{ fontSize: 16, color: 'var(--ps-muted)', margin: 0 }}>
        Fabrication, shipping, installation, and more.
      </p>
    </div>
  )
}
