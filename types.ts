
export enum Shape {
  CIRCLE = 'CIRCLE',
  TRIANGLE = 'TRIANGLE',
  CROSS = 'CROSS',
  SQUARE = 'SQUARE',
  STAR = 'STAR',
  WHOT = 'WHOT'
}

export interface Card {
  id: string;
  shape: Shape;
  number: number;
}

export enum GameStatus {
  LOBBY = 'LOBBY',
  WAITING = 'WAITING',
  PLAYING = 'PLAYING',
  FINISHED = 'FINISHED',
  ACADEMY = 'ACADEMY'
}

export enum Difficulty {
  BEGINNER = 'BEGINNER',
  STREET_SMART = 'STREET_SMART',
  LAGOS_BOSS = 'LAGOS_BOSS'
}

export enum AIPersonality {
  AGGRESSIVE = 'AGGRESSIVE',
  DEFENSIVE = 'DEFENSIVE',
  TRICKSTER = 'TRICKSTER'
}

export enum SpeedMode {
  NORMAL = 'NORMAL',
  FAST = 'FAST',
  MADNESS = 'MADNESS'
}

export enum GameMode {
  CLASSIC = 'CLASSIC',
  CHAOS = 'CHAOS',
  SPEED = 'SPEED',
  KING_OF_TABLE = 'KING_OF_TABLE',
  TOURNAMENT = 'TOURNAMENT'
}

export enum TableSkin {
  CLASSIC = 'CLASSIC',
  ANKARA = 'ANKARA',
  NEON_LAGOS = 'NEON_LAGOS',
  STREET = 'STREET'
}

export enum SlangIntensity {
  OFF = 'OFF',
  NORMAL = 'NORMAL',
  EXTRA = 'EXTRA'
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  isAI: boolean;
  difficulty?: Difficulty;
  personality?: AIPersonality;
  hand: Card[] | number;
  isReady: boolean;
  score: number;
  xp: number;
  level: number;
  title: string;
  isSpectator?: boolean;
}

export interface GameState {
  roomId: string;
  status: GameStatus;
  players: Player[];
  currentPlayerIndex: number;
  drawPile: Card[];
  discardPile: Card[];
  currentShape: Shape;
  currentNumber: number;
  pendingPicks: number;
  turnDirection: 1 | -1;
  logs: string[];
  chatHistory: ChatMessage[];
  lastCardDeclared: string[];
  winnerId: string | null;
  speedMode: SpeedMode;
  gameMode: GameMode;
  skin: TableSkin;
  hostId: string;
  commentary: string;
  chaosModifier?: string;
  dataSaver: boolean;
  lastActionTrigger?: string;
  
  turnTimeLeft: number;
  undoBuffer: Partial<GameState> | null;
  slangIntensity: SlangIntensity;
  commentaryEnabled: boolean;
  explanation: string | null;
  reputationLevel: number;
  isDarkMode: boolean;
}

export interface RoomConfig {
  maxPlayers: number;
  enableChat?: boolean;
  speedMode: SpeedMode;
  gameMode: GameMode;
  skin: TableSkin;
}

// Multiplayer types
export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}

export enum GameModeType {
  SINGLE_PLAYER = 'SINGLE_PLAYER',
  MULTIPLAYER = 'MULTIPLAYER'
}

export interface MultiplayerRoom {
  id: string;
  code: string;
  hostId: string;
  players: MultiplayerPlayer[];
  status: 'waiting' | 'playing' | 'finished';
  config: RoomConfig;
  gameState?: GameState;
  createdAt: number;
}

export interface MultiplayerPlayer {
  id: string;
  name: string;
  avatar: string;
  socketId: string;
  isReady: boolean;
  isHost: boolean;
  joinedAt: number;
  lastSeen?: number;
  isConnected: boolean;
}

export interface TournamentMatch {
  id: string;
  round: number;
  players: (Player | null)[];
  winner: Player | null;
  status: 'pending' | 'in-progress' | 'completed';
  gameId?: string; // Reference to the actual game room
}

export interface TournamentData {
  id: string;
  name: string;
  hostId: string;
  participants: Player[];
  maxParticipants: number;
  status: 'waiting' | 'in-progress' | 'completed';
  format: 'single-elimination' | 'double-elimination';
  currentRound: number;
  matches: TournamentMatch[];
  winner: Player | null;
  createdAt: number;
}

export interface SocketEventData {
  'connection-status-changed': ConnectionStatus;
  'room-created': MultiplayerRoom;
  'room-joined': MultiplayerRoom;
  'player-joined': MultiplayerRoom;
  'player-left': { playerId: string; room: MultiplayerRoom };
  'player-ready-update': MultiplayerRoom;
  'host-changed': MultiplayerRoom;
  'game-started': { room: MultiplayerRoom; gameState: GameState };
  'game-state-update': { gameState: GameState; awaitingShapeSelection: string | null };
  'room-updated': MultiplayerRoom;
  'move-invalid': { error: string };
  'chat-message': ChatMessage;
  'error': { type: string; message: string };
  'tournament-created': TournamentData;
  'tournament-joined': TournamentData;
  'tournament-updated': TournamentData;
  'tournament-match-started': { tournament: TournamentData; match: TournamentMatch };
  'tournament-match-ended': { tournament: TournamentData; match: TournamentMatch; winner: Player };
  'tournament-completed': { tournament: TournamentData; winner: Player };
}
