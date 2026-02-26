'use client';

import { motion } from 'framer-motion';
import { Camera, Shield, Zap } from 'lucide-react';

interface Props {
  onRequest: () => void;
  error?: string | null;
}

export default function CameraPermission({ onRequest, error }: Props) {
  return (
    <div className="fixed inset-0 bg-[#050510] flex flex-col items-center justify-center z-40 p-6">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(0,240,255,0.08) 0%, transparent 70%)',
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
        className="relative z-10 flex flex-col items-center text-center max-w-xs"
      >
        {/* Camera icon ring */}
        <div className="relative mb-8">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0 rounded-full"
            style={{
              background:
                'conic-gradient(from 0deg, #00f0ff, #ff00cc, #7b2fff, #00f0ff)',
              padding: '2px',
              borderRadius: '50%',
            }}
          />
          <div
            className="relative w-28 h-28 rounded-full flex items-center justify-center"
            style={{
              background: 'rgba(10,10,30,0.95)',
              border: '3px solid transparent',
              backgroundClip: 'padding-box',
              boxShadow: '0 0 30px rgba(0,240,255,0.25)',
            }}
          >
            <Camera
              size={44}
              style={{ color: '#00f0ff', filter: 'drop-shadow(0 0 8px #00f0ff)' }}
            />
          </div>
        </div>

        <h2 className="text-2xl font-black mb-2 text-white">Camera Access</h2>
        <p className="text-gray-400 text-sm leading-relaxed mb-8">
          GestureFlow uses your camera to analyze your body language in real-time.{' '}
          <strong className="text-white">Nothing is recorded or sent anywhere.</strong>{' '}
          All AI processing happens locally on your device.
        </p>

        {/* Feature bullets */}
        <div className="w-full space-y-3 mb-8">
          {[
            { icon: Shield, text: '100% private — runs on your device', color: '#00f0ff' },
            { icon: Zap, text: 'Real-time AI gesture analysis at 30fps', color: '#ff00cc' },
            { icon: Camera, text: 'Front camera, mirrored for natural view', color: '#7b2fff' },
          ].map(({ icon: Icon, text, color }) => (
            <div
              key={text}
              className="flex items-center gap-3 text-left px-4 py-3 rounded-xl"
              style={{
                background: 'rgba(20,20,45,0.6)',
                border: `1px solid ${color}22`,
              }}
            >
              <Icon size={18} style={{ color, flexShrink: 0 }} />
              <span className="text-sm text-gray-300">{text}</span>
            </div>
          ))}
        </div>

        {/* Error message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full mb-4 px-4 py-3 rounded-xl text-sm text-red-300 text-center"
            style={{ background: 'rgba(255,50,50,0.12)', border: '1px solid rgba(255,50,50,0.3)' }}
          >
            {error}
          </motion.div>
        )}

        {/* Allow button */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={onRequest}
          className="w-full py-4 rounded-2xl font-black text-lg text-[#050510] tracking-wide"
          style={{
            background: 'linear-gradient(135deg, #00f0ff, #7b2fff)',
            boxShadow: '0 0 24px rgba(0,240,255,0.4), 0 4px 20px rgba(0,0,0,0.4)',
          }}
        >
          Allow Camera
        </motion.button>

        <p className="mt-4 text-xs text-gray-600">
          You can revoke access anytime in your browser settings
        </p>
      </motion.div>
    </div>
  );
}
