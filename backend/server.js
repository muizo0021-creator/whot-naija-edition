const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

// Backend-local TURN_DURATIONS definition
const TURN_DURATIONS = {
  NORMAL: 10
};

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.io
const corsOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ["http://localhost:3000", "http://localhost:5173"]; // Default to localhost for development

const io = socketIo(server, {
  cors: {
    origin: corsOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors({ origin: corsOrigins }));
app.use(express.json());

// In-memory storage for rooms (in production, use Redis or database)
const rooms = new Map(); // roomCode -> roomData
const players = new Map(); // socketId -> playerData
const tournaments = new Map(); // tournamentId -> tournamentData

// Room data structure
class Room {
  constructor(hostId, config) {
    this.id = uuidv4();
    this.code = null; // Will be set after uniqueness check
    this.hostId = hostId;
    this.players = new Map(); // socketId -> player
    this.gameState = null;
    this.status = 'waiting'; // waiting, playing, finished
    this.config = config;
    this.createdAt = Date.now();
    this.awaitingShapeSelection = null; // playerId or null
    this.turnTimer = null; // interval ID for turn timer
    this.disconnectedPlayers = new Map(); // playerId -> {disconnectTime, countdown, timer}
    this.gamePaused = false;
    this.pauseReason = null;
    this.roomCleanupTimer = null; // for 10 min cleanup after all disconnect
  }

  generateRoomCode() {
    return `NAIJA-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  addPlayer(socketId, playerData) {
    this.players.set(socketId, {
      ...playerData,
      socketId,
      joinedAt: Date.now(),
      isReady: false,
      isConnected: true,
      lastSeen: Date.now()
    });
  }

  removePlayer(socketId) {
    return this.players.delete(socketId);
  }

  getPlayerCount() {
    return this.players.size;
  }

  getReadyCount() {
    return Array.from(this.players.values()).filter(p => p.isReady).length;
  }

  cleanupDisconnectedPlayers(timeoutMs = 300000) { // 5 minutes default
    const now = Date.now();
    const toRemove = [];
    const removedPlayerIds = [];

    for (const [socketId, player] of this.players) {
      if (!player.isConnected && (now - player.lastSeen) > timeoutMs) {
        toRemove.push(socketId);
        removedPlayerIds.push(player.id);
      }
    }

    toRemove.forEach(socketId => {
      this.players.delete(socketId);
    });

    // Remove from gameState if game is active
    if (this.gameState && this.gameState.players) {
      // Count how many players before currentPlayerIndex are being removed
      let removedBeforeCurrent = 0;
      for (let i = 0; i < this.gameState.currentPlayerIndex; i++) {
        if (removedPlayerIds.includes(this.gameState.players[i].id)) {
          removedBeforeCurrent++;
        }
      }

      this.gameState.players = this.gameState.players.filter(p => !removedPlayerIds.includes(p.id));

      // Adjust currentPlayerIndex for removed players before it
      this.gameState.currentPlayerIndex -= removedBeforeCurrent;

      // Normalize currentPlayerIndex to stay within bounds
      if (this.gameState.players.length > 0) {
        this.gameState.currentPlayerIndex = Math.max(0, Math.min(this.gameState.currentPlayerIndex, this.gameState.players.length - 1));
      } else {
        this.gameState.currentPlayerIndex = 0;
      }

      // Check if only one player remains - end the game
      if (this.gameState.players.length === 1 && this.gameState.status === GameStatus.PLAYING) {
        const remainingPlayer = this.gameState.players[0];
        this.gameState.status = GameStatus.FINISHED;
        this.gameState.winnerId = remainingPlayer.id;
        this.status = 'finished';
        this.stopTurnTimer();
        console.log(`Game ended due to disconnected players. Winner: ${remainingPlayer.name}`);
      }
    }

    return { count: toRemove.length, hadActiveGame: this.gameState && this.status === 'playing' };
  }

  handleReconnectionTimeout(playerId) {
    this.disconnectedPlayers.delete(playerId);
    
    // Remove player from game or make spectator
    if (this.gameState) {
      const playerIndex = this.gameState.players.findIndex(p => p.id === playerId);
      if (playerIndex !== -1) {
        const player = this.gameState.players[playerIndex];
        player.isSpectator = true; // Add spectator flag
        // Keep in game but mark as spectator
        console.log(`Player ${player.name} became spectator after reconnection timeout`);
      }
    }
    
    // Resume game if paused
    if (this.gamePaused) {
      this.gamePaused = false;
      this.pauseReason = null;
      this.startTurnTimer();
    }
    
    // Notify players
    io.to(this.code).emit('player-became-spectator', { playerId });
    io.to(this.code).emit('game-resumed');
  }

  canStartGame() {
    return this.getPlayerCount() >= 2 && this.getReadyCount() === this.getPlayerCount();
  }

  toPublicData() {
    return {
      id: this.id,
      code: this.code,
      hostId: this.hostId,
      players: Array.from(this.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        isReady: p.isReady,
        isHost: p.id === this.hostId,
        socketId: p.socketId,
        joinedAt: p.joinedAt,
        isConnected: p.isConnected
      })),
      status: this.status,
      config: this.config,
      playerCount: this.getPlayerCount(),
      readyCount: this.getReadyCount(),
      createdAt: this.createdAt
    };
  }

  startTurnTimer(io) {
    if (this.turnTimer) {
      clearInterval(this.turnTimer);
    }
    this.turnTimer = setInterval(() => {
      if (this.gameState && this.gameState.status === 'PLAYING' && this.gameState.turnTimeLeft > 0) {
        this.gameState.turnTimeLeft--;
        // Broadcast updated game state to all players
        this.players.forEach((player, socketId) => {
          const personalizedGameState = getPersonalizedGameState(this, player.id);
          io.to(socketId).emit('game-state-update', { gameState: personalizedGameState, awaitingShapeSelection: this.awaitingShapeSelection });
        });
      } else if (this.gameState && this.gameState.turnTimeLeft <= 0) {
        // Handle timeout - force draw card or skip turn, or auto-select shape for WHOT
        this.handleTurnTimeout(io);
      }
    }, 1000);
  }

  stopTurnTimer() {
    if (this.turnTimer) {
      clearInterval(this.turnTimer);
      this.turnTimer = null;
    }
  }

  handleTurnTimeout(io) {
    if (this.awaitingShapeSelection) {
      // Auto-select a random shape for WHOT timeout
      const shapes = ['CIRCLE', 'TRIANGLE', 'CROSS', 'SQUARE', 'STAR'];
      const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
      this.gameState.currentShape = randomShape;
      this.awaitingShapeSelection = null;
      this.gameState.logs.push(`WHOT shape selection timed out - auto-selected ${randomShape}`);
      // Advance to next player
      this.gameState.currentPlayerIndex = (this.gameState.currentPlayerIndex + this.gameState.turnDirection + this.gameState.players.length) % this.gameState.players.length;
      this.gameState.turnTimeLeft = TURN_DURATIONS.NORMAL; // Fixed 10 seconds
    } else {
      // Force current player to draw 2 penalty cards on timeout
      const currentPlayer = this.gameState.players[this.gameState.currentPlayerIndex];
      if (currentPlayer) {
        const penaltyCards = 2;
        
        for (let i = 0; i < penaltyCards; i++) {
          if (this.gameState.drawPile.length === 0) {
            if (this.gameState.discardPile.length <= 1) break;
            const top = this.gameState.discardPile.pop();
            this.gameState.drawPile = this.gameState.discardPile.sort(() => Math.random() - 0.5);
            this.gameState.discardPile = [top];
          }
          const c = this.gameState.drawPile.pop();
          if (c) currentPlayer.hand.push(c);
        }
        
        this.gameState.pendingPicks = 0;
        const penaltyMessage = `${currentPlayer.name} timed out and drew ${penaltyCards} penalty cards!`;
        this.gameState.logs.push(penaltyMessage);
        
        // Broadcast penalty message to all players
        this.players.forEach((player, socketId) => {
          io.to(socketId).emit('penalty-notification', { message: penaltyMessage, playerId: currentPlayer.id });
        });
        
        // Move to next player
        this.gameState.currentPlayerIndex = getNextPlayerIndex(this.gameState);
        this.gameState.turnTimeLeft = TURN_DURATIONS.NORMAL; // Fixed 10 seconds
      }
    }
    // Broadcast update
    this.players.forEach((player, socketId) => {
      const personalizedGameState = getPersonalizedGameState(this, player.id);
      io.to(socketId).emit('game-state-update', { gameState: personalizedGameState, awaitingShapeSelection: this.awaitingShapeSelection });
    });
  }
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Store player data
  players.set(socket.id, { socketId: socket.id });

  // Create room
  socket.on('create-room', (config) => {
    try {
      const room = new Room(config.playerData.id, config);
      room.addPlayer(socket.id, config.playerData);

      // Generate unique room code
      let roomCode;
      do {
        roomCode = room.generateRoomCode();
      } while (rooms.has(roomCode));
      room.code = roomCode;

      rooms.set(room.code, room);
      socket.join(room.code);

      // Update player data with room info
      players.set(socket.id, { 
        socketId: socket.id, 
        id: config.playerData.id, 
        name: config.playerData.name, 
        currentRoom: room.code 
      });

      console.log(`Room created: ${room.code} by ${socket.id}`);

      socket.emit('room-created', room.toPublicData());
    } catch (error) {
      console.error('Error creating room:', error);
      socket.emit('error', { type: 'CREATE_ROOM_FAILED', message: 'Failed to create room' });
    }
  });

  // Join room
  socket.on('join-room', (data) => {
    try {
      const { roomCode, playerData } = data;
      const room = rooms.get(roomCode);

      if (!room) {
        socket.emit('error', { type: 'ROOM_NOT_FOUND', message: 'Room not found' });
        return;
      }

      if (room.status !== 'waiting') {
        // Allow reconnection if player was previously in the room
        const wasInRoom = room.gameState && room.gameState.players.some(p => p.id === playerData.id);
        if (!wasInRoom) {
          socket.emit('error', { type: 'ROOM_NOT_JOINABLE', message: 'Game already started' });
          return;
        }
        // Allow reconnection
      }

      if (room.getPlayerCount() >= (room.config.maxPlayers || 4)) {
        socket.emit('error', { type: 'ROOM_FULL', message: 'Room is full' });
        return;
      }

      // Check for duplicate player ID
      let existingSocketId = null;
      for (const [socketId, player] of room.players) {
        if (player.id === playerData.id) {
          existingSocketId = socketId;
          break;
        }
      }

      if (existingSocketId) {
        // Remove old socket entry and update with new socket
        room.players.delete(existingSocketId);
      }

      room.addPlayer(socket.id, playerData);
      socket.join(roomCode);

      // Update player data with room info
      players.set(socket.id, { 
        socketId: socket.id, 
        id: playerData.id, 
        name: playerData.name, 
        currentRoom: roomCode 
      });

      console.log(`Player ${socket.id} joined room ${roomCode}`);

      // Handle reconnection if player was disconnected
      if (room.disconnectedPlayers.has(playerData.id)) {
        const disconnectData = room.disconnectedPlayers.get(playerData.id);
        clearInterval(disconnectData.timer);
        room.disconnectedPlayers.delete(playerData.id);
        
        // Update player connection status
        const player = room.players.get(socket.id);
        if (player) {
          player.isConnected = true;
          player.lastSeen = Date.now();
        }
        
        // Resume game if paused
        if (room.gamePaused && room.disconnectedPlayers.size === 0) {
          room.gamePaused = false;
          room.pauseReason = null;
          room.startTurnTimer();
          io.to(roomCode).emit('game-resumed');
        }
        
        console.log(`Player ${playerData.name} reconnected to room ${roomCode}`);
      }

      // Notify all players in room
      io.to(roomCode).emit('player-joined', room.toPublicData());
      socket.emit('room-joined', room.toPublicData());

    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { type: 'JOIN_ROOM_FAILED', message: 'Failed to join room' });
    }
  });

  socket.on('reconnect-room', (data) => {
    try {
      const { roomCode, playerData } = data;
      const room = rooms.get(roomCode);

      if (!room) {
        socket.emit('error', { type: 'ROOM_NOT_FOUND', message: 'Room not found' });
        return;
      }

      // Check if player was already in the room
      const existingPlayer = Array.from(room.players.values()).find(p => p.id === playerData.id);
      if (!existingPlayer) {
        socket.emit('error', { type: 'NOT_IN_ROOM', message: 'Player not in this room' });
        return;
      }

      // Find the old socketId key for this player
      const oldSocketId = Array.from(room.players.keys()).find(key => room.players.get(key).id === playerData.id);
      
      // Remove the old entry and set new entry with current socketId
      if (oldSocketId) {
        room.players.delete(oldSocketId);
      }
      room.players.set(socket.id, existingPlayer);

      // Update existing player entry with new socket and mark as connected
      existingPlayer.socketId = socket.id;
      existingPlayer.isConnected = true;
      existingPlayer.lastSeen = Date.now();
      socket.join(roomCode);

      // Update player data
      players.set(socket.id, { 
        socketId: socket.id, 
        id: playerData.id, 
        name: playerData.name, 
        currentRoom: roomCode 
      });

      console.log(`Player ${socket.id} reconnected to room ${roomCode}`);

      // Send current room state
      socket.emit('room-joined', room.toPublicData());

      // If game is in progress, send current game state
      if (room.status === 'playing' && room.gameState) {
        const personalizedGameState = getPersonalizedGameState(room, playerData.id);
        socket.emit('game-started', {
          room: room.toPublicData(),
          gameState: personalizedGameState,
          awaitingShapeSelection: room.awaitingShapeSelection
        });
      }

    } catch (error) {
      console.error('Error reconnecting to room:', error);
      socket.emit('error', { type: 'RECONNECT_FAILED', message: 'Failed to reconnect to room' });
    }
  });

  // Player ready
  socket.on('player-ready', (isReady) => {
    const playerData = players.get(socket.id);
    if (!playerData || !playerData.currentRoom) return;

    const room = rooms.get(playerData.currentRoom);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (player) {
      player.isReady = isReady;
      io.to(room.code).emit('player-ready-update', room.toPublicData());
    }
  });

  // Start game
  socket.on('start-game', () => {
    const playerData = players.get(socket.id);
    if (!playerData || !playerData.currentRoom) return;

    const room = rooms.get(playerData.currentRoom);
    if (!room || room.hostId !== playerData.id) return;

    if (!room.canStartGame()) {
      socket.emit('error', { type: 'CANNOT_START', message: 'Not all players are ready' });
      return;
    }

    room.status = 'playing';
    // Initialize game state here (will be implemented)
    room.gameState = initializeGameState(room);

    // Handle initial WHOT card
    const initialDiscard = room.gameState.discardPile[0];
    if (initialDiscard.number === 20) {
      room.awaitingShapeSelection = room.gameState.players[0].id; // First player needs to select shape
    }

    // Send personalized game state to each player
    room.players.forEach((player, socketId) => {
      const personalizedGameState = getPersonalizedGameState(room, player.id);
      io.to(socketId).emit('game-started', {
        room: room.toPublicData(),
        gameState: personalizedGameState,
        awaitingShapeSelection: room.awaitingShapeSelection
      });
    });

    // Start turn timer
    room.startTurnTimer(io);
  });

  // Leave room
  socket.on('leave-room', () => {
    const playerData = players.get(socket.id);
    if (!playerData || !playerData.currentRoom) return;

    const room = rooms.get(playerData.currentRoom);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    // Remove player from room
    room.players.delete(socket.id);

    // If game is active, also remove from gameState.players
    if (room.gameState && room.gameState.players) {
      const removedPlayerIndex = room.gameState.players.findIndex(p => p.id === player.id);
      room.gameState.players = room.gameState.players.filter(p => p.id !== player.id);

      // If the leaving player was supposed to select a shape, clear the flag and advance turn
      if (room.awaitingShapeSelection === player.id) {
        room.awaitingShapeSelection = null;
        // Auto-select a random shape for the WHOT card
        const shapes = ['CIRCLE', 'TRIANGLE', 'CROSS', 'SQUARE', 'STAR'];
        const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
        room.gameState.currentShape = randomShape;
        room.gameState.logs.push(`WHOT shape selection cancelled - player left, auto-selected ${randomShape}`);
        // Advance to next player
        room.gameState.currentPlayerIndex = getNextPlayerIndex(room.gameState);
        room.gameState.turnTimeLeft = TURN_DURATIONS[room.gameState.speedMode] || TURN_DURATIONS.NORMAL;
      }

      // Normalize currentPlayerIndex
      if (removedPlayerIndex < room.gameState.currentPlayerIndex) {
        room.gameState.currentPlayerIndex--;
      }
      // Clamp to valid range if out of bounds
      if (room.gameState.currentPlayerIndex >= room.gameState.players.length) {
        room.gameState.currentPlayerIndex = room.gameState.players.length - 1;
      }
      if (room.gameState.currentPlayerIndex < 0) room.gameState.currentPlayerIndex = 0;

      // Check if only one player remains - end the game
      if (room.gameState.players.length === 1 && room.gameState.status === GameStatus.PLAYING) {
        const remainingPlayer = room.gameState.players[0];
        room.gameState.status = GameStatus.FINISHED;
        room.gameState.winnerId = remainingPlayer.id;
        room.status = 'finished';
        room.stopTurnTimer();
        console.log(`Game ended due to player leaving. Winner: ${remainingPlayer.name}`);
      }
    }

    // If this was the host and there are other players, assign new host
    // (even if gameState is null - waiting room)
    if (player.id === room.hostId && room.players.size > 0) {
      const newHost = room.players.values().next().value;
      if (newHost) {
        room.hostId = newHost.id;
        // Emit host-changed event so clients refresh host status
        io.to(room.code).emit('host-changed', room.toPublicData());
      }
    }

    // Remove from global players map
    players.delete(socket.id);

    // Leave the room socket channel
    socket.leave(room.code);

    // Broadcast updated room state to remaining players
    if (room.players.size > 0) {
      io.to(room.code).emit('player-left', { playerId: player.id, room: room.toPublicData() });

      // If game is active, broadcast updated game state
      if (room.gameState) {
        room.players.forEach((player, socketId) => {
          const personalizedGameState = getPersonalizedGameState(room, player.id);
          io.to(socketId).emit('game-state-update', {
            gameState: personalizedGameState,
            awaitingShapeSelection: room.awaitingShapeSelection
          });
        });
      }
    } else {
      // If room is empty, delete it
      rooms.delete(room.code);
    }
  });

  // Replace disconnected player
  socket.on('replace-disconnected-player', (data) => {
    const { playerId } = data;
    const playerData = players.get(socket.id);
    if (!playerData || !playerData.currentRoom) return;

    const room = rooms.get(playerData.currentRoom);
    if (!room || room.hostId !== playerData.id) return; // Only host can replace

    // Remove the disconnected player
    if (room.gameState) {
      room.gameState.players = room.gameState.players.filter(p => p.id !== playerId);
    }
    // Remove from room players map (find the socket for the disconnected player)
    for (const [socketId, player] of room.players) {
      if (player.id === playerId && !player.isConnected) {
        room.players.delete(socketId);
        break;
      }
    }

    // Clear any disconnect data
    room.disconnectedPlayers.delete(playerId);

    // If game was paused, resume
    if (room.gamePaused && room.disconnectedPlayers.size === 0) {
      room.gamePaused = false;
      room.pauseReason = null;
      room.startTurnTimer();
      io.to(room.code).emit('game-resumed');
    }

    // Broadcast updated state
    io.to(room.code).emit('player-left', { playerId, room: room.toPublicData() });
    if (room.gameState) {
      room.players.forEach((player, socketId) => {
        const personalizedGameState = getPersonalizedGameState(room, player.id);
        io.to(socketId).emit('game-state-update', { gameState: personalizedGameState, awaitingShapeSelection: room.awaitingShapeSelection });
      });
    }
  });

  // Game actions
  socket.on('play-card', (cardId) => {
    const playerData = players.get(socket.id);
    if (!playerData || !playerData.currentRoom) return;

    const room = rooms.get(playerData.currentRoom);
    if (!room || room.status !== 'playing') return;

    // Validate and process move (will be implemented)
    const result = processCardPlay(room, socket.id, cardId);
    if (result.valid) {
      // Reset turn timer on valid move
      room.gameState.turnTimeLeft = TURN_DURATIONS[room.gameState.speedMode] || TURN_DURATIONS.NORMAL;
      // Send personalized game state to each player
      room.players.forEach((player, socketId) => {
        const personalizedGameState = getPersonalizedGameState(room, player.id);
        io.to(socketId).emit('game-state-update', { gameState: personalizedGameState, awaitingShapeSelection: room.awaitingShapeSelection });
      });
      // If game finished, emit room update
      if (room.status === 'finished') {
        io.to(room.code).emit('room-updated', room.toPublicData());
      }
    } else {
      socket.emit('move-invalid', { error: result.error });
    }
  });

  socket.on('draw-card', () => {
    const playerData = players.get(socket.id);
    if (!playerData || !playerData.currentRoom) return;

    const room = rooms.get(playerData.currentRoom);
    if (!room || room.status !== 'playing') return;

    // Process draw (will be implemented)
    const result = processDrawCard(room, socket.id);
    if (result.valid) {
      // Reset turn timer on valid draw
      room.gameState.turnTimeLeft = TURN_DURATIONS[room.gameState.speedMode] || TURN_DURATIONS.NORMAL;
      // Send personalized game state to each player
      room.players.forEach((player, socketId) => {
        const personalizedGameState = getPersonalizedGameState(room, player.id);
        io.to(socketId).emit('game-state-update', { gameState: personalizedGameState, awaitingShapeSelection: room.awaitingShapeSelection });
      });
    }
  });

  socket.on('select-shape', (shape) => {
    const playerData = players.get(socket.id);
    if (!playerData || !playerData.currentRoom) return;

    const room = rooms.get(playerData.currentRoom);
    if (!room || room.status !== 'playing') return;

    // Process shape selection (will be implemented)
    const result = processShapeSelection(room, socket.id, shape);
    if (result.valid) {
      // Reset turn timer on valid shape selection
      room.gameState.turnTimeLeft = TURN_DURATIONS[room.gameState.speedMode] || TURN_DURATIONS.NORMAL;
      // Send personalized game state to each player
      room.players.forEach((player, socketId) => {
        const personalizedGameState = getPersonalizedGameState(room, player.id);
        io.to(socketId).emit('game-state-update', { gameState: personalizedGameState, awaitingShapeSelection: room.awaitingShapeSelection });
      });
    } else {
      socket.emit('move-invalid', { error: result.error });
    }
  });

  socket.on('call-last-card', () => {
    const playerData = players.get(socket.id);
    if (!playerData || !playerData.currentRoom) return;

    const room = rooms.get(playerData.currentRoom);
    if (!room || room.status !== 'playing') return;

    const gameState = room.gameState;
    if (!gameState) return;

    // Find the player
    const playerIndex = gameState.players.findIndex(p => p.id === playerData.id);
    if (playerIndex === -1 || gameState.players[playerIndex].hand.length !== 1) return;

    // Update lastCardDeclared
    gameState.lastCardDeclared = [...gameState.lastCardDeclared, playerData.id];

    // Broadcast updated game state
    room.players.forEach((player, socketId) => {
      const personalizedGameState = getPersonalizedGameState(room, player.id);
      io.to(socketId).emit('game-state-update', { gameState: personalizedGameState, awaitingShapeSelection: room.awaitingShapeSelection });
    });
  });

  // Chat
  socket.on('chat-message', (message) => {
    const playerData = players.get(socket.id);
    if (!playerData || !playerData.currentRoom) return;

    const room = rooms.get(playerData.currentRoom);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    const chatMessage = {
      id: uuidv4(),
      senderId: player.id,
      senderName: player.name,
      text: message,
      timestamp: Date.now()
    };

    // Append to game state chat history if game is active
    if (room.gameState && room.gameState.status === 'PLAYING') {
      room.gameState.chatHistory.push(chatMessage);
    }

    io.to(room.code).emit('chat-message', chatMessage);
  });

  // Pause game
  socket.on('pause-game', () => {
    const playerData = players.get(socket.id);
    if (!playerData || !playerData.currentRoom) return;

    const room = rooms.get(playerData.currentRoom);
    if (!room || room.status !== 'playing' || !room.gameState) return;

    // Only host can pause
    if (playerData.id !== room.hostId) {
      socket.emit('error', { type: 'NOT_HOST', message: 'Only the host can pause the game' });
      return;
    }

    // Pause the game
    room.gameState.isPaused = true;
    room.stopTurnTimer(); // Stop the turn timer

    // Broadcast updated game state
    room.players.forEach((player, socketId) => {
      const personalizedGameState = getPersonalizedGameState(room, player.id);
      io.to(socketId).emit('game-state-update', { gameState: personalizedGameState, awaitingShapeSelection: room.awaitingShapeSelection });
    });
  });

  // Resume game
  socket.on('resume-game', () => {
    const playerData = players.get(socket.id);
    if (!playerData || !playerData.currentRoom) return;

    const room = rooms.get(playerData.currentRoom);
    if (!room || room.status !== 'playing' || !room.gameState) return;

    // Only host can resume
    if (playerData.id !== room.hostId) {
      socket.emit('error', { type: 'NOT_HOST', message: 'Only the host can resume the game' });
      return;
    }

    // Resume the game
    room.gameState.isPaused = false;
    room.startTurnTimer(io); // Restart the turn timer

    // Broadcast updated game state
    room.players.forEach((player, socketId) => {
      const personalizedGameState = getPersonalizedGameState(room, player.id);
      io.to(socketId).emit('game-state-update', { gameState: personalizedGameState, awaitingShapeSelection: room.awaitingShapeSelection });
    });
  });

  // Tournament handlers
  socket.on('create-tournament', (config) => {
    try {
      const tournamentId = uuidv4();
      const tournament = {
        id: tournamentId,
        name: config.name || 'Whot Tournament',
        hostId: config.playerData.id,
        participants: [config.playerData],
        maxParticipants: config.maxParticipants || 8,
        status: 'waiting',
        format: 'single-elimination',
        currentRound: 0,
        matches: [],
        winner: null,
        createdAt: Date.now()
      };

      // Generate initial bracket (will be empty until tournament starts)
      tournament.matches = generateTournamentBracket(tournament.participants, tournament.maxParticipants);

      tournaments.set(tournamentId, tournament);
      socket.join(tournamentId);

      // Update player data with tournament info
      players.set(socket.id, {
        ...players.get(socket.id),
        currentTournament: tournamentId
      });

      console.log(`Tournament created: ${tournamentId} by ${socket.id}`);

      socket.emit('tournament-created', tournament);
    } catch (error) {
      console.error('Error creating tournament:', error);
      socket.emit('error', { type: 'CREATE_TOURNAMENT_FAILED', message: 'Failed to create tournament' });
    }
  });

  socket.on('join-tournament', (data) => {
    try {
      const { tournamentId, playerData } = data;
      const tournament = tournaments.get(tournamentId);

      if (!tournament) {
        socket.emit('error', { type: 'TOURNAMENT_NOT_FOUND', message: 'Tournament not found' });
        return;
      }

      if (tournament.status !== 'waiting') {
        socket.emit('error', { type: 'TOURNAMENT_NOT_JOINABLE', message: 'Tournament already started' });
        return;
      }

      if (tournament.participants.length >= tournament.maxParticipants) {
        socket.emit('error', { type: 'TOURNAMENT_FULL', message: 'Tournament is full' });
        return;
      }

      // Check for duplicate player
      if (tournament.participants.some(p => p.id === playerData.id)) {
        socket.emit('error', { type: 'ALREADY_JOINED', message: 'Already joined this tournament' });
        return;
      }

      tournament.participants.push(playerData);
      socket.join(tournamentId);

      // Update player data with tournament info
      players.set(socket.id, {
        ...players.get(socket.id),
        currentTournament: tournamentId
      });

      // Regenerate bracket with new participants
      tournament.matches = generateTournamentBracket(tournament.participants, tournament.maxParticipants);

      console.log(`Player ${socket.id} joined tournament ${tournamentId}`);

      // Notify all participants
      io.to(tournamentId).emit('tournament-updated', tournament);
      socket.emit('tournament-joined', tournament);

    } catch (error) {
      console.error('Error joining tournament:', error);
      socket.emit('error', { type: 'JOIN_TOURNAMENT_FAILED', message: 'Failed to join tournament' });
    }
  });

  socket.on('leave-tournament', () => {
    const playerData = players.get(socket.id);
    if (!playerData || !playerData.currentTournament) return;

    const tournament = tournaments.get(playerData.currentTournament);
    if (!tournament) return;

    // Remove player from participants
    tournament.participants = tournament.participants.filter(p => p.id !== playerData.id);

    // If host left and there are other participants, assign new host
    if (playerData.id === tournament.hostId && tournament.participants.length > 0) {
      tournament.hostId = tournament.participants[0].id;
    }

    // Update player data
    players.set(socket.id, {
      ...players.get(socket.id),
      currentTournament: null
    });

    socket.leave(tournament.id);

    // If no participants left, delete tournament
    if (tournament.participants.length === 0) {
      tournaments.delete(tournament.id);
    } else {
      // Regenerate bracket
      tournament.matches = generateTournamentBracket(tournament.participants, tournament.maxParticipants);
      // Notify remaining participants
      io.to(tournament.id).emit('tournament-updated', tournament);
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);

    const playerData = players.get(socket.id);
    if (playerData && playerData.currentRoom) {
      const room = rooms.get(playerData.currentRoom);
      if (room) {
        // Mark player as disconnected instead of removing
        const player = room.players.get(socket.id);
        if (player) {
          if (room.status === 'waiting') {
            // Remove immediately from waiting room
            room.players.delete(socket.id);
            // Emit player-left to update UI
            io.to(room.code).emit('player-left', {
              playerId: playerData.id,
              room: room.toPublicData()
            });
          } else {
            // For active games, mark as disconnected and pause game
            player.isConnected = false;
            player.lastSeen = Date.now();

            // Add to disconnected players with 60 second countdown
            const countdown = 60;
            const disconnectData = {
              disconnectTime: Date.now(),
              countdown: countdown,
              timer: setInterval(() => {
                disconnectData.countdown--;
                if (disconnectData.countdown <= 0) {
                  clearInterval(disconnectData.timer);
                  // Timeout - make player spectator
                  room.handleReconnectionTimeout(playerData.id);
                } else {
                  // Update countdown for remaining players
                  io.to(room.code).emit('reconnection-countdown', {
                    playerId: playerData.id,
                    countdown: disconnectData.countdown,
                    playerName: player.name
                  });
                }
              }, 1000)
            };
            room.disconnectedPlayers.set(playerData.id, disconnectData);

            // Pause the game
            room.gamePaused = true;
            room.pauseReason = `Waiting for ${player.name} to reconnect...`;
            room.stopTurnTimer();

            // Notify all players with specific disconnected player info
            io.to(room.code).emit('game-paused', {
              reason: room.pauseReason,
              disconnectedPlayer: playerData.id,
              playerName: player.name,
              countdown: countdown
            });
          }
        }

        // Check if any connected players remain
        const connectedPlayers = Array.from(room.players.values()).filter(p => p.isConnected);
        if (connectedPlayers.length === 0) {
          // Stop timer before cleanup
          room.stopTurnTimer();

          // Set 10 minute cleanup timer instead of immediate cleanup
          room.roomCleanupTimer = setTimeout(() => {
            rooms.delete(room.code);
            console.log(`Room ${room.code} cleaned up after 10 minutes - no connected players`);
          }, 10 * 60 * 1000); // 10 minutes

          console.log(`Room ${room.code} paused - no connected players, will cleanup in 10 minutes`);
        } else {
          // Notify remaining players
          io.to(room.code).emit('player-left', {
            playerId: playerData.id,
            room: room.toPublicData()
          });

          // If host disconnected, assign new host from connected players
          if (playerData.id === room.hostId) {
            const newHost = connectedPlayers[0];
            if (newHost) {
              room.hostId = newHost.id;
              io.to(room.code).emit('host-changed', room.toPublicData());
            }
          }

          // For active games, don't remove from gameState yet - allow reconnection
          // The player remains in gameState.players but marked as disconnected
        }
      }
    }

    players.delete(socket.id);
  });

});

// Game constants
const Shape = {
  CIRCLE: 'CIRCLE',
  TRIANGLE: 'TRIANGLE',
  CROSS: 'CROSS',
  SQUARE: 'SQUARE',
  STAR: 'STAR',
  WHOT: 'WHOT'
};

const GameStatus = {
  LOBBY: 'LOBBY',
  PLAYING: 'PLAYING',
  FINISHED: 'FINISHED'
};

const GameMode = {
  CLASSIC: 'CLASSIC',
  CHAOS: 'CHAOS'
};

const SpeedMode = {
  NORMAL: 'NORMAL',
  FAST: 'FAST',
  MADNESS: 'MADNESS'
};

// Game engine functions
function createDeck() {
  const deck = [];
  const shapes = [Shape.CIRCLE, Shape.TRIANGLE, Shape.CROSS, Shape.SQUARE, Shape.STAR];

  shapes.forEach(shape => {
    const numbers = [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14];
    numbers.forEach(num => {
      deck.push({ id: `${shape}-${num}-${Math.random()}`, shape, number: num });
    });
  });

  for (let i = 0; i < 4; i++) {
    deck.push({ id: `WHOT-${i}-${Math.random()}`, shape: Shape.WHOT, number: 20 });
  }

  return deck.sort(() => Math.random() - 0.5);
}

function isValidMove(card, gameState) {
  if (!card) return false;

  if (gameState.chaosModifier === 'REVERSED_SHAPES') {
    if (card.shape === Shape.WHOT) return true;
    return card.number === gameState.currentNumber;
  }

  if (gameState.pendingPicks > 0) {
    if (card.number === 2 && gameState.currentNumber === 2) return true;
    if (card.number === 5 && gameState.currentNumber === 5) return true;
    return false;
  }

  if (card.shape === Shape.WHOT) return true;
  if (card.shape === gameState.currentShape) return true;
  if (card.number === gameState.currentNumber) return true;

  return false;
}

function getExplanation(card) {
  if (!card) return "Waiting for move...";
  switch (card.number) {
    case 1: return "HOLD ON: Everyone waits, you play again!";
    case 2: return "PICK TWO: Next player draws 2 unless they have a 2!";
    case 5: return "PICK THREE: Heavy market! Next player draws 3.";
    case 8: return "SUSPENSION: Next player skipped! Comot for road.";
    case 14: return "GENERAL MARKET: Everyone else carries a basket (draw 1).";
    case 20: return "WHOT: Wild card played! Shape is being changed.";
    default: return `Matched ${card.shape} ${card.number}. Normal move.`;
  }
}

function applyRules(card, gameState) {
  const updates = {
    currentNumber: card.number,
    currentShape: card.shape,
    explanation: getExplanation(card)
  };

  switch (card.number) {
    case 1:
      updates.currentPlayerIndex = gameState.currentPlayerIndex;
      break;
    case 2:
      updates.pendingPicks = (gameState.pendingPicks || 0) + 2;
      updates.currentPlayerIndex = getNextPlayerIndex(gameState, 1);
      break;
    case 5:
      updates.pendingPicks = (gameState.pendingPicks || 0) + 3;
      updates.currentPlayerIndex = getNextPlayerIndex(gameState, 1);
      break;
    case 8:
      updates.currentPlayerIndex = getNextPlayerIndex(gameState, 2);
      break;
    case 14:
      updates.currentPlayerIndex = getNextPlayerIndex(gameState, 1);
      break;
    case 20:
      // WHOT: don't advance player yet, shape selection will happen
      updates.currentPlayerIndex = gameState.currentPlayerIndex;
      break;
    default:
      updates.currentPlayerIndex = getNextPlayerIndex(gameState, 1);
      break;
  }

  if (gameState.gameMode === GameMode.CHAOS && card.number === 8) {
    updates.turnDirection = (gameState.turnDirection * -1);
  }

  return updates;
}

function getNextPlayerIndex(state, skipCount = 1) {
  const total = state.players.length;
  if (total === 0) return 0;
  let next = (state.currentPlayerIndex + (state.turnDirection * skipCount)) % total;
  while (next < 0) next += total;
  return next % total;
}

// Placeholder functions (to be implemented with game logic)
function initializeGameState(room) {
  const deck = createDeck();
  const players = Array.from(room.players.values()).map(p => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    isAI: false, // Multiplayer players are never AI
    hand: [],
    score: 0,
    xp: 0,
    level: 1,
    title: 'Learner',
    isReady: true // Players are ready when game starts
  }));

  // Deal 6 cards to each player
  players.forEach(player => {
    player.hand = deck.splice(0, 6);
  });

  const initialDiscard = deck.pop();

  return {
    roomId: room.code,
    status: GameStatus.PLAYING,
    players: players,
    currentPlayerIndex: 0,
    drawPile: deck,
    discardPile: [initialDiscard],
    currentShape: initialDiscard.shape,
    currentNumber: initialDiscard.number,
    pendingPicks: 0,
    turnDirection: 1,
    logs: ['Game started! No dulling.'],
    chatHistory: [],
    lastCardDeclared: [],
    winnerId: null,
    speedMode: room.config.speedMode || SpeedMode.NORMAL,
    gameMode: room.config.gameMode || GameMode.CLASSIC,
    skin: room.config.skin || 'ANKARA',
    hostId: room.hostId,
    commentary: 'Oya, game don start!',
    chaosModifier: undefined,
    dataSaver: false, // Default to false for multiplayer
    lastActionTrigger: undefined,
    turnTimeLeft: TURN_DURATIONS[room.config.speedMode] || TURN_DURATIONS.NORMAL,
    undoBuffer: null,
    slangIntensity: 'NORMAL',
    commentaryEnabled: true,
    explanation: `Matched ${initialDiscard.shape}`,
    reputationLevel: 100,
    isDarkMode: false,
    isPaused: false
  };
}

function processCardPlay(room, socketId, cardId) {
  const gameState = room.gameState;
  if (!gameState || gameState.status !== GameStatus.PLAYING) {
    return { valid: false, error: 'Game not in playing state' };
  }

  // Reject actions while shape selection is pending
  if (room.awaitingShapeSelection) {
    return { valid: false, error: 'Shape selection pending' };
  }

  // Find the player
  const playerIndex = gameState.players.findIndex(p => {
    const roomPlayer = room.players.get(socketId);
    return roomPlayer && p.id === roomPlayer.id;
  });

  if (playerIndex === -1) {
    return { valid: false, error: 'Player not found' };
  }

  if (playerIndex !== gameState.currentPlayerIndex) {
    return { valid: false, error: 'Not your turn' };
  }

  const player = gameState.players[playerIndex];
  const cardIndex = player.hand.findIndex(c => c.id === cardId);

  if (cardIndex === -1) {
    return { valid: false, error: 'Card not in hand' };
  }

  const card = player.hand[cardIndex];

  if (!isValidMove(card, gameState)) {
    return { valid: false, error: 'Invalid move' };
  }

  // Play the card
  player.hand.splice(cardIndex, 1);
  gameState.discardPile.push(card);

  // Apply card rules
  const updates = applyRules(card, gameState);
  Object.assign(gameState, updates);

  // Handle special cards
  if (card.number === 14) {
    // General market - everyone else draws 1
    gameState.players.forEach((p, i) => {
      if (i !== playerIndex) {
        // Reshuffle if draw pile is empty (same logic as processDrawCard)
        if (gameState.drawPile.length === 0) {
          if (gameState.discardPile.length <= 1) return; // Can't draw if only one card left
          const top = gameState.discardPile.pop();
          gameState.drawPile = gameState.discardPile.sort(() => Math.random() - 0.5);
          gameState.discardPile = [top];
        }
        const draw = gameState.drawPile.pop();
        if (draw) p.hand.push(draw);
      }
    });
  }

  // Handle WHOT shape selection
  if (card.number === 20) {
    room.awaitingShapeSelection = player.id;
  }

  // Check for winner
  if (player.hand.length === 0) {
    gameState.status = GameStatus.FINISHED;
    gameState.winnerId = player.id;
    room.status = 'finished'; // Set room status to finished
    room.stopTurnTimer(); // Stop timer when game ends
  }

  return { valid: true };
}

function processDrawCard(room, socketId) {
  const gameState = room.gameState;
  if (!gameState || gameState.status !== GameStatus.PLAYING) {
    return { valid: false, error: 'Game not in playing state' };
  }

  // Reject actions while shape selection is pending
  if (room.awaitingShapeSelection) {
    return { valid: false, error: 'Shape selection pending' };
  }

  // Find the player
  const playerIndex = gameState.players.findIndex(p => {
    const roomPlayer = room.players.get(socketId);
    return roomPlayer && p.id === roomPlayer.id;
  });

  if (playerIndex === -1) {
    return { valid: false, error: 'Player not found' };
  }

  if (playerIndex !== gameState.currentPlayerIndex) {
    return { valid: false, error: 'Not your turn' };
  }

  const player = gameState.players[playerIndex];
  const count = Math.max(1, gameState.pendingPicks);

  for (let i = 0; i < count; i++) {
    if (gameState.drawPile.length === 0) {
      if (gameState.discardPile.length <= 1) break;
      const top = gameState.discardPile.pop();
      gameState.drawPile = gameState.discardPile.sort(() => Math.random() - 0.5);
      gameState.discardPile = [top];
    }
    const c = gameState.drawPile.pop();
    if (c) player.hand.push(c);
  }

  gameState.pendingPicks = 0;
  gameState.currentPlayerIndex = getNextPlayerIndex(gameState);

  return { valid: true };
}

function processShapeSelection(room, socketId, shape) {
  const gameState = room.gameState;
  if (!gameState || gameState.status !== GameStatus.PLAYING) {
    return { valid: false, error: 'Game not in playing state' };
  }

  const roomPlayer = room.players.get(socketId);
  if (!roomPlayer) {
    return { valid: false, error: 'Player not found' };
  }

  // Check if shape selection is pending for this player
  if (room.awaitingShapeSelection !== roomPlayer.id) {
    return { valid: false, error: 'No shape selection pending' };
  }

  // Find the player
  const playerIndex = gameState.players.findIndex(p => p.id === roomPlayer.id);

  if (playerIndex === -1) {
    return { valid: false, error: 'Player not found' };
  }

  if (playerIndex !== gameState.currentPlayerIndex) {
    return { valid: false, error: 'Not your turn' };
  }

  // Validate shape
  const allowedShapes = ['CIRCLE', 'TRIANGLE', 'CROSS', 'SQUARE', 'STAR'];
  if (!allowedShapes.includes(shape)) {
    return { valid: false, error: 'Invalid shape' };
  }

  // Update shape and advance turn
  gameState.currentShape = shape;
  gameState.currentNumber = 20; // Keep WHOT number
  gameState.currentPlayerIndex = getNextPlayerIndex(gameState);

  // Clear the awaiting flag
  room.awaitingShapeSelection = null;

  return { valid: true };
}

// Get personalized game state for a player (hide other players' hands)
function getPersonalizedGameState(room, playerId) {
  const gameState = room.gameState;
  if (!gameState) return null;

  const personalizedPlayers = gameState.players.map(player => {
    if (player.id === playerId) {
      return player; // Full hand for self
    } else {
      return { ...player, hand: player.hand.length }; // Hand count for others
    }
  });

  return { ...gameState, players: personalizedPlayers };
}

// Tournament functions
function generateTournamentBracket(participants, maxParticipants) {
  const matches = [];
  const numParticipants = participants.length;

  // For single-elimination tournament
  // Round 1: Create matches for current participants
  const round1Matches = Math.floor(numParticipants / 2);

  for (let i = 0; i < round1Matches; i++) {
    const match = {
      id: uuidv4(),
      round: 1,
      players: [participants[i * 2], participants[i * 2 + 1]],
      winner: null,
      status: 'pending',
      gameId: null
    };
    matches.push(match);
  }

  // Add bye for odd number of participants
  if (numParticipants % 2 === 1) {
    const byeMatch = {
      id: uuidv4(),
      round: 1,
      players: [participants[numParticipants - 1], null],
      winner: participants[numParticipants - 1], // Automatic win
      status: 'completed',
      gameId: null
    };
    matches.push(byeMatch);
  }

  return matches;
}

function startTournamentMatch(tournament, matchId) {
  const match = tournament.matches.find(m => m.id === matchId);
  if (!match || match.status !== 'pending') return null;

  // Create a game room for this match
  const roomCode = `TOURN-${Math.floor(1000 + Math.random() * 9000)}`;
  const room = new Room(match.players[0].id, {
    maxPlayers: 2,
    speedMode: 'NORMAL',
    gameMode: 'CLASSIC',
    skin: 'ANKARA'
  });

  // Add both players to the room
  match.players.forEach(player => {
    if (player) {
      // Find socket for this player and add to room
      for (const [socketId, playerData] of players) {
        if (playerData.id === player.id) {
          room.addPlayer(socketId, player);
          break;
        }
      }
    }
  });

  room.code = roomCode;
  rooms.set(roomCode, room);

  match.status = 'in-progress';
  match.gameId = roomCode;

  return room;
}

function endTournamentMatch(tournament, matchId, winnerId) {
  const match = tournament.matches.find(m => m.id === matchId);
  if (!match) return;

  const winner = match.players.find(p => p && p.id === winnerId);
  match.winner = winner;
  match.status = 'completed';

  // Clean up the game room
  if (match.gameId) {
    const room = rooms.get(match.gameId);
    if (room) {
      room.stopTurnTimer();
      rooms.delete(match.gameId);
    }
  }

  // Check if round is complete and advance to next round
  const currentRound = match.round;
  const roundMatches = tournament.matches.filter(m => m.round === currentRound);
  const completedMatches = roundMatches.filter(m => m.status === 'completed');

  if (completedMatches.length === roundMatches.length) {
    // Round complete, create next round matches
    const winners = completedMatches.map(m => m.winner).filter(w => w);
    advanceTournamentRound(tournament, winners, currentRound + 1);
  }

  // Check if tournament is complete
  if (tournament.matches.every(m => m.status === 'completed')) {
    tournament.status = 'completed';
    tournament.winner = winner;
  }
}

function advanceTournamentRound(tournament, winners, nextRound) {
  if (winners.length <= 1) {
    // Tournament complete
    return;
  }

  const nextRoundMatches = Math.floor(winners.length / 2);

  for (let i = 0; i < nextRoundMatches; i++) {
    const match = {
      id: uuidv4(),
      round: nextRound,
      players: [winners[i * 2], winners[i * 2 + 1]],
      winner: null,
      status: 'pending',
      gameId: null
    };
    tournament.matches.push(match);
  }

  // Handle bye if odd number
  if (winners.length % 2 === 1) {
    const byeMatch = {
      id: uuidv4(),
      round: nextRound,
      players: [winners[winners.length - 1], null],
      winner: winners[winners.length - 1],
      status: 'completed',
      gameId: null
    };
    tournament.matches.push(byeMatch);
  }

  tournament.currentRound = nextRound;
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    rooms: rooms.size,
    players: players.size,
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = process.env.PORT || 3004;

// Cleanup disconnected players every 5 minutes
setInterval(() => {
  let totalCleaned = 0;
  for (const room of rooms.values()) {
    const result = room.cleanupDisconnectedPlayers();
    totalCleaned += result.count;
    
    // Broadcast updated state if players were removed from active game
    if (result.count > 0 && result.hadActiveGame) {
      room.players.forEach((player, socketId) => {
        const personalizedGameState = getPersonalizedGameState(room, player.id);
        io.to(socketId).emit('game-state-update', { gameState: personalizedGameState, awaitingShapeSelection: room.awaitingShapeSelection });
      });
    }
  }
  if (totalCleaned > 0) {
    console.log(`Cleaned up ${totalCleaned} disconnected players from rooms`);
  }
}, 5 * 60 * 1000); // 5 minutes

server.listen(PORT, () => {
  console.log(`Whot Multiplayer Server running on port ${PORT}`);
  console.log(`Frontend should connect to: http://localhost:${PORT}`);
});