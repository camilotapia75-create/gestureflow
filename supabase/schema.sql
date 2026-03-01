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
