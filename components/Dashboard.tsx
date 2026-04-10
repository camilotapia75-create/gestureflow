'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Cloud, CloudOff, LogIn, LogOut,
  Flame, Star, Clock, Zap, TrendingUp,
  Mic, Monitor, Smile, ChevronRight,
  type LucideIcon,
} from 'lucide-react';

import { loadStats, formatTime, StoredStats } from '@/lib/storage';
import { loadSessionsFromDb, type DbSession } from '@/lib/db';
import { useUser } from '@/hooks/useUser';
import { createClient } from '@/lib/supabase';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

function loadTodaySmileCount(): number {
  try {
    const raw = localStorage.getItem('gestureflow_smile_quota');
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    if (parsed.date !== getTodayStr()) return 0;
    return Math.min(parsed.count ?? 0, 10);
  } catch {
    return 0;
  }
}

// ── Tool Card ─────────────────────────────────────────────────────────────────

function ToolCard({
  icon: Icon, name, description, stat, statColor,
  cta, color, delay, onClick,
}: {
  icon: LucideIcon; name: string; description: string;
  stat: string; statColor: string; cta: string;
  color: string; delay: number; onClick: () => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full flex items-center gap-4 rounded-2xl p-4 text-left relative overflow-hidden"
      style={{
        background: 'rgba(18,18,40,0.85)',
        border: `1px solid ${color}25`,
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Subtle glow */}
      <div
        className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-10 pointer-events-none"
        style={{ background: color, filter: 'blur(20px)' }}
      />

      {/* Icon badge */}
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18`, border: `1px solid ${color}35` }}
      >
        <Icon size={22} style={{ color, filter: `drop-shadow(0 0 6px ${color}88)` }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black text-white leading-tight">{name}</p>
        <p className="text-xs text-gray-500 mt-0.5 leading-snug">{description}</p>
        <p className="text-xs font-semibold mt-1.5" style={{ color: statColor }}>{stat}</p>
      </div>

      {/* CTA chip */}
      <div
        className="flex items-center gap-1 flex-shrink-0 px-3 py-1.5 rounded-xl"
        style={{ background: `${color}15`, border: `1px solid ${color}30` }}
      >
        <span className="text-xs font-bold" style={{ color }}>{cta}</span>
        <ChevronRight size={12} style={{ color }} />
      </div>
    </motion.button>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, unit, color, delay,
}: {
  icon: LucideIcon; label: string; value: string | number;
  unit?: string; color: string; delay: number;
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

// ── Activity Bar ──────────────────────────────────────────────────────────────

function ActivityBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="w-5 h-14 rounded-full bg-gray-800 relative overflow-hidden">
      <motion.div
        className="absolute bottom-0 left-0 right-0 rounded-full"
        style={{ background: 'linear-gradient(180deg, #00f0ff, #7b2fff)' }}
        initial={{ height: '0%' }}
        animate={{ height: `${pct}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
    </div>
  );
}

// ── Dashboard (Hub) ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();

  const [localStats, setLocalStats] = useState<StoredStats | null>(null);
  const [cloudSessions, setCloudSessions] = useState<DbSession[] | null>(null);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [todaySmiles, setTodaySmiles] = useState(0);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    setLocalStats(loadStats());
    setTodaySmiles(loadTodaySmileCount());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!user) { setCloudSessions(null); return; }
    setCloudLoading(true);
    loadSessionsFromDb()
      .then(rows => setCloudSessions(rows))
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

  // Aggregate stats: prefer cloud when signed in
  const totalGestures = user && cloudSessions
    ? cloudSessions.reduce((s, r) => s + r.gestures, 0)
    : localStats?.totalGestures ?? 0;
  const bestImpact = user && cloudSessions && cloudSessions.length > 0
    ? Math.max(...cloudSessions.map(r => r.peak_impact))
    : localStats?.bestImpact ?? 0;
  const totalTime = user && cloudSessions
    ? cloudSessions.reduce((s, r) => s + r.duration, 0)
    : localStats?.totalTime ?? 0;
  const bestStreak = user && cloudSessions && cloudSessions.length > 0
    ? Math.max(...cloudSessions.map(r => r.best_streak))
    : localStats?.bestStreak ?? 0;
  const totalSessions = user && cloudSessions
    ? cloudSessions.length
    : localStats?.totalSessions ?? 0;

  // Weekly bar chart (last 7 localStorage sessions)
  const weekActivity = Array.from({ length: 7 }, (_, i) => {
    const s = localStats?.sessions[(localStats.sessions.length - 7 + i)];
    return s ? s.impact : 0;
  });
  const maxActivity = Math.max(...weekActivity, 1);

  // Smile card stat
  const smileStatColor = todaySmiles >= 10 ? '#00ff88' : todaySmiles >= 5 ? '#ffcc00' : '#ff00cc';
  const smileStat = todaySmiles >= 10
    ? '10/10 — quota complete! 🎉'
    : `${todaySmiles}/10 smiles today`;

  // Presentation card stat
  const presentationStat = cloudLoading
    ? 'Loading…'
    : totalGestures === 0
    ? 'No sessions yet — start your first!'
    : `${totalGestures} gestures · ${totalSessions} session${totalSessions !== 1 ? 's' : ''}`;

  return (
    <div className="page-scroll cyber-bg scanline">
      <div className="min-h-full px-5 pt-safe pb-10 flex flex-col">

        {/* ── Top bar ── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-between pt-4 mb-1"
        >
          <h1 className="text-2xl font-black text-white tracking-tight">
            <span style={{ color: '#00f0ff', textShadow: '0 0 12px #00f0ff55' }}>Gesture</span>Flow
          </h1>
          <div className="flex items-center gap-2">
            {/* Sync chip — shown left of Local/Sign In when signed out */}
            {!userLoading && !user && (
              <button
                onClick={() => router.push('/auth')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold"
                style={{
                  background: 'rgba(0,240,255,0.06)',
                  border: '1px solid rgba(0,240,255,0.2)',
                  color: '#00f0ff',
                }}
              >
                <Cloud size={12} />
                Sync progress
              </button>
            )}
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

        {/* Greeting */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.08 }}
          className="text-gray-400 text-sm mb-4"
        >
          {greeting} 👋 What are you working on today?
        </motion.p>

        {/* ── Daily pro tip (below title) ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="rounded-2xl p-4 mb-5"
          style={{
            background: 'linear-gradient(135deg, rgba(0,240,255,0.06), rgba(255,0,204,0.04))',
            border: '1px solid rgba(0,240,255,0.12)',
          }}
        >
          <div className="flex items-start gap-3">
            <span className="text-xl leading-none mt-0.5">💡</span>
            <div>
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Daily Tip</p>
              <p className="text-sm text-gray-300 leading-snug">
                {[
                  'Open gestures with palms facing out build 40% more audience trust.',
                  'Speakers who pause for 2–3 seconds before key points are rated as more confident and credible by listeners.',
                  'Standing with feet shoulder-width apart lowers cortisol and raises testosterone — your body changes how you feel before you speak.',
                  'Eye contact held for 3–5 seconds per person makes audiences feel personally addressed; less feels evasive, more feels aggressive.',
                  "Mirroring your audience's posture within the first 60 seconds increases perceived rapport by up to 30%.",
                  'Gesturing above the waist is associated with enthusiasm and energy; below the waist reads as uncertainty to observers.',
                  'Research shows speakers who vary their vocal pitch are rated 38% more interesting than those who speak in a monotone.',
                  'The "steeple" hand gesture (fingertips touching, forming a tent) is consistently linked to authority and high confidence in studies.',
                  'People decide whether they like a speaker within the first 7 seconds — posture and facial expression drive that snap judgment.',
                  'Nodding slowly (once per second) signals agreement and encourages audiences to keep listening. Fast nodding signals impatience.',
                  'Pointing with an open hand (all fingers together) is perceived as less aggressive than a single pointed finger.',
                  "Smiling before speaking — even briefly — activates the audience's mirror neurons, making them more receptive from the first word.",
                ][Math.floor(Date.now() / 86400000) % 12]}
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── 3 Tool Cards ── */}
        <div className="flex flex-col gap-3 mb-6">
          <ToolCard
            icon={Mic}
            name="Presentation Coach"
            description="Practice body language, gestures & presence"
            stat={presentationStat}
            statColor={totalGestures > 0 ? '#00f0ff' : '#444466'}
            cta="Start"
            color="#00f0ff"
            delay={0.15}
            onClick={() => router.push('/practice')}
          />
          <ToolCard
            icon={Monitor}
            name="Office Ergonomics"
            description="Real-time posture & slouch alerts while you work"
            stat="Tracks posture · Alerts when you slouch"
            statColor="#7b2fff"
            cta="Start"
            color="#7b2fff"
            delay={0.2}
            onClick={() => router.push('/office')}
          />
          <ToolCard
            icon={Smile}
            name="Daily Smile Quota"
            description="Hit 10 smiles a day to boost energy & mood"
            stat={smileStat}
            statColor={smileStatColor}
            cta="Start"
            color="#ff00cc"
            delay={0.25}
            onClick={() => router.push('/smile')}
          />
        </div>

        {/* ── Progress label ── */}
        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Your Progress</p>

        {/* ── Stats grid ── */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <StatCard icon={Flame} label="Gestures" value={cloudLoading ? '…' : totalGestures} color="#ff6600" delay={0.1} />
          <StatCard icon={Star} label="Best Impact" value={cloudLoading ? '…' : bestImpact} unit="%" color="#ffaa00" delay={0.15} />
          <StatCard icon={Clock} label="Total Time" value={cloudLoading ? '…' : formatTime(totalTime)} color="#00f0ff" delay={0.2} />
          <StatCard icon={Zap} label="Best Streak" value={cloudLoading ? '…' : bestStreak} unit="s" color="#7b2fff" delay={0.25} />
        </div>

        {/* ── Weekly activity chart ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl p-4 mb-4"
          style={{ background: 'rgba(18,18,40,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-white">This Week</span>
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#00f0ff' }}>
              <TrendingUp size={13} />
              <span>{totalSessions} sessions</span>
            </div>
          </div>
          <div className="flex items-end justify-between gap-2">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
                <ActivityBar value={weekActivity[i]} max={maxActivity} />
                <span className="text-[10px] text-gray-600">{day}</span>
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </div>
  );
}
