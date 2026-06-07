'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  Cloud, LogIn, LogOut,
  Flame, Star, Clock, Zap, TrendingUp,
  Mic, Monitor, Smile, ChevronRight, GraduationCap, Lightbulb,
  type LucideIcon,
} from 'lucide-react';

import { loadStats, formatTime, StoredStats } from '@/lib/storage';
import { loadSessionsFromDb, type DbSession } from '@/lib/db';
import { useUser } from '@/hooks/useUser';
import { createClient } from '@/lib/supabase';

const ThreeBackground = dynamic(() => import('./ThreeBackground'), { ssr: false });

// ── Shared glass style ────────────────────────────────────────────────────────

const glass: React.CSSProperties = {
  background: 'rgba(6, 6, 22, 0.42)',
  backdropFilter: 'blur(28px) saturate(160%)',
  WebkitBackdropFilter: 'blur(28px) saturate(160%)',
  border: '1px solid rgba(255,255,255,0.055)',
  borderTop: '1px solid rgba(255,255,255,0.10)',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTodayStr() { return new Date().toISOString().split('T')[0]; }

function loadTodaySmileCount(): number {
  try {
    const raw = localStorage.getItem('gestureflow_smile_quota');
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    if (parsed.date !== getTodayStr()) return 0;
    return Math.min(parsed.count ?? 0, 10);
  } catch { return 0; }
}

// ── Feature card ──────────────────────────────────────────────────────────────

function FeatureCard({
  icon: Icon, name, stat, statColor, cta, accent, delay, onClick,
}: {
  icon: LucideIcon; name: string; stat: string; statColor: string;
  cta: string; accent: string; delay: number; onClick: () => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 22, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="relative overflow-hidden rounded-2xl p-4 flex flex-col items-start gap-3 text-left w-full"
      style={{ ...glass, minHeight: 148 }}
    >
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}90, transparent)` }} />

      {/* Ambient bloom */}
      <div className="absolute -top-8 -left-4 w-28 h-28 rounded-full pointer-events-none"
        style={{ background: accent, filter: 'blur(28px)', opacity: 0.12 }} />

      {/* Icon */}
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${accent}14`, border: `1px solid ${accent}35` }}>
        <Icon size={17} style={{ color: accent }} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0 w-full">
        <p className="text-[13px] font-bold text-white leading-tight mb-1 tracking-tight">{name}</p>
        <p className="text-[11px] font-medium leading-snug" style={{ color: statColor }}>{stat}</p>
      </div>

      {/* CTA */}
      <div className="flex items-center gap-1 text-[11px] font-bold mt-auto"
        style={{ color: accent }}>
        {cta}
        <ChevronRight size={11} />
      </div>
    </motion.button>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, unit, accent, delay,
}: {
  icon: LucideIcon; label: string; value: string | number;
  unit?: string; accent: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl p-4 flex flex-col gap-2 relative overflow-hidden"
      style={glass}
    >
      <div className="absolute -top-5 -right-5 w-16 h-16 rounded-full pointer-events-none"
        style={{ background: accent, filter: 'blur(18px)', opacity: 0.15 }} />
      <div className="w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ background: `${accent}14`, border: `1px solid ${accent}30` }}>
        <Icon size={15} style={{ color: accent }} />
      </div>
      <div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-black text-white leading-none">{value}</span>
          {unit && <span className="text-xs font-semibold" style={{ color: accent }}>{unit}</span>}
        </div>
        <span className="text-[10px] uppercase tracking-widest font-semibold text-gray-600">{label}</span>
      </div>
    </motion.div>
  );
}

// ── Activity bar ──────────────────────────────────────────────────────────────

function ActivityBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="w-4 h-12 rounded-full bg-white/[0.04] relative overflow-hidden">
      <motion.div
        className="absolute bottom-0 left-0 right-0 rounded-full"
        style={{ background: 'linear-gradient(180deg,#00d4ff,#7b2fff)' }}
        initial={{ height: '0%' }}
        animate={{ height: `${pct}%` }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
      />
    </div>
  );
}

// ── Daily tips ────────────────────────────────────────────────────────────────

