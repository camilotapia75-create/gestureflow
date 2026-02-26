'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Settings,
  Flame,
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
  const [stats, setStats] = useState<StoredStats | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    setStats(loadStats());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const greeting = (() => {
    const h = now.getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  // Build mock weekly activity (last 7 session impacts or zeros)
  const weekActivity = Array.from({ length: 7 }, (_, i) => {
    const s = stats?.sessions[stats.sessions.length - 7 + i];
    return s ? s.impact : 0;
  });
  const maxActivity = Math.max(...weekActivity, 1);

  const recentSessions = stats?.sessions.slice(-3).reverse() ?? [];

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
            <button
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(18,18,40,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <Bell size={18} className="text-gray-400" />
            </button>
            <button
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(18,18,40,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <Settings size={18} className="text-gray-400" />
            </button>
          </div>
        </motion.div>

        {/* ── Stats grid ── */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <StatCard
            icon={Flame}
            label="Gestures"
            value={stats?.totalGestures ?? 0}
            color="#ff6600"
            delay={0.1}
          />
          <StatCard
            icon={Star}
            label="Best Impact"
            value={stats?.bestImpact ?? 0}
            unit="%"
            color="#ffaa00"
            delay={0.15}
          />
          <StatCard
            icon={Clock}
            label="Total Time"
            value={formatTime(stats?.totalTime ?? 0)}
            color="#00f0ff"
            delay={0.2}
          />
          <StatCard
            icon={Zap}
            label="Best Streak"
            value={stats?.bestStreak ?? 0}
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
              <span>{stats?.totalSessions ?? 0} sessions</span>
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
              <span className="text-xs text-gray-500">{stats?.totalSessions ?? 0} total</span>
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
