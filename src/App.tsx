import React, { useState, useEffect, useCallback } from 'react';
import { Landing } from './components/Landing';
import { RoomLobby } from './components/RoomLobby';
import { GameHUD } from './components/GameHUD';
import { ArrowBoard } from './components/ArrowBoard';
import { ChatPanel } from './components/ChatPanel';
import { RoundResultModal } from './components/RoundResultModal';
import { socketService, getSessionPlayerId, getSavedPlayerName } from './services/socketService';
import { RoomData, Player } from './types/socketEvents';
import { Puzzle } from './game/arrowTypes';

export const App: React.FC = () => {
  const [room, setRoom] = useState<RoomData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStartingGame, setIsStartingGame] = useState<boolean>(false);

  // Deep linked room code from URL (e.g. /room/K7P2XA)
  const [initialDeepLinkCode, setInitialDeepLinkCode] = useState<string>('');

  // Round / Game State
  const [currentPuzzle, setCurrentPuzzle] = useState<Puzzle | null>(null);
  const [roundStartTime, setRoundStartTime] = useState<number | null>(null);
  const [lives, setLives] = useState<number>(3);
  const [remoteEscapeEvent, setRemoteEscapeEvent] = useState<{ arrowId: string; playerName?: string } | null>(null);
  const [actionFeed, setActionFeed] = useState<string | null>(null);
  const [roundStandingsData, setRoundStandingsData] = useState<{
    completedLevel: number;
    standings: Array<{
      playerId: string;
      name: string;
      completionTime: number | null;
      roundScore: number;
      totalScore: number;
    }>;
    nextRoundInMs: number;
  } | null>(null);

  const sessionPlayerId = getSessionPlayerId();

  // Parse path for /room/:code deep links
  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/room\/([A-Za-z0-9]{6})$/i);
    if (match && match[1]) {
      setInitialDeepLinkCode(match[1].toUpperCase());
    }
  }, []);

  // Update browser URL without reload
  const updateUrl = (code?: string) => {
    if (code) {
      window.history.pushState({}, '', `/room/${code}`);
    } else {
      window.history.pushState({}, '', '/');
    }
  };

  // Socket setup & real-time event listeners
  useEffect(() => {
    const socket = socketService.connect();

    socket.on('roomUpdated', (updatedRoom: RoomData) => {
      setRoom(updatedRoom);
      if (updatedRoom.currentPuzzle) {
        setCurrentPuzzle(updatedRoom.currentPuzzle);
      }
    });

    socket.on('roundStarted', (puzzle: Puzzle, startTime: number) => {
      setCurrentPuzzle(puzzle);
      setRoundStartTime(startTime);
      setLives(3);
      setRemoteEscapeEvent(null);
      setRoundStandingsData(null);
      setRoom(prev => prev ? {
        ...prev,
        status: 'PLAYING',
        currentLevel: puzzle.level,
        currentPuzzle: puzzle,
        roundStartTime: startTime,
        players: Object.fromEntries(
          Object.entries(prev.players).map(([id, p]) => [id, { ...p, status: 'SOLVING', completionTime: null }])
        )
      } : null);
    });

    socket.on('arrowEscapedByPlayer', (data) => {
      if (data.playerId !== sessionPlayerId) {
        setRemoteEscapeEvent({ arrowId: data.arrowId, playerName: data.playerName });
        setActionFeed(`${data.playerName} cleared an arrow!`);
        setTimeout(() => setActionFeed(null), 2000);
      }
    });

    socket.on('roundCompleted', (data) => {
      setRoundStandingsData(data);
      setActionFeed(`Level ${data.completedLevel} Cleared!`);
      setTimeout(() => setActionFeed(null), 2500);
    });

    socket.on('hostMigrated', (newHostId, newHostName) => {
      if (newHostId === sessionPlayerId) {
        setErrorMessage('You are now the room host!');
      } else {
        setErrorMessage(`Host migrated to ${newHostName}`);
      }
      setTimeout(() => setErrorMessage(null), 3500);
    });

    socket.on('errorNotification', (msg: string) => {
      setErrorMessage(msg);
    });

    // Auto-reconnect if session already had a room in URL
    const savedName = getSavedPlayerName();
    const match = window.location.pathname.match(/^\/room\/([A-Za-z0-9]{6})$/i);
    if (match && match[1] && savedName) {
      socketService.reconnect(match[1]).then(res => {
        if (res.success && res.room) {
          setRoom(res.room);
          if (res.room.currentPuzzle) {
            setCurrentPuzzle(res.room.currentPuzzle);
          }
        }
      });
    }

    return () => {
      socket.off('roomUpdated');
      socket.off('roundStarted');
      socket.off('arrowEscapedByPlayer');
      socket.off('roundCompleted');
      socket.off('hostMigrated');
      socket.off('errorNotification');
    };
  }, [sessionPlayerId]);

  // Handle Create Room
  const handleCreateRoom = async (playerName: string) => {
    setIsLoading(true);
    setErrorMessage(null);

    const result = await socketService.createRoom(playerName);
    setIsLoading(false);

    if (result.success && result.roomCode) {
      if (result.room) {
        setRoom(result.room);
      }
      updateUrl(result.roomCode);
    } else {
      setErrorMessage(result.error || 'Failed to create room');
    }
  };

  // Handle Join Room
  const handleJoinRoom = async (roomCode: string, playerName: string) => {
    setIsLoading(true);
    setErrorMessage(null);

    const result = await socketService.joinRoom(roomCode, playerName);
    setIsLoading(false);

    if (result.success && result.room) {
      setRoom(result.room);
      updateUrl(result.room.roomCode);
    } else {
      setErrorMessage(result.error || 'Failed to join room');
    }
  };

  // Handle Start Game
  const handleStartGame = async () => {
    setIsStartingGame(true);
    const res = await socketService.startGame();
    setIsStartingGame(false);
    if (!res.success) {
      setErrorMessage(res.error || 'Could not start game');
    }
  };

  // Handle Leave Room
  const handleLeaveRoom = () => {
    socketService.leaveRoom();
    setRoom(null);
    setCurrentPuzzle(null);
    setRoundStandingsData(null);
    updateUrl();
  };

  // Arrow escaped handler
  const handleArrowEscaped = useCallback((arrowId: string, remaining: number, moves: number) => {
    socketService.escapeArrow(arrowId, moves);
    socketService.submitProgress(remaining, moves);
  }, []);

  // Puzzle cleared handler
  const handlePuzzleCleared = useCallback(async (moves: number, clientElapsedSeconds: number) => {
    await socketService.submitSolved(moves, clientElapsedSeconds);
  }, []);

  const currentPlayer: Player | null = room ? room.players[sessionPlayerId] || null : null;

  // Render view depending on room status
  return (
    <div className="h-screen max-h-screen w-screen max-w-full bg-zinc-50 text-zinc-900 flex flex-col justify-between relative overflow-hidden font-sans">
      {/* Action Notification Feed */}
      {actionFeed && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 rounded-full bg-purple-100 border border-purple-300 text-purple-900 font-mono text-xs shadow-md backdrop-blur-md animate-bounce font-semibold">
          ⚡ {actionFeed}
        </div>
      )}

      {/* Round Result Standings Modal */}
      {roundStandingsData && (
        <RoundResultModal
          currentLevel={roundStandingsData.completedLevel}
          currentPlayer={currentPlayer}
          standings={roundStandingsData.standings}
          nextRoundInMs={roundStandingsData.nextRoundInMs}
        />
      )}

      {!room ? (
        <Landing
          initialRoomCode={initialDeepLinkCode}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          isLoading={isLoading}
          errorMessage={errorMessage}
          onClearError={() => setErrorMessage(null)}
        />
      ) : (
        /* Multiplayer Room Split Layout: Left 3/4 Game/Lobby, Right 1/4 Chat */
        <div className="w-full flex-1 flex flex-col lg:flex-row items-stretch gap-2.5 sm:gap-3 p-2 sm:p-3 max-w-[1800px] mx-auto h-screen max-h-screen overflow-hidden">
          {/* Left 3/4 Area: Pure Game Canvas / Lobby Arena */}
          <div className="w-full lg:w-3/4 h-full max-h-full flex flex-col justify-between min-w-0 bg-white border border-zinc-200/90 rounded-3xl p-2 sm:p-3 shadow-sm overflow-hidden">
            {room.status === 'WAITING' ? (
              <div className="h-full overflow-y-auto no-scrollbar">
                <RoomLobby
                  room={room}
                  currentPlayer={currentPlayer}
                  onStartGame={handleStartGame}
                  onLeaveRoom={handleLeaveRoom}
                  isStarting={isStartingGame}
                />
              </div>
            ) : (
              /* In Game Pure Board View */
              <div className="flex-1 min-h-0 flex flex-col justify-between items-center overflow-hidden">
                <main className="flex-1 min-h-0 w-full py-1 flex items-center justify-center overflow-hidden">
                  {currentPuzzle ? (
                    <ArrowBoard
                      gridWidth={currentPuzzle.gridWidth}
                      gridHeight={currentPuzzle.gridHeight}
                      arrows={currentPuzzle.arrows}
                      onArrowEscaped={handleArrowEscaped}
                      onPuzzleCleared={handlePuzzleCleared}
                      onBlockedMove={() => {
                        setLives(prev => {
                          const next = Math.max(0, prev - 1);
                          if (next === 0) {
                            setActionFeed('💔 Out of hearts! Try carefully!');
                            setTimeout(() => setActionFeed(null), 2500);
                          }
                          return next;
                        });
                      }}
                      roundStartTime={roundStartTime}
                      disabled={room.status !== 'PLAYING' || currentPlayer?.status === 'COMPLETED'}
                      remoteEscapeEvent={remoteEscapeEvent}
                    />
                  ) : (
                    <div className="text-zinc-400 font-mono text-xs animate-pulse">
                      Preparing next puzzle...
                    </div>
                  )}
                </main>

                <footer className="w-full text-center text-[10px] text-zinc-400 font-mono py-0.5 shrink-0">
                  ARROW • Synchronized Board
                </footer>
              </div>
            )}
          </div>

          {/* Right 1/4 Area: Real-Time Live Chat (Top) & Game HUD (Below Chat) */}
          <div className="w-full lg:w-1/4 h-full max-h-full flex flex-col gap-2 min-w-0 overflow-hidden">
            {/* Top: Live Chat */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <ChatPanel
                currentUserId={sessionPlayerId}
                players={room.players}
                roomCode={room.roomCode}
              />
            </div>

            {/* Below Chat: GameHUD (Level, Hearts, Room Code, Scores & Leaderboard) */}
            {room.status !== 'WAITING' && (
              <div className="shrink-0">
                <GameHUD
                  level={room.currentLevel}
                  roomCode={room.roomCode}
                  currentPlayer={currentPlayer}
                  players={room.players}
                  lives={lives}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
export default App;
