-- ============================================================
-- Pairascope — Supabase Schema
-- Run this in the Supabase SQL editor (project → SQL Editor)
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── conversations ─────────────────────────────────────────────────────────
create table conversations (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table conversations enable row level security;

-- Anon can insert (pre-auth conversations)
create policy "anon can insert conversations"
  on conversations for insert to anon
  with check (true);

-- Users can read their own conversations
create policy "users can read own conversations"
  on conversations for select using (
    auth.uid() = user_id or user_id is null
  );

-- Service role has full access (used by backend)
create policy "service role full access conversations"
  on conversations for all to service_role
  using (true) with check (true);

-- ── messages ──────────────────────────────────────────────────────────────
create table messages (
  id               uuid primary key default uuid_generate_v4(),
  conversation_id  uuid not null references conversations(id) on delete cascade,
  role             text not null check (role in ('user', 'assistant')),
  content          text not null,
  created_at       timestamptz not null default now()
);

alter table messages enable row level security;

create policy "service role full access messages"
  on messages for all to service_role
  using (true) with check (true);

create policy "users can read own messages"
  on messages for select using (
    exists (
      select 1 from conversations c
      where c.id = conversation_id
      and (c.user_id = auth.uid() or c.user_id is null)
    )
  );

-- ── project_snapshots ─────────────────────────────────────────────────────
create table project_snapshots (
  id               uuid primary key default uuid_generate_v4(),
  conversation_id  uuid not null unique references conversations(id) on delete cascade,
  project_type     text,
  material         text,
  scale            text,
  location         text,
  services         text[],
  missing_info     text[],
  budget_range     text,
  timeline         text,
  confidence_level text not null default 'red' check (confidence_level in ('red', 'yellow', 'green')),
  confidence_score numeric not null default 0,
  ai_summary       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table project_snapshots enable row level security;

create policy "service role full access snapshots"
  on project_snapshots for all to service_role
  using (true) with check (true);

create policy "users can read own snapshots"
  on project_snapshots for select using (
    exists (
      select 1 from conversations c
      where c.id = conversation_id
      and (c.user_id = auth.uid() or c.user_id is null)
    )
  );

-- ── files ─────────────────────────────────────────────────────────────────
create table files (
  id              uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  path            text not null,
  mime_type       text not null,
  size            bigint not null,
  original_name   text,
  created_at      timestamptz not null default now()
);

alter table files enable row level security;

create policy "service role full access files"
  on files for all to service_role
  using (true) with check (true);

-- ── Storage bucket ─────────────────────────────────────────────────────────
-- Run this separately in Supabase Storage settings, or via the dashboard:
-- Create a bucket named "uploads" with public access = false

-- ── Indexes ────────────────────────────────────────────────────────────────
create index on messages (conversation_id);
create index on project_snapshots (conversation_id);
create index on files (conversation_id);
create index on conversations (user_id);
