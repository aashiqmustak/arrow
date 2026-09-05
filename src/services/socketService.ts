import { io, Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents, RoomData, Player, ChatMessage } from '../types/socketEvents';
import { generatePuzzle } from '../game/puzzleGenerator';
import { PlayerScoreBreakdown } from '../game/arrowTypes';

export function getSessionPlayerId(): string {
  let id = sessionStorage.getItem('as_arrow_player_id');
  if (!id) {
    id = 'p_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    sessionStorage.setItem('as_arrow_player_id', id);
  }
  return id;
}

export function getSavedPlayerName(): string {
  return localStorage.getItem('as_arrow_player_name') || '';
}

export function savePlayerName(name: string): void {
  localStorage.setItem('as_arrow_player_name', name.trim());
}

type EventCallback = (...args: any[]) => void;

class SocketService {
  public socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private localRoom: RoomData | null = null;
  private localListeners: Map<string, Set<EventCallback>> = new Map();
  private isLocalMode: boolean = false;

  public connect(): Socket<ServerToClientEvents, ClientToServerEvents> {
    if (!this.socket) {
      const serverUrl = import.meta.env.VITE_SERVER_URL || undefined;

      try {
        this.socket = io(serverUrl, {
          transports: ['websocket', 'polling'],
          reconnectionAttempts: 3,
          reconnectionDelay: 1000,
          timeout: 2500,
        });

        this.socket.on('connect', () => {
          this.isLocalMode = false;
          console.log('[Socket] Connected to server with ID:', this.socket?.id);
        });

        this.socket.on('connect_error', () => {
          this.isLocalMode = true;
          console.log('[Socket] Remote server unavailable. Using fast local in-browser engine.');
        });
      } catch {
        this.isLocalMode = true;
      }
    }
    return this.createProxySocket();
  }

  // Create a proxy that routes events through real socket or local fallback
  private createProxySocket(): any {
    return {
      on: (event: string, callback: EventCallback) => {
        if (!this.localListeners.has(event)) {
          this.localListeners.set(event, new Set());
        }
        this.localListeners.get(event)!.add(callback);

        if (this.socket) {
          this.socket.on(event as any, callback as any);
        }
      },
      off: (event: string, callback?: EventCallback) => {
        if (callback && this.localListeners.has(event)) {
          this.localListeners.get(event)!.delete(callback);
        } else {
          this.localListeners.delete(event);
        }

        if (this.socket) {
          this.socket.off(event as any, callback as any);
        }
      },
      emit: (event: string, ...args: any[]) => {
        if (this.socket && this.socket.connected) {
          (this.socket as any).emit(event, ...args);
        }
      },
      get connected() {
        return true;
      },
      get id() {
        return getSessionPlayerId();
      },
    };
  }

  private triggerLocalEvent(event: string, ...args: any[]) {
    const listeners = this.localListeners.get(event);
    if (listeners) {
      listeners.forEach(cb => cb(...args));
    }
  }

  public getSocket() {
    return this.connect();
  }

  public createRoom(playerName: string): Promise<{ success: boolean; roomCode?: string; room?: RoomData; error?: string }> {
    return new Promise((resolve) => {
      savePlayerName(playerName);
      const sessionPlayerId = getSessionPlayerId();

      if (this.socket && this.socket.connected) {
        this.socket.emit('createRoom', { playerName, sessionPlayerId }, (res) => {
          resolve(res);
        });
        return;
      }

      // Local In-Browser Fallback Engine
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const hostPlayer: Player = {
        id: sessionPlayerId,
        socketId: 'local_socket_' + sessionPlayerId,
        name: playerName,
        isHost: true,
        score: 0,
        status: 'WAITING',
        currentLevel: 1,
        completionTime: null,
        moves: 0,
        lastRoundBreakdown: null,
        connected: true,
      };

      this.localRoom = {
        roomCode,
        hostId: sessionPlayerId,
        status: 'WAITING',
        currentLevel: 1,
        difficulty: 100,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        players: { [sessionPlayerId]: hostPlayer },
        currentPuzzle: null,
        roundStartTime: null,
        roundCountdownEndTime: null,
        nextRoundAutoStartTime: null,
      };

      setTimeout(() => {
        this.triggerLocalEvent('roomUpdated', this.localRoom);
        resolve({ success: true, roomCode, room: this.localRoom });
      }, 50);
    });
  }

  public joinRoom(roomCode: string, playerName: string): Promise<{ success: boolean; room?: RoomData; error?: string }> {
    return new Promise((resolve) => {
      savePlayerName(playerName);
      const sessionPlayerId = getSessionPlayerId();

      if (this.socket && this.socket.connected) {
        this.socket.emit('joinRoom', { roomCode, playerName, sessionPlayerId }, (res) => {
          resolve(res);
        });
        return;
      }

      // Local In-Browser Fallback Engine
      const player: Player = {
        id: sessionPlayerId,
        socketId: 'local_socket_' + sessionPlayerId,
        name: playerName,
        isHost: true,
        score: 0,
        status: 'WAITING',
        currentLevel: 1,
        completionTime: null,
        moves: 0,
        lastRoundBreakdown: null,
        connected: true,
      };

      this.localRoom = {
        roomCode: roomCode.toUpperCase(),
        hostId: sessionPlayerId,
        status: 'WAITING',
        currentLevel: 1,
        difficulty: 100,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        players: { [sessionPlayerId]: player },
        currentPuzzle: null,
        roundStartTime: null,
        roundCountdownEndTime: null,
        nextRoundAutoStartTime: null,
      };

      setTimeout(() => {
        this.triggerLocalEvent('roomUpdated', this.localRoom);
        resolve({ success: true, room: this.localRoom });
      }, 50);
    });
  }

