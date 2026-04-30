'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AuthModal from '@/components/ui/AuthModal'
import type { ProjectSnapshot, ConfidenceLevel } from '@/types'

interface ScopePanelProps {
  snapshot:       ProjectSnapshot
  conversationId: string
}

export default function ScopePanel({ snapshot, conversationId }: ScopePanelProps) {
  const router = useRouter()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [isBlurred,     setIsBlurred]     = useState(false)
  const [user,          setUser]          = useState<boolean | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(!!data.session?.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(!!session?.user)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Auto-show login modal when scope turns green and user is not logged in
  useEffect(() => {
    if (snapshot.confidenceLevel === 'green' && user === false) {
      setShowAuthModal(true)
    }
  }, [snapshot.confidenceLevel, user])

  const handleGenerateRFQ = () => {
    if (!user) {
      setShowAuthModal(true)
      return
    }
    try {
      sessionStorage.setItem('ps_scope_editor', JSON.stringify({
        snapshot,
        scopeDocument: buildScopeDocument(),
        conversationId,
      }))
    } catch { /* ignore */ }
    router.push('/scope-editor')
  }

  const handleSeeVendors = () => {
    if (user) {
      router.push(`/vendors?conversationId=${conversationId}&fromScope=true`)
    } else {
      setTimeout(() => { setIsBlurred(true); setShowAuthModal(true) }, 5000)
      router.push(`/vendors?conversationId=${conversationId}&fromScope=true`)
    }
  }

  const handleAuthSuccess = () => {
    setShowAuthModal(false)
    setIsBlurred(false)
    handleGenerateRFQ()
  }

  const buildScopeDocument = () => {
    const lines: string[] = []
    if (snapshot.aiSummary) {
      lines.push('PROJECT OVERVIEW')
      lines.push('────────────────')
      lines.push(snapshot.aiSummary)
      lines.push('')
    }
    lines.push('SCOPE DETAILS')
    lines.push('────────────────')
    if (snapshot.projectType)  lines.push(`Type: ${snapshot.projectType}`)
    if (snapshot.material)     lines.push(`Material: ${snapshot.material}`)
    if (snapshot.scale)        lines.push(`Scale: ${snapshot.scale}`)
    if (snapshot.location)     lines.push(`Location: ${snapshot.location}`)
    if (snapshot.services?.length) lines.push(`Services: ${snapshot.services.join(', ')}`)
    if (snapshot.timeline)     lines.push(`Timeline: ${snapshot.timeline}`)
    if (snapshot.budgetRange)  lines.push(`Budget Range: ${snapshot.budgetRange}`)
    if (snapshot.finish)       lines.push(`Finish: ${snapshot.finish}`)
    if (snapshot.siteConditions) lines.push(`Site Conditions: ${snapshot.siteConditions}`)
    if (snapshot.structuralRequirements) lines.push(`Structural Requirements: ${snapshot.structuralRequirements}`)
    if (snapshot.missingInfo?.length) {
      lines.push('')
      lines.push('OPEN QUESTIONS')
      lines.push('────────────────')
      snapshot.missingInfo.forEach((item) => lines.push(`• ${item}`))
    }
    lines.push('')
    lines.push('REQUEST')
    lines.push('────────────────')
    lines.push('Please provide:')
    lines.push('• A rough order of magnitude (ROM) price or proposal')
    lines.push('• Estimated timeline from kickoff to completion')
    lines.push('• Key assumptions and exclusions')
    lines.push('• Any concerns or clarifying questions')
    return lines.join('\n')
  }

  return (
    <>
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        backgroundColor: 'var(--ps-bg)',
        filter: isBlurred ? 'blur(4px)' : 'none',
        transition: 'filter 0.3s ease',
        pointerEvents: isBlurred ? 'none' : 'auto',
      }}>
        <div style={{ padding: '20px 20px 16px', borderBottom: '0.5px solid var(--ps-border)', flexShrink: 0 }}>
          <p style={{ fontSize: 11, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>
            Scope review
          </p>
          <ConfidenceDial level={snapshot.confidenceLevel} score={snapshot.confidenceScore} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <SnapshotFields snapshot={snapshot} />
        </div>

        {snapshot.confidenceLevel === 'green' && (
          <div style={{ padding: '16px 20px', borderTop: '0.5px solid var(--ps-border)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={handleGenerateRFQ}
              style={{ width: '100%', padding: '12px 20px', backgroundColor: 'var(--ps-teal)', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s ease' }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              Generate RFQ →
            </button>

            {!user && (
              <p style={{ fontSize: 11, color: 'var(--ps-muted)', textAlign: 'center', margin: 0 }}>
                Sign in to generate an RFQ and save your project.
              </p>
            )}
          </div>
        )}
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => { setShowAuthModal(false); setIsBlurred(false) }}
        onSuccess={handleAuthSuccess}
        message="Sign in to generate an RFQ and send it to matched vendors."
      />
    </>
  )
}

const LEVEL_CONFIG: Record<ConfidenceLevel, { label: string; color: string; bg: string; description: string }> = {
  red:    { label: 'Needs more info', color: '#E24B4A', bg: 'rgba(226,75,74,0.12)',   description: 'Keep describing your project — the more detail, the better.' },
  yellow: { label: 'Getting there',   color: '#EF9F27', bg: 'rgba(239,159,39,0.12)', description: 'Good progress. A few more details will sharpen the scope.' },
  green:  { label: 'Vendor ready',    color: '#1D9E75', bg: 'rgba(29,158,117,0.12)', description: 'Your project is well-defined. Ready to generate an RFQ.' },
}

function ConfidenceDial({ level, score }: { level: ConfidenceLevel; score: number }) {
  const config = LEVEL_CONFIG[level]
  const r = 28, cx = 40, cy = 40
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ * 0.75
  const gap  = circ - dash

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ position: 'relative', width: 60, height: 60, flexShrink: 0 }}>
        <svg width="60" height="60" viewBox="0 0 80 80" style={{ transform: 'rotate(135deg)' }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" strokeDasharray={`${circ * 0.75} ${circ}`} strokeLinecap="round" />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={config.color} strokeWidth="7" strokeDasharray={`${dash} ${gap + circ * 0.25}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        </svg>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 12, fontWeight: 500, color: config.color }}>
          {Math.round(score)}
        </div>
      </div>
      <div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, backgroundColor: config.bg, borderRadius: 6, padding: '3px 8px', marginBottom: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: config.color, display: 'inline-block' }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: config.color }}>{config.label}</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--ps-muted)', margin: 0, lineHeight: 1.5 }}>{config.description}</p>
      </div>
    </div>
  )
}

