'use client'

import { useState } from 'react'
import Nav from '@/components/ui/Nav'

export default function HowItWorksPage() {
  return (
    <>
      <Nav />
      <main style={{ paddingTop: 56, minHeight: '100vh' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '64px 24px 80px' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
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
      <div style={{ display: 'flex', backgroundColor: 'var(--ps-surface)', border: '0.5px solid var(--ps-border)', borderRadius: 10, padding: 4, marginBottom: 56, maxWidth: 320, margin: '0 auto 56px' }}>
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

function ScreenPlaceholder({ label, accent = false }: { label: string; accent?: boolean }) {
  return (
    <div style={{ width: 220, height: 140, flexShrink: 0, backgroundColor: 'var(--ps-surface)', border: `0.5px solid ${accent ? 'rgba(29,158,117,0.4)' : 'var(--ps-border)'}`, borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 }}>
      <div style={{ width: '100%', height: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, marginBottom: 4 }} />
      <div style={{ width: '80%', height: 6, backgroundColor: accent ? 'rgba(29,158,117,0.3)' : 'rgba(255,255,255,0.06)', borderRadius: 3 }} />
      <div style={{ width: '60%', height: 4, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 3 }} />
      <div style={{ width: '90%', height: 4, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 3 }} />
      <div style={{ width: '70%', height: 4, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 3 }} />
      <p style={{ fontSize: 10, color: 'var(--ps-muted)', margin: '4px 0 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
    </div>
  )
}

function IllustratedSection({ title, children, screenLabel, accent }: { title: string; children: React.ReactNode; screenLabel: string; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', marginBottom: 48, paddingBottom: 48, borderBottom: '0.5px solid var(--ps-border)' }}>
      <div style={{ flex: 1 }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, color: 'var(--ps-white)', margin: '0 0 14px' }}>{title}</h2>
        {children}
      </div>
      <ScreenPlaceholder label={screenLabel} accent={accent} />
    </div>
  )
}

function Body({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 15, color: 'var(--ps-text)', lineHeight: 1.75, margin: '0 0 10px' }}>{children}</p>
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: '10px 0', padding: '0 0 0 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((item, i) => <li key={i} style={{ fontSize: 15, color: 'var(--ps-text)', lineHeight: 1.65 }}>{item}</li>)}
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
      <IllustratedSection title="Describe your project" screenLabel="Landing" accent>
        <Body>Start by describing your project — anything from a rough idea to a detailed design. There&apos;s no form to fill out. Just tell us what you&apos;re working on.</Body>
        <Body>Pairascope&apos;s AI asks focused questions to understand:</Body>
        <BulletList items={['What you&apos;re building and from what material', 'Scale, location, and site conditions', 'Services you need: fabrication, shipping, installation, and more']} />
      </IllustratedSection>
      <IllustratedSection title="Build the scope together" screenLabel="Conversation">
        <Body>As the conversation deepens, Pairascope builds a live project scope alongside your dialogue — identifying what&apos;s clear, what&apos;s missing, and what vendors will need to know.</Body>
        <Body>A confidence indicator shows how ready your project is for vendor engagement.</Body>
      </IllustratedSection>
      <IllustratedSection title="Review your scope" screenLabel="Scope review" accent>
        <Body>Once your project is well-defined, Pairascope generates a structured, vendor-ready scope document — the kind that fabricators can actually price from.</Body>
        <BulletList items={['Scope of work by service type', 'Key assumptions and exclusions', 'Risks and open questions']} />
      </IllustratedSection>
      <IllustratedSection title="Get matched with the right vendors" screenLabel="Vendors">
        <Body>Instead of reaching out blindly, we match your project with fabricators, shippers, and installers who are suited to the work.</Body>
        <BulletList items={['Structured, comparable proposals', 'Clear scope and assumptions sent to each vendor', 'Fewer surprises when bids come back']} />
      </IllustratedSection>
      <Callout text="Pairascope helps you go from idea → understanding → execution, without the guesswork." />
    </div>
  )
}

function VendorContent() {
  return (
    <div>
      <IllustratedSection title="Receive better-scoped projects" screenLabel="RFQ Hub" accent>
        <Body>Instead of vague emails, you receive structured RFQs — projects that have already been scoped and refined through AI-assisted dialogue with the artist.</Body>
        <Body>Before a project reaches you, Pairascope has:</Body>
        <BulletList items={['Helped the artist define what they actually need', 'Identified missing information', 'Clarified scope, scale, materials, and site conditions']} />
      </IllustratedSection>
      <IllustratedSection title="Submit structured proposals" screenLabel="Proposals">
        <Body>Instead of free-form emails, you receive a clear RFQ format and submit your response in a consistent structure — price range, timeline, assumptions, and notes.</Body>
        <BulletList items={['Less back-and-forth to understand scope', 'Faster turnaround on pricing', 'Better alignment with the client before the project starts']} />
      </IllustratedSection>
      <IllustratedSection title="Get matched to the right work" screenLabel="Vendors" accent>
        <Body>We&apos;re not a marketplace that promotes everyone. Projects are matched to vendors based on capabilities, materials, experience, and location.</Body>
        <Body>You&apos;re not competing on everything — just the projects that make sense for your shop.</Body>
      </IllustratedSection>
      <IllustratedSection title="Start projects properly" screenLabel="Scope review">
        <Body>When you&apos;re selected, the scope is already aligned and expectations are clear. Projects start with a secured deposit — so you&apos;re not chasing payment or renegotiating scope before work begins.</Body>
      </IllustratedSection>
      <Callout text="Pairascope brings you projects that are already scoped — and ready to move forward." />
    </div>
  )
}
