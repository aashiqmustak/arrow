import React, { useState } from 'react';
import { Copy, Check, Users, Shield, Play, Share2, LogOut } from 'lucide-react';
import { SoundToggle } from './SoundToggle';
import { RoomData, Player } from '../types/socketEvents';

interface RoomLobbyProps {
  room: RoomData;
  currentPlayer: Player | null;
  onStartGame: () => void;
  onLeaveRoom: () => void;
  isStarting: boolean;
}

export const RoomLobby: React.FC<RoomLobbyProps> = ({
  room,
  currentPlayer,
  onStartGame,
  onLeaveRoom,
  isStarting,
}) => {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room.roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareLink = async () => {
    const url = `${window.location.origin}/room/${room.roomCode}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my AS Arrow game room!',
          text: `Join my AS Arrow room with code: ${room.roomCode}`,
          url,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    navigator.clipboard.writeText(url);
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  };

  const isHost = currentPlayer?.isHost;
  const activePlayers = Object.values(room.players).filter(p => p.connected);

  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-4 sm:p-6 max-w-xl mx-auto select-none">
      {/* Top Header */}
      <header className="w-full flex items-center justify-between glass-panel px-5 py-3.5 rounded-3xl">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-cyan to-brand-blue flex items-center justify-center text-dark-950 font-black text-sm shadow-md shadow-brand-cyan/20">
            ↗
          </div>
          <span className="text-xl font-black tracking-wider text-white neon-text-cyan">
            AS ARROW
          </span>
        </div>

        <div className="flex items-center gap-2">
          <SoundToggle />
          <button
            onClick={onLeaveRoom}
            className="p-2.5 rounded-xl bg-dark-800/80 border border-slate-700/60 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 transition-all active:scale-95"
            title="Leave Room"
            aria-label="Leave Room"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Center Room Code Card */}
      <main className="w-full my-auto py-6 flex flex-col items-center">
        <div className="glass-panel-glow border-brand-cyan/40 p-6 sm:p-8 rounded-3xl w-full flex flex-col items-center text-center relative overflow-hidden shadow-2xl">
          {/* Subtle Cyber Glow in Background */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-brand-cyan/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-brand-blue/15 rounded-full blur-3xl pointer-events-none" />

          <span className="text-xs font-mono uppercase tracking-[0.25em] text-cyan-300 font-bold mb-2">
            ROOM READY
          </span>
          <p className="text-sm text-slate-400 mb-5">
            Share this code with your friends to play together
          </p>

          {/* Large 6-Character Room Code Display */}
          <div className="bg-dark-950/80 border-2 border-brand-cyan/50 rounded-2xl px-6 py-4 mb-5 flex items-center justify-center gap-3 shadow-inner group">
            <span className="text-4xl sm:text-5xl font-mono font-black tracking-widest text-white neon-text-cyan">
              {room.roomCode}
            </span>
          </div>

          {/* Action Buttons: Copy & Share */}
          <div className="flex items-center gap-3 w-full max-w-sm mb-6">
            <button
              onClick={handleCopyCode}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-dark-800/90 border border-brand-cyan/40 text-sm font-bold text-white hover:bg-brand-cyan/20 transition-all active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">COPIED!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-cyan-300" />
                  <span>COPY CODE</span>
                </>
              )}
            </button>

            <button
              onClick={handleShareLink}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-dark-800/90 border border-slate-700/80 text-sm font-bold text-slate-300 hover:text-white hover:border-slate-500 transition-all active:scale-95"
              title="Share Room Link"
            >
              {shared ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Share2 className="w-4 h-4 text-slate-400" />
              )}
              <span className="hidden sm:inline">SHARE</span>
            </button>
          </div>

          {/* Connected Players Section */}
          <div className="w-full border-t border-slate-800/80 pt-5">
            <div className="flex items-center justify-between mb-3 text-xs font-mono">
              <span className="text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-bold">
                <Users className="w-3.5 h-3.5 text-brand-cyan" />
                PLAYERS
              </span>
              <span className="text-cyan-300 bg-brand-cyan/15 px-2.5 py-0.5 rounded-full font-bold">
                {activePlayers.length} {activePlayers.length === 1 ? 'Player' : 'Players'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {activePlayers.map((player) => {
                const isCurrent = player.id === currentPlayer?.id;

                return (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl border text-sm transition-all ${
                      isCurrent
                        ? 'bg-brand-cyan/15 border-brand-cyan/40 text-white'
                        : 'bg-dark-900/60 border-slate-800/80 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                      <span className="font-medium truncate max-w-[130px]">
                        {player.name} {isCurrent && '(You)'}
                      </span>
                    </div>

                    {player.isHost && (
                      <span className="flex items-center gap-1 text-[10px] font-mono uppercase bg-amber-500/20 border border-amber-400/40 text-amber-300 px-2 py-0.5 rounded-md shrink-0">
                        <Shield className="w-2.5 h-2.5" /> HOST
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Controls / Host Start Button */}
      <footer className="w-full pb-2">
        {isHost ? (
          <button
            onClick={onStartGame}
            disabled={isStarting}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-brand-cyan via-brand-blue to-brand-purple hover:brightness-110 active:scale-[0.98] text-dark-950 font-black text-lg tracking-wider uppercase transition-all shadow-xl shadow-brand-cyan/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Play className="w-6 h-6 fill-current" />
            {isStarting ? 'STARTING...' : 'START GAME'}
          </button>
        ) : (
          <div className="w-full py-4 rounded-2xl glass-panel border-slate-800/80 text-center font-mono text-sm text-slate-400 flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            Waiting for host to start...
          </div>
        )}
      </footer>
    </div>
  );
};
