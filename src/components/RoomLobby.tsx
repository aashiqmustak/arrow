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
          title: 'Join my Arrow game room!',
          text: `Join my Arrow room with code: ${room.roomCode}`,
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
    <div className="min-h-screen flex flex-col items-center justify-between p-4 sm:p-6 max-w-xl mx-auto select-none bg-zinc-50">
      {/* Top Header */}
      <header className="w-full flex items-center justify-between bg-white/90 backdrop-blur-md px-5 py-3 rounded-2xl border border-zinc-200 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center text-white font-black text-sm shadow-md shadow-purple-600/20">
            ↗
          </div>
          <span className="text-lg font-black tracking-wider text-zinc-900">
            ARROW<span className="text-purple-600">.</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <SoundToggle />
          <button
            onClick={onLeaveRoom}
            className="p-2.5 rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-500 hover:text-rose-600 hover:bg-rose-50 transition-all active:scale-95 cursor-pointer"
            title="Leave Room"
            aria-label="Leave Room"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Center Room Code Card */}
      <main className="w-full my-auto py-6 flex flex-col items-center">
        <div className="bg-white border border-zinc-200/80 p-6 sm:p-8 rounded-3xl w-full flex flex-col items-center text-center relative overflow-hidden shadow-xl">
          <span className="text-xs font-mono uppercase tracking-[0.25em] text-purple-600 font-bold mb-2">
            ROOM READY
          </span>
          <p className="text-xs text-zinc-500 mb-5">
            Share this room code with other players to invite them
          </p>

          {/* Large 6-Character Room Code Display */}
          <div className="bg-zinc-50 border-2 border-zinc-200 rounded-2xl px-6 py-4 mb-5 flex items-center justify-center gap-3 shadow-inner">
            <span className="text-4xl sm:text-5xl font-mono font-black tracking-widest text-zinc-900">
              {room.roomCode}
            </span>
          </div>

          {/* Action Buttons: Copy & Share */}
          <div className="flex items-center gap-3 w-full max-w-sm mb-6">
            <button
              onClick={handleCopyCode}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-xs font-bold text-zinc-800 transition-all active:scale-95 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700 font-mono">COPIED!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-purple-600" />
                  <span>COPY CODE</span>
                </>
              )}
            </button>

            <button
              onClick={handleShareLink}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-xs font-bold text-zinc-700 transition-all active:scale-95 cursor-pointer"
              title="Share Room Link"
            >
              {shared ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <Share2 className="w-4 h-4 text-zinc-600" />
              )}
              <span className="hidden sm:inline">SHARE</span>
            </button>
          </div>

          {/* Connected Players Section */}
          <div className="w-full border-t border-zinc-100 pt-5">
            <div className="flex items-center justify-between mb-3 text-xs font-mono">
              <span className="text-zinc-600 uppercase tracking-wider flex items-center gap-1.5 font-medium">
                <Users className="w-3.5 h-3.5 text-purple-600" />
                PLAYERS
              </span>
              <span className="text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md font-bold text-[11px]">
                {activePlayers.length} {activePlayers.length === 1 ? 'Player' : 'Players'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {activePlayers.map((player) => {
                const isCurrent = player.id === currentPlayer?.id;

                return (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs transition-all ${
                      isCurrent
                        ? 'bg-purple-50 border-purple-200 text-purple-950 font-semibold'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span className="font-medium truncate max-w-[130px]">
                        {player.name} {isCurrent && '(You)'}
                      </span>
                    </div>

                    {player.isHost && (
                      <span className="flex items-center gap-1 text-[10px] font-mono uppercase bg-zinc-200 text-zinc-800 px-1.5 py-0.5 rounded shrink-0 font-semibold">
                        <Shield className="w-2.5 h-2.5 text-purple-600" /> HOST
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
            className="w-full py-3.5 rounded-2xl bg-black hover:bg-zinc-800 active:scale-[0.98] text-white font-black text-sm tracking-wider uppercase transition-all shadow-lg shadow-black/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-current" />
            {isStarting ? 'STARTING...' : 'START GAME'}
          </button>
        ) : (
          <div className="w-full py-3.5 rounded-2xl bg-white border border-zinc-200 text-center font-mono text-xs text-zinc-500 flex items-center justify-center gap-2 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />
            Waiting for host to start...
          </div>
        )}
      </footer>
    </div>
  );
};
