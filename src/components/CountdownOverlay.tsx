import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sound } from '../game/audioEngine';

interface CountdownOverlayProps {
  countdownEndTime: number;
}

export const CountdownOverlay: React.FC<CountdownOverlayProps> = ({ countdownEndTime }) => {
  const [secondsLeft, setSecondsLeft] = useState<number | 'GO' | null>(null);

  useEffect(() => {
    let lastPlayed: number | 'GO' | null = null;

    const interval = setInterval(() => {
      const now = Date.now();
      const diffMs = countdownEndTime - now;
      const sec = Math.ceil(diffMs / 1000);

      if (sec > 0) {
        setSecondsLeft(sec);
        if (lastPlayed !== sec) {
          sound.playCountdownTick(false);
          lastPlayed = sec;
        }
      } else if (sec === 0 || diffMs > -800) {
        setSecondsLeft('GO');
        if (lastPlayed !== 'GO') {
          sound.playCountdownTick(true);
          lastPlayed = 'GO';
        }
      } else {
        setSecondsLeft(null);
        clearInterval(interval);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [countdownEndTime]);

  if (secondsLeft === null) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark-950/80 backdrop-blur-md pointer-events-none">
      <AnimatePresence mode="wait">
        <motion.div
          key={String(secondsLeft)}
          initial={{ scale: 0.3, opacity: 0, rotate: -10 }}
          animate={{ scale: 1.1, opacity: 1, rotate: 0 }}
          exit={{ scale: 1.8, opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="flex flex-col items-center justify-center"
        >
          <div
            className={`text-7xl sm:text-9xl font-black tracking-widest ${
              secondsLeft === 'GO'
                ? 'text-transparent bg-clip-text bg-gradient-to-r from-brand-cyan via-emerald-400 to-brand-blue drop-shadow-[0_0_40px_rgba(0,242,254,0.8)]'
                : 'text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.6)] font-mono'
            }`}
          >
            {secondsLeft}
          </div>
          <p className="mt-4 text-xs uppercase tracking-[0.3em] text-cyan-300/80 font-mono">
            {secondsLeft === 'GO' ? 'CLEAR ALL ARROWS!' : 'GET READY'}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
