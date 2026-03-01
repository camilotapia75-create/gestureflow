'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Cloud,
  CloudOff,
  Flame,
  LogIn,
  LogOut,
  Star,
  Clock,
  Zap,
  ChevronRight,
  Activity,
  TrendingUp,
  Play,
  type LucideIcon,
} from 'lucide-react';
import { loadStats, formatTime, StoredStats } from '@/lib/storage';
import { loadUserStats, loadSessionsFromDb, type DbSession } from '@/lib/db';
import { useUser } from '@/hooks/useUser';
import { createClient } from '@/lib/supabase';

// ── Stat Card ─────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  unit,
  color,
  delay,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  unit?: string;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
      className="rounded-2xl p-4 flex flex-col gap-1.5 relative overflow-hidden"
      style={{
        background: 'rgba(18,18,40,0.8)',
        border: `1px solid ${color}22`,
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Glow blob */}
      <div
        className="absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-20"
        style={{ background: color, filter: 'blur(16px)' }}
      />
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center"
        style={{ background: `${color}18`, border: `1px solid ${color}30` }}
      >
        <Icon size={18} style={{ color }} />
      </div>
      <div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-black text-white leading-none">{value}</span>
          {unit && <span className="text-xs font-medium" style={{ color }}>{unit}</span>}
        </div>
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">{label}</span>
      </div>
    </motion.div>
  );
}

// ── Activity Bar ──────────────────────────────────────────────────────────
function ActivityBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="w-5 h-16 rounded-full bg-gray-800 relative overflow-hidden">
        <motion.div
          className="absolute bottom-0 left-0 right-0 rounded-full"
          style={{ background: 'linear-gradient(180deg, #00f0ff, #7b2fff)' }}
          initial={{ height: '0%' }}
          animate={{ height: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <span className="text-[10px] text-gray-600">{value}</span>
    </div>
  );
}

