import { Server as SocketIOServer } from 'socket.io';
import { RoomData, Player, ChatMessage } from '../src/types/socketEvents';
import { generatePuzzle } from '../src/game/puzzleGenerator';
import { calculateRoundScore } from '../src/game/scoring';
import { PlayerScoreBreakdown } from '../src/game/arrowTypes';

// Characters for 6-character room code (avoiding easily confused chars 0/O, 1/I/L)
const ROOM_CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export class RoomManager {
  private rooms: Map<string, RoomData> = new Map();
  private playerToRoom: Map<string, string> = new Map(); // socketId -> roomCode
  private sessionToPlayer: Map<string, { roomCode: string; playerId: string }> = new Map();
  private io: SocketIOServer | null = null;
  private autoProgressTimeouts: Map<string, NodeJS.Timeout> = new Map();

  public setIO(io: SocketIOServer) {
    this.io = io;
  }

  /**
   * Generates an unambiguous 6-character uppercase room code.
   */
  public generateUniqueRoomCode(): string {
    let code: string;
    let attempts = 0;
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
      }
      attempts++;
    } while (this.rooms.has(code) && attempts < 1000);
    return code;
  }

  /**
   * Cleans inactive rooms (older than 30 min)
   */
  public cleanupExpiredRooms() {
    const now = Date.now();
    const EXPIRY_MS = 30 * 60 * 1000;

    for (const [code, room] of this.rooms.entries()) {
      const activePlayers = Object.values(room.players).filter(p => p.connected);
      if (activePlayers.length === 0 || now - room.lastActivity > EXPIRY_MS) {
        this.destroyRoom(code);
      }
    }
  }

  public getRoom(roomCode: string): RoomData | undefined {
    return this.rooms.get(roomCode.toUpperCase());
  }

  /**
   * Creates a brand new multiplayer room with creator as host.
   */
  public createRoom(
    playerName: string,
    sessionPlayerId: string,
    socketId: string
  ): { roomCode: string; room: RoomData } {
    const roomCode = this.generateUniqueRoomCode();
    const cleanName = playerName.trim().substring(0, 15) || 'ArrowMaster';

    const hostPlayer: Player = {
      id: sessionPlayerId,
      socketId,
      name: cleanName,
      isHost: true,
      score: 0,
      status: 'WAITING',
      currentLevel: 1,
      completionTime: null,
      moves: 0,
      lastRoundBreakdown: null,
      connected: true,
    };

    const room: RoomData = {
      roomCode,
      hostId: sessionPlayerId,
      status: 'WAITING',
      currentLevel: 1,
      difficulty: 10,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      players: { [sessionPlayerId]: hostPlayer },
      currentPuzzle: null,
      roundStartTime: null,
      roundCountdownEndTime: null,
      nextRoundAutoStartTime: null,
    };

    this.rooms.set(roomCode, room);
    this.playerToRoom.set(socketId, roomCode);
    this.sessionToPlayer.set(sessionPlayerId, { roomCode, playerId: sessionPlayerId });

    return { roomCode, room };
  }

  /**
   * Joins an existing room by code.
   */
  public joinRoom(
    roomCode: string,
    playerName: string,
    sessionPlayerId: string,
    socketId: string
  ): { success: boolean; room?: RoomData; error?: string } {
    const code = roomCode.trim().toUpperCase();
    const room = this.rooms.get(code);

    if (!room) {
      return { success: false, error: 'Room not found. Check the 6-character code.' };
    }

    const cleanName = playerName.trim().substring(0, 15) || `Player ${Object.keys(room.players).length + 1}`;
    
    // Check if name is already in use by another active player
    const existingPlayerWithSameName = Object.values(room.players).find(
      p => p.name.toLowerCase() === cleanName.toLowerCase() && p.id !== sessionPlayerId && p.connected
    );
    if (existingPlayerWithSameName) {
      return { success: false, error: 'That name is already being used in this room.' };
    }

    // Reconnecting or new player in room
    let player = room.players[sessionPlayerId];
    if (player) {
      player.socketId = socketId;
      player.name = cleanName;
      player.connected = true;
    } else {
      player = {
        id: sessionPlayerId,
        socketId,
        name: cleanName,
        isHost: room.hostId === sessionPlayerId,
        score: 0,
        status: room.status === 'PLAYING' ? 'SOLVING' : 'WAITING',
        currentLevel: room.currentLevel,
        completionTime: null,
        moves: 0,
        lastRoundBreakdown: null,
        connected: true,
      };
      room.players[sessionPlayerId] = player;
    }

    room.lastActivity = Date.now();
    this.playerToRoom.set(socketId, code);
    this.sessionToPlayer.set(sessionPlayerId, { roomCode: code, playerId: sessionPlayerId });

    this.broadcastRoomUpdate(code);
    this.broadcastSystemMessage(code, `👋 ${cleanName} joined the room!`);
    return { success: true, room };
  }

  /**
   * Reconnects a player who refreshed or had network hiccup.
   */
  public reconnectPlayer(
    roomCode: string,
    sessionPlayerId: string,
    socketId: string
  ): { success: boolean; room?: RoomData; error?: string } {
    const code = roomCode.trim().toUpperCase();
    const room = this.rooms.get(code);

    if (!room) {
      return { success: false, error: 'Room expired or not found.' };
    }

    const player = room.players[sessionPlayerId];
    if (!player) {
      return { success: false, error: 'Player session not found in room.' };
    }

    player.socketId = socketId;
    player.connected = true;
    room.lastActivity = Date.now();
    this.playerToRoom.set(socketId, code);

    this.broadcastRoomUpdate(code);
    return { success: true, room };
  }

  /**
   * Starts a game round immediately: generates puzzle and begins gameplay instantly.
   */
  public startRound(roomCode: string, hostPlayerId: string): { success: boolean; error?: string } {
    const code = roomCode.toUpperCase();
    const room = this.rooms.get(code);

    if (!room) return { success: false, error: 'Room not found.' };
    if (room.hostId !== hostPlayerId) return { success: false, error: 'Only the room host can start the game.' };

    this.clearAutoProgressTimeout(code);

    // Generate puzzle for current level
    const puzzle = generatePuzzle(room.currentLevel);
    room.currentPuzzle = puzzle;
    room.difficulty = puzzle.difficulty;
    room.status = 'PLAYING';
    room.roundStartTime = Date.now();
    room.roundCountdownEndTime = null;
    room.lastActivity = Date.now();

    // Reset player round status
    for (const player of Object.values(room.players)) {
      player.status = 'SOLVING';
      player.completionTime = null;
      player.moves = 0;
      player.lastRoundBreakdown = null;
      player.currentLevel = room.currentLevel;
    }

    if (this.io && room.currentPuzzle) {
      this.io.to(code).emit('roundStarted', room.currentPuzzle, room.roundStartTime);
      this.broadcastRoomUpdate(code);
    }

    return { success: true };
  }

  /**
   * Synchronizes arrow escape across all players in the room
   */
  public handleArrowEscape(socketId: string, arrowId: string, moves: number) {
    const roomCode = this.playerToRoom.get(socketId);
    if (!roomCode) return;

    const room = this.rooms.get(roomCode);
    if (!room || room.status !== 'PLAYING' || !room.currentPuzzle) return;

    const player = Object.values(room.players).find(p => p.socketId === socketId);
    if (!player) return;

    // Mark arrow as escaped in current puzzle
    const arrow = room.currentPuzzle.arrows.find(a => a.id === arrowId);
    if (arrow) {
      arrow.escaped = true;
    }

    const remainingCount = room.currentPuzzle.arrows.filter(a => !a.escaped).length;
    player.moves = moves;
    room.lastActivity = Date.now();

    if (this.io) {
      this.io.to(roomCode).emit('arrowEscapedByPlayer', {
        arrowId,
        playerId: player.id,
        playerName: player.name,
        remainingCount,
        moves,
      });
    }

    // If board is fully cleared
    if (remainingCount === 0) {
      const clientElapsedSeconds = room.roundStartTime ? (Date.now() - room.roundStartTime) / 1000 : 1;
      this.handlePlayerSolved(socketId, moves, clientElapsedSeconds);
    }
  }

  /**
   * Player submits arrow progress during solving
   */
  public updatePlayerProgress(socketId: string, arrowsRemaining: number, moves: number) {
    const roomCode = this.playerToRoom.get(socketId);
    if (!roomCode) return;

    const room = this.rooms.get(roomCode);
    if (!room || room.status !== 'PLAYING') return;

    const player = Object.values(room.players).find(p => p.socketId === socketId);
    if (!player) return;

    player.moves = moves;
    room.lastActivity = Date.now();

    if (this.io) {
      this.io.to(roomCode).emit('playerProgressUpdate', {
        playerId: player.id,
        arrowsRemaining,
        moves,
      });
    }
  }

  /**
   * Handles player puzzle completion with server-side validation and scoring.
   */
  public handlePlayerSolved(
    socketId: string,
    moves: number,
    clientElapsedSeconds: number
  ): { success: boolean; score?: PlayerScoreBreakdown; error?: string } {
    const roomCode = this.playerToRoom.get(socketId);
    if (!roomCode) return { success: false, error: 'Not in a room' };

    const room = this.rooms.get(roomCode);
    if (!room || room.status !== 'PLAYING' || !room.roundStartTime || !room.currentPuzzle) {
      return { success: false, error: 'Game is not in active playing state' };
    }

    const player = Object.values(room.players).find(p => p.socketId === socketId);
    if (!player) return { success: false, error: 'Player not found' };

    if (player.status === 'COMPLETED') {
      return { success: true, score: player.lastRoundBreakdown || undefined };
    }

    // Server-side authoritative time calculation
    const serverElapsedSeconds = Math.max(0.1, (Date.now() - room.roundStartTime) / 1000);
    // Use smaller of server elapsed or client elapsed (bounded by server to prevent tampering)
    const authoritativeTime = Number(
      Math.min(serverElapsedSeconds, Math.max(0.5, clientElapsedSeconds)).toFixed(2)
    );

    // Minimum moves validation (must be at least number of arrows in puzzle)
    const validMoves = Math.max(room.currentPuzzle.arrows.length, moves);

    // Calculate score
    const breakdown = calculateRoundScore(
      room.difficulty,
      authoritativeTime,
      validMoves
    );

    player.status = 'COMPLETED';
    player.completionTime = authoritativeTime;
    player.moves = validMoves;
    player.lastRoundBreakdown = breakdown;
    player.score += breakdown.totalRoundScore;
    room.lastActivity = Date.now();

    if (this.io) {
      this.io.to(roomCode).emit('playerSolved', {
        playerId: player.id,
        completionTime: authoritativeTime,
        moves: validMoves,
        roundScore: breakdown.totalRoundScore,
        totalScore: player.score,
      });
      this.broadcastRoomUpdate(roomCode);
    }

    // Check if round should end
    this.checkRoundCompletion(roomCode);

    return { success: true, score: breakdown };
  }

  /**
   * Checks if all active players completed the round, or schedules round ending.
   */
  private checkRoundCompletion(roomCode: string) {
    const room = this.rooms.get(roomCode);
    if (!room || room.status !== 'PLAYING') return;

    const activePlayers = Object.values(room.players).filter(p => p.connected);
    const completedPlayers = activePlayers.filter(p => p.status === 'COMPLETED');

    const allFinished = activePlayers.length > 0 && completedPlayers.length === activePlayers.length;

    if (allFinished) {
      this.finishRound(roomCode);
    } else if (completedPlayers.length > 0 && !this.autoProgressTimeouts.has(roomCode)) {
      // If someone finished, give remaining players a reasonable 30-second window or auto finish
      const timeout = setTimeout(() => {
        const liveRoom = this.rooms.get(roomCode);
        if (liveRoom && liveRoom.status === 'PLAYING') {
          this.finishRound(roomCode);
        }
      }, 35000);
      this.autoProgressTimeouts.set(roomCode, timeout);
    }
  }

  /**
   * Ends the round, compiles leaderboard rankings, and schedules auto-advancement.
   */
  private finishRound(roomCode: string) {
    this.clearAutoProgressTimeout(roomCode);
    const room = this.rooms.get(roomCode);
    if (!room) return;

    room.status = 'ROUND_COMPLETE';
    room.lastActivity = Date.now();

    // Sort active players by completion time (fastest first), then by score
    const standings = Object.values(room.players)
      .filter(p => p.connected)
      .sort((a, b) => {
        if (a.completionTime !== null && b.completionTime !== null) {
          return a.completionTime - b.completionTime;
        }
        if (a.completionTime !== null) return -1;
        if (b.completionTime !== null) return 1;
        return b.score - a.score;
      })
      .map(p => ({
        playerId: p.id,
        name: p.name,
        completionTime: p.completionTime,
        roundScore: p.lastRoundBreakdown?.totalRoundScore || 0,
        totalScore: p.score,
      }));

    const winnerId = standings.length > 0 ? standings[0].playerId : room.hostId;
    const AUTO_NEXT_ROUND_MS = 1800;
    room.nextRoundAutoStartTime = Date.now() + AUTO_NEXT_ROUND_MS;

    const completedLevel = room.currentLevel;

    if (this.io) {
      this.io.to(roomCode).emit('roundCompleted', {
        completedLevel,
        winnerId,
        standings,
        nextRoundInMs: AUTO_NEXT_ROUND_MS,
      });
      this.broadcastRoomUpdate(roomCode);
    }

    // Fast seamless auto progress to next level
    const nextRoundTimer = setTimeout(() => {
      const liveRoom = this.rooms.get(roomCode);
      if (!liveRoom || liveRoom.status !== 'ROUND_COMPLETE') return;

      liveRoom.currentLevel += 1;
      this.startRound(roomCode, liveRoom.hostId);
    }, AUTO_NEXT_ROUND_MS);

    this.autoProgressTimeouts.set(roomCode, nextRoundTimer);
  }

  /**
   * Handles player disconnection with automatic host migration.
   */
  public handleDisconnect(socketId: string) {
    const roomCode = this.playerToRoom.get(socketId);
    if (!roomCode) return;

    this.playerToRoom.delete(socketId);
    const room = this.rooms.get(roomCode);
    if (!room) return;

    const player = Object.values(room.players).find(p => p.socketId === socketId);
    if (!player) return;

    player.connected = false;
    player.status = 'DISCONNECTED';
    room.lastActivity = Date.now();

    // If the disconnecting player was the host, migrate host to another connected player
    if (player.isHost) {
      player.isHost = false;
      const nextHost = Object.values(room.players).find(p => p.connected && p.id !== player.id);
      if (nextHost) {
        nextHost.isHost = true;
        room.hostId = nextHost.id;
        if (this.io) {
          this.io.to(roomCode).emit('hostMigrated', nextHost.id, nextHost.name);
        }
      }
    }

    // Check if room is completely empty
    const connectedCount = Object.values(room.players).filter(p => p.connected).length;
    if (connectedCount === 0) {
      // Allow 5 minutes for reconnection before destroying
      setTimeout(() => {
        const liveRoom = this.rooms.get(roomCode);
        if (liveRoom) {
          const liveConnected = Object.values(liveRoom.players).filter(p => p.connected).length;
          if (liveConnected === 0) {
            this.destroyRoom(roomCode);
          }
        }
      }, 5 * 60 * 1000);
    } else {
      this.checkRoundCompletion(roomCode);
      this.broadcastRoomUpdate(roomCode);
    }
  }

  /**
   * Removes player explicitly (Leave Room)
   */
  public handleLeaveRoom(socketId: string) {
    this.handleDisconnect(socketId);
  }

  private clearAutoProgressTimeout(roomCode: string) {
    const t = this.autoProgressTimeouts.get(roomCode);
    if (t) {
      clearTimeout(t);
      this.autoProgressTimeouts.delete(roomCode);
    }
  }

  private destroyRoom(roomCode: string) {
    this.clearAutoProgressTimeout(roomCode);
    const room = this.rooms.get(roomCode);
    if (room) {
      for (const p of Object.values(room.players)) {
        this.playerToRoom.delete(p.socketId);
        this.sessionToPlayer.delete(p.id);
      }
      this.rooms.delete(roomCode);
    }
  }

  /**
   * Broadcasts a chat message in the room
   */
  public sendChatMessage(
    roomCode: string,
    senderId: string,
    text: string
  ): { success: boolean; error?: string } {
    const code = roomCode.trim().toUpperCase();
    const room = this.rooms.get(code);
    if (!room) return { success: false, error: 'Room not found' };

    const player = room.players[senderId];
    if (!player) return { success: false, error: 'Player not in room' };

    const cleanText = text.trim();
    if (!cleanText) return { success: false, error: 'Message cannot be empty' };

    const message: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      senderId: player.id,
      senderName: player.name,
      text: cleanText.substring(0, 300),
      timestamp: Date.now(),
    };

    if (this.io) {
      this.io.to(code).emit('newChatMessage', message);
    }

    return { success: true };
  }

  /**
   * Broadcasts a system chat announcement in the room
   */
  public broadcastSystemMessage(roomCode: string, text: string) {
    const code = roomCode.trim().toUpperCase();
    if (this.io) {
      const message: ChatMessage = {
        id: `sys_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        senderId: 'system',
        senderName: 'System',
        text,
        timestamp: Date.now(),
        isSystem: true,
      };
      this.io.to(code).emit('newChatMessage', message);
    }
  }

  public broadcastRoomUpdate(roomCode: string) {
    const room = this.rooms.get(roomCode);
    if (room && this.io) {
      this.io.to(roomCode).emit('roomUpdated', room);
    }
  }
}

export const roomManager = new RoomManager();
