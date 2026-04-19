# Pairascope

**Scope. Pair. Create.**

AI-powered platform that turns art concepts into buildable, scoped projects and connects artists with the right fabricators, shippers, and installers.

---

## Stack

- **Frontend** — Next.js 14, TypeScript, Tailwind CSS, App Router
- **AI** — Anthropic API (claude-sonnet for conversation, claude-haiku for extraction)
- **Database** — Supabase (Postgres + Auth + Storage)
- **CRM** — Airtable (Projects, Vendors, RFQs, Bids, Deals, Knowledge Hub)
- **Email** — Gmail (manual Phase 1, nodemailer for admin errors)
- **Hosting** — Vercel

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.local` and fill in all values:

```bash
# Anthropic — console.anthropic.com
ANTHROPIC_API_KEY=

# Supabase — app.supabase.com → project → settings → API
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Airtable — airtable.com/create/tokens
AIRTABLE_API_KEY=
AIRTABLE_BASE_ID=appXCamQTyaOhuqn9

# Gmail — use App Password (not your regular password)
GMAIL_USER=pairascope.projects@gmail.com
GMAIL_APP_PASSWORD=
ADMIN_EMAIL=pairascope.projects@gmail.com
```

### 3. Set up Supabase

1. Go to your Supabase project → SQL Editor
2. Paste and run the contents of `supabase/schema.sql`
3. Go to Storage → Create bucket named `uploads` (private)

### 4. Set up Gmail App Password

1. Go to myaccount.google.com → Security → 2-Step Verification → App Passwords
2. Generate a password for "Mail"
3. Add it as `GMAIL_APP_PASSWORD` in `.env.local`

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project structure

```
pairascope/
├── app/
│   ├── page.tsx              # Landing page + chat (Screen 1 & 2)
│   ├── how-it-works/         # How it works (Screen nav)
│   ├── vendors/              # Vendor comparison (Screen 5)
│   ├── rfq-hub/              # RFQ tracking (Screen 4)
│   ├── auth/                 # Sign in / sign up
│   └── api/
│       ├── chat/             # Streaming Claude API + Supabase save
│       ├── vendors/          # Vendor data from Airtable
│       └── save-project/     # File upload to Supabase Storage
├── components/
│   ├── ui/                   # Logo, Nav
│   ├── chat/                 # MessageList, ChatInput
│   └── scope/                # ScopePanel (Screen 3)
├── lib/
│   ├── supabase.ts           # Supabase clients
│   ├── airtable.ts           # Airtable helpers
│   ├── email.ts              # Admin error emails
│   └── prompt.ts             # System prompt + extraction prompt
├── types/
│   └── index.ts              # Shared TypeScript types
└── supabase/
    └── schema.sql            # Run this in Supabase SQL editor
```

---

## Deploying to Vercel

1. Push to GitHub
2. Connect repo in Vercel
3. Add all environment variables in Vercel project settings
4. Deploy from `main` branch

---

## Airtable base

Base ID: `appXCamQTyaOhuqn9`

Tables: Projects, Vendors, RFQs, Responses, Deals, Knowledge Hub, Error Log

**Vendor matching workflow (Phase 1 — manual):**
1. Review new project in Airtable Projects table
2. Open Vendors table, find suitable vendors
3. Go back to Projects → open the record → add vendors to "Assigned Vendors" field
4. Set Status to "Vendors Assigned"
5. The site will surface these vendors on the artist's recommended vendors screen
