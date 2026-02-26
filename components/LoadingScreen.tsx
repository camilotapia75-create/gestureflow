'use client';

import { motion } from 'framer-motion';

interface Props {
  progress: number;
  stage: string;
}

export default function LoadingScreen({ progress, stage }: Props) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#050510] z-50 overflow-hidden">
      {/* Animated background grid */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,240,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.08) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Radial glow behind logo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="w-96 h-96 rounded-full"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(0,240,255,0.12) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, scale: 0.7, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
        className="relative z-10 mb-12 text-center"
      >
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div
            className="w-24 h-24 rounded-3xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(0,240,255,0.15), rgba(255,0,204,0.15))',
              border: '1px solid rgba(0,240,255,0.3)',
              boxShadow: '0 0 40px rgba(0,240,255,0.2), 0 0 80px rgba(255,0,204,0.1)',
            }}
          >
            {/* Simplified body icon with open arms */}
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
              <circle cx="26" cy="10" r="6" stroke="#00f0ff" strokeWidth="2.5" fill="none"
                style={{ filter: 'drop-shadow(0 0 4px #00f0ff)' }} />
              {/* Arms open */}
              <line x1="4" y1="24" x2="18" y2="28" stroke="#00f0ff" strokeWidth="2.5" strokeLinecap="round"
                style={{ filter: 'drop-shadow(0 0 3px #00f0ff)' }} />
              <line x1="34" y1="28" x2="48" y2="24" stroke="#00f0ff" strokeWidth="2.5" strokeLinecap="round"
                style={{ filter: 'drop-shadow(0 0 3px #00f0ff)' }} />
              {/* Shoulders */}
              <line x1="18" y1="28" x2="34" y2="28" stroke="#00f0ff" strokeWidth="2.5" strokeLinecap="round" />
              {/* Torso */}
              <line x1="26" y1="28" x2="26" y2="40" stroke="#00f0ff" strokeWidth="2.5" strokeLinecap="round" />
              {/* Legs */}
              <line x1="26" y1="40" x2="20" y2="50" stroke="#7b2fff" strokeWidth="2" strokeLinecap="round" />
              <line x1="26" y1="40" x2="32" y2="50" stroke="#7b2fff" strokeWidth="2" strokeLinecap="round" />
              {/* Hand dots */}
              <circle cx="4" cy="24" r="3" fill="#ff00cc" style={{ filter: 'drop-shadow(0 0 4px #ff00cc)' }} />
              <circle cx="48" cy="24" r="3" fill="#ff00cc" style={{ filter: 'drop-shadow(0 0 4px #ff00cc)' }} />
            </svg>
          </div>
        </div>

        <h1 className="text-5xl font-black tracking-tight">
          <span style={{ color: '#00f0ff', textShadow: '0 0 20px #00f0ff66' }}>Gesture</span>
          <span className="text-white">Flow</span>
        </h1>
        <p className="mt-2 text-gray-400 text-sm font-medium tracking-widest uppercase">
          AI Presentation Coach
        </p>
      </motion.div>

      {/* Loading state */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="relative z-10 w-64 text-center"
      >
        {/* Progress track */}
        <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden mb-3">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, #00f0ff, #ff00cc)',
              boxShadow: '0 0 8px #00f0ff, 0 0 16px rgba(0,240,255,0.4)',
            }}
            initial={{ width: '0%' }}
            animate={{ width: `${progress}%` }}
            transition={{ ease: 'easeOut', duration: 0.4 }}
          />
        </div>

        {/* Stage label */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="capitalize">{stage === 'loading-wasm' ? 'Loading engine…' : stage === 'loading-model' ? 'Fetching AI model…' : 'Initialising…'}</span>
          <span className="font-mono" style={{ color: '#00f0ff' }}>
            {Math.round(progress)}%
          </span>
        </div>

        {/* Scanning dots */}
        <div className="flex justify-center gap-2 mt-8">
          {[0, 0.15, 0.3].map((delay, i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: '#00f0ff' }}
              animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
              transition={{ duration: 1.2, repeat: Infinity, delay }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
