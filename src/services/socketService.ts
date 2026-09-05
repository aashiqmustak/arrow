import { io, Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents, RoomData } from '../types/socketEvents';

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

class SocketService {
  public socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

  public connect(): Socket<ServerToClientEvents, ClientToServerEvents> {
    if (!this.socket) {
      // In dev, Vite proxies /socket.io to http://localhost:3001
      // In prod, connects to current host
      this.socket = io({
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      this.socket.on('connect', () => {
        console.log('[Socket] Connected with ID:', this.socket?.id);
      });

      this.socket.on('disconnect', () => {
        console.log('[Socket] Disconnected');
      });
    }
    return this.socket;
  }

  public getSocket() {
    if (!this.socket) {
      return this.connect();
    }
    return this.socket;
  }

  public createRoom(playerName: string): Promise<{ success: boolean; roomCode?: string; room?: RoomData; error?: string }> {
    return new Promise((resolve) => {
      const s = this.getSocket();
      const sessionPlayerId = getSessionPlayerId();
      savePlayerName(playerName);

      s.emit('createRoom', { playerName, sessionPlayerId }, (res) => {
        resolve(res);
      });
    });
  }

  public joinRoom(roomCode: string, playerName: string): Promise<{ success: boolean; room?: RoomData; error?: string }> {
    return new Promise((resolve) => {
      const s = this.getSocket();
      const sessionPlayerId = getSessionPlayerId();
      savePlayerName(playerName);

      s.emit('joinRoom', { roomCode, playerName, sessionPlayerId }, (res) => {
        resolve(res);
      });
    });
  }

  public reconnect(roomCode: string): Promise<{ success: boolean; room?: RoomData; error?: string }> {
    return new Promise((resolve) => {
      const s = this.getSocket();
      const sessionPlayerId = getSessionPlayerId();

      s.emit('reconnectPlayer', { roomCode, sessionPlayerId }, (res) => {
        resolve(res);
      });
    });
  }

  public startGame(): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const s = this.getSocket();
      s.emit('startGame', (res) => {
        resolve(res);
      });
    });
  }

  public submitProgress(arrowsRemaining: number, moves: number) {
    const s = this.getSocket();
    s.emit('submitProgress', { arrowsRemaining, moves });
  }

  public submitSolved(moves: number, clientElapsedSeconds: number) {
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      const s = this.getSocket();
      s.emit('submitSolved', { moves, clientElapsedSeconds }, (res) => {
        resolve(res);
      });
    });
  }

  public leaveRoom() {
    if (this.socket) {
      this.socket.emit('leaveRoom');
    }
  }
}

export const socketService = new SocketService();
