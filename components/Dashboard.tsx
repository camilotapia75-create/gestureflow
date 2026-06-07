'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Cloud, LogIn, LogOut,
  Flame, Star, Clock, Zap, TrendingUp,
  Mic, Monitor, Smile, ChevronRight, GraduationCap,
  type LucideIcon,
} from 'lucide-react';

import { loadStats, formatTime, StoredStats } from '@/lib/storage';
import { loadSessionsFromDb, type DbSession } from '@/lib/db';
import { useUser } from '@/hooks/useUser';
import { createClient } from '@/lib/supabase';
import AuroraBackground from './AuroraBackground';

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

// ── Animated counter ──────────────────────────────────────────────────────────
function Counter({ value }: { value: number | string }) {
  const [display, setDisplay] = useState(0);
  const target = typeof value === 'number' ? value : 0;
  useEffect(() => {
    if (typeof value !== 'number') return;
    let cur = 0;
    const step = Math.max(1, Math.ceil(target / 32));
    const id = setInterval(() => {
      cur = Math.min(cur + step, target);
      setDisplay(cur);
      if (cur >= target) clearInterval(id);
    }, 24);
    return () => clearInterval(id);
  }, [target, value]);
  if (typeof value === 'string') return <>{value}</>;
  return <>{display}</>;
}

