import React, { useState, useEffect, useCallback } from 'react';
import { Landing } from './components/Landing';
import { RoomLobby } from './components/RoomLobby';
import { GameHUD } from './components/GameHUD';
import { ArrowBoard } from './components/ArrowBoard';
import { CountdownOverlay } from './components/CountdownOverlay';
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
  const [countdownEndTime, setCountdownEndTime] = useState<number | null>(null);
  const [arrowsRemaining, setArrowsRemaining] = useState<number>(0);
  const [moveCount, setMoveCount] = useState<number>(0);
  const [roundStandings, setRoundStandings] = useState<Array<{
    playerId: string;
    name: string;
    completionTime: number | null;
    roundScore: number;
    totalScore: number;
  }> | null>(null);
  const [nextRoundInMs, setNextRoundInMs] = useState<number>(6000);
  const [remoteEscapeEvent, setRemoteEscapeEvent] = useState<{ arrowId: string; playerName?: string } | null>(null);
  const [actionFeed, setActionFeed] = useState<string | null>(null);

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

    socket.on('gameCountdownStarted', (endTime: number) => {
      setCountdownEndTime(endTime);
      setRoundStandings(null);
      setRemoteEscapeEvent(null);
    });

    socket.on('roundStarted', (puzzle: Puzzle, startTime: number) => {
      setCurrentPuzzle(puzzle);
      setRoundStartTime(startTime);
      setArrowsRemaining(puzzle.arrows.length);
      setMoveCount(0);
      setRoundStandings(null);
      setRemoteEscapeEvent(null);
    });

    socket.on('arrowEscapedByPlayer', (data) => {
      setArrowsRemaining(data.remainingCount);
      if (data.playerId !== sessionPlayerId) {
        setRemoteEscapeEvent({ arrowId: data.arrowId, playerName: data.playerName });
        setActionFeed(`${data.playerName} cleared an arrow!`);
        setTimeout(() => setActionFeed(null), 2000);
      }
    });

    socket.on('roundCompleted', (data) => {
      setRoundStandings(data.standings);
      setNextRoundInMs(data.nextRoundInMs);
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
      socket.off('gameCountdownStarted');
      socket.off('roundStarted');
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
    setRoundStandings(null);
    updateUrl();
  };

  // Arrow escaped handler
  const handleArrowEscaped = useCallback((arrowId: string, remaining: number, moves: number) => {
    setArrowsRemaining(remaining);
    setMoveCount(moves);
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
    <div className="min-h-screen bg-dark-950 text-slate-100 flex flex-col justify-between relative overflow-x-hidden">
      {/* Synchronized Countdown Overlay */}
      {countdownEndTime && <CountdownOverlay countdownEndTime={countdownEndTime} />}

      {/* Action Notification Feed */}
      {actionFeed && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full bg-brand-cyan/20 border border-brand-cyan/50 text-cyan-300 font-mono text-xs shadow-lg backdrop-blur-md animate-bounce">
          ⚡ {actionFeed}
        </div>
      )}

      {/* Round Finished Standings & Progression Modal */}
      {roundStandings && (
        <RoundResultModal
          currentLevel={room?.currentLevel || 1}
          currentPlayer={currentPlayer}
          standings={roundStandings}
          nextRoundInMs={nextRoundInMs}
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
      ) : room.status === 'WAITING' ? (
        <RoomLobby
          room={room}
          currentPlayer={currentPlayer}
          onStartGame={handleStartGame}
          onLeaveRoom={handleLeaveRoom}
          isStarting={isStartingGame}
        />
      ) : (
        /* In Game View (COUNTDOWN, PLAYING, ROUND_COMPLETE) */
        <div className="min-h-screen flex flex-col justify-between py-2 sm:py-4 px-2 sm:px-4">
          <GameHUD
            level={room.currentLevel}
            roomCode={room.roomCode}
            currentPlayer={currentPlayer}
            players={room.players}
            arrowsRemaining={arrowsRemaining}
            moveCount={moveCount}
          />

          <main className="my-auto py-2 flex items-center justify-center">
            {currentPuzzle ? (
              <ArrowBoard
                gridWidth={currentPuzzle.gridWidth}
                gridHeight={currentPuzzle.gridHeight}
                arrows={currentPuzzle.arrows}
                onArrowEscaped={handleArrowEscaped}
                onPuzzleCleared={handlePuzzleCleared}
                roundStartTime={roundStartTime}
                disabled={room.status !== 'PLAYING' || currentPlayer?.status === 'COMPLETED'}
                remoteEscapeEvent={remoteEscapeEvent}
              />
            ) : (
              <div className="text-slate-400 font-mono text-sm animate-pulse">
                Preparing next puzzle...
              </div>
            )}
          </main>

          {/* Bottom Session Footer */}
          <footer className="w-full text-center text-[10px] text-slate-400 font-mono py-1">
            AS Arrow • Authoritative Sync
          </footer>
        </div>
      )}
    </div>
  );
};
export default App;
