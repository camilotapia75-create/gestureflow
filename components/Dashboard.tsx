'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Cloud, LogIn, LogOut, Mic, Monitor, Smile, GraduationCap, Zap, Flame, Star, Clock, TrendingUp, type LucideIcon } from 'lucide-react';

import { loadStats, formatTime, StoredStats } from '@/lib/storage';
import { loadSessionsFromDb, type DbSession } from '@/lib/db';
import { useUser } from '@/hooks/useUser';
import { createClient } from '@/lib/supabase';
import AuroraBackground from './AuroraBackground';

function getTodayStr() { return new Date().toISOString().split('T')[0]; }
function loadTodaySmileCount(): number {
  try {
    const d = JSON.parse(localStorage.getItem('gestureflow_smile_quota') ?? '{}');
    return d.date === getTodayStr() ? Math.min(d.count ?? 0, 10) : 0;
  } catch { return 0; }
}

// ── 3-D tilt card wrapper ─────────────────────────────────────────────────────
function TiltCard({ children, className = '', style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const rx = useMotionValue(0); const ry = useMotionValue(0);
  const sx = useSpring(rx, { stiffness: 200, damping: 22 });
  const sy = useSpring(ry, { stiffness: 200, damping: 22 });

  const onMove = useCallback((e: React.MouseEvent) => {
    if (window.matchMedia('(pointer:coarse)').matches) return;
    const el = ref.current; if (!el) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    rx.set(((e.clientY - top) / height - 0.5) * -10);
    ry.set(((e.clientX - left) / width - 0.5) * 10);
  }, [rx, ry]);

  const onLeave = useCallback(() => { rx.set(0); ry.set(0); }, [rx, ry]);

  return (
    <motion.div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}
      style={{ rotateX: sx, rotateY: sy, transformStyle: 'preserve-3d', transformPerspective: 900, ...style }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Animated counter ──────────────────────────────────────────────────────────
function Counter({ to }: { to: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let c = 0; const step = Math.max(1, Math.ceil(to / 28));
    const id = setInterval(() => { c = Math.min(c + step, to); setN(c); if (c >= to) clearInterval(id); }, 22);
    return () => clearInterval(id);
  }, [to]);
  return <>{n}</>;
}

// ── Bento card (large hero) ───────────────────────────────────────────────────
function HeroCard({ icon: Icon, name, sub, stat, color, gradient, delay, onClick }: {
  icon: LucideIcon; name: string; sub: string; stat: string; color: string; gradient: string; delay: number; onClick: () => void;
}) {
  return (
    <TiltCard className="col-span-2 row-span-1 md:col-span-2 md:row-span-2">
      <motion.button
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className="relative w-full h-full min-h-[160px] md:min-h-[280px] rounded-3xl overflow-hidden text-left p-6 md:p-8 flex flex-col justify-between"
        style={{ background: 'rgba(8,8,22,0.85)', border: `1px solid ${color}25`, backdropFilter: 'blur(28px)' }}
      >
        {/* Animated gradient blob */}
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full pointer-events-none" style={{ background: gradient, filter: 'blur(52px)', opacity: 0.35 }} />
        {/* Bottom gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-2/3 pointer-events-none" style={{ background: `linear-gradient(0deg, ${color}0a, transparent)` }} />
        {/* Top edge line */}
        <div className="absolute top-0 left-10 right-10 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}50, transparent)` }} />

        <div className="relative z-10 flex items-start justify-between">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
            <Icon size={22} className="md:hidden" style={{ color }} />
            <Icon size={26} className="hidden md:block" style={{ color }} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full" style={{ background: `${color}12`, border: `1px solid ${color}25`, color }}>
            {stat}
          </span>
        </div>

        <div className="relative z-10 mt-auto">
          <p className="text-xl md:text-3xl font-black text-white leading-tight mb-1">{name}</p>
          <p className="text-xs md:text-sm text-gray-500 mb-4">{sub}</p>
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-sm"
            style={{ background: `linear-gradient(135deg, ${color}, ${color}aa)`, color: '#050510', boxShadow: `0 0 28px ${color}40` }}>
            Start Session →
          </div>
        </div>
      </motion.button>
    </TiltCard>
  );
}

// ── Mini bento card ───────────────────────────────────────────────────────────
function MiniCard({ icon: Icon, name, sub, color, delay, onClick, badge }: {
  icon: LucideIcon; name: string; sub: string; color: string; delay: number; onClick: () => void; badge?: string;
}) {
  return (
    <TiltCard>
      <motion.button
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
        whileTap={{ scale: 0.97 }}
        onClick={onClick}
        className="spotlight-card relative w-full min-h-[130px] md:min-h-0 md:aspect-square rounded-2xl p-4 md:p-5 flex flex-col justify-between text-left overflow-hidden"
        style={{ background: 'rgba(8,8,22,0.85)', border: `1px solid ${color}18`, backdropFilter: 'blur(24px)' }}
      >
        <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full pointer-events-none" style={{ background: color, filter: 'blur(32px)', opacity: 0.12 }} />
        <div className="absolute top-0 left-5 right-5 h-px pointer-events-none" style={{ background: `linear-gradient(90deg, transparent, ${color}30, transparent)` }} />

        <div className="flex items-start justify-between mb-auto">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}12`, border: `1px solid ${color}22` }}>
            <Icon size={16} style={{ color }} />
          </div>
          {badge && <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: `${color}10`, border: `1px solid ${color}20`, color }}>{badge}</span>}
        </div>

        <div>
          <p className="text-sm font-bold text-white leading-snug mb-0.5">{name}</p>
          <p className="text-[10px] text-gray-600 leading-snug">{sub}</p>
        </div>
      </motion.button>
    </TiltCard>
  );
}

// ── Stat pill ─────────────────────────────────────────────────────────────────
function StatPill({ icon: Icon, label, value, unit = '', color }: { icon: LucideIcon; label: string; value: string | number; unit?: string; color: string }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl" style={{ background: 'rgba(8,8,22,0.85)', border: `1px solid ${color}15`, backdropFilter: 'blur(20px)' }}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}12`, border: `1px solid ${color}20` }}>
        <Icon size={13} style={{ color }} />
      </div>
      <div>
        <div className="text-base font-black text-white leading-none">
          {typeof value === 'number' ? <Counter to={value} /> : value}{unit}
        </div>
        <div className="text-[9px] text-gray-600 uppercase tracking-wider font-semibold mt-0.5">{label}</div>
      </div>
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
  const [showStats, setShowStats]         = useState(false);

  useEffect(() => {
    setLocalStats(loadStats()); setTodaySmiles(loadTodaySmileCount());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!user) { setCloudSessions(null); return; }
    setCloudLoading(true);
    loadSessionsFromDb().then(r => setCloudSessions(r)).finally(() => setCloudLoading(false));
  }, [user]);

  const totalGestures = user && cloudSessions ? cloudSessions.reduce((s, r) => s + r.gestures, 0) : localStats?.totalGestures ?? 0;
  const bestImpact    = user && cloudSessions && cloudSessions.length > 0 ? Math.max(...cloudSessions.map(r => r.peak_impact)) : localStats?.bestImpact ?? 0;
  const totalTime     = user && cloudSessions ? cloudSessions.reduce((s, r) => s + r.duration, 0) : localStats?.totalTime ?? 0;
  const bestStreak    = user && cloudSessions && cloudSessions.length > 0 ? Math.max(...cloudSessions.map(r => r.best_streak)) : localStats?.bestStreak ?? 0;
  const totalSessions = user && cloudSessions ? cloudSessions.length : localStats?.totalSessions ?? 0;

  const h = now.getHours();
  const greeting = h < 5 ? 'Late night grind' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const smileStat = todaySmiles >= 10 ? '10/10 done' : `${todaySmiles}/10 today`;

  const TIPS = [
    'Open palms build 40% more trust with your audience.',
    'A 2-second pause before key points signals authority.',
    'Shoulder-width stance lowers cortisol within minutes.',
    'Vary your vocal pitch — monotone speakers lose 38% more attention.',
    '7 seconds. That\'s how long you have to make a first impression.',
    'The steeple gesture is the single most studied sign of authority.',
  ];
  const tip = TIPS[Math.floor(Date.now() / 86400000) % TIPS.length];

  return (
    <div className="page-scroll" style={{ background: '#050510' }}>
      <AuroraBackground />

      <div className="relative z-10 min-h-full px-4 md:px-6 pt-safe pb-28 flex flex-col">

        {/* ── Top bar ── */}
        <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.23,1,0.32,1] }}
          className="pt-5 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo with pulsing rings */}
            <div className="relative w-9 h-9 shrink-0">
              <div className="absolute inset-0 rounded-xl animate-ping" style={{ background: 'rgba(0,240,255,0.12)', animationDuration: '2.5s' }} />
              <div className="relative w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#00f0ff22,#7b2fff22)', border: '1px solid rgba(0,240,255,0.3)' }}>
                <Zap size={16} style={{ color: '#00f0ff' }} />
              </div>
            </div>
            <div>
              <h1 className="text-lg font-black leading-none" style={{ background: 'linear-gradient(90deg,#00f0ff,#7b2fff,#ff00cc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                GestureFlow
              </h1>
              <p className="text-[10px] font-medium" style={{ color: '#2a2a4a' }}>{greeting}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live indicator */}
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-bold" style={{ background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.12)', color: '#00ff88' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />AI Ready
            </div>
            {!userLoading && (
              user
                ? <button onClick={async () => { await createClient().auth.signOut(); router.refresh(); }}
                    className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <LogOut size={13} style={{ color: '#333355' }} />
                  </button>
                : <button onClick={() => router.push('/auth')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold" style={{ background: 'rgba(0,240,255,0.08)', border: '1px solid rgba(0,240,255,0.16)', color: '#00f0ff' }}>
                    <LogIn size={11} />Sign In
                  </button>
            )}
          </div>
        </motion.div>

        {/* ── Bento grid ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4" style={{ gridAutoRows: 'auto' }}>
          {/* Hero card — Presentation Coach */}
          <HeroCard
            icon={Mic} name="Presentation Coach" sub="Real-time gesture & posture coaching"
            stat={totalGestures > 0 ? `${totalGestures} moves` : 'Start free'}
            color="#00f0ff" gradient="radial-gradient(circle, #00f0ff, #7b2fff)"
            delay={0.1} onClick={() => router.push('/practice')}
          />

          {/* Office Ergo */}
          <MiniCard icon={Monitor} name="Office Ergonomics" sub="Live posture monitoring"
            color="#7b2fff" delay={0.18} onClick={() => router.push('/office')} badge="Live" />

          {/* Smile Quota */}
          <MiniCard icon={Smile} name="Smile Quota" sub={smileStat}
            color="#ff00cc" delay={0.24} onClick={() => router.push('/smile')}
            badge={todaySmiles >= 10 ? 'Done' : undefined} />

          {/* Ergo Cert */}
          <MiniCard icon={GraduationCap} name="Ergo Cert" sub="5 lessons · 10 questions"
            color="#ffaa00" delay={0.3} onClick={() => router.push('/ergo')} badge="Free" />
        </div>

        {/* ── Daily tip strip ── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35, duration: 0.5 }}
          className="rounded-2xl px-4 py-3 mb-4 flex items-center gap-3 relative overflow-hidden"
          style={{ background: 'rgba(0,240,255,0.03)', border: '1px solid rgba(0,240,255,0.07)', backdropFilter: 'blur(20px)' }}>
          <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(0,240,255,0.04), transparent 40%)' }} />
          <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 relative" style={{ background: 'rgba(0,240,255,0.1)', border: '1px solid rgba(0,240,255,0.16)' }}>
            <Zap size={12} style={{ color: '#00f0ff' }} />
          </div>
          <p className="text-xs text-gray-500 leading-relaxed relative"><span className="font-bold" style={{ color: 'rgba(0,240,255,0.5)' }}>Today — </span>{tip}</p>
        </motion.div>

        {/* ── Stats row ── */}
        {(totalGestures > 0 || totalSessions > 0) && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.5 }}>
            <button onClick={() => setShowStats(v => !v)} className="flex items-center gap-1.5 text-[10px] font-bold mb-2.5 tracking-widest uppercase" style={{ color: '#1a1a3a' }}>
              <TrendingUp size={10} />{showStats ? 'Hide' : 'Your stats'}
            </button>
            <AnimatePresence>
              {showStats && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
                    <StatPill icon={Flame} label="Moves"       value={cloudLoading ? 0 : totalGestures} color="#ff6600" />
                    <StatPill icon={Star}  label="Best Impact" value={cloudLoading ? 0 : bestImpact} unit="%" color="#ffaa00" />
                    <StatPill icon={Clock} label="Total Time"  value={cloudLoading ? '…' : formatTime(totalTime)} color="#00f0ff" />
                    <StatPill icon={Zap}   label="Best Streak" value={cloudLoading ? 0 : bestStreak} unit="s" color="#7b2fff" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── Sign-in nudge ── */}
        {!userLoading && !user && (
          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}
            onClick={() => router.push('/auth')}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-2xl text-[10px] font-bold mt-auto tracking-widest uppercase"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: '#1a1a3a' }}>
            <Cloud size={10} />Sync across devices — sign in free
          </motion.button>
        )}

      </div>
    </div>
  );
}