// ── Spotlight Tool Card ───────────────────────────────────────────────────────
function ToolCard({
  icon: Icon, name, description, stat, statColor,
  cta, color, delay, onClick,
}: {
  icon: LucideIcon; name: string; description: string;
  stat: string; statColor: string; cta: string;
  color: string; delay: number; onClick: () => void;
}) {
  const cardRef = useRef<HTMLButtonElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    el.style.setProperty('--my', `${e.clientY - rect.top}px`);
  }, []);

  return (
    <motion.button
      ref={cardRef}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      whileHover={{ y: -3, transition: { duration: 0.18 } }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      className="spotlight-card w-full relative overflow-hidden rounded-2xl p-4 md:p-6 flex flex-col items-start text-left gap-0 min-h-[164px] md:min-h-0 md:aspect-square"
      style={{
        background: 'rgba(10,10,26,0.8)',
        border: `1px solid ${color}1a`,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      } as React.CSSProperties}
    >
      {/* Spotlight */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl" style={{ background: `radial-gradient(260px circle at var(--mx,50%) var(--my,50%), ${color}10, transparent 70%)` }} />
      {/* Top edge glow */}
      <div className="absolute top-0 left-8 right-8 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}35, transparent)` }} />

      <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center mb-3 flex-shrink-0" style={{ background: `${color}12`, border: `1px solid ${color}25` }}>
        <Icon size={18} className="md:hidden" style={{ color }} />
        <Icon size={20} className="hidden md:block" style={{ color }} />
      </div>

      <p className="text-sm font-bold text-white leading-snug mb-1">{name}</p>
      <p className="text-[10px] md:text-[11px] text-gray-600 leading-snug mb-auto line-clamp-2">{description}</p>
      <p className="text-[10px] font-semibold mt-1.5 leading-snug" style={{ color: statColor }}>{stat}</p>

      <div className="w-full mt-2.5 py-2 rounded-xl flex items-center justify-center gap-1" style={{ background: `${color}10`, border: `1px solid ${color}22` }}>
        <span className="text-[10px] md:text-[11px] font-black" style={{ color }}>{cta}</span>
        <ChevronRight size={10} style={{ color }} />
      </div>
    </motion.button>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, unit = '', color, delay }: {
  icon: LucideIcon; label: string; value: string | number; unit?: string; color: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
      className="rounded-2xl p-4 relative overflow-hidden"
      style={{ background: 'rgba(10,10,26,0.8)', border: `1px solid ${color}15`, backdropFilter: 'blur(20px)' }}
    >
      <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-10 pointer-events-none" style={{ background: color, filter: 'blur(22px)' }} />
      <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3" style={{ background: `${color}12`, border: `1px solid ${color}20` }}>
        <Icon size={14} style={{ color }} />
      </div>
      <div className="flex items-baseline gap-0.5">
        <span className="text-2xl font-black text-white"><Counter value={value} /></span>
        {unit && <span className="text-xs font-bold ml-0.5" style={{ color }}>{unit}</span>}
      </div>
      <span className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider">{label}</span>
    </motion.div>
  );
}

// ── Activity bar ──────────────────────────────────────────────────────────────
function ActivityBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="w-full h-12 rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
      <motion.div
        className="w-full rounded-lg"
        style={{ background: 'linear-gradient(180deg,#00f0ff,#7b2fff)', height: '100%', transformOrigin: 'bottom' }}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: pct / 100 }}
        transition={{ duration: 0.9, ease: [0.23, 1, 0.32, 1] }}
      />
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();

  const [localStats, setLocalStats]       = useState<StoredStats | null>(null);
  const [cloudSessions, setCloudSessions] = useState<DbSession[] | null>(null);
  const [cloudLoading, setCloudLoading]   = useState(false);
  const [todaySmiles, setTodaySmiles]     = useState(0);
  const [now, setNow]                     = useState(new Date());
  const [showMore, setShowMore]           = useState(false);

  useEffect(() => {
    setLocalStats(loadStats());
    setTodaySmiles(loadTodaySmileCount());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!user) { setCloudSessions(null); return; }
    setCloudLoading(true);
    loadSessionsFromDb().then(rows => setCloudSessions(rows)).finally(() => setCloudLoading(false));
  }, [user]);

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.refresh();
  }

  const h = now.getHours();
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';

  const totalGestures = user && cloudSessions ? cloudSessions.reduce((s, r) => s + r.gestures, 0)       : localStats?.totalGestures ?? 0;
  const bestImpact    = user && cloudSessions && cloudSessions.length > 0 ? Math.max(...cloudSessions.map(r => r.peak_impact)) : localStats?.bestImpact ?? 0;
  const totalTime     = user && cloudSessions ? cloudSessions.reduce((s, r) => s + r.duration, 0)        : localStats?.totalTime ?? 0;
  const bestStreak    = user && cloudSessions && cloudSessions.length > 0 ? Math.max(...cloudSessions.map(r => r.best_streak)) : localStats?.bestStreak ?? 0;
  const totalSessions = user && cloudSessions ? cloudSessions.length                                      : localStats?.totalSessions ?? 0;
  const weekActivity  = Array.from({ length: 7 }, (_, i) => { const s = localStats?.sessions[(localStats.sessions.length - 7 + i)]; return s ? s.impact : 0; });
  const maxActivity   = Math.max(...weekActivity, 1);

  const smileStatColor   = todaySmiles >= 10 ? '#00ff88' : todaySmiles >= 5 ? '#ffcc00' : '#ff00cc';
  const smileStat        = todaySmiles >= 10 ? '10/10 — quota complete' : `${todaySmiles}/10 smiles today`;
  const presentationStat = cloudLoading ? 'Loading…' : totalGestures === 0 ? 'No sessions yet' : `${totalGestures} gestures · ${totalSessions} session${totalSessions !== 1 ? 's' : ''}`;

  const TIPS = [
    'Open gestures with palms facing out build 40% more audience trust.',
    'Pause 2–3 seconds before key points — it signals confidence and command.',
    'Standing feet shoulder-width apart lowers cortisol and raises testosterone.',
    'Eye contact held 3–5 seconds per person makes audiences feel personally addressed.',
    "Mirroring your audience's posture in the first 60 seconds increases rapport by 30%.",
    'Gesturing above the waist signals enthusiasm; below the waist signals uncertainty.',
    'Speakers who vary vocal pitch are rated 38% more interesting than monotone speakers.',
    'The steeple gesture — fingertips touching — is consistently linked to authority in research.',
    'People decide whether they like a speaker within the first 7 seconds.',
    'A brief smile before speaking activates mirror neurons, making audiences more receptive.',
  ];

  return (
    <div className="page-scroll" style={{ background: '#050510' }}>
      <AuroraBackground />

      <div className="relative z-10 min-h-full px-5 pt-safe pb-28 flex flex-col">

        {/* Top bar */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="pt-5 mb-5 flex items-center justify-between"
        >
          <div>
            <h1 className="text-2xl font-black tracking-tight">
              <span style={{ color: '#00f0ff', textShadow: '0 0 24px #00f0ff55' }}>Gesture</span>
              <span className="text-white">Flow</span>
            </h1>
            <p className="text-xs font-medium mt-0.5" style={{ color: '#333355' }}>{greeting}</p>
          </div>
          <div className="flex items-center gap-2">
            {!userLoading && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-bold"
                style={{ background: user ? 'rgba(0,255,136,0.06)' : 'rgba(255,255,255,0.03)', border: `1px solid ${user ? 'rgba(0,255,136,0.12)' : 'rgba(255,255,255,0.06)'}`, color: user ? '#00ff88' : '#333355' }}>
                <Cloud size={10} />{user ? 'Synced' : 'Local'}
              </div>
            )}
            {!userLoading && (
              user
                ? <button onClick={handleSignOut} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <LogOut size={13} style={{ color: '#444466' }} />
                  </button>
                : <button onClick={() => router.push('/auth')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold" style={{ background: 'rgba(0,240,255,0.09)', border: '1px solid rgba(0,240,255,0.18)', color: '#00f0ff' }}>
                    <LogIn size={11} />Sign In
                  </button>
            )}
          </div>
        </motion.div>

        {/* Daily tip */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="rounded-2xl p-4 mb-5 relative overflow-hidden"
          style={{ background: 'rgba(0,240,255,0.03)', border: '1px solid rgba(0,240,255,0.08)', backdropFilter: 'blur(20px)' }}
        >
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(120deg, rgba(0,240,255,0.04) 0%, transparent 55%)' }} />
          <div className="relative flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(0,240,255,0.1)', border: '1px solid rgba(0,240,255,0.18)' }}>
              <Zap size={13} style={{ color: '#00f0ff' }} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(0,240,255,0.5)' }}>Today's Tip</p>
              <p className="text-xs text-gray-400 leading-relaxed">{TIPS[Math.floor(Date.now() / 86400000) % TIPS.length]}</p>
            </div>
          </div>
        </motion.div>

        {/* Tool cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4">
          <ToolCard icon={Mic}           name="Presentation Coach" description="Practice body language, gestures & presence"    stat={presentationStat}   statColor={totalGestures > 0 ? '#00f0ff' : '#222244'} cta="Start Session" color="#00f0ff" delay={0.15} onClick={() => router.push('/practice')} />
          <ToolCard icon={Monitor}       name="Office Ergonomics"  description="Real-time posture monitoring & slouch alerts"   stat="Live posture tracking" statColor="#7b2fff"        cta="Start"         color="#7b2fff" delay={0.2}  onClick={() => router.push('/office')} />
          <ToolCard icon={Smile}         name="Daily Smile Quota"  description="Hit 10 smiles a day to boost energy & mood"    stat={smileStat}          statColor={smileStatColor}    cta="Start"         color="#ff00cc" delay={0.25} onClick={() => router.push('/smile')} />
          <ToolCard icon={GraduationCap} name="Ergo Certification" description="5-lesson course · earn your certificate"       stat="5 lessons · 10 questions" statColor="#ffaa00"   cta="Start Course"  color="#ffaa00" delay={0.3}  onClick={() => router.push('/ergo')} />
        </div>

        {/* Stats toggle */}
        <button onClick={() => setShowMore(v => !v)} className="flex items-center gap-1.5 text-[11px] font-bold mb-3 self-start transition-colors" style={{ color: showMore ? '#00f0ff' : '#333355' }}>
          <motion.span animate={{ rotate: showMore ? 180 : 0 }} transition={{ duration: 0.22 }} className="inline-block">▾</motion.span>
          {showMore ? 'Hide stats' : 'Your stats'}
        </button>

        <AnimatePresence>
          {showMore && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <StatCard icon={Flame} label="Power Moves" value={cloudLoading ? '…' : totalGestures} color="#ff6600" delay={0} />
                <StatCard icon={Star}  label="Best Impact" value={cloudLoading ? '…' : bestImpact} unit="%" color="#ffaa00" delay={0.05} />
                <StatCard icon={Clock} label="Total Time"  value={cloudLoading ? '…' : formatTime(totalTime)} color="#00f0ff" delay={0.1} />
                <StatCard icon={Zap}   label="Best Streak" value={cloudLoading ? '…' : bestStreak} unit="s" color="#7b2fff" delay={0.15} />
              </div>
              <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(10,10,26,0.8)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)' }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-white">This Week</span>
                  <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#00f0ff' }}>
                    <TrendingUp size={12} /><span>{totalSessions} sessions</span>
                  </div>
                </div>
                <div className="flex items-end justify-between gap-2">
                  {['M','T','W','T','F','S','S'].map((day, i) => (
                    <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
                      <ActivityBar value={weekActivity[i]} max={maxActivity} />
                      <span className="text-[10px] text-gray-700">{day}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!userLoading && !user && (
          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
            onClick={() => router.push('/auth')}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-xs font-bold mt-auto"
            style={{ background: 'rgba(0,240,255,0.04)', border: '1px solid rgba(0,240,255,0.08)', color: '#333355' }}
          >
            <Cloud size={11} />Sync progress across devices — sign in free
          </motion.button>
        )}

      </div>
    </div>
  );
}