  public reconnect(roomCode: string): Promise<{ success: boolean; room?: RoomData; error?: string }> {
    return new Promise((resolve) => {
      const sessionPlayerId = getSessionPlayerId();
      const savedName = getSavedPlayerName() || 'Player';

      if (this.socket && this.socket.connected) {
        this.socket.emit('reconnectPlayer', { roomCode, sessionPlayerId }, (res) => {
          resolve(res);
        });
        return;
      }

      this.joinRoom(roomCode, savedName).then(resolve);
    });
  }

  public startGame(): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (this.socket && this.socket.connected) {
        this.socket.emit('startGame', (res) => {
          resolve(res);
        });
        return;
      }

      if (!this.localRoom) {
        resolve({ success: false, error: 'No active local room' });
        return;
      }

      const puzzle = generatePuzzle(this.localRoom.currentLevel);
      const startTime = Date.now();

      this.localRoom.status = 'PLAYING';
      this.localRoom.currentPuzzle = puzzle;
      this.localRoom.roundStartTime = startTime;

      Object.values(this.localRoom.players).forEach(p => {
        p.status = 'SOLVING';
        p.completionTime = null;
        p.moves = 0;
      });

      this.triggerLocalEvent('roundStarted', puzzle, startTime);
      this.triggerLocalEvent('roomUpdated', this.localRoom);
      resolve({ success: true });
    });
  }

  public escapeArrow(arrowId: string, moves: number) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('escapeArrow', { arrowId, moves });
    }
  }

  public submitProgress(arrowsRemaining: number, moves: number) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('submitProgress', { arrowsRemaining, moves });
      return;
    }

    const sessionPlayerId = getSessionPlayerId();
    if (this.localRoom && this.localRoom.players[sessionPlayerId]) {
      this.localRoom.players[sessionPlayerId].moves = moves;
    }
  }

  public submitSolved(moves: number, clientElapsedSeconds: number) {
    return new Promise<{ success: boolean; score?: PlayerScoreBreakdown; error?: string }>((resolve) => {
      if (this.socket && this.socket.connected) {
        this.socket.emit('submitSolved', { moves, clientElapsedSeconds }, (res) => {
          resolve(res);
        });
        return;
      }

      if (!this.localRoom) {
        resolve({ success: false, error: 'No active room' });
        return;
      }

      const sessionPlayerId = getSessionPlayerId();
      const player = this.localRoom.players[sessionPlayerId];

      const baseScore = 500 * this.localRoom.currentLevel;
      const speedBonus = Math.max(0, Math.round((60 - clientElapsedSeconds) * 25));
      const moveBonus = Math.max(0, 300 - moves * 5);
      const roundScore = baseScore + speedBonus + moveBonus;

      const breakdown: PlayerScoreBreakdown = {
        baseScore,
        speedBonus,
        moveBonus,
        comboBonus: 0,
        totalScore: roundScore,
      };

      if (player) {
        player.score += roundScore;
        player.status = 'COMPLETED';
        player.completionTime = clientElapsedSeconds;
        player.lastRoundBreakdown = breakdown;
      }

      const completedLevel = this.localRoom.currentLevel;
      const nextLevel = completedLevel + 1;
      this.localRoom.currentLevel = nextLevel;

      this.triggerLocalEvent('roundCompleted', {
        completedLevel,
        winnerId: sessionPlayerId,
        standings: Object.values(this.localRoom.players).map(p => ({
          playerId: p.id,
          name: p.name,
          completionTime: p.completionTime,
          roundScore,
          totalScore: p.score,
        })),
        nextRoundInMs: 3500,
      });

      // Auto start next level after 3.5s
      setTimeout(() => {
        if (this.localRoom && this.localRoom.status !== 'WAITING') {
          const nextPuzzle = generatePuzzle(nextLevel);
          const nextStartTime = Date.now();
          this.localRoom.currentPuzzle = nextPuzzle;
          this.localRoom.roundStartTime = nextStartTime;

          Object.values(this.localRoom.players).forEach(p => {
            p.status = 'SOLVING';
            p.completionTime = null;
            p.moves = 0;
          });

          this.triggerLocalEvent('roundStarted', nextPuzzle, nextStartTime);
          this.triggerLocalEvent('roomUpdated', this.localRoom);
        }
      }, 3500);

      resolve({ success: true, score: breakdown });
    });
  }

  public sendChatMessage(text: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (this.socket && this.socket.connected) {
        this.socket.emit('sendChatMessage', { text }, (res) => {
          resolve(res || { success: true });
        });
        return;
      }

      const sessionPlayerId = getSessionPlayerId();
      const playerName = getSavedPlayerName() || 'Player';

      const msg: ChatMessage = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        senderId: sessionPlayerId,
        senderName: playerName,
        text,
        timestamp: Date.now(),
      };

      this.triggerLocalEvent('newChatMessage', msg);
      resolve({ success: true });
    });
  }

  public leaveRoom() {
    if (this.socket && this.socket.connected) {
      this.socket.emit('leaveRoom');
    }
    this.localRoom = null;
  }
}

export const socketService = new SocketService();
