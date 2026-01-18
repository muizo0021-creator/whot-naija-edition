
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  GameState, Player, Shape, GameStatus,
  SpeedMode, Difficulty, Card, GameMode, TableSkin, ChatMessage, SlangIntensity, AIPersonality,
  ConnectionStatus, GameModeType, MultiplayerRoom, MultiplayerPlayer,
  TournamentData
} from './types';
import { AVATARS, COMMENTARY_POOL, SLANGS, TURN_DURATIONS, PERSONALITY_COMMENTARY } from './constants';
import { WhotEngine } from './engine/WhotGame';
import Lobby from './components/Lobby';
import GameTable from './components/GameTable';
import WhotAcademy from './components/WhotAcademy';
import AudioManager from './components/AudioManager';
import WaitingRoom from './components/WaitingRoom';
import Tournament from './components/Tournament';
import socketService from './services/SocketService';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectingShape, setSelectingShape] = useState(false);
  const [showAcademy, setShowAcademy] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);
  const gameRef = useRef<GameState | null>(null);

  // Multiplayer state
  const [gameModeType, setGameModeType] = useState<GameModeType>(() => {
    // Restore gameModeType if there's an active multiplayer session
    const hasRoomCode = localStorage.getItem('whot_room_code');
    const hasRoomJoined = localStorage.getItem('whot_room_joined');
    if (hasRoomCode || hasRoomJoined) {
      return GameModeType.MULTIPLAYER;
    }
    // Otherwise restore from storage or default to single-player
    const stored = localStorage.getItem('whot_game_mode_type');
    return stored === GameModeType.MULTIPLAYER ? GameModeType.MULTIPLAYER : GameModeType.SINGLE_PLAYER;
  });
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [currentRoom, setCurrentRoom] = useState<MultiplayerRoom | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [localPlayerId, setLocalPlayerId] = useState<string | null>(null);
  const [gamePaused, setGamePaused] = useState(false);
  const [pauseReason, setPauseReason] = useState<string | null>(null);
  const [reconnectionCountdown, setReconnectionCountdown] = useState<{[playerId: string]: number}>({});

  // Tournament state
  const [currentTournament, setCurrentTournament] = useState<TournamentData | null>(null);

  // Persist gameModeType changes
  useEffect(() => {
    localStorage.setItem('whot_game_mode_type', gameModeType);
  }, [gameModeType]);

  const handleMultiplayerCreate = (config: any) => {
    // Multiplayer path: calls socketService.createRoom, backend initializes with real players only (isAI: false)
    setLocalPlayerId(config.playerData.id);
    // Store player data for reconnection
    localStorage.setItem('whot_player_data', JSON.stringify(config.playerData));
    socketService.createRoom(config);
  };

  const handleMultiplayerJoin = (roomCode: string, playerData: any) => {
    setLocalPlayerId(playerData.id);
    // Store for reconnection
    localStorage.setItem('whot_room_code', roomCode);
    localStorage.setItem('whot_player_data', JSON.stringify(playerData));
    socketService.joinRoom(roomCode, playerData);
  };

  const handleMultiplayerExit = () => {
    // Leave the room properly
    socketService.leaveRoom();
    
    // Clear all room-related data to prevent auto-reconnect
    localStorage.removeItem('whot_room_code');
    localStorage.removeItem('whot_player_data');
    localStorage.removeItem('whot_room_joined');
    localStorage.removeItem('whot_game_mode_type');
    
    // Disconnect socket
    socketService.disconnect();
    
    // Reset state
    setCurrentRoom(null);
    setIsHost(false);
    setLocalPlayerId(null);
    setGameModeType(GameModeType.SINGLE_PLAYER);
    setConnectionStatus(ConnectionStatus.DISCONNECTED);
    setGameState(null);
    
    // Clear any recovery data
    sessionStorage.removeItem('whot_recovery_v1');
  };

  const handleTournamentCreate = (tournamentConfig: any) => {
    setLocalPlayerId(tournamentConfig.playerData.id);
    localStorage.setItem('whot_player_data', JSON.stringify(tournamentConfig.playerData));
    socketService.createTournament(tournamentConfig);
  };

  const handleTournamentJoin = (tournamentId: string, playerData: any) => {
    setLocalPlayerId(playerData.id);
    localStorage.setItem('whot_tournament_id', tournamentId);
    localStorage.setItem('whot_player_data', JSON.stringify(playerData));
    socketService.joinTournament(tournamentId, playerData);
  };

  const handleTournamentLeave = () => {
    socketService.leaveTournament();
    localStorage.removeItem('whot_tournament_id');
    localStorage.removeItem('whot_player_data');
    setCurrentTournament(null);
    setLocalPlayerId(null);
  };

  useEffect(() => {
    gameRef.current = gameState;
    // Only persist session recovery for single-player sessions
    if (gameState && gameState.status === GameStatus.PLAYING && gameModeType === GameModeType.SINGLE_PLAYER) {
        const recoveryPayload = {
            gameState,
            gameModeType
        };
        sessionStorage.setItem('whot_recovery_v1', JSON.stringify(recoveryPayload));
    }
  }, [gameState, gameModeType]);

  // Sync with device theme
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateTheme = (e: MediaQueryListEvent | MediaQueryList) => {
        if (gameRef.current) {
            setGameState(s => s ? ({ ...s, isDarkMode: e.matches }) : null);
        }
    };
    mediaQuery.addEventListener('change', updateTheme);
    return () => mediaQuery.removeEventListener('change', updateTheme);
  }, []);

  const localPlayerIdRef = useRef<string | null>(null);
  localPlayerIdRef.current = localPlayerId;

  // Socket connection management
  useEffect(() => {
    if (gameModeType === GameModeType.MULTIPLAYER) {
      // Clear any stale single-player recovery data when switching to multiplayer
      sessionStorage.removeItem('whot_recovery_v1');
      socketService.connect();

      // Define callbacks
      const onConnectionStatusChanged = (status: string) => {
        const mappedStatus = status.toUpperCase() as ConnectionStatus;
        setConnectionStatus(mappedStatus);
      };

      const onRoomCreated = (room: MultiplayerRoom) => {
        setCurrentRoom(room);
        setIsHost(true);
        // Store room code for reconnection
        localStorage.setItem('whot_room_code', room.code);
        localStorage.setItem('whot_room_joined', 'true');
        // Clear any stale recovery data after successful multiplayer connection
        sessionStorage.removeItem('whot_recovery_v1');
        // Restore localPlayerId from stored data
        const playerDataStr = localStorage.getItem('whot_player_data');
        if (playerDataStr) {
          try {
            const playerData = JSON.parse(playerDataStr);
            setLocalPlayerId(playerData.id);
          } catch (e) {
            console.error('Failed to parse stored player data:', e);
          }
        }
        console.log('Room created:', room.code);
      };

      const onRoomJoined = (room: MultiplayerRoom) => {
        setCurrentRoom(room);
        // Determine if current user is the host
        const playerDataStr = localStorage.getItem('whot_player_data');
        let isCurrentUserHost = false;
        if (playerDataStr) {
          try {
            const playerData = JSON.parse(playerDataStr);
            isCurrentUserHost = room.hostId === playerData.id;
            setLocalPlayerId(playerData.id);
          } catch (e) {
            console.error('Failed to parse stored player data:', e);
          }
        }
        setIsHost(isCurrentUserHost);
        // Mark as successfully joined
        localStorage.setItem('whot_room_joined', 'true');
        // Clear any stale recovery data after successful multiplayer connection
        sessionStorage.removeItem('whot_recovery_v1');
        console.log('Joined room:', room.code);
      };

      const onPlayerJoined = (room: MultiplayerRoom) => {
        setCurrentRoom(room);
      };

      const onPlayerLeft = (data: { playerId: string; room: MultiplayerRoom }) => {
        setCurrentRoom(data.room);
      };

      const onPlayerReadyUpdate = (room: MultiplayerRoom) => {
        setCurrentRoom(room);
      };

      const onHostChanged = (room: MultiplayerRoom) => {
        setCurrentRoom(room);
        setIsHost(room.hostId === localPlayerIdRef.current);
      };

      const onGameStarted = (data: { room: MultiplayerRoom; gameState: GameState; awaitingShapeSelection: string | null }) => {
        setCurrentRoom(data.room);
        setGameState(data.gameState);
        setSelectingShape(data.awaitingShapeSelection === localPlayerIdRef.current);
      };

      const onGameStateUpdate = (data: { gameState: GameState; awaitingShapeSelection: string | null }) => {
        setGameState(prevState => {
          if (!prevState) return data.gameState;

          // Preserve local-only preferences that shouldn't be overridden by server
          // Note: skin is excluded here as it should be consistent across all players in the room
          const preservedPreferences = {
            dataSaver: prevState.dataSaver,
            slangIntensity: prevState.slangIntensity,
            commentaryEnabled: prevState.commentaryEnabled,
            isDarkMode: prevState.isDarkMode
          };

          // Preserve local chat history if it's more complete than server's
          const chatHistory = data.gameState.chatHistory.length >= prevState.chatHistory.length
            ? data.gameState.chatHistory
            : prevState.chatHistory;

          return { ...data.gameState, chatHistory, ...preservedPreferences };
        });
        setSelectingShape(data.awaitingShapeSelection === localPlayerIdRef.current);
      };

      const onChatMessage = (message: ChatMessage) => {
        setGameState(s => {
          if (!s) return null;
          
          // Check if this message already exists in chatHistory to prevent duplicates
          const messageExists = s.chatHistory.some(msg => msg.id === message.id);
          if (messageExists) {
            return s; // Message already exists, don't add it again
          }
          
          return {
            ...s,
            chatHistory: [...s.chatHistory, message].slice(-50)
          };
        });
      };

      const onRoomUpdated = (room: MultiplayerRoom) => {
        setCurrentRoom(room);
      };

      const onMoveInvalid = (data: { error: string }) => {
        setAppError(data.error);
        setTimeout(() => setAppError(null), 5000);
      };

      const onError = (error: { type: string; message: string }) => {
        // Handle reconnection failures by clearing stored room data
        const reconnectErrors = ['ROOM_NOT_FOUND', 'NOT_IN_ROOM', 'ROOM_NOT_JOINABLE', 'RECONNECT_FAILED'];
        if (reconnectErrors.includes(error.type)) {
          // Clear stored room data to prevent endless reconnect loops
          localStorage.removeItem('whot_room_code');
          localStorage.removeItem('whot_player_data');
          localStorage.removeItem('whot_room_joined');
          localStorage.removeItem('whot_game_mode_type');
          
          // Reset state
          setCurrentRoom(null);
          setGameState(null);
          setLocalPlayerId(null);
          setGameModeType(GameModeType.SINGLE_PLAYER);
          
          // Disconnect socket
          socketService.disconnect();
        }
        
        setAppError(error.message);
        setTimeout(() => setAppError(null), 5000);
      };

      // Set up event listeners
      socketService.on('connection-status-changed', onConnectionStatusChanged);
      socketService.on('room-created', onRoomCreated);
      socketService.on('room-joined', onRoomJoined);
      socketService.on('player-joined', onPlayerJoined);
      socketService.on('player-left', onPlayerLeft);
      socketService.on('player-ready-update', onPlayerReadyUpdate);
      socketService.on('host-changed', onHostChanged);
      socketService.on('game-started', onGameStarted);
      socketService.on('game-state-update', onGameStateUpdate);
      socketService.on('room-updated', onRoomUpdated);
      socketService.on('move-invalid', onMoveInvalid);
      socketService.on('chat-message', onChatMessage);
      socketService.on('error', onError);
      socketService.on('game-paused', (data) => {
        setGamePaused(true);
        setPauseReason(data.reason);
      });
      socketService.on('game-resumed', () => {
        setGamePaused(false);
        setPauseReason(null);
        setReconnectionCountdown({});
      });
      socketService.on('reconnection-countdown', (data) => {
        setReconnectionCountdown(prev => ({ ...prev, [data.playerId]: data.countdown }));
      });
      socketService.on('player-became-spectator', (data) => {
        // Handle player becoming spectator
        console.log(`Player ${data.playerId} became spectator`);
      });
      socketService.on('tournament-created', (tournament) => {
        setCurrentTournament(tournament);
        setGameModeType(GameModeType.MULTIPLAYER);
      });
      socketService.on('tournament-joined', (tournament) => {
        setCurrentTournament(tournament);
        setGameModeType(GameModeType.MULTIPLAYER);
      });
      socketService.on('tournament-updated', (tournament) => {
        setCurrentTournament(tournament);
      });
      socketService.on('tournament-match-started', (data) => {
        // Handle tournament match starting - could navigate to game
        console.log('Tournament match started:', data);
      });
      socketService.on('tournament-match-ended', (data) => {
        setCurrentTournament(data.tournament);
      });
      socketService.on('tournament-completed', (data) => {
        setCurrentTournament(data.tournament);
      });

      return () => {
        socketService.off('connection-status-changed', onConnectionStatusChanged);
        socketService.off('room-created', onRoomCreated);
        socketService.off('room-joined', onRoomJoined);
        socketService.off('player-joined', onPlayerJoined);
        socketService.off('player-left', onPlayerLeft);
        socketService.off('player-ready-update', onPlayerReadyUpdate);
        socketService.off('host-changed', onHostChanged);
        socketService.off('game-started', onGameStarted);
        socketService.off('game-state-update', onGameStateUpdate);
        socketService.off('room-updated', onRoomUpdated);
        socketService.off('move-invalid', onMoveInvalid);
        socketService.off('chat-message', onChatMessage);
        socketService.off('error', onError);
        socketService.off('game-paused');
        socketService.off('game-resumed');
        socketService.off('reconnection-countdown');
        socketService.off('player-became-spectator');
        socketService.disconnect();
      };
    } else {
      socketService.disconnect();
      setConnectionStatus(ConnectionStatus.DISCONNECTED);
      setCurrentRoom(null);
      setIsHost(false);
      setLocalPlayerId(null);
      // Clear stored room data
      localStorage.removeItem('whot_room_code');
      localStorage.removeItem('whot_player_data');
      localStorage.removeItem('whot_room_joined');
    }
  }, [gameModeType]);

  // Room Recovery Logic
  useEffect(() => {
    const saved = sessionStorage.getItem('whot_recovery_v1');
    if (saved && gameModeType === GameModeType.SINGLE_PLAYER) {
        try {
            const parsed = JSON.parse(saved);
            // Only restore if the saved session was also single-player
            if (parsed.gameModeType === GameModeType.SINGLE_PLAYER && parsed.gameState.status === GameStatus.PLAYING) {
                setGameState(parsed.gameState);
                console.log("Analytics: Room recovered successfully.");
            }
        } catch (e) {
            sessionStorage.removeItem('whot_recovery_v1');
        }
    }
  }, [gameModeType]);

  const updateXP = (amount: number) => {
      try {
        const currentXP = Number(localStorage.getItem('whot_xp')) || 0;
        const newXP = Math.max(0, currentXP + amount);
        localStorage.setItem('whot_xp', newXP.toString());
      } catch (e) {
        console.error("XP Storage error", e);
      }
  };

  const generateCommentary = useCallback((type: string, personality?: AIPersonality) => {
      if (gameRef.current?.slangIntensity === SlangIntensity.OFF || !gameRef.current?.commentaryEnabled) return '';
      
      const pool = COMMENTARY_POOL[type] || ["Oya, your turn!"];
      let commentary = pool[Math.floor(Math.random() * pool.length)];

      if (personality && Math.random() < 0.4) {
        const pPool = PERSONALITY_COMMENTARY[personality]?.[type === 'PLAY_2' || type === 'PLAY_5' ? 'ATTACK' : 'WIN'] || [];
        if (pPool.length > 0) commentary = pPool[Math.floor(Math.random() * pPool.length)];
      }

      return commentary;
  }, []);

  const addChatMessage = useCallback((text: string, senderId: string, senderName: string) => {
      setGameState(s => {
          if (!s) return null;
          const newMsg: ChatMessage = {
              id: `msg-${Date.now()}-${Math.random()}`,
              senderId,
              senderName,
              text,
              timestamp: Date.now()
          };
          return { ...s, chatHistory: [...s.chatHistory, newMsg].slice(-50) };
      });
  }, []);

  const initGame = (config: any) => {
    // Single-player path: creates AI players if in single-player mode
    try {
        // Rage-quit detection
        const lastStatus = sessionStorage.getItem('whot_last_status');
        if (lastStatus === 'PLAYING') {
            const rageCount = Number(localStorage.getItem('whot_rage_quit')) || 0;
            localStorage.setItem('whot_rage_quit', (rageCount + 1).toString());
            console.log("Analytics: Soft rage-quit detected.");
        }
        sessionStorage.setItem('whot_last_status', 'PLAYING');

        const deck = WhotEngine.createDeck();
        const myPlayer: Player = {
          id: 'player-1',
          name: config.nickname || 'Sharp Guy',
          avatar: config.avatar || AVATARS[0],
          isAI: false,
          hand: [],
          isReady: true,
          score: 0,
          xp: Number(localStorage.getItem('whot_xp')) || 0,
          level: config.level || 1,
          title: config.title || 'Learner'
        };

        let aiPlayers: Player[] = [];
        if (gameModeType === GameModeType.SINGLE_PLAYER) {
          // Defensive guard: only create AI players for single-player mode
          aiPlayers = [
            { id: 'ai-1', name: 'Lagos Boss', avatar: AVATARS[1], isAI: true, difficulty: Difficulty.LAGOS_BOSS, personality: AIPersonality.AGGRESSIVE, hand: [], isReady: true, score: 0, xp: 5000, level: 10, title: 'Lagos Boss' },
            { id: 'ai-2', name: 'Street Smart', avatar: AVATARS[2], isAI: true, difficulty: Difficulty.STREET_SMART, personality: AIPersonality.DEFENSIVE, hand: [], isReady: true, score: 0, xp: 2000, level: 5, title: 'Street Smart' },
            { id: 'ai-3', name: 'Smallie', avatar: AVATARS[3], isAI: true, difficulty: Difficulty.BEGINNER, personality: AIPersonality.TRICKSTER, hand: [], isReady: true, score: 0, xp: 100, level: 1, title: 'Learner' },
          ].slice(0, Math.min(Math.max(1, (config.maxPlayers || 4) - 1), 3));
        }

        const players = [myPlayer, ...aiPlayers];
        players.forEach(p => { p.hand = deck.splice(0, 6); });

        const initialDiscard = deck.pop() || deck[0];
        
        setGameState({
          roomId: config.roomId || `NAIJA-${Math.floor(1000 + Math.random() * 9000)}`,
          status: GameStatus.PLAYING,
          players,
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
          speedMode: config.speed || SpeedMode.NORMAL,
          gameMode: config.mode || GameMode.CLASSIC,
          skin: config.skin || TableSkin.ANKARA,
          hostId: 'player-1',
          commentary: 'Oya, game don start!',
          dataSaver: false,
          lastActionTrigger: undefined,
          turnTimeLeft: TURN_DURATIONS[config.speed as keyof typeof TURN_DURATIONS] || 30,
          undoBuffer: null,
          slangIntensity: SlangIntensity.NORMAL,
          commentaryEnabled: true,
          explanation: "Matched " + initialDiscard.shape,
          reputationLevel: 100,
          isDarkMode: window.matchMedia('(prefers-color-scheme: dark)').matches
        });
        setLocalPlayerId('player-1');
    } catch (e) {
        setAppError("Failed to initialize game. Please refresh.");
    }
  };

  const playCard = useCallback((cardId: string, isUndoMove: boolean = false) => {
    if (gameModeType === GameModeType.MULTIPLAYER) {
      // In multiplayer, emit to server
      socketService.playCard(cardId);
      return;
    }

    // Single-player logic (existing code)
    setGameState(s => {
        if (!s) return null;
        const state = { ...s };
        if (!isUndoMove) state.undoBuffer = JSON.parse(JSON.stringify(s));

        const player = state.players[state.currentPlayerIndex];
        const cardIndex = player.hand.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return s;

        const card = player.hand[cardIndex];
        if (!WhotEngine.isValidMove(card, state)) return s;

        player.hand.splice(cardIndex, 1);
        state.discardPile.push(card);
        state.lastActionTrigger = card.number === 20 ? 'WHOT_PLAY' : 'PLAY_CARD';

        if (player.id === 'player-1') updateXP(WhotEngine.getXPForAction('PLAY', state));

        state.commentary = generateCommentary(
            card.number === 20 ? 'WHOT' :
            card.number === 2 ? 'PLAY_2' :
            card.number === 5 ? 'PLAY_5' :
            card.number === 14 ? 'GENERAL_MARKET' :
            card.number === 1 ? 'HOLD_ON' : 'PLAY',
            player.personality
        );

        const updates = WhotEngine.applyRules(card, state);
        Object.assign(state, updates);

        if (card.number === 20) {
            setSelectingShape(true);
            state.currentNumber = 20;
            state.currentShape = Shape.WHOT;
        }

        if (card.number === 14) {
            state.players.forEach((p, i) => {
                if (i !== state.currentPlayerIndex) {
                    const draw = state.drawPile.pop();
                    if (draw) p.hand.push(draw);
                }
            });
        }

        if (player.hand.length === 0) {
            state.status = GameStatus.FINISHED;
            state.winnerId = player.id;
            state.commentary = generateCommentary('VICTORY', player.personality);
            sessionStorage.setItem('whot_last_status', 'FINISHED');
            if (player.id === 'player-1') updateXP(500);
        }

        state.turnTimeLeft = TURN_DURATIONS[state.speedMode] || 30;
        return state;
    });
    
    setTimeout(() => {
        setGameState(s => s ? ({ ...s, lastActionTrigger: undefined }) : null);
    }, 150);
  }, [generateCommentary, gameModeType]);

  const drawCard = useCallback(() => {
    if (gameModeType === GameModeType.MULTIPLAYER) {
      // In multiplayer, emit to server
      socketService.drawCard();
      return;
    }

    // Single-player logic (existing code)
    setGameState(s => {
        if (!s) return null;
        const state = { ...s };
        state.undoBuffer = JSON.parse(JSON.stringify(s));

        const player = state.players[state.currentPlayerIndex];
        const count = Math.max(1, state.pendingPicks);

        for (let i = 0; i < count; i++) {
            if (state.drawPile.length === 0) {
                if (state.discardPile.length <= 1) break;
                const top = state.discardPile.pop()!;
                state.drawPile = state.discardPile.sort(() => Math.random() - 0.5);
                state.discardPile = [top];
            }
            const c = state.drawPile.pop();
            if (c) player.hand.push(c);
        }

        state.commentary = generateCommentary('DRAW', player.personality);
        state.pendingPicks = 0;
        state.lastActionTrigger = 'DRAW_CARD';
        state.currentPlayerIndex = WhotEngine.getNextPlayerIndex(state);
        state.turnTimeLeft = TURN_DURATIONS[state.speedMode] || 30;
        return state;
    });

    setTimeout(() => {
        setGameState(s => s ? ({ ...s, lastActionTrigger: undefined }) : null);
    }, 150);
  }, [generateCommentary, gameModeType]);

  // Global Turn Logic
  useEffect(() => {
    if (gameState?.status !== GameStatus.PLAYING || selectingShape || gameModeType !== GameModeType.SINGLE_PLAYER) return;
    
    const interval = window.setInterval(() => {
        setGameState(s => {
            if (!s || s.status !== GameStatus.PLAYING) return s;
            if (s.turnTimeLeft <= 1) {
                const state = { ...s };
                const player = state.players[state.currentPlayerIndex];
                const draw = state.drawPile.pop() || state.drawPile[0];
                if (draw) player.hand.push(draw);
                state.currentPlayerIndex = WhotEngine.getNextPlayerIndex(state);
                state.turnTimeLeft = TURN_DURATIONS[state.speedMode] || 30;
                state.commentary = `${player.name} slow o! Lagos no de wait.`;
                return state;
            }
            return { ...s, turnTimeLeft: s.turnTimeLeft - 1 };
        });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [gameState?.status, selectingShape]);

  // AI Logic
  useEffect(() => {
    if (!gameState || gameState.status !== GameStatus.PLAYING || selectingShape || gameModeType !== GameModeType.SINGLE_PLAYER) return;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer && currentPlayer.isAI) {
        // Quick AI response delay
        const delay = 500;  // Quick AI response (0.5s after player move)
        const timer = window.setTimeout(() => {
            const moveId = WhotEngine.getAIAction(currentPlayer, gameRef.current!);
            if (moveId) {
                playCard(moveId);
                if (currentPlayer.hand.length === 1 && !gameRef.current?.lastCardDeclared.includes(currentPlayer.id)) {
                    setGameState(s => s ? ({ ...s, lastCardDeclared: [...s.lastCardDeclared, currentPlayer.id], commentary: `${currentPlayer.name}: Check o! Last Card!` }) : null);
                }
            } else {
                drawCard();
            }
        }, delay);
        return () => window.clearTimeout(timer);
    }
  }, [gameState?.currentPlayerIndex, gameState?.status, playCard, drawCard, selectingShape]);

  const handleSelectShape = useCallback((shape: Shape) => {
    if (gameModeType === GameModeType.MULTIPLAYER) {
      // In multiplayer, emit to server
      socketService.selectShape(shape);
      return;
    }

    // Single-player logic (existing code)
    setGameState(s => {
        if (!s) return null;
        const state = { ...s };
        state.currentShape = shape;
        state.currentNumber = 20; // keep at 20 for WHOT
        state.commentary = `Oya, shape na ${shape} now!`;
        state.currentPlayerIndex = WhotEngine.getNextPlayerIndex(state);
        state.turnTimeLeft = TURN_DURATIONS[state.speedMode] || 30;
        return state;
    });
    setSelectingShape(false);
  }, [gameModeType]);

  // AI Shape Selection
  useEffect(() => {
    if (!gameState || gameState.status !== GameStatus.PLAYING || !selectingShape || gameModeType !== GameModeType.SINGLE_PLAYER) return;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer && currentPlayer.isAI) {
        // Auto-pick shape for AI
        const hand = currentPlayer.hand;
        const nonWhotCards = hand.filter(c => c.shape !== Shape.WHOT);
        let chosenShape: Shape;
        if (nonWhotCards.length > 0) {
            const shapeCounts = nonWhotCards.reduce((acc, c) => {
                acc[c.shape] = (acc[c.shape] || 0) + 1;
                return acc;
            }, {} as Record<Shape, number>);
            chosenShape = (Object.entries(shapeCounts) as [Shape, number][]).sort((a, b) => b[1] - a[1])[0][0];
        } else {
            chosenShape = Shape.CIRCLE; // default if all WHOT
        }
        // Delay to simulate thinking
        const delay = gameState.speedMode === SpeedMode.MADNESS ? 200 : gameState.speedMode === SpeedMode.FAST ? 500 : 1200;
        const timer = window.setTimeout(() => {
            handleSelectShape(chosenShape);
        }, delay);
        return () => window.clearTimeout(timer);
    }
  }, [gameState?.currentPlayerIndex, gameState?.status, selectingShape, handleSelectShape]);

  if (appError) {
      return (
          <div className="h-screen w-screen flex flex-col items-center justify-center bg-black text-white p-8">
              <h1 className="text-4xl font-black mb-4">WAHALA DEY!</h1>
              <p className="text-gray-400 mb-8">{appError}</p>
              <button onClick={() => window.location.reload()} className="bg-orange-600 px-8 py-4 rounded-xl font-bold">RESTART GAME</button>
          </div>
      );
  }

  if (showAcademy) return <WhotAcademy onClose={() => setShowAcademy(false)} />;
  if (currentRoom && !gameState) return <WaitingRoom 
    currentRoom={currentRoom} 
    isHost={isHost} 
    localPlayerId={localPlayerId!} 
    onMultiplayerExit={handleMultiplayerExit}
  />;
  if (!gameState) return <Lobby
    onCreateRoom={initGame}
    onJoinRoom={(c) => initGame({ roomId: c })}
    onOpenAcademy={() => setShowAcademy(true)}
    gameModeType={gameModeType}
    onGameModeChange={setGameModeType}
    connectionStatus={connectionStatus}
    onMultiplayerCreate={handleMultiplayerCreate}
    onMultiplayerJoin={handleMultiplayerJoin}
  />;

  return (
    <>
      <AudioManager gameState={gameState} />
      <GameTable 
        gameState={gameState}
        onPlayCard={playCard}
        onDrawCard={drawCard}
        onSelectShape={handleSelectShape}
        onCallLastCard={() => {
            if (gameModeType === GameModeType.MULTIPLAYER) {
                socketService.callLastCard();
            } else {
                const localPlayerIndex = localPlayerId ? gameState.players.findIndex(p => p.id === localPlayerId) : 0;
                setGameState(s => {
                    if (!s || s.players[localPlayerIndex].hand.length !== 1) return s;
                    return { 
                        ...s, 
                        lastCardDeclared: [...s.lastCardDeclared, localPlayerId || 'player-1'],
                        commentary: "LAST CARD! Shine your eye!" 
                    };
                });
                updateXP(30);
            }
        }}
        onSendMessage={(m) => {
          if (gameModeType === GameModeType.MULTIPLAYER) {
            socketService.sendChatMessage(m);
          } else {
            const localPlayerIndex = localPlayerId ? gameState.players.findIndex(p => p.id === localPlayerId) : 0;
            addChatMessage(m, localPlayerId || 'player-1', gameState.players[localPlayerIndex].name);
          }
        }}
        onToggleDataSaver={() => setGameState(s => s ? ({ ...s, dataSaver: !s.dataSaver }) : null)}
        onOpenAcademy={() => setShowAcademy(true)}
        onUndo={() => {
            if (gameState.undoBuffer) {
                setGameState(gameState.undoBuffer as GameState);
                updateXP(-20);
                addChatMessage("I take back that move!", "player-1", "Sharp Guy");
            }
        }}
        onToggleSlang={(intensity) => setGameState(s => s ? ({ ...s, slangIntensity: intensity }) : null)}
        onToggleCommentary={() => setGameState(s => s ? ({ ...s, commentaryEnabled: !s.commentaryEnabled }) : null)}
        onMultiplayerExit={handleMultiplayerExit}
        selectingShape={selectingShape}
        localPlayerId={localPlayerId}
        gamePaused={gamePaused}
        pauseReason={pauseReason}
        reconnectionCountdown={reconnectionCountdown}
      />
    </>
  );
};

export default App;
