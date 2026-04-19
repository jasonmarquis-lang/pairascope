'use client'

import { useRouter } from 'next/navigation'
import type { ProjectSnapshot, ConfidenceLevel } from '@/types'

interface ScopePanelProps {
  snapshot:       ProjectSnapshot
  conversationId: string
}

export default function ScopePanel({ snapshot, conversationId }: ScopePanelProps) {
  const router = useRouter()

  const handleSeeVendors = () => {
    router.push(`/vendors?conversationId=${conversationId}`)
  }

  return (
    <div
      style={{
        height:        '100%',
        display:       'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--ps-bg)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding:      '20px 20px 16px',
          borderBottom: '0.5px solid var(--ps-border)',
          flexShrink:   0,
        }}
      >
        <p style={{ fontSize: 11, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>
          Scope review
        </p>
        <ConfidenceDial level={snapshot.confidenceLevel} score={snapshot.confidenceScore} />
      </div>

      {/* Snapshot fields */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        <SnapshotFields snapshot={snapshot} />
      </div>

      {/* CTA — only shown when green */}
      {snapshot.confidenceLevel === 'green' && (
        <div
          style={{
            padding:    '16px 20px',
            borderTop:  '0.5px solid var(--ps-border)',
            flexShrink: 0,
          }}
        >
          <button
            onClick={handleSeeVendors}
            style={{
              width:           '100%',
              padding:         '12px 20px',
              backgroundColor: 'var(--ps-teal)',
              color:           'white',
              border:          'none',
              borderRadius:    10,
              fontSize:        14,
              fontWeight:      500,
              cursor:          'pointer',
              fontFamily:      'inherit',
              transition:      'opacity 0.15s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            See recommended vendors →
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Confidence Dial ───────────────────────────────────────────────────────

const LEVEL_CONFIG: Record<ConfidenceLevel, { label: string; color: string; bg: string; description: string }> = {
  red: {
    label:       'Needs more info',
    color:       '#E24B4A',
    bg:          'rgba(226,75,74,0.12)',
    description: 'Keep describing your project — the more detail, the better.',
  },
  yellow: {
    label:       'Getting there',
    color:       '#EF9F27',
    bg:          'rgba(239,159,39,0.12)',
    description: "Good progress. A few more details will sharpen the scope.",
  },
  green: {
    label:       'Vendor ready',
    color:       '#1D9E75',
    bg:          'rgba(29,158,117,0.12)',
    description: 'Your project is well-defined. Ready to match with vendors.',
  },
}

function ConfidenceDial({ level, score }: { level: ConfidenceLevel; score: number }) {
  const config = LEVEL_CONFIG[level]

  // SVG arc parameters
  const r     = 28
  const cx    = 40
  const cy    = 40
  const circ  = 2 * Math.PI * r
  const dash  = (score / 100) * circ * 0.75 // 270 degree arc
  const gap   = circ - dash

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      {/* Arc dial */}
      <div style={{ position: 'relative', width: 60, height: 60, flexShrink: 0 }}>
        <svg width="60" height="60" viewBox="0 0 80 80" style={{ transform: 'rotate(135deg)' }}>
          {/* Track */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="7"
            strokeDasharray={`${circ * 0.75} ${circ}`}
            strokeLinecap="round"
          />
          {/* Progress */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={config.color}
            strokeWidth="7"
            strokeDasharray={`${dash} ${gap + circ * 0.25}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
        </svg>
        {/* Score label */}
        <div
          style={{
            position:  'absolute',
            top:       '50%',
            left:      '50%',
            transform: 'translate(-50%, -50%)',
            fontSize:  12,
            fontWeight: 500,
            color:     config.color,
          }}
        >
          {Math.round(score)}
        </div>
      </div>

      {/* Label + description */}
      <div>
        <div
          style={{
            display:         'inline-flex',
            alignItems:      'center',
            gap:             5,
            backgroundColor: config.bg,
            borderRadius:    6,
            padding:         '3px 8px',
            marginBottom:    4,
          }}
        >
          <span
            style={{
              width:        6,
              height:       6,
              borderRadius: '50%',
              backgroundColor: config.color,
              display:      'inline-block',
              flexShrink:   0,
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 500, color: config.color }}>
            {config.label}
          </span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--ps-muted)', margin: 0, lineHeight: 1.5 }}>
          {config.description}
        </p>
      </div>
    </div>
  )
}

// ─── Snapshot field rows ───────────────────────────────────────────────────

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
          <div
            key={label}
            style={{
              display:       'flex',
              flexDirection: 'column',
              padding:       '10px 0',
              borderBottom:  '0.5px solid var(--ps-border)',
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>
              {label}
            </span>
            <span style={{ fontSize: 13, color: display ? 'var(--ps-text)' : 'rgba(136,135,128,0.4)', fontStyle: display ? 'normal' : 'italic' }}>
              {display || 'Not yet defined'}
            </span>
          </div>
        )
      })}

      {/* Missing info */}
      {missing.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 11, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
            Still needed
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {missing.map((item, i) => (
              <div
                key={i}
                style={{
                  display:         'flex',
                  alignItems:      'flex-start',
                  gap:             7,
                  fontSize:        12,
                  color:           'var(--ps-muted)',
                }}
              >
                <span style={{ color: '#EF9F27', marginTop: 2, flexShrink: 0 }}>·</span>
                {item}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI summary */}
      {snapshot.aiSummary && (
        <div
          style={{
            marginTop:       16,
            padding:         '12px 14px',
            backgroundColor: 'var(--ps-surface)',
            borderRadius:    8,
            border:          '0.5px solid var(--ps-border)',
          }}
        >
          <p style={{ fontSize: 11, color: 'var(--ps-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
            Summary
          </p>
          <p style={{ fontSize: 13, color: 'var(--ps-text)', lineHeight: 1.6, margin: 0 }}>
            {snapshot.aiSummary}
          </p>
        </div>
      )}
    </div>
  )
}
