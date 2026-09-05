import { io, Socket } from 'socket.io-client';
import { joinRoom as joinP2PRoom, selfId } from 'trystero/nostr';
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
  private p2pRoom: any = null;
  private p2pActions: Record<string, any> = {};

  public connect(): Socket<ServerToClientEvents, ClientToServerEvents> {
    if (!this.socket) {
      const serverUrl = import.meta.env.VITE_SERVER_URL || undefined;

      if (serverUrl) {
        try {
          this.socket = io(serverUrl, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
          });
        } catch {
          this.socket = null;
        }
      }
    }
    return this.createProxySocket();
  }

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

  // Set up P2P Room Synchronization across devices on Vercel
  private initP2PRoom(roomCode: string, isHost: boolean, playerName: string) {
    if (this.p2pRoom) {
      try {
        this.p2pRoom.leave();
      } catch {
        // Ignore
      }
    }

    try {
      const normalizedCode = roomCode.toUpperCase();
      this.p2pRoom = joinP2PRoom({ appId: 'as-arrow-game-v2' }, `arrow_${normalizedCode}`);

      const [sendRoomSync, getRoomSync] = this.p2pRoom.makeAction('roomSync');
      const [sendPlayerJoin, getPlayerJoin] = this.p2pRoom.makeAction('playerJoin');
      const [sendStartRound, getStartRound] = this.p2pRoom.makeAction('startRound');
      const [sendArrowEscape, getArrowEscape] = this.p2pRoom.makeAction('arrowEscape');
      const [sendChatMessage, getChatMessage] = this.p2pRoom.makeAction('chatMessage');
      const [sendRoundComplete, getRoundComplete] = this.p2pRoom.makeAction('roundComplete');

      this.p2pActions = {
        sendRoomSync,
        sendPlayerJoin,
        sendStartRound,
        sendArrowEscape,
        sendChatMessage,
        sendRoundComplete,
      };

      const sessionPlayerId = getSessionPlayerId();

      // Listen for peer join
      this.p2pRoom.onPeerJoin((peerId: string) => {
        console.log('[P2P] Peer joined:', peerId);
        if (this.localRoom && this.localRoom.hostId === sessionPlayerId) {
          // Host sends current room state to new peer
          sendRoomSync(this.localRoom, peerId);
        } else {
          // Non-host sends their player info to host
          sendPlayerJoin({ id: sessionPlayerId, name: playerName });
        }
      });

      // Listen for peer leave
      this.p2pRoom.onPeerLeave((peerId: string) => {
        console.log('[P2P] Peer left:', peerId);
        if (this.localRoom) {
          this.triggerLocalEvent('roomUpdated', this.localRoom);
        }
      });

      // When room state is received from Host
      getRoomSync((remoteRoom: RoomData) => {
        console.log('[P2P] Received Room Sync from Host:', remoteRoom);
        this.localRoom = remoteRoom;
        this.triggerLocalEvent('roomUpdated', remoteRoom);
      });

      // When a new player joins room
      getPlayerJoin((newPlayer: { id: string; name: string }) => {
        console.log('[P2P] Received Player Join:', newPlayer);
        if (this.localRoom) {
          this.localRoom.players[newPlayer.id] = {
            id: newPlayer.id,
            socketId: 'p2p_' + newPlayer.id,
            name: newPlayer.name,
            isHost: false,
            score: 0,
            status: this.localRoom.status === 'PLAYING' ? 'SOLVING' : 'WAITING',
            currentLevel: this.localRoom.currentLevel,
            completionTime: null,
            moves: 0,
            lastRoundBreakdown: null,
            connected: true,
          };

          this.triggerLocalEvent('roomUpdated', this.localRoom);
          if (this.localRoom.hostId === sessionPlayerId) {
            sendRoomSync(this.localRoom);
          }
        }
      });

      // When host starts round
      getStartRound((data: { puzzle: any; startTime: number; room: RoomData }) => {
        console.log('[P2P] Received Start Round:', data);
        this.localRoom = data.room;
        this.triggerLocalEvent('roundStarted', data.puzzle, data.startTime);
        this.triggerLocalEvent('roomUpdated', data.room);
      });

      // When an arrow is cleared by any player in the room
      getArrowEscape((data: { arrowId: string; playerId: string; playerName: string; remainingCount: number; moves: number }) => {
        this.triggerLocalEvent('arrowEscapedByPlayer', data);
      });

      // When a chat message arrives
      getChatMessage((msg: ChatMessage) => {
        this.triggerLocalEvent('newChatMessage', msg);
      });

      // When round is completed
      getRoundComplete((data: any) => {
        this.triggerLocalEvent('roundCompleted', data);
      });

      // Broadcast join intent
      if (!isHost) {
        setTimeout(() => {
          sendPlayerJoin({ id: sessionPlayerId, name: playerName });
        }, 300);
      }
    } catch (err) {
      console.warn('[P2P] WebRTC initialization fallback:', err);
    }
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

      // Real-time P2P Host Room
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const hostPlayer: Player = {
        id: sessionPlayerId,
        socketId: 'p2p_host_' + selfId,
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

      this.initP2PRoom(roomCode, true, playerName);

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
      const cleanCode = roomCode.trim().toUpperCase();

      if (this.socket && this.socket.connected) {
        this.socket.emit('joinRoom', { roomCode: cleanCode, playerName, sessionPlayerId }, (res) => {
          resolve(res);
        });
        return;
      }

      // Real-time P2P Join Room
      const player: Player = {
        id: sessionPlayerId,
        socketId: 'p2p_guest_' + selfId,
        name: playerName,
        isHost: false,
        score: 0,
        status: 'WAITING',
        currentLevel: 1,
        completionTime: null,
        moves: 0,
        lastRoundBreakdown: null,
        connected: true,
      };

      this.localRoom = {
        roomCode: cleanCode,
        hostId: 'remote_host',
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

      this.initP2PRoom(cleanCode, false, playerName);

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
        resolve({ success: false, error: 'No active room' });
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

      if (this.p2pActions.sendStartRound) {
        this.p2pActions.sendStartRound({
          puzzle,
          startTime,
          room: this.localRoom,
        });
      }

      this.triggerLocalEvent('roundStarted', puzzle, startTime);
      this.triggerLocalEvent('roomUpdated', this.localRoom);
      resolve({ success: true });
    });
  }

  public escapeArrow(arrowId: string, moves: number) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('escapeArrow', { arrowId, moves });
      return;
    }

    const sessionPlayerId = getSessionPlayerId();
    const playerName = getSavedPlayerName() || 'Player';

    if (this.p2pActions.sendArrowEscape) {
      this.p2pActions.sendArrowEscape({
        arrowId,
        playerId: sessionPlayerId,
        playerName,
        remainingCount: 0,
        moves,
      });
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

      const roundResultData = {
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
      };

      if (this.p2pActions.sendRoundComplete) {
        this.p2pActions.sendRoundComplete(roundResultData);
      }

      this.triggerLocalEvent('roundCompleted', roundResultData);

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

          if (this.p2pActions.sendStartRound) {
            this.p2pActions.sendStartRound({
              puzzle: nextPuzzle,
              startTime: nextStartTime,
              room: this.localRoom,
            });
          }

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

      if (this.p2pActions.sendChatMessage) {
        this.p2pActions.sendChatMessage(msg);
      }

      this.triggerLocalEvent('newChatMessage', msg);
      resolve({ success: true });
    });
  }

  public leaveRoom() {
    if (this.socket && this.socket.connected) {
      this.socket.emit('leaveRoom');
    }
    if (this.p2pRoom) {
      try {
        this.p2pRoom.leave();
      } catch {
        // Ignore
      }
      this.p2pRoom = null;
    }
    this.localRoom = null;
  }
}

export const socketService = new SocketService();
