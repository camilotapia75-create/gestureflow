/**
 * Supabase database helpers for GestureFlow.
 *
 * All queries are scoped to the authenticated user via Row Level Security —
 * a user can only ever read/write their own session rows.  No server-side
 * compute is needed for this app; ML runs entirely in the browser.
 */
import { createClient } from '@/lib/supabase';

export interface DbSession {
  id: string;
  created_at: string;
  duration: number;
  gestures: number;
  best_streak: number;
  peak_impact: number;
  smile_count: number;
  slouch_count: number;
  good_posture_seconds: number;
}

export interface UserStats {
  totalSessions: number;
  totalTime: number;
  bestImpact: number;
  bestStreak: number;
  totalGestures: number;
}

/** Save a completed session for the signed-in user.  No-op if unauthenticated. */
export async function saveSessionToDb(session: {
  duration: number;
  gestures: number;
  bestStreak: number;
  peakImpact: number;
  smileCount: number;
  slouchCount: number;
  goodPostureSeconds: number;
}): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('sessions').insert({
    user_id:              user.id,
    duration:             session.duration,
    gestures:             session.gestures,
    best_streak:          session.bestStreak,
    peak_impact:          session.peakImpact,
    smile_count:          session.smileCount,
    slouch_count:         session.slouchCount,
    good_posture_seconds: session.goodPostureSeconds,
  });
}

/** Load up to 50 most-recent sessions for the signed-in user. */
export async function loadSessionsFromDb(): Promise<DbSession[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  return (data ?? []) as DbSession[];
}

/** Aggregate stats for the signed-in user.  Returns null if unauthenticated. */
export async function loadUserStats(): Promise<UserStats | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('sessions')
    .select('duration, gestures, best_streak, peak_impact');
  if (!data || data.length === 0) return null;

  return {
    totalSessions:  data.length,
    totalTime:      data.reduce((s, r) => s + r.duration,   0),
    bestImpact:     Math.max(...data.map((r) => r.peak_impact)),
    bestStreak:     Math.max(...data.map((r) => r.best_streak)),
    totalGestures:  data.reduce((s, r) => s + r.gestures,   0),
  };
}
