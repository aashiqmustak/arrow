import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, ArrowRight, Zap, Move } from 'lucide-react';
import { Player } from '../types/socketEvents';

interface RoundResultModalProps {
  currentLevel: number;
  currentPlayer: Player | null;
  standings: Array<{
    playerId: string;
    name: string;
    completionTime: number | null;
    roundScore: number;
    totalScore: number;
  }>;
  nextRoundInMs: number;
}

export const RoundResultModal: React.FC<RoundResultModalProps> = ({
  currentLevel,
  currentPlayer,
  standings,
  nextRoundInMs,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(Math.ceil(nextRoundInMs / 1000));

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const left = Math.max(0, Math.ceil((nextRoundInMs - elapsed) / 1000));
      setSecondsRemaining(left);
      if (left <= 0) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [nextRoundInMs]);

  const breakdown = currentPlayer?.lastRoundBreakdown;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-dark-950/85 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="glass-panel-glow border-brand-cyan/40 p-6 sm:p-8 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col items-center text-center relative overflow-hidden"
      >
        {/* Glowing Top Decoration */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-2 bg-gradient-to-r from-brand-cyan via-brand-blue to-brand-purple rounded-b-full shadow-lg shadow-brand-cyan/50" />

        {/* Title */}
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="w-7 h-7 text-amber-400 drop-shadow-md animate-bounce" />
          <h2 className="text-2xl sm:text-3xl font-black tracking-wider text-white uppercase font-sans">
            ROUND COMPLETE!
          </h2>
        </div>
        <p className="text-xs font-mono text-cyan-300 uppercase tracking-widest mb-5">
          Level {currentLevel} Cleared
        </p>

        {/* Standings Podium */}
        <div className="w-full space-y-2 mb-6">
          {standings.slice(0, 5).map((player, idx) => {
            const isCurrent = player.playerId === currentPlayer?.id;
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;

            return (
              <div
                key={player.playerId}
                className={`flex items-center justify-between px-4 py-2.5 rounded-2xl border transition-all ${
                  isCurrent
                    ? 'bg-brand-cyan/15 border-brand-cyan/60 shadow-lg shadow-brand-cyan/10'
                    : 'bg-dark-800/70 border-slate-700/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg font-mono font-bold">{medal}</span>
                  <span className={`text-sm font-bold truncate max-w-[130px] ${isCurrent ? 'text-cyan-300' : 'text-slate-200'}`}>
                    {player.name} {isCurrent && '(YOU)'}
                  </span>
                </div>

                <div className="flex items-center gap-4 font-mono text-xs">
                  <span className="text-slate-400">
                    {player.completionTime !== null ? `${player.completionTime}s` : 'DNP'}
                  </span>
                  <span className="font-bold text-brand-cyan min-w-[60px] text-right">
                    +{player.roundScore}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Personal Score Breakdown */}
        {breakdown && (
          <div className="w-full bg-dark-900/80 border border-slate-800/80 rounded-2xl p-3 mb-5 font-mono text-xs">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">Round Score Breakdown</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center p-2 rounded-xl bg-dark-800/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 flex items-center gap-1">Base</span>
                <span className="font-bold text-slate-200 mt-0.5">+{breakdown.baseScore}</span>
              </div>
              <div className="flex flex-col items-center p-2 rounded-xl bg-dark-800/60 border border-slate-800">
                <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Speed
                </span>
                <span className="font-bold text-emerald-300 mt-0.5">+{breakdown.speedBonus}</span>
              </div>
              <div className="flex flex-col items-center p-2 rounded-xl bg-dark-800/60 border border-slate-800">
                <span className="text-[10px] text-amber-400 flex items-center gap-1">
                  <Move className="w-3 h-3" /> Moves
                </span>
                <span className="font-bold text-amber-300 mt-0.5">+{breakdown.moveBonus}</span>
              </div>
            </div>
          </div>
        )}

        {/* Next Level Progression Bar & Timer */}
        <div className="w-full flex items-center justify-between p-3 rounded-2xl bg-brand-cyan/10 border border-brand-cyan/30 text-xs font-mono">
          <div className="flex items-center gap-2 text-cyan-300 font-bold">
            <span>NEXT LEVEL</span>
            <span className="text-slate-400">{currentLevel}</span>
            <ArrowRight className="w-4 h-4 text-brand-cyan" />
            <span className="text-white text-sm">{currentLevel + 1}</span>
          </div>

          <div className="text-slate-300 font-medium">
            Starting in <span className="font-black text-brand-cyan text-sm">{secondsRemaining}s</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
