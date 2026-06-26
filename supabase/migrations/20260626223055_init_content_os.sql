-- Content OS v2 — initial schema (T1)
-- Mirrors the frozen contract in src/lib/types.ts / CONTRACT.md.
-- ideas (1) ──< posts (many);  follower_logs = authoritative growth per platform/day.
-- Note: timestamptz columns map to the contract's epoch-ms numbers in the repo
-- layer (T2); follower_logs.date maps to the contract's ISO 'YYYY-MM-DD' string.

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ── ideas ──────────────────────────────────────────────────────────────────
create table if not exists ideas (
  id             uuid primary key default gen_random_uuid(),
  text           text not null,
  status         text not null default 'idea' check (status in ('idea', 'shootable')),
  hook           text,
  caption        text,
  format         text,
  lane           text,                       -- optional, effectively free-text
  draft_link     text,                       -- D9 lightweight media field
  source_idea_id uuid references ideas (id) on delete set null, -- clone provenance
  created_at     timestamptz not null default now()
);

create index if not exists ideas_status_idx      on ideas (status);
create index if not exists ideas_source_idea_idx on ideas (source_idea_id);

-- ── posts ──────────────────────────────────────────────────────────────────
create table if not exists posts (
  id                        uuid primary key default gen_random_uuid(),
  idea_id                   uuid not null references ideas (id) on delete cascade,
  platform                  text not null check (platform in ('tiktok', 'instagram')),
  status                    text not null default 'queued' check (status in ('queued', 'posted')),
  views                     integer,          -- null until logged (~48h, refresh ~7d)
  posted_at                 timestamptz,      -- set when status -> posted
  edit_minutes              integer,          -- optional guardrail metric
  follower_delta_candidate  integer,          -- D5 derived, best-effort; null when ambiguous
  is_winner                 boolean not null default false,
  created_at                timestamptz not null default now()
);

-- per-platform winner queries + queue lookups
create index if not exists posts_platform_status_idx on posts (platform, status);
create index if not exists posts_idea_idx            on posts (idea_id);
create index if not exists posts_platform_posted_idx on posts (platform, posted_at desc);

-- ── follower_logs ──────────────────────────────────────────────────────────
-- Authoritative growth source. One row per (platform, date).
create table if not exists follower_logs (
  id        uuid primary key default gen_random_uuid(),
  platform  text not null check (platform in ('tiktok', 'instagram')),
  date      date not null,
  count     integer not null,
  unique (platform, date)
);

create index if not exists follower_logs_platform_date_idx on follower_logs (platform, date);
