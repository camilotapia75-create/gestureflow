-- ============================================================
-- GestureFlow — Supabase database schema
-- Run this once in: https://app.supabase.com/project/_/sql/new
-- ============================================================

-- Sessions table: one row per completed practice session.
-- All ML computation happens client-side; we only store lightweight metrics.
CREATE TABLE IF NOT EXISTS public.sessions (
  id                    UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration              INTEGER     NOT NULL DEFAULT 0,   -- seconds
  gestures              INTEGER     NOT NULL DEFAULT 0,   -- power-move count
  best_streak           INTEGER     NOT NULL DEFAULT 0,   -- seconds
  peak_impact           INTEGER     NOT NULL DEFAULT 0,   -- 0–100
  smile_count           INTEGER     NOT NULL DEFAULT 0,
  slouch_count          INTEGER     NOT NULL DEFAULT 0,
  good_posture_seconds  INTEGER     NOT NULL DEFAULT 0
);

-- Row Level Security: each user can only read and write their own rows.
-- This is the primary data-isolation mechanism — no additional backend needed.
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_sessions"
  ON public.sessions
  FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes for fast per-user history queries
CREATE INDEX IF NOT EXISTS idx_sessions_user_id    ON public.sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON public.sessions (created_at DESC);

-- ── Push notification subscriptions ─────────────────────────────────────────
-- Stores Web Push subscriptions for background reminder notifications.
-- No user_id: reminders work for both guests and signed-in users.
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint      TEXT        NOT NULL UNIQUE,
  p256dh        TEXT        NOT NULL,
  auth_key      TEXT        NOT NULL,
  reminder_time TEXT        NOT NULL,  -- UTC "HH:MM" (e.g. "20:00")
  source        TEXT        NOT NULL DEFAULT 'smile',  -- 'smile' | 'office'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- No RLS needed: rows contain no personal data, only browser-generated push endpoints.
-- The service role key (server-only) is required to read/write this table.
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically — no explicit policy needed for server writes.
-- Allow no public client access (security by default).

CREATE INDEX IF NOT EXISTS idx_push_reminder_time ON public.push_subscriptions (reminder_time);
