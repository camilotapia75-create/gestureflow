'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, Zap, Clock, Flame, TrendingUp, Award, type LucideIcon } from 'lucide-react';
import { formatTime } from '@/lib/storage';

interface Props {
  open: boolean;
  onClose: () => void;
  stats: {
    duration: number;
    gestures: number;
    averageImpact: number;
    peakImpact: number;
    bestStreak: number;
  };
}

function ScoreRing({ value, label, color }: { value: number; label: string; color: string }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        {/* Background ring */}
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black text-white leading-none">{value}</span>
          <span className="text-[10px] text-gray-400 font-medium">/ 100</span>
        </div>
      </div>
      <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{label}</span>
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
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
          <Icon size={18} style={{ color }} />
        </div>
        <span className="text-sm text-gray-300 font-medium">{label}</span>
      </div>
      <span className="font-black text-white text-base">{value}</span>
    </div>
  );
}

function getGrade(impact: number): { grade: string; label: string; color: string } {
  if (impact >= 90) return { grade: 'S', label: 'World Class', color: '#00f0ff' };
  if (impact >= 80) return { grade: 'A', label: 'Excellent', color: '#7b2fff' };
  if (impact >= 65) return { grade: 'B', label: 'Good', color: '#ff00cc' };
  if (impact >= 50) return { grade: 'C', label: 'Keep Practicing', color: '#ffaa00' };
  return { grade: 'D', label: 'Needs Work', color: '#888' };
}

export default function SessionSummary({ open, onClose, stats }: Props) {
  const { duration, gestures, averageImpact, peakImpact, bestStreak } = stats;
  const grade = getGrade(averageImpact);

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

              {/* Grade + Score rings */}
              <div
                className="rounded-2xl p-5 mb-5 flex items-center gap-6"
                style={{
                  background: `linear-gradient(135deg, ${grade.color}10, ${grade.color}05)`,
                  border: `1px solid ${grade.color}30`,
                }}
              >
                {/* Grade circle */}
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
                  <p className="text-sm text-gray-400 mt-1">Avg impact: {averageImpact}%</p>
                </div>
              </div>

              {/* Score rings */}
              <div className="flex justify-around mb-6">
                <ScoreRing value={averageImpact} label="Avg Impact" color="#00f0ff" />
                <ScoreRing value={Math.min(100, peakImpact)} label="Peak" color="#ff00cc" />
                <ScoreRing value={Math.min(100, bestStreak * 3)} label="Streak" color="#7b2fff" />
              </div>

              {/* Stat rows */}
              <div className="space-y-2 mb-6">
                <StatRow icon={Flame} label="Gestures Counted" value={`${gestures}`} color="#ff6600" />
                <StatRow icon={Clock} label="Session Duration" value={formatTime(duration)} color="#00f0ff" />
                <StatRow icon={Zap} label="Best Streak" value={`${bestStreak}s`} color="#7b2fff" />
                <StatRow icon={TrendingUp} label="Peak Impact" value={`${peakImpact}%`} color="#ff00cc" />
                <StatRow icon={Star} label="Average Impact" value={`${averageImpact}%`} color="#ffaa00" />
              </div>

              {/* Achievement */}
              {peakImpact >= 95 && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.4, type: 'spring' }}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-4"
                  style={{
                    background: 'linear-gradient(135deg, rgba(0,240,255,0.15), rgba(255,0,204,0.1))',
                    border: '1px solid rgba(0,240,255,0.3)',
                  }}
                >
                  <Award size={24} style={{ color: '#00f0ff' }} />
                  <div>
                    <p className="font-bold text-white text-sm">Peak Performer! 🎉</p>
                    <p className="text-xs text-gray-400">You hit 95%+ impact — world-class gestures</p>
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
