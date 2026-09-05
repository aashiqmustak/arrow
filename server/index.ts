import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { roomManager } from './roomManager';
import { ClientToServerEvents, ServerToClientEvents } from '../src/types/socketEvents';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

roomManager.setIO(io);

// Periodically clean up expired rooms (every 5 minutes)
setInterval(() => {
  roomManager.cleanupExpiredRooms();
}, 5 * 60 * 1000);

// Socket.io connection handlers
io.on('connection', (socket) => {
  // Create Room
  socket.on('createRoom', ({ playerName, sessionPlayerId }, callback) => {
    try {
      const { roomCode, room } = roomManager.createRoom(playerName, sessionPlayerId, socket.id);
      socket.join(roomCode);
      callback({ success: true, roomCode, room });
      roomManager.broadcastRoomUpdate(roomCode);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create room';
      callback({ success: false, error: msg });
    }
  });

  // Join Room
  socket.on('joinRoom', ({ roomCode, playerName, sessionPlayerId }, callback) => {
    try {
      const result = roomManager.joinRoom(roomCode, playerName, sessionPlayerId, socket.id);
      if (result.success && result.room) {
        socket.join(roomCode.toUpperCase());
        callback({ success: true, room: result.room });
      } else {
        callback({ success: false, error: result.error });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to join room';
      callback({ success: false, error: msg });
    }
  });

  // Reconnect Player
  socket.on('reconnectPlayer', ({ roomCode, sessionPlayerId }, callback) => {
    try {
      const result = roomManager.reconnectPlayer(roomCode, sessionPlayerId, socket.id);
      if (result.success && result.room) {
        socket.join(roomCode.toUpperCase());
        callback({ success: true, room: result.room });
      } else {
        callback({ success: false, error: result.error });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reconnect';
      callback({ success: false, error: msg });
    }
  });

  // Host starts game
  socket.on('startGame', (callback) => {
    try {
      // Find room for this socket
      const rooms = Array.from(socket.rooms);
      const roomCode = rooms.find(r => r !== socket.id);

      if (!roomCode) {
        return callback({ success: false, error: 'Not in a room' });
      }

      const room = roomManager.getRoom(roomCode);
      if (!room) {
        return callback({ success: false, error: 'Room not found' });
      }

      const player = Object.values(room.players).find(p => p.socketId === socket.id);
      if (!player) {
        return callback({ success: false, error: 'Player not recognized' });
      }

      const result = roomManager.startRound(roomCode, player.id);
      callback(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start game';
      callback({ success: false, error: msg });
    }
  });

  // Escape arrow (live sync across all players in room)
  socket.on('escapeArrow', ({ arrowId, moves }) => {
    roomManager.handleArrowEscape(socket.id, arrowId, moves);
  });

  // Live progress updates
  socket.on('submitProgress', ({ arrowsRemaining, moves }) => {
    roomManager.updatePlayerProgress(socket.id, arrowsRemaining, moves);
  });

  // Player finished puzzle
  socket.on('submitSolved', ({ moves, clientElapsedSeconds }, callback) => {
    const result = roomManager.handlePlayerSolved(socket.id, moves, clientElapsedSeconds);
    callback(result);
  });

  // In-Game & Lobby Chat
  socket.on('sendChatMessage', ({ text }, callback) => {
    try {
      const rooms = Array.from(socket.rooms);
      const roomCode = rooms.find(r => r !== socket.id);
      if (!roomCode) {
        if (callback) callback({ success: false, error: 'Not in a room' });
        return;
      }

      const room = roomManager.getRoom(roomCode);
      if (!room) {
        if (callback) callback({ success: false, error: 'Room not found' });
        return;
      }

      const player = Object.values(room.players).find(p => p.socketId === socket.id);
      if (!player) {
        if (callback) callback({ success: false, error: 'Player not recognized' });
        return;
      }

      const res = roomManager.sendChatMessage(roomCode, player.id, text);
      if (callback) callback(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send message';
      if (callback) callback({ success: false, error: msg });
    }
  });

  // Leave room
  socket.on('leaveRoom', () => {
    roomManager.handleLeaveRoom(socket.id);
  });

  // Disconnect
  socket.on('disconnect', () => {
    roomManager.handleDisconnect(socket.id);
  });
});

// REST Health & Room verification endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: Date.now() });
});

app.get('/api/room/:code', (req, res) => {
  const room = roomManager.getRoom(req.params.code);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  return res.json({
    roomCode: room.roomCode,
    status: room.status,
    playerCount: Object.values(room.players).filter(p => p.connected).length,
    currentLevel: room.currentLevel,
  });
});

// Serve frontend in production
const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[AS ARROW SERVER] Running on port ${PORT}`);
});
