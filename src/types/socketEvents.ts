import { Puzzle, PlayerScoreBreakdown } from '../game/arrowTypes';

export type RoomStatus = 'WAITING' | 'COUNTDOWN' | 'PLAYING' | 'ROUND_COMPLETE' | 'FINISHED';

export type PlayerStatus = 'WAITING' | 'SOLVING' | 'COMPLETED' | 'DISCONNECTED';

export interface Player {
  id: string; // Session UUID
  socketId: string;
  name: string;
  isHost: boolean;
  score: number;
  status: PlayerStatus;
  currentLevel: number;
  completionTime: number | null; // In seconds (e.g. 14.82)
  moves: number;
  lastRoundBreakdown: PlayerScoreBreakdown | null;
  connected: boolean;
}

export interface RoomData {
  roomCode: string;
  hostId: string;
  status: RoomStatus;
  currentLevel: number;
  difficulty: number;
  createdAt: number;
  lastActivity: number;
  players: Record<string, Player>;
  currentPuzzle: Puzzle | null;
  roundStartTime: number | null;
  roundCountdownEndTime: number | null;
  nextRoundAutoStartTime: number | null;
}

export interface ServerToClientEvents {
  roomUpdated: (room: RoomData) => void;
  gameCountdownStarted: (countdownEndTime: number) => void;
  roundStarted: (puzzle: Puzzle, roundStartTime: number) => void;
  arrowEscapedByPlayer: (data: { arrowId: string; playerId: string; playerName: string; remainingCount: number; moves: number }) => void;
  playerProgressUpdate: (data: { playerId: string; arrowsRemaining: number; moves: number }) => void;
  playerSolved: (data: { playerId: string; completionTime: number; moves: number; roundScore: number; totalScore: number }) => void;
  roundCompleted: (data: { winnerId: string; standings: Array<{ playerId: string; name: string; completionTime: number | null; roundScore: number; totalScore: number }>; nextRoundInMs: number }) => void;
  errorNotification: (message: string) => void;
  hostMigrated: (newHostId: string, newHostName: string) => void;
}

export interface ClientToServerEvents {
  createRoom: (data: { playerName: string; sessionPlayerId: string }, callback: (res: { success: boolean; roomCode?: string; room?: RoomData; error?: string }) => void) => void;
  joinRoom: (data: { roomCode: string; playerName: string; sessionPlayerId: string }, callback: (res: { success: boolean; room?: RoomData; error?: string }) => void) => void;
  reconnectPlayer: (data: { roomCode: string; sessionPlayerId: string }, callback: (res: { success: boolean; room?: RoomData; error?: string }) => void) => void;
  startGame: (callback: (res: { success: boolean; error?: string }) => void) => void;
  escapeArrow: (data: { arrowId: string; moves: number }) => void;
  submitProgress: (data: { arrowsRemaining: number; moves: number }) => void;
  submitSolved: (data: { moves: number; clientElapsedSeconds: number }, callback: (res: { success: boolean; score?: PlayerScoreBreakdown; error?: string }) => void) => void;
  leaveRoom: () => void;
}