const TIPS = [
  'Open palms facing outward build 40% more perceived trust with an audience.',
  'A deliberate 2–3 second pause before key points signals confidence and invites attention.',
  'Standing feet shoulder-width apart lowers cortisol — your body shapes how you feel before you speak.',
  'Eye contact of 3–5 seconds per person makes each individual feel personally addressed.',
  'Gesturing above the waist communicates enthusiasm; below reads as uncertainty.',
  'Speakers who vary vocal pitch are rated 38% more interesting than those in monotone.',
  'The "steeple" gesture (fingertips touching) is consistently linked to authority in studies.',
  'People form a first impression within 7 seconds — posture and expression lead it.',
  'Slow single nods signal understanding; fast repeated nods reads as impatience.',
  'An open-hand point (fingers together) is perceived as far less aggressive than a single finger.',
  'A brief smile before speaking activates mirror neurons, making audiences more receptive.',
  'Mirroring posture within the first 60 seconds increases perceived rapport by up to 30%.',
];

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();

  const [localStats, setLocalStats]     = useState<StoredStats | null>(null);
  const [cloudSessions, setCloudSessions] = useState<DbSession[] | null>(null);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [todaySmiles, setTodaySmiles]   = useState(0);
  const [now, setNow]                   = useState(new Date());
  const [showStats, setShowStats]       = useState(false);

  useEffect(() => {
    setLocalStats(loadStats());
    setTodaySmiles(loadTodaySmileCount());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!user) { setCloudSessions(null); return; }
    setCloudLoading(true);
    loadSessionsFromDb().then(setCloudSessions).finally(() => setCloudLoading(false));
  }, [user]);

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.refresh();
  }

  const h = now.getHours();
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';

  const totalGestures = user && cloudSessions ? cloudSessions.reduce((s, r) => s + r.gestures, 0) : localStats?.totalGestures ?? 0;
  const bestImpact    = user && cloudSessions && cloudSessions.length > 0 ? Math.max(...cloudSessions.map(r => r.peak_impact)) : localStats?.bestImpact ?? 0;
  const totalTime     = user && cloudSessions ? cloudSessions.reduce((s, r) => s + r.duration, 0) : localStats?.totalTime ?? 0;
  const bestStreak    = user && cloudSessions && cloudSessions.length > 0 ? Math.max(...cloudSessions.map(r => r.best_streak)) : localStats?.bestStreak ?? 0;
  const totalSessions = user && cloudSessions ? cloudSessions.length : localStats?.totalSessions ?? 0;

  const weekActivity = Array.from({ length: 7 }, (_, i) => {
    const s = localStats?.sessions[(localStats.sessions.length - 7 + i)];
    return s ? s.impact : 0;
  });
  const maxActivity = Math.max(...weekActivity, 1);

  const smileStatColor = todaySmiles >= 10 ? '#00ff88' : todaySmiles >= 5 ? '#ffcc00' : '#ff00cc';
  const smileStat = todaySmiles >= 10 ? '10/10 — quota complete' : `${todaySmiles} / 10 today`;

  const tipIndex = Math.floor(Date.now() / 86_400_000) % TIPS.length;

  return (
    <>
      <ThreeBackground />

      <div className="page-scroll" style={{ position: 'relative', zIndex: 1 }}>
        <div className="min-h-full px-4 pt-safe pb-10 flex flex-col max-w-lg mx-auto">

          {/* ── Header ── */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center justify-between pt-5 mb-6"
          >
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="relative w-8 h-8">
                <div className="absolute inset-0 rounded-lg"
                  style={{ background: 'linear-gradient(135deg,#00d4ff,#7b2fff)', opacity: 0.9 }} />
                <div className="absolute inset-0 rounded-lg flex items-center justify-center">
                  <Mic size={15} className="text-white" />
                </div>
              </div>
              <span className="text-lg font-black tracking-tight"
                style={{
                  background: 'linear-gradient(90deg,#00d4ff 0%,#b066ff 55%,#ff00cc 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>
                GestureFlow
              </span>
            </div>

            {/* Auth */}
            <div className="flex items-center gap-2">
              {!userLoading && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold"
                  style={{
                    background: user ? 'rgba(0,255,136,0.07)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${user ? 'rgba(0,255,136,0.18)' : 'rgba(255,255,255,0.06)'}`,
                    color: user ? '#00ff88' : '#444466',
                  }}>
                  <Cloud size={9} />
                  {user ? 'Synced' : 'Local'}
                </div>
              )}
              {!userLoading && (user
                ? <button onClick={handleSignOut}
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <LogOut size={13} className="text-gray-500" />
                  </button>
                : <button onClick={() => router.push('/auth')}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold"
                    style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', color: '#00d4ff' }}>
                    <LogIn size={11} /> Sign In
                  </button>
              )}
            </div>
          </motion.div>

          {/* ── Greeting ── */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.06, duration: 0.45 }}
            className="mb-5"
          >
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-600 mb-1">{greeting}</p>
            <h2 className="text-2xl font-black text-white leading-tight tracking-tight">
              What are you<br />
              <span style={{ color: '#00d4ff' }}>working on today?</span>
            </h2>
          </motion.div>

          {/* ── Tip strip ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="rounded-2xl p-3.5 mb-5 flex items-start gap-3"
            style={glass}
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: 'rgba(255,180,0,0.1)', border: '1px solid rgba(255,180,0,0.25)' }}>
              <Lightbulb size={13} style={{ color: '#ffb400' }} />
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-1">Daily Insight</p>
              <p className="text-[12px] text-gray-300 leading-relaxed">{TIPS[tipIndex]}</p>
            </div>
          </motion.div>

          {/* ── Feature cards ── */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <FeatureCard
              icon={Mic} name="Presentation Coach"
              stat={cloudLoading ? 'Loading…' : totalGestures === 0 ? 'No sessions yet' : `${totalGestures} gestures · ${totalSessions} session${totalSessions !== 1 ? 's' : ''}`}
              statColor={totalGestures > 0 ? '#00d4ff' : '#333355'}
              cta="Launch" accent="#00d4ff" delay={0.14}
              onClick={() => router.push('/practice')}
            />
            <FeatureCard
              icon={Monitor} name="Office Ergonomics"
              stat="Posture alerts while you work"
              statColor="#7b2fff"
              cta="Launch" accent="#7b2fff" delay={0.19}
              onClick={() => router.push('/office')}
            />
            <FeatureCard
              icon={Smile} name="Smile Quota"
              stat={smileStat}
              statColor={smileStatColor}
              cta="Track" accent="#ff00cc" delay={0.24}
              onClick={() => router.push('/smile')}
            />
            <FeatureCard
              icon={GraduationCap} name="Ergo Certification"
              stat="5 lessons · 10-question exam"
              statColor="#ffaa00"
              cta="Start" accent="#ffaa00" delay={0.29}
              onClick={() => router.push('/ergo')}
            />
          </div>

          {/* Sync prompt */}
          {!userLoading && !user && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              onClick={() => router.push('/auth')}
              className="flex items-center gap-2 mb-5 text-left"
            >
              <Cloud size={10} style={{ color: '#00d4ff', flexShrink: 0 }} />
              <span className="text-[11px] text-gray-600">
                Sync progress across devices —{' '}
                <span className="font-semibold" style={{ color: '#00d4ff' }}>sign in free</span>
              </span>
            </motion.button>
          )}

          {/* ── Stats toggle ── */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.38 }}
            onClick={() => setShowStats(v => !v)}
            className="flex items-center gap-2 text-[11px] font-bold mb-4 self-start"
            style={{ color: '#00d4ff' }}
          >
            <motion.span animate={{ rotate: showStats ? 180 : 0 }} transition={{ duration: 0.22 }} className="inline-block">
              ▾
            </motion.span>
            {showStats ? 'Hide stats' : 'My stats'}
          </motion.button>

          {/* ── Collapsible stats ── */}
          <AnimatePresence>
            {showStats && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                style={{ overflow: 'hidden' }}
              >
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <StatCard icon={Flame} label="Power moves" value={cloudLoading ? '—' : totalGestures} accent="#ff6600" delay={0} />
                  <StatCard icon={Star}  label="Best impact"  value={cloudLoading ? '—' : bestImpact} unit="%" accent="#ffaa00" delay={0} />
                  <StatCard icon={Clock} label="Total time"   value={cloudLoading ? '—' : formatTime(totalTime)} accent="#00d4ff" delay={0} />
                  <StatCard icon={Zap}   label="Best streak"  value={cloudLoading ? '—' : bestStreak} unit="s" accent="#7b2fff" delay={0} />
                </div>

                <div className="rounded-2xl p-4 mb-4" style={glass}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[12px] font-bold text-white tracking-tight">This week</span>
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: '#00d4ff' }}>
                      <TrendingUp size={12} />
                      {totalSessions} sessions
                    </div>
                  </div>
                  <div className="flex items-end justify-between gap-1.5">
                    {['M','T','W','T','F','S','S'].map((day, i) => (
                      <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
                        <ActivityBar value={weekActivity[i]} max={maxActivity} />
                        <span className="text-[9px] text-gray-700 font-medium">{day}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </>
  );
}
