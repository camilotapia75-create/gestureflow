'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Clock, Flame, TrendingUp, Award, type LucideIcon } from 'lucide-react';
import { formatTime } from '@/lib/storage';

interface Props {
  open: boolean;
  onClose: () => void;
  stats: {
    duration: number;
    gestures: number;
    bestStreak: number;
    smileCount: number;
    slouchCount: number;
    goodPostureSeconds: number;
  };
}

// Big three number boxes shown at the top of the summary
function QuickStat({
  emoji,
  value,
  label,
  color,
}: {
  emoji: string;
  value: string;
  label: string;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 flex-1 py-1">
      <span className="text-2xl leading-none mb-0.5">{emoji}</span>
      <span className="text-2xl font-black leading-none" style={{ color }}>
        {value}
      </span>
      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center">
        {label}
      </span>
    </div>
  );
}

function StatRow({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3 rounded-2xl"
      style={{ background: 'rgba(20,20,45,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: `${color}18` }}
        >
          <Icon size={18} style={{ color }} />
        </div>
        <span className="text-sm text-gray-300 font-medium">{label}</span>
      </div>
      <span className="font-black text-white text-base">{value}</span>
    </div>
  );
}

// Grade is now based on good-posture percentage — a concrete, learnable target
function getGrade(posturePercent: number): { grade: string; label: string; color: string } {
  if (posturePercent >= 80) return { grade: 'S', label: 'Excellent Form', color: '#00f0ff' };
  if (posturePercent >= 65) return { grade: 'A', label: 'Great Posture', color: '#7b2fff' };
  if (posturePercent >= 50) return { grade: 'B', label: 'Good Work', color: '#ff00cc' };
  if (posturePercent >= 30) return { grade: 'C', label: 'Keep Practicing', color: '#ffaa00' };
  return { grade: 'D', label: 'Sit Up & Smile!', color: '#888' };
}

export default function SessionSummary({ open, onClose, stats }: Props) {
  const { duration, gestures, bestStreak, smileCount, slouchCount, goodPostureSeconds } = stats;

  const goodPosturePercent =
    duration > 0 ? Math.min(100, Math.round((goodPostureSeconds / duration) * 100)) : 0;

  const grade = getGrade(goodPosturePercent);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[32px] overflow-hidden pb-safe"
            style={{
              background: 'linear-gradient(180deg, #0d0d25 0%, #050510 100%)',
              border: '1px solid rgba(0,240,255,0.15)',
              borderBottom: 'none',
              boxShadow: '0 -20px 80px rgba(0,240,255,0.08)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-600" />
            </div>

            <div className="px-5 pt-2 pb-8">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-black text-white">Session Complete</h2>
                  <p className="text-gray-400 text-sm mt-0.5">{formatTime(duration)} of practice</p>
                </div>
                <button
                  onClick={onClose}
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  <X size={18} className="text-gray-400" />
                </button>
              </div>

              {/* Grade card */}
              <div
                className="rounded-2xl p-5 mb-4 flex items-center gap-6"
                style={{
                  background: `linear-gradient(135deg, ${grade.color}10, ${grade.color}05)`,
                  border: `1px solid ${grade.color}30`,
                }}
              >
                <div
                  className="w-20 h-20 rounded-2xl flex flex-col items-center justify-center flex-shrink-0"
                  style={{
                    background: `${grade.color}18`,
                    border: `2px solid ${grade.color}50`,
                    boxShadow: `0 0 20px ${grade.color}30`,
                  }}
                >
                  <span className="text-4xl font-black leading-none" style={{ color: grade.color }}>
                    {grade.grade}
                  </span>
                </div>
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Your Grade</p>
                  <p className="text-xl font-black text-white">{grade.label}</p>
                  <p className="text-sm mt-1" style={{ color: grade.color }}>
                    Good posture {goodPosturePercent}% of session
                  </p>
                </div>
              </div>

              {/* Big 3 quick stats */}
              <div
                className="flex rounded-2xl mb-5 overflow-hidden"
                style={{ background: 'rgba(20,20,45,0.7)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <QuickStat emoji="🏆" value={`${gestures}`} label="Good Moves" color="#00ff88" />
                <div className="w-px self-stretch bg-white/10" />
                <QuickStat emoji="😊" value={`${smileCount}`} label="Smiles" color="#ffcc00" />
                <div className="w-px self-stretch bg-white/10" />
                <QuickStat emoji="🧍" value={`${goodPosturePercent}%`} label="Good Posture" color="#00f0ff" />
              </div>

              {/* Detail rows */}
              <div className="space-y-2 mb-6">
                <StatRow
                  icon={TrendingUp}
                  label="Good Posture Time"
                  value={formatTime(goodPostureSeconds)}
                  color="#00ff88"
                />
                <StatRow
                  icon={Flame}
                  label="Slouch Alerts"
                  value={slouchCount === 0 ? '0 ✓' : `${slouchCount}`}
                  color={slouchCount === 0 ? '#00ff88' : '#ff4444'}
                />
                <StatRow icon={Zap} label="Best Streak" value={`${bestStreak}s`} color="#7b2fff" />
                <StatRow icon={Clock} label="Session Duration" value={formatTime(duration)} color="#555577" />
              </div>

              {/* Achievement badges */}
              {smileCount >= 5 && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3, type: 'spring' }}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-3"
                  style={{
                    background: 'rgba(255,204,0,0.1)',
                    border: '1px solid rgba(255,204,0,0.3)',
                  }}
                >
                  <span className="text-2xl">😊</span>
                  <div>
                    <p className="font-bold text-white text-sm">Great Smile Game!</p>
                    <p className="text-xs text-gray-400">Smiling makes you more persuasive</p>
                  </div>
                </motion.div>
              )}
              {slouchCount === 0 && duration >= 30 && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.4, type: 'spring' }}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-3"
                  style={{
                    background: 'rgba(0,255,136,0.08)',
                    border: '1px solid rgba(0,255,136,0.25)',
                  }}
                >
                  <Award size={24} style={{ color: '#00ff88' }} />
                  <div>
                    <p className="font-bold text-white text-sm">Perfect Posture! 🪑</p>
                    <p className="text-xs text-gray-400">No slouching detected all session</p>
                  </div>
                </motion.div>
              )}
              {goodPosturePercent >= 80 && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.5, type: 'spring' }}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-4"
                  style={{
                    background: 'linear-gradient(135deg, rgba(0,240,255,0.12), rgba(123,47,255,0.08))',
                    border: '1px solid rgba(0,240,255,0.25)',
                  }}
                >
                  <span className="text-2xl">🌟</span>
                  <div>
                    <p className="font-bold text-white text-sm">Commanding Presence!</p>
                    <p className="text-xs text-gray-400">80%+ of session with great posture</p>
                  </div>
                </motion.div>
              )}

              {/* Done button */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onClose}
                className="w-full py-4 rounded-2xl font-black text-lg text-[#050510]"
                style={{
                  background: 'linear-gradient(135deg, #00f0ff, #7b2fff)',
                  boxShadow: '0 0 20px rgba(0,240,255,0.35)',
                }}
              >
                Practice Again
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
