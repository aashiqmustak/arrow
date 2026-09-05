import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, Play, Users, Sparkles, X, ChevronRight } from 'lucide-react';
import { SoundToggle } from './SoundToggle';
import { getSavedPlayerName } from '../services/socketService';

interface LandingProps {
  initialRoomCode?: string;
  onCreateRoom: (playerName: string) => void;
  onJoinRoom: (roomCode: string, playerName: string) => void;
  isLoading: boolean;
  errorMessage: string | null;
  onClearError: () => void;
}

export const Landing: React.FC<LandingProps> = ({
  initialRoomCode = '',
  onCreateRoom,
  onJoinRoom,
  isLoading,
  errorMessage,
  onClearError,
}) => {
  const [modalMode, setModalMode] = useState<'NONE' | 'CREATE' | 'JOIN'>(
    initialRoomCode ? 'JOIN' : 'NONE'
  );
  const [playerName, setPlayerName] = useState<string>(getSavedPlayerName() || '');
  const [roomCode, setRoomCode] = useState<string>(initialRoomCode.toUpperCase());
  const [localError, setLocalError] = useState<string | null>(null);

  const handleOpenCreate = () => {
    onClearError();
    setLocalError(null);
    setModalMode('CREATE');
  };

  const handleOpenJoin = () => {
    onClearError();
    setLocalError(null);
    setModalMode('JOIN');
  };

  const handleCloseModal = () => {
    setModalMode('NONE');
    setLocalError(null);
    onClearError();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = playerName.trim();
    if (!cleanName) {
      setLocalError("Please enter a display name (e.g. 'Aashiq')");
      return;
    }

    if (modalMode === 'CREATE') {
      onCreateRoom(cleanName);
    } else if (modalMode === 'JOIN') {
      const cleanCode = roomCode.trim().toUpperCase();
      if (!cleanCode || cleanCode.length !== 6) {
        setLocalError('Please enter a valid 6-character room code');
        return;
      }
      onJoinRoom(cleanCode, cleanName);
    }
  };

  // Decorative floating arrows in background
  const backgroundArrows = [
    { top: '12%', left: '8%', rotate: -45, size: 36, delay: 0 },
    { top: '22%', right: '12%', rotate: 45, size: 48, delay: 1 },
    { top: '70%', left: '15%', rotate: 135, size: 40, delay: 2 },
    { top: '80%', right: '10%', rotate: -135, size: 52, delay: 0.5 },
    { top: '45%', left: '5%', rotate: 90, size: 30, delay: 1.5 },
    { top: '40%', right: '6%', rotate: -90, size: 34, delay: 2.5 },
  ];

  return (
    <div className="relative min-h-screen flex flex-col justify-between items-center p-4 sm:p-6 overflow-hidden select-none">
      {/* Dynamic Background Floating Arrows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {backgroundArrows.map((item, idx) => (
          <motion.div
            key={idx}
            className="absolute text-brand-cyan/10"
            style={{
              top: item.top,
              left: item.left,
              right: item.right,
              transform: `rotate(${item.rotate}deg)`,
            }}
            animate={{
              y: [0, -18, 0],
              opacity: [0.08, 0.22, 0.08],
            }}
            transition={{
              duration: 5 + idx,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: item.delay,
            }}
          >
            <ArrowUpRight style={{ width: item.size, height: item.size }} />
          </motion.div>
        ))}
      </div>

      {/* Top Header */}
      <header className="w-full max-w-4xl flex items-center justify-between z-10 glass-panel px-5 py-3 rounded-2xl">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-cyan to-brand-blue flex items-center justify-center text-dark-950 font-black text-sm shadow-md shadow-brand-cyan/20">
            ↗
          </div>
          <span className="text-xl font-black tracking-wider text-white neon-text-cyan">
            AS ARROW
          </span>
        </div>

        <div className="flex items-center gap-3">
          <SoundToggle />
        </div>
      </header>

      {/* Hero Content */}
      <main className="w-full max-w-xl my-auto py-8 flex flex-col items-center text-center z-10">
        {/* Glow Accent Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan text-xs font-mono uppercase tracking-widest mb-6"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Real-time Multiplayer Puzzle</span>
        </motion.div>

        {/* Main Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-4xl sm:text-6xl font-black text-white tracking-tight mb-4 leading-tight"
        >
          Clear the arrows. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-cyan via-brand-blue to-brand-purple neon-text-cyan">
            Beat your friends.
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-base sm:text-lg text-slate-300 max-w-md mb-8 leading-relaxed font-normal"
        >
          A fast multiplayer puzzle where every move matters. Compete live on the exact same board.
        </motion.p>

        {/* Error Alert if any */}
        {(errorMessage || localError) && (
          <div className="w-full mb-6 p-3 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-sm font-mono flex items-center justify-between">
            <span>{errorMessage || localError}</span>
            <button onClick={() => { onClearError(); setLocalError(null); }} className="text-rose-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Primary Call-To-Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="w-full flex flex-col sm:flex-row items-center gap-4 max-w-md"
        >
          <button
            onClick={handleOpenCreate}
            className="w-full sm:w-1/2 py-4 px-6 rounded-2xl bg-gradient-to-r from-brand-cyan via-brand-blue to-brand-purple text-dark-950 font-black text-base uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all shadow-xl shadow-brand-cyan/25 flex items-center justify-center gap-2 group cursor-pointer"
          >
            <Play className="w-5 h-5 fill-current transition-transform group-hover:scale-110" />
            <span>CREATE ROOM</span>
          </button>

          <button
            onClick={handleOpenJoin}
            className="w-full sm:w-1/2 py-4 px-6 rounded-2xl bg-dark-800/90 border border-slate-700 hover:border-brand-cyan/50 hover:bg-dark-700 text-white font-bold text-base uppercase tracking-wider active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Users className="w-5 h-5 text-cyan-300" />
            <span>JOIN ROOM</span>
          </button>
        </motion.div>

        {/* Zero Signup Guarantee Text */}
        <p className="mt-8 text-xs font-mono text-slate-400 uppercase tracking-widest">
          ⚡ No signup. No downloads. Just play.
        </p>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-4xl text-center py-3 text-xs text-slate-400 font-mono z-10">
        AS Arrow © {new Date().getFullYear()} — Ultra-fast Realtime Multiplayer
      </footer>

      {/* Modal: Create or Join Room */}
      <AnimatePresence>
        {modalMode !== 'NONE' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="glass-panel-glow border-brand-cyan/40 p-6 sm:p-8 rounded-3xl w-full max-w-md shadow-2xl relative"
            >
              {/* Close Button */}
              <button
                onClick={handleCloseModal}
                className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-xl hover:bg-dark-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Modal Header */}
              <div className="mb-6">
                <span className="text-xs font-mono uppercase tracking-widest text-cyan-300 font-bold">
                  {modalMode === 'CREATE' ? 'HOST A MATCH' : 'ENTER CODE'}
                </span>
                <h3 className="text-2xl font-black text-white mt-1">
                  {modalMode === 'CREATE' ? 'Create Game Room' : 'Join Game Room'}
                </h3>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Temporary Name Input */}
                <div>
                  <label className="block text-xs font-mono text-slate-300 uppercase tracking-wider mb-2 font-semibold">
                    What's your name?
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={15}
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="e.g. Aashiq, ArrowMaster"
                    autoFocus
                    className="w-full px-4 py-3.5 rounded-2xl bg-dark-900/90 border border-slate-700/80 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 text-white font-medium placeholder:text-slate-500 transition-all outline-none"
                  />
                  <span className="block text-[10px] font-mono text-slate-400 mt-1 text-right">
                    {playerName.length}/15 chars (No account required)
                  </span>
                </div>

                {/* Room Code Input (If Joining) */}
                {modalMode === 'JOIN' && (
                  <div>
                    <label className="block text-xs font-mono text-slate-300 uppercase tracking-wider mb-2 font-semibold">
                      Enter 6-Character Room Code
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      placeholder="ABC123"
                      className="w-full px-4 py-3.5 rounded-2xl bg-dark-900/90 border border-slate-700/80 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 text-white font-mono font-bold tracking-widest uppercase placeholder:text-slate-500 transition-all outline-none text-center text-xl"
                    />
                  </div>
                )}

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-4 rounded-2xl bg-gradient-to-r from-brand-cyan via-brand-blue to-brand-purple text-dark-950 font-black text-base uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all shadow-xl shadow-brand-cyan/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <span>CONNECTING...</span>
                  ) : (
                    <>
                      <span>{modalMode === 'CREATE' ? 'CREATE & ENTER LOBBY' : 'JOIN ROOM'}</span>
                      <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
