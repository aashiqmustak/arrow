import React, { useState } from 'react';
import { Copy, Check, Shield } from 'lucide-react';
import { SoundToggle } from './SoundToggle';
import { Player } from '../types/socketEvents';

interface GameHUDProps {
  level: number;
  roomCode: string;
  currentPlayer: Player | null;
  players: Record<string, Player>;
  arrowsRemaining: number;
  moveCount: number;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  level,
  roomCode,
  currentPlayer,
  players,
  arrowsRemaining,
  moveCount,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activePlayersList = Object.values(players)
    .filter(p => p.connected)
    .sort((a, b) => b.score - a.score);

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-3 px-3 pt-2 select-none">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between glass-panel px-4 py-2.5 rounded-2xl">
        {/* Top Left: Level Badge */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 bg-brand-cyan/15 border border-brand-cyan/40 rounded-xl">
            <span className="text-xs font-mono uppercase tracking-wider text-cyan-300 font-bold">
              LEVEL {level}
            </span>
          </div>
        </div>

        {/* Top Center: Brand Identity */}
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-brand-cyan to-brand-blue flex items-center justify-center text-dark-950 font-black text-xs shadow-md">
            ↗
          </div>
          <span className="text-base sm:text-lg font-black tracking-wider text-white neon-text-cyan">
            AS ARROW
          </span>
        </div>

        {/* Top Right: Room Code & Sound */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-dark-800/80 border border-slate-700/70 hover:border-brand-cyan/40 text-xs font-mono text-slate-300 hover:text-white transition-all active:scale-95"
            title="Click to copy Room Code"
          >
            <span className="text-slate-400">Room:</span>
            <span className="font-bold text-cyan-300 tracking-wider">{roomCode}</span>
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
          </button>
          <SoundToggle />
        </div>
      </div>

      {/* Player Personal Stat & Live Multiplayer Mini Leaderboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {/* User Card */}
        <div className="glass-panel px-4 py-2 rounded-2xl flex items-center justify-between border-brand-cyan/20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-cyan/30 to-brand-purple/30 border border-brand-cyan/50 flex items-center justify-center font-bold text-xs text-white">
              {currentPlayer?.name?.charAt(0).toUpperCase() || 'P'}
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                YOU
                {currentPlayer?.isHost && (
                  <span title="Host">
                    <Shield className="w-3 h-3 text-amber-400" />
                  </span>
                )}
              </span>
              <span className="text-sm font-bold text-white truncate max-w-[120px]">
                {currentPlayer?.name || 'Player'}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">TOTAL SCORE</span>
            <span className="text-base sm:text-lg font-mono font-black text-brand-cyan">
              {currentPlayer?.score?.toLocaleString() || '0'}
            </span>
          </div>
        </div>

        {/* Live Multiplayer Status Bar */}
        <div className="glass-panel px-3 py-2 rounded-2xl flex items-center gap-2 overflow-x-auto">
          <span className="text-[10px] uppercase tracking-wider font-mono text-slate-400 font-bold px-1 shrink-0">
            LIVE:
          </span>
          <div className="flex items-center gap-2 overflow-x-auto py-0.5 no-scrollbar">
            {activePlayersList.map((p, idx) => {
              const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
              const isDone = p.status === 'COMPLETED';

              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono border shrink-0 transition-all ${
                    p.id === currentPlayer?.id
                      ? 'bg-brand-cyan/15 border-brand-cyan/50 text-white'
                      : 'bg-dark-800/60 border-slate-700/50 text-slate-300'
                  }`}
                >
                  <span className="text-xs">{medal}</span>
                  <span className="font-medium truncate max-w-[80px]">{p.name}</span>
                  <span className="text-[10px] ml-0.5">
                    {isDone ? (
                      <span className="text-emerald-400 font-bold">✅ {p.completionTime}s</span>
                    ) : (
                      <span className="text-amber-400 animate-pulse">🟢 Solving</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* In-Game Bottom Statistics */}
      <div className="flex items-center justify-between px-4 py-2 glass-panel rounded-2xl border-slate-800/80 font-mono text-xs sm:text-sm">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">ARROWS LEFT:</span>
          <span className="font-black text-brand-cyan text-base">{arrowsRemaining}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">MOVES:</span>
          <span className="font-black text-amber-300 text-base">{moveCount}</span>
        </div>
      </div>
    </div>
  );
};
