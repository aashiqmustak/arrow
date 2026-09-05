import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Smile, Bell, BellOff, Sparkles } from 'lucide-react';
import { ChatMessage, Player } from '../types/socketEvents';
import { socketService } from '../services/socketService';
import { sound } from '../game/audioEngine';

interface ChatPanelProps {
  currentUserId: string;
  players: Record<string, Player>;
  roomCode: string;
}

const QUICK_REACTIONS = [
  '👋 Hi!',
  '🔥 GG!',
  '🚀 Let\'s go!',
  '😅 So close!',
  '🎉 Nice move!',
  '🧩 Tricky maze!',
];

export const ChatPanel: React.FC<ChatPanelProps> = ({
  currentUserId,
  players,
  roomCode,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showQuickReactions, setShowQuickReactions] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Listen for real-time chat messages
  useEffect(() => {
    const socket = socketService.getSocket();

    const handleNewMessage = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
      if (soundEnabled && !msg.isSystem) {
        sound.playCountdownTick(false);
      }
    };

    socket.on('newChatMessage', handleNewMessage);

    return () => {
      socket.off('newChatMessage', handleNewMessage);
    };
  }, [soundEnabled]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    if (!textToSend) {
      setInputText('');
    }

    try {
      await socketService.sendChatMessage(text);
      if (soundEnabled) {
        sound.playArrowSwipe();
      }
    } catch {
      // Ignore
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const activePlayerCount = Object.values(players).filter((p) => p.connected).length;

  return (
    <aside
      className="w-full h-full max-h-full flex flex-col bg-white border border-zinc-200/90 rounded-3xl shadow-lg overflow-hidden font-sans"
      aria-label="Room Live Chat"
    >
      {/* Header */}
      <header className="flex items-center justify-between px-3.5 py-2.5 bg-zinc-50 border-b border-zinc-200">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-7 h-7 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 shadow-2xs">
              <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-purple-600 ring-2 ring-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-xs text-zinc-900 tracking-wide">Live Chat</h3>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 border border-purple-200">
                {roomCode}
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 font-mono">
              {activePlayerCount} {activePlayerCount === 1 ? 'player' : 'players'} online
            </p>
          </div>
        </div>

        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="p-1.5 rounded-xl hover:bg-zinc-200 text-zinc-400 hover:text-zinc-800 transition-colors cursor-pointer"
          title={soundEnabled ? 'Mute Chat Sounds' : 'Unmute Chat Sounds'}
        >
          {soundEnabled ? <Bell className="w-3.5 h-3.5 text-purple-600" /> : <BellOff className="w-3.5 h-3.5 text-zinc-400" />}
        </button>
      </header>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-zinc-50/50 scrollbar-thin scrollbar-thumb-zinc-300 scrollbar-track-transparent">
        {messages.length === 0 ? (
          <div className="h-full min-h-[140px] flex flex-col items-center justify-center text-center p-4 text-zinc-400">
            <div className="w-8 h-8 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center mb-2 text-purple-600">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>
            <p className="font-medium text-xs text-zinc-700 mb-0.5">Room Chat Ready</p>
            <p className="text-[10px] text-zinc-500 max-w-[170px]">
              Chat or send quick reactions during matches
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;

            if (msg.isSystem) {
              return (
                <div key={msg.id} className="flex justify-center my-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-[10px] text-purple-700 font-mono shadow-2xs">
                    {msg.text}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}
              >
                {!isMe && (
                  <span className="text-[10px] font-medium text-zinc-600 mb-0.5 ml-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                    {msg.senderName}
                  </span>
                )}
                <div
                  className={`max-w-[85%] px-3 py-1.5 rounded-2xl text-xs break-words shadow-2xs ${
                    isMe
                      ? 'bg-purple-600 text-white rounded-tr-none font-medium'
                      : 'bg-white text-zinc-900 border border-zinc-200 rounded-tl-none font-normal'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[9px] text-zinc-400 font-mono mt-0.5 px-1 opacity-60 group-hover:opacity-100 transition-opacity">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Reactions Bar */}
      <div className="px-3 py-1.5 bg-zinc-50 border-t border-zinc-200">
        <div className="flex items-center justify-between mb-1 px-0.5">
          <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider font-semibold">Quick Chat</span>
          <button
            onClick={() => setShowQuickReactions(!showQuickReactions)}
            className="text-[9px] text-purple-600 hover:text-purple-800 cursor-pointer font-mono font-medium"
          >
            {showQuickReactions ? 'Fewer' : 'More'}
          </button>
        </div>
        <div className="flex flex-wrap gap-1 max-h-14 overflow-y-auto no-scrollbar">
          {(showQuickReactions ? QUICK_REACTIONS : QUICK_REACTIONS.slice(0, 3)).map((emoji, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(emoji)}
              className="px-2 py-0.5 rounded-xl bg-white hover:bg-purple-50 text-zinc-700 hover:text-purple-900 border border-zinc-200 hover:border-purple-200 text-[10px] font-medium transition-all active:scale-95 cursor-pointer whitespace-nowrap shadow-2xs"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Message Input Footer */}
      <footer className="p-2 bg-white border-t border-zinc-200 flex items-center gap-1.5">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            maxLength={300}
            className="w-full pl-3 pr-7 py-1.5 rounded-2xl bg-zinc-50 border border-zinc-200 text-zinc-900 text-xs placeholder:text-zinc-400 focus:outline-none focus:border-purple-600 focus:bg-white focus:ring-1 focus:ring-purple-200 transition-all font-sans"
          />
          <Smile className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <button
          onClick={() => handleSendMessage()}
          disabled={!inputText.trim()}
          className="p-1.5 rounded-2xl bg-purple-600 hover:bg-purple-700 disabled:opacity-30 text-white shadow-sm transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed"
          title="Send (Enter)"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </footer>
    </aside>
  );
};
