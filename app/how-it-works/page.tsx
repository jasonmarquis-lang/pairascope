'use client'

import { useState } from 'react'
import Nav from '@/components/ui/Nav'

export default function HowItWorksPage() {
  return (
    <>
      <Nav />
      <main style={{ paddingTop: 56, minHeight: '100vh' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '64px 24px 80px' }}>
          <div style={{ textAlign: 'center', marginBottom: 72 }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 400, color: 'var(--ps-white)', margin: '0 0 14px' }}>
              How Pairascope works
            </h1>
            <p style={{ fontSize: 16, color: 'var(--ps-muted)', margin: 0, lineHeight: 1.6 }}>
              From early-stage idea to the right team — with clarity at every step.
            </p>
          </div>
          <AudienceSections />
        </div>
      </main>
    </>
  )
}

function AudienceSections() {
  const [active, setActive] = useState<'artists' | 'vendors'>('artists')
  return (
    <>
      <div style={{ display: 'flex', backgroundColor: 'var(--ps-surface)', border: '0.5px solid var(--ps-border)', borderRadius: 10, padding: 4, marginBottom: 48, maxWidth: 320, margin: '0 auto 48px' }}>
        {(['artists', 'vendors'] as const).map((tab) => (
          <button key={tab} onClick={() => setActive(tab)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', backgroundColor: active === tab ? 'var(--ps-bg)' : 'transparent', color: active === tab ? 'var(--ps-white)' : 'var(--ps-muted)', fontSize: 14, fontWeight: active === tab ? 500 : 400, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s ease' }}>
            {tab === 'artists' ? 'For artists' : 'For vendors'}
          </button>
        ))}
      </div>
      {active === 'artists' ? <ArtistContent /> : <VendorContent />}
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 18, fontWeight: 500, color: 'var(--ps-white)', margin: '0 0 14px' }}>{title}</h2>
      {children}
    </div>
  )
}

function Body({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 15, color: 'var(--ps-text)', lineHeight: 1.75, margin: '0 0 10px' }}>{children}</p>
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: '10px 0', padding: '0 0 0 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: 15, color: 'var(--ps-text)', lineHeight: 1.65 }}>{item}</li>
      ))}
    </ul>
  )
}

function Callout({ text }: { text: string }) {
  return (
    <div style={{ borderLeft: '2px solid var(--ps-teal)', paddingLeft: 16, margin: '20px 0', fontSize: 15, color: 'var(--ps-white)', fontStyle: 'italic', lineHeight: 1.65 }}>
      {text}
    </div>
  )
}

function ArtistContent() {
  return (
    <div>
      <Section title="What Pairascope does">
        <Body>Pairascope helps you take an idea and make it real — clearly and confidently. You describe your project — anything from a rough concept to a detailed design.</Body>
        <Body>From there, we help you:</Body>
        <BulletList items={['Understand what it will take to build', "Identify what's missing or unclear", 'Get a realistic sense of cost and approach']} />
      </Section>
      <Section title="Then we connect you to the right team">
        <Body>Instead of reaching out blindly, we match your project with fabricators who are actually suited to the work.</Body>
        <BulletList items={['Structured, comparable proposals', 'Clear scope and assumptions', 'Fewer surprises later']} />
      </Section>
      <Section title="And when you're ready">
        <BulletList items={['Align on scope', 'Secure your project with a deposit', 'Start with the right partner']} />
      </Section>
      <Section title="What you get">
        <BulletList items={['Clarity before you commit', 'Better conversations with fabricators', 'Fewer unknowns', 'More control over your project']} />
      </Section>
      <Callout text="Pairascope helps you go from idea → understanding → execution, without the guesswork." />
    </div>
  )
}

function VendorContent() {
  return (
    <div>
      <Section title="The problem Pairascope solves">
        <Body>You&apos;re great at building complex work. But getting the right projects — and getting them clearly scoped — takes a lot of time.</Body>
        <BulletList items={['Incomplete or unclear project requests', 'Long back-and-forth just to understand scope', 'Pricing work that never moves forward']} />
      </Section>
      <Section title="What Pairascope does">
        <Body>Pairascope sends you better projects, already structured. Before a project reaches you, we:</Body>
        <BulletList items={["Help the artist define what they actually need", 'Identify missing information', 'Clarify scope, scale, and intent']} />
      </Section>
      <Section title="A better way to quote">
        <BulletList items={['A structured RFQ', 'Clearly defined scope and assumptions', 'A clean format for submitting your pricing and timeline']} />
      </Section>
      <Section title="What you get">
        <BulletList items={['Better-qualified leads', 'Clearer scope before pricing', 'Structured proposals', 'Secured deposits at project start']} />
      </Section>
      <Callout text="Pairascope brings you projects that are already scoped — and ready to move forward." />
    </div>
  )
}
