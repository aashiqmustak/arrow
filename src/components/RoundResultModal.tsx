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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="bg-white border border-purple-200 p-6 sm:p-7 rounded-3xl w-full max-w-md shadow-2xl flex flex-col items-center text-center relative overflow-hidden"
      >
        {/* Top Accent Strip */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-purple-600 rounded-b-full shadow-sm shadow-purple-500/50" />

        {/* Title */}
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="w-6 h-6 text-purple-600" />
          <h2 className="text-xl sm:text-2xl font-black tracking-wider text-zinc-900 uppercase font-sans">
            ROUND COMPLETE
          </h2>
        </div>
        <p className="text-xs font-mono text-purple-600 uppercase tracking-widest mb-4 font-bold">
          Level {currentLevel} Cleared
        </p>

        {/* Standings Podium */}
        <div className="w-full space-y-1.5 mb-4">
          {standings.slice(0, 5).map((player, idx) => {
            const isCurrent = player.playerId === currentPlayer?.id;
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;

            return (
              <div
                key={player.playerId}
                className={`flex items-center justify-between px-3.5 py-2 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-purple-50 border-purple-300 text-purple-950 font-semibold'
                    : 'bg-zinc-50 border-zinc-200 text-zinc-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-mono font-bold">{medal}</span>
                  <span className={`text-xs font-bold truncate max-w-[130px] ${isCurrent ? 'text-purple-700' : 'text-zinc-800'}`}>
                    {player.name} {isCurrent && '(YOU)'}
                  </span>
                </div>

                <div className="flex items-center gap-3 font-mono text-xs">
                  <span className="text-zinc-500">
                    {player.completionTime !== null ? `${player.completionTime}s` : 'DNP'}
                  </span>
                  <span className="font-bold text-zinc-900 min-w-[50px] text-right">
                    +{player.roundScore}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Personal Score Breakdown */}
        {breakdown && (
          <div className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 mb-4 font-mono text-xs">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5 font-semibold">Round Score Breakdown</div>
            <div className="grid grid-cols-3 gap-1.5">
              <div className="flex flex-col items-center p-1.5 rounded-lg bg-white border border-zinc-200 shadow-2xs">
                <span className="text-[9px] text-zinc-500">Base</span>
                <span className="font-bold text-zinc-900 text-xs mt-0.5">+{breakdown.baseScore}</span>
              </div>
              <div className="flex flex-col items-center p-1.5 rounded-lg bg-white border border-zinc-200 shadow-2xs">
                <span className="text-[9px] text-purple-600 flex items-center gap-0.5">
                  <Zap className="w-2.5 h-2.5" /> Speed
                </span>
                <span className="font-bold text-purple-700 text-xs mt-0.5">+{breakdown.speedBonus}</span>
              </div>
              <div className="flex flex-col items-center p-1.5 rounded-lg bg-white border border-zinc-200 shadow-2xs">
                <span className="text-[9px] text-zinc-500 flex items-center gap-0.5">
                  <Move className="w-2.5 h-2.5 text-zinc-400" /> Moves
                </span>
                <span className="font-bold text-zinc-900 text-xs mt-0.5">+{breakdown.moveBonus}</span>
              </div>
            </div>
          </div>
        )}

        {/* Next Level Progression Bar & Timer */}
        <div className="w-full flex items-center justify-between p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-xs font-mono">
          <div className="flex items-center gap-2 text-purple-800 font-bold">
            <span>NEXT LEVEL</span>
            <span className="text-zinc-500">{currentLevel}</span>
            <ArrowRight className="w-3.5 h-3.5 text-purple-600" />
            <span className="text-zinc-900 font-bold">{currentLevel + 1}</span>
          </div>

          <div className="text-zinc-600 font-medium text-[11px]">
            Starting in <span className="font-black text-purple-700 text-xs">{secondsRemaining}s</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
