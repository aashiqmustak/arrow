import React, { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { sound } from '../game/audioEngine';

export const SoundToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [muted, setMuted] = useState(sound.isMuted());

  const handleToggle = () => {
    const nextMuted = sound.toggleMute();
    setMuted(nextMuted);
    if (!nextMuted) {
      sound.playArrowEscape(2);
    }
  };

  return (
    <button
      onClick={handleToggle}
      className={`p-2.5 rounded-xl border transition-all duration-200 flex items-center justify-center ${
        muted
          ? 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
          : 'bg-brand-cyan/10 border-brand-cyan/40 text-brand-cyan hover:bg-brand-cyan/20 shadow-lg shadow-brand-cyan/10'
      } ${className}`}
      title={muted ? 'Sound: OFF (Click to unmute)' : 'Sound: ON (Click to mute)'}
      aria-label="Toggle Sound"
    >
      {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
    </button>
  );
};
