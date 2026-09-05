import React, { useState } from 'react';
import { Copy, Check, Shield, Heart } from 'lucide-react';
import { SoundToggle } from './SoundToggle';
import { Player } from '../types/socketEvents';

interface GameHUDProps {
  level: number;
  roomCode: string;
  currentPlayer: Player | null;
  players: Record<string, Player>;
  lives?: number;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  level,
  roomCode,
  currentPlayer,
  players,
  lives = 3,
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
    <div className="w-full flex flex-col gap-1.5 select-none bg-white border border-zinc-200 rounded-3xl p-2.5 shadow-md font-sans">
      {/* Top Row: Level Badge, Hearts, Room Code & Sound */}
      <div className="flex items-center justify-between gap-1.5 px-2 py-1 bg-zinc-50 border border-zinc-200/80 rounded-2xl">
        {/* Level Badge */}
        <div className="px-2 py-0.5 bg-purple-50 border border-purple-200 rounded-xl">
          <span className="text-[11px] font-mono uppercase tracking-wider text-purple-800 font-bold">
            LVL {level}
          </span>
        </div>

        {/* 3 Hearts (Lives) */}
        <div className="flex items-center gap-1 px-2 py-0.5 bg-white rounded-full border border-zinc-200 shadow-2xs">
          {[1, 2, 3].map(heartIdx => (
            <Heart
              key={heartIdx}
              className={`w-3.5 h-3.5 transition-all duration-300 ${
                heartIdx <= lives
                  ? 'text-rose-500 fill-rose-500 drop-shadow-[0_0_4px_rgba(244,63,94,0.3)] scale-100'
                  : 'text-zinc-300 fill-zinc-100 scale-90 opacity-40'
              }`}
            />
          ))}
        </div>

        {/* Room Code & Sound */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1 px-2 py-0.5 rounded-xl bg-white border border-zinc-200 hover:border-purple-300 text-[10px] font-mono text-zinc-700 hover:text-zinc-900 transition-all active:scale-95 cursor-pointer shadow-2xs"
            title="Click to copy Room Code"
          >
            <span className="font-bold text-purple-700">{roomCode}</span>
            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-zinc-400" />}
          </button>
          <SoundToggle />
        </div>
      </div>

      {/* Second Row: User Personal Stat & Live Leaderboard */}
      <div className="flex flex-col gap-1.5">
        {/* User Card */}
        <div className="px-3 py-1.5 bg-zinc-50 border border-zinc-200/80 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center font-bold text-[11px] text-white shadow-2xs">
              {currentPlayer?.name?.charAt(0).toUpperCase() || 'P'}
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] text-zinc-500 font-medium flex items-center gap-1 leading-none">
                YOU
                {currentPlayer?.isHost && (
                  <span title="Host">
                    <Shield className="w-2.5 h-2.5 text-purple-600" />
                  </span>
                )}
              </span>
              <span className="text-xs font-semibold text-zinc-900 truncate max-w-[100px] leading-tight">
                {currentPlayer?.name || 'Player'}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-mono leading-none">SCORE</span>
            <span className="text-sm font-mono font-bold text-purple-700 leading-tight">
              {currentPlayer?.score?.toLocaleString() || '0'}
            </span>
          </div>
        </div>

        {/* Live Multiplayer Mini Status Bar */}
        <div className="px-2.5 py-1 bg-zinc-50/70 border border-zinc-200/60 rounded-2xl flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-[9px] uppercase tracking-wider font-mono text-zinc-500 font-semibold shrink-0">
            LIVE:
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {activePlayersList.map((p, idx) => {
              const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
              const isDone = p.status === 'COMPLETED';

              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono border shrink-0 transition-all ${
                    p.id === currentPlayer?.id
                      ? 'bg-purple-50 border-purple-200 text-purple-900 font-semibold'
                      : 'bg-white border-zinc-200 text-zinc-700 shadow-2xs'
                  }`}
                >
                  <span className="text-[10px]">{medal}</span>
                  <span className="font-medium truncate max-w-[65px]">{p.name}</span>
                  <span className="text-[9px]">
                    {isDone ? (
                      <span className="text-emerald-600 font-bold">✅ {p.completionTime}s</span>
                    ) : (
                      <span className="text-purple-600 animate-pulse">🟢</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
