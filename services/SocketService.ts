import { io, Socket } from 'socket.io-client';
import { GameState, Player, RoomConfig } from '../types';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface RoomData {
  id: string;
  code: string;
  hostId: string;
  players: Array<{
    id: string;
    name: string;
    avatar: string;
    isReady: boolean;
    isHost: boolean;
  }>;
  status: string;
  config: RoomConfig;
  playerCount: number;
  readyCount: number;
}

class SocketService {
  private socket: Socket | null = null;
  private status: ConnectionStatus = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  // Event listeners
  private eventListeners: Map<string, ((...args: any[]) => void)[]> = new Map();

  constructor() {
    // setupEventListeners removed to avoid recursion
  }

  private getSocketEventHandlers() {
    return {
      connect: () => {
        console.log('Connected to server');
        this.status = 'connected';
        this.reconnectAttempts = 0;
        this.emitEvent('connection-status-changed', 'connected');

        // Check for stored room data and attempt reconnection
        const roomCode = localStorage.getItem('whot_room_code');
        const playerDataStr = localStorage.getItem('whot_player_data');
        const roomJoined = localStorage.getItem('whot_room_joined');

        if (roomCode && playerDataStr && roomJoined === 'true') {
          try {
            const playerData = JSON.parse(playerDataStr);
            console.log('Attempting to reconnect to room:', roomCode);
            this.socket!.emit('reconnect-room', { roomCode, playerData });
          } catch (e) {
            console.error('Failed to parse stored player data:', e);
            // Clear invalid data
            localStorage.removeItem('whot_room_code');
            localStorage.removeItem('whot_player_data');
            localStorage.removeItem('whot_room_joined');
          }
        }
      },
      disconnect: (reason) => {
        console.log('Disconnected from server:', reason);
        this.status = 'disconnected';
        this.emitEvent('connection-status-changed', 'disconnected');

        // Attempt reconnection for network-related disconnects, not intentional disconnects
        if (reason === 'io server disconnect' || reason === 'transport close' || reason === 'ping timeout') {
          this.attemptReconnect();
        }
      },
      connect_error: (error) => {
        console.error('Connection error:', error);
        this.status = 'error';
        this.emitEvent('connection-status-changed', 'error');
        this.attemptReconnect();
      },
      'room-created': (data) => this.emitEvent('room-created', data),
      'room-joined': (data) => this.emitEvent('room-joined', data),
      'player-joined': (data) => this.emitEvent('player-joined', data),
      'player-left': (data) => this.emitEvent('player-left', data),
      'player-ready-update': (data) => this.emitEvent('player-ready-update', data),
      'host-changed': (data) => this.emitEvent('host-changed', data),
      'game-started': (data) => this.emitEvent('game-started', data),
      'game-state-update': (data) => this.emitEvent('game-state-update', data),
      'room-updated': (data) => this.emitEvent('room-updated', data),
      'move-invalid': (data) => this.emitEvent('move-invalid', data),
      'chat-message': (data) => this.emitEvent('chat-message', data),
      'tournament-created': (data) => this.emitEvent('tournament-created', data),
      'tournament-joined': (data) => this.emitEvent('tournament-joined', data),
      'tournament-updated': (data) => this.emitEvent('tournament-updated', data),
      'tournament-match-started': (data) => this.emitEvent('tournament-match-started', data),
      'tournament-match-ended': (data) => this.emitEvent('tournament-match-ended', data),
      'tournament-completed': (data) => this.emitEvent('tournament-completed', data),
      error: (data) => this.emitEvent('error', data)
    };
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    this.status = 'connecting';
    this.emitEvent('connection-status-changed', 'connecting');

    setTimeout(() => {
      console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      this.socket?.connect();
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  private emitEvent(event: string, data?: any) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }

  // Public API
  connect(serverUrl?: string) {
    if (this.socket?.connected) return;

    if (!serverUrl && !import.meta.env.VITE_SOCKET_SERVER_URL && import.meta.env.PROD) {
      console.warn('Production socket URL missing! Set VITE_SOCKET_SERVER_URL environment variable.');
    }

    const url = serverUrl || (import.meta.env.VITE_SOCKET_SERVER_URL as string) || 'http://localhost:3004';
    this.status = 'connecting';
    this.emitEvent('connection-status-changed', 'connecting');

    this.socket = io(url, {
      transports: ['websocket', 'polling'],
      timeout: 5000,
      forceNew: true,
      reconnection: false, // Disable Socket.io's auto-reconnection to avoid conflicts with custom logic
    });

    // Attach internal socket event handlers
    const handlers = this.getSocketEventHandlers();
    Object.entries(handlers).forEach(([event, handler]) => {
      this.socket!.on(event, handler);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.status = 'disconnected';
    this.emitEvent('connection-status-changed', 'disconnected');
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  // Room management
  createRoom(config: RoomConfig & { playerData: { id: string; name: string; avatar: string } }) {
    if (this.socket?.connected) {
      this.socket.emit('create-room', config);
    } else {
      console.warn('Cannot create room: socket not connected');
      this.emitEvent('error', { type: 'CONNECTION_NOT_READY', message: 'Please wait for connection to establish' });
    }
  }

  joinRoom(roomCode: string, playerData: { id: string; name: string; avatar: string }) {
    if (this.socket?.connected) {
      this.socket.emit('join-room', { roomCode, playerData });
    } else {
      console.warn('Cannot join room: socket not connected');
      this.emitEvent('error', { type: 'CONNECTION_NOT_READY', message: 'Please wait for connection to establish' });
    }
  }

  setPlayerReady(isReady: boolean) {
    this.socket?.emit('player-ready', isReady);
  }

  startGame() {
    this.socket?.emit('start-game');
  }

  leaveRoom() {
    this.socket?.emit('leave-room');
  }

  // Game actions
  playCard(cardId: string) {
    this.socket?.emit('play-card', cardId);
  }

  drawCard() {
    this.socket?.emit('draw-card');
  }

  selectShape(shape: string) {
    this.socket?.emit('select-shape', shape);
  }

  callLastCard() {
    this.socket?.emit('call-last-card');
  }

  sendChatMessage(message: string) {
    this.socket?.emit('chat-message', message);
  }

  // Event subscription
  on(event: string, callback: (...args: any[]) => void) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback?: (...args: any[]) => void) {
    if (callback) {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    } else {
      this.eventListeners.delete(event);
    }
  }

  // Replace disconnected player
  replaceDisconnectedPlayer(playerId: string) {
    this.socket?.emit('replace-disconnected-player', { playerId });
  }

  // Tournament management
  createTournament(config: any) {
    if (this.socket?.connected) {
      this.socket.emit('create-tournament', config);
    } else {
      console.warn('Cannot create tournament: socket not connected');
      this.emitEvent('error', { type: 'CONNECTION_NOT_READY', message: 'Please wait for connection to establish' });
    }
  }

  joinTournament(tournamentId: string, playerData: any) {
    if (this.socket?.connected) {
      this.socket.emit('join-tournament', { tournamentId, playerData });
    } else {
      console.warn('Cannot join tournament: socket not connected');
      this.emitEvent('error', { type: 'CONNECTION_NOT_READY', message: 'Please wait for connection to establish' });
    }
  }

  leaveTournament() {
    this.socket?.emit('leave-tournament');
  }

  // Game control
  pauseGame() {
    this.socket?.emit('pause-game');
  }

  resumeGame() {
    this.socket?.emit('resume-game');
  }

  // Cleanup
  destroy() {
    this.disconnect();
    this.eventListeners.clear();
  }
}

// Singleton instance
export const socketService = new SocketService();
export default socketService;