// ── Recent Session Row ────────────────────────────────────────────────────
function SessionRow({ date, impact, duration }: { date: string; impact: number; duration: number; }) {
  const d = new Date(date);
  const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return (
    <div
      className="flex items-center justify-between px-4 py-3 rounded-2xl"
      style={{ background: 'rgba(18,18,40,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(0,240,255,0.1)' }}
        >
          <Activity size={16} style={{ color: '#00f0ff' }} />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="text-xs text-gray-500">{formatTime(duration)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div
          className="px-2.5 py-1 rounded-lg text-xs font-bold"
          style={{
            background: impact >= 80 ? 'rgba(0,240,255,0.15)' : 'rgba(255,255,255,0.06)',
            color: impact >= 80 ? '#00f0ff' : '#888',
          }}
        >
          {impact}%
        </div>
        <ChevronRight size={14} className="text-gray-600" />
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();

  // Local stats (always available, used as fallback when signed out)
  const [localStats, setLocalStats] = useState<StoredStats | null>(null);

  // Cloud stats (used when signed in)
  const [cloudSessions, setCloudSessions] = useState<DbSession[] | null>(null);
  const [cloudLoading, setCloudLoading] = useState(false);

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    setLocalStats(loadStats());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Fetch cloud sessions whenever auth state changes
  useEffect(() => {
    if (!user) { setCloudSessions(null); return; }
    setCloudLoading(true);
    loadSessionsFromDb()
      .then((rows) => setCloudSessions(rows))
      .finally(() => setCloudLoading(false));
  }, [user]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
  }

  const greeting = (() => {
    const h = now.getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  // Aggregate stats: prefer cloud when signed in, fall back to localStorage
  const stats = localStats; // always used for week chart (localStorage)
  const totalGestures = user && cloudSessions
    ? cloudSessions.reduce((s, r) => s + r.gestures, 0)
    : localStats?.totalGestures ?? 0;
  const bestImpact = user && cloudSessions && cloudSessions.length > 0
    ? Math.max(...cloudSessions.map((r) => r.peak_impact))
    : localStats?.bestImpact ?? 0;
  const totalTime = user && cloudSessions
    ? cloudSessions.reduce((s, r) => s + r.duration, 0)
    : localStats?.totalTime ?? 0;
  const bestStreak = user && cloudSessions && cloudSessions.length > 0
    ? Math.max(...cloudSessions.map((r) => r.best_streak))
    : localStats?.bestStreak ?? 0;

  // Weekly activity bar chart — last 7 local sessions (quick, no async)
  const weekActivity = Array.from({ length: 7 }, (_, i) => {
    const s = stats?.sessions[( stats.sessions.length - 7 + i)];
    return s ? s.impact : 0;
  });
  const maxActivity = Math.max(...weekActivity, 1);
  const totalSessions = user && cloudSessions ? cloudSessions.length : localStats?.totalSessions ?? 0;

  // Recent sessions list
  const recentSessions = user && cloudSessions
    ? cloudSessions.slice(0, 3).map((r) => ({
        id: r.id,
        date: r.created_at,
        impact: r.peak_impact,
        duration: r.duration,
      }))
    : (localStats?.sessions.slice(-3).reverse() ?? []).map((r) => ({
        id: r.id,
        date: r.date,
        impact: r.peakImpact,
        duration: r.duration,
      }));

  return (
    <div className="page-scroll cyber-bg scanline">
      <div className="min-h-full px-5 pt-safe pb-8 flex flex-col">

        {/* ── Top bar ── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-between pt-4 mb-6"
        >
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              <span style={{ color: '#00f0ff', textShadow: '0 0 12px #00f0ff55' }}>Gesture</span>
              Flow
            </h1>
            <p className="text-gray-500 text-xs mt-0.5">{greeting} 👋</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Cloud sync status indicator */}
            {!userLoading && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold"
                style={{
                  background: user ? 'rgba(0,255,136,0.08)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${user ? 'rgba(0,255,136,0.2)' : 'rgba(255,255,255,0.07)'}`,
                  color: user ? '#00ff88' : '#444466',
                }}
              >
                {user ? <Cloud size={12} /> : <CloudOff size={12} />}
                {user ? 'Synced' : 'Local'}
              </div>
            )}
            {/* Sign in / out */}
            {!userLoading && (
              user
                ? <button
                    onClick={handleSignOut}
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(18,18,40,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}
                    title="Sign out"
                  >
                    <LogOut size={16} className="text-gray-400" />
                  </button>
                : <button
                    onClick={() => router.push('/auth')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold"
                    style={{
                      background: 'rgba(0,240,255,0.1)',
                      border: '1px solid rgba(0,240,255,0.2)',
                      color: '#00f0ff',
                    }}
                  >
                    <LogIn size={13} />
                    Sign In
                  </button>
            )}
          </div>
        </motion.div>

        {/* Cloud sync prompt (signed-out users) */}
        {!userLoading && !user && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => router.push('/auth')}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-4 w-full text-left"
            style={{
              background: 'rgba(0,240,255,0.04)',
              border: '1px solid rgba(0,240,255,0.12)',
            }}
          >
            <Cloud size={18} style={{ color: '#00f0ff', flexShrink: 0 }} />
            <div>
              <p className="text-xs font-bold text-white">Sync progress across devices</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Sign in to save your history to the cloud</p>
            </div>
            <ChevronRight size={14} className="text-gray-600 ml-auto flex-shrink-0" />
          </motion.button>
        )}

        {/* ── Stats grid ── */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <StatCard
            icon={Flame}
            label="Gestures"
            value={cloudLoading ? '…' : totalGestures}
            color="#ff6600"
            delay={0.1}
          />
          <StatCard
            icon={Star}
            label="Best Impact"
            value={cloudLoading ? '…' : bestImpact}
            unit="%"
            color="#ffaa00"
            delay={0.15}
          />
          <StatCard
            icon={Clock}
            label="Total Time"
            value={cloudLoading ? '…' : formatTime(totalTime)}
            color="#00f0ff"
            delay={0.2}
          />
          <StatCard
            icon={Zap}
            label="Best Streak"
            value={cloudLoading ? '…' : bestStreak}
            unit="s"
            color="#7b2fff"
            delay={0.25}
          />
        </div>

        {/* ── Weekly activity ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl p-4 mb-4"
          style={{ background: 'rgba(18,18,40,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-white">This Week</span>
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#00f0ff' }}>
              <TrendingUp size={13} />
              <span>{totalSessions} sessions</span>
            </div>
          </div>
          <div className="flex items-end justify-between gap-2">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
              <div key={i} className="flex flex-col items-center gap-1 flex-1">
                <ActivityBar value={weekActivity[i]} max={maxActivity} />
                <span className="text-[10px] text-gray-600">{day}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Recent sessions ── */}
        {recentSessions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mb-6"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-white">Recent Sessions</span>
              <span className="text-xs text-gray-500">{totalSessions} total</span>
            </div>
            <div className="space-y-2">
              {recentSessions.map((s) => (
                <SessionRow key={s.id} date={s.date} impact={s.impact} duration={s.duration} />
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Spacer ── */}
        <div className="flex-1" />

        {/* ── CTA ── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, type: 'spring', damping: 20 }}
        >
          {/* Tips teaser */}
          <div
            className="rounded-2xl p-4 mb-4 flex items-center gap-3"
            style={{
              background: 'linear-gradient(135deg, rgba(0,240,255,0.08), rgba(255,0,204,0.06))',
              border: '1px solid rgba(0,240,255,0.15)',
            }}
          >
            <span className="text-2xl">💡</span>
            <p className="text-sm text-gray-300 leading-snug">
              <strong className="text-white">Pro tip:</strong> Open gestures with palms facing out build 40% more audience trust.
            </p>
          </div>

          {/* Start button */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push('/practice')}
            className="w-full py-5 rounded-3xl flex items-center justify-center gap-3 font-black text-xl text-[#050510] relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #00f0ff 0%, #7b2fff 60%, #ff00cc 100%)',
              boxShadow: '0 0 30px rgba(0,240,255,0.4), 0 8px 32px rgba(0,0,0,0.4)',
            }}
          >
            {/* Shimmer overlay */}
            <motion.div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.25) 50%, transparent 60%)',
                backgroundSize: '200% 100%',
              }}
              animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
            />
            <Play size={22} className="relative z-10" />
            <span className="relative z-10 tracking-wide">Start Practice</span>
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