function SnapshotFields({ snapshot }: { snapshot: ProjectSnapshot }) {
  const fields: { label: string; value: string | string[] | undefined }[] = [
    { label: 'Project type', value: snapshot.projectType },
    { label: 'Material',     value: snapshot.material },
    { label: 'Scale',        value: snapshot.scale },
    { label: 'Location',     value: snapshot.location },
    { label: 'Services',     value: snapshot.services },
    { label: 'Timeline',     value: snapshot.timeline },
    { label: 'Budget range', value: snapshot.budgetRange },
  ]
  const missing = snapshot.missingInfo ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {fields.map(({ label, value }) => {
        const display = Array.isArray(value) ? value.join(', ') : value
        return (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', padding: '10px 0', borderBottom: '0.5px solid var(--ps-border)' }}>
            <span style={{ fontSize: 11, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>{label}</span>
            <span style={{ fontSize: 13, color: display ? 'var(--ps-text)' : 'rgba(136,135,128,0.4)', fontStyle: display ? 'normal' : 'italic' }}>
              {display || 'Not yet defined'}
            </span>
          </div>
        )
      })}
      {missing.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 11, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Still needed</p>
          {missing.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 7, fontSize: 12, color: 'var(--ps-muted)', marginBottom: 4 }}>
              <span style={{ color: '#EF9F27', flexShrink: 0 }}>·</span>{item}
            </div>
          ))}
        </div>
      )}
      {snapshot.aiSummary && (
        <div style={{ marginTop: 16, padding: '12px 14px', backgroundColor: 'var(--ps-surface)', borderRadius: 8, border: '0.5px solid var(--ps-border)' }}>
          <p style={{ fontSize: 11, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Summary</p>
          <p style={{ fontSize: 13, color: 'var(--ps-text)', lineHeight: 1.6, margin: 0 }}>{snapshot.aiSummary}</p>
        </div>
      )}
    </div>
  )
}
