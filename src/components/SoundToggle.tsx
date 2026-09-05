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
      className={`p-2.5 rounded-xl border transition-all duration-200 flex items-center justify-center cursor-pointer ${
        muted
          ? 'bg-zinc-100 border-zinc-200 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200'
          : 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 shadow-sm'
      } ${className}`}
      title={muted ? 'Sound: OFF (Click to unmute)' : 'Sound: ON (Click to mute)'}
      aria-label="Toggle Sound"
    >
      {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
    </button>
  );
};
