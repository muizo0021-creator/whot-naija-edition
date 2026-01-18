
import React, { useState, useEffect, useRef } from 'react';
import { GameState, Shape, GameStatus, TableSkin, SlangIntensity } from '../types';
import CardUI from './CardUI';
import { SLANGS, SHAPE_COLORS, SHAPE_ICONS, SKIN_CONFIGS, RULE_TOOLTIPS, SPORTSMANSHIP_SLANGS } from '../constants';
import { WhotEngine } from '../engine/WhotGame';
import socketService from '../services/SocketService';

// Helper to get hand count regardless of Card[] or number
const getHandCount = (hand: any): number => {
  return Array.isArray(hand) ? hand.length : (typeof hand === 'number' ? hand : 0);
};

interface GameTableProps {
  gameState: GameState;
  onPlayCard: (cardId: string) => void;
  onDrawCard: () => void;
  onSelectShape: (shape: Shape) => void;
  onCallLastCard: () => void;
  onSendMessage: (msg: string) => void;
  onOpenAcademy: () => void;
  onUndo: () => void;
  onToggleSlang: (intensity: SlangIntensity) => void;
  onToggleCommentary: () => void;
  onMultiplayerExit?: () => void;
  selectingShape: boolean;
  localPlayerId?: string;
  gamePaused?: boolean;
  pauseReason?: string | null;
  reconnectionCountdown?: {[playerId: string]: number};
}

const GameTable: React.FC<GameTableProps> = ({ 
  gameState, 
  onPlayCard, 
  onDrawCard, 
  onSelectShape, 
  onCallLastCard,
  onSendMessage,
  onToggleDataSaver,
  onOpenAcademy,
  onUndo,
  onToggleSlang,
  onToggleCommentary,
  onMultiplayerExit,
  selectingShape,
  localPlayerId,
  gamePaused = false,
  pauseReason = null,
  reconnectionCountdown = {}
}) => {
  const localPlayerIndex = localPlayerId ? gameState.players.findIndex(p => p.id === localPlayerId) : 0;
  const me = gameState.players[localPlayerIndex];
  const isSpectator = me?.isSpectator;
  const isMyTurn = gameState.currentPlayerIndex === localPlayerIndex;
  const skin = SKIN_CONFIGS[gameState.skin] || SKIN_CONFIGS[TableSkin.ANKARA];

  const [showCommentary, setShowCommentary] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [reconnectionNotifications, setReconnectionNotifications] = useState<Array<{id: string, message: string, type: 'success' | 'warning' | 'info', timestamp: number}>>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const handRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (gameState.commentary && gameState.commentaryEnabled) {
      setShowCommentary(true);
      const timer = setTimeout(() => setShowCommentary(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [gameState.commentary, gameState.commentaryEnabled]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [gameState.chatHistory, isChatOpen]);

  useEffect(() => {
    if (handRef.current) {
        handRef.current.scrollTo({ left: handRef.current.scrollWidth, behavior: 'smooth' });
    }
  }, [me?.hand?.length]);

  // Handle reconnection notifications
  useEffect(() => {
    if (gameState.isPaused && gameState.pauseReason?.includes("Waiting for")) {
      const playerName = gameState.pauseReason.split("Waiting for ")[1]?.split(" to reconnect")[0];
      if (playerName) {
        const notification = {
          id: `reconnect-${Date.now()}`,
          message: `${playerName} disconnected. Game paused for reconnection.`,
          type: 'warning' as const,
          timestamp: Date.now()
        };
        setReconnectionNotifications(prev => [notification, ...prev.slice(0, 2)]); // Keep max 3 notifications
      }
    } else if (!gameState.isPaused && reconnectionCountdown && Object.keys(reconnectionCountdown).length === 0) {
      // Game resumed - show success notification
      const notification = {
        id: `reconnect-success-${Date.now()}`,
        message: 'Player reconnected successfully! Game resuming...',
        type: 'success' as const,
        timestamp: Date.now()
      };
      setReconnectionNotifications(prev => [notification, ...prev.slice(0, 2)]);
    }
  }, [gameState.isPaused, gameState.pauseReason, reconnectionCountdown]);

  // Auto-cleanup old notifications
  useEffect(() => {
    const interval = setInterval(() => {
      setReconnectionNotifications(prev =>
        prev.filter(notification => Date.now() - notification.timestamp < 10000) // Remove after 10 seconds
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSendCustomChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      onSendMessage(chatInput.trim());
      setChatInput('');
    }
  };

  const timerColor = gameState.turnTimeLeft <= 3 ? 'text-red-500 animate-pulse scale-110' : 'text-orange-500';

  if (!me) {
    // Player not found in game state - likely disconnected or room state issue
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-black text-white p-8">
        <h1 className="text-4xl font-black mb-4">WAHALA DEY!</h1>
        <p className="text-gray-400 mb-8">You appear to have been disconnected from the game.</p>
        <button
          onClick={() => {
            if (onMultiplayerExit) {
              onMultiplayerExit();
            } else {
              window.location.reload();
            }
          }}
          className="bg-orange-600 px-8 py-4 rounded-xl font-bold"
        >
          RETURN TO LOBBY
        </button>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-screen ${skin.bg} ${gameState.isDarkMode ? 'dark' : ''} overflow-hidden flex flex-col transition-all duration-700`}>
      <div className="absolute inset-0 ankara-bg opacity-30 pointer-events-none" />
      
      {/* Dynamic HUD */}
      <div className="p-4 flex justify-between items-center glass z-20 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="text-white font-black text-xl italic tracking-tighter">
            ROOM: <span className="text-orange-500">{gameState.roomId}</span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1 bg-black/40 rounded-full border border-white/10 transition-all duration-300 ${timerColor}`}>
             <span className="text-[10px] font-black uppercase tracking-widest">Time:</span>
             <span className="text-sm font-black italic">{gameState.turnTimeLeft}s</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center gap-1 mr-2 px-2 py-1 bg-black/20 rounded-lg border border-white/5">
                <button 
                  onClick={onToggleCommentary}
                  className={`w-8 h-8 rounded flex items-center justify-center text-[10px] ${gameState.commentaryEnabled ? 'bg-orange-600 text-white' : 'bg-white/10 text-white/40'}`}
                >🎙️</button>
                <button 
                  onClick={() => {
                    const intensities: SlangIntensity[] = [SlangIntensity.OFF, SlangIntensity.NORMAL, SlangIntensity.EXTRA];
                    const next = intensities[(intensities.indexOf(gameState.slangIntensity) + 1) % intensities.length];
                    onToggleSlang(next);
                  }}
                  className="px-2 h-8 rounded bg-white/10 text-[8px] font-black text-white hover:bg-white/20 uppercase"
                >SLANG: {gameState.slangIntensity}</button>
            </div>
            <button onClick={onOpenAcademy} className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white font-black text-sm hover:bg-orange-600">?</button>
            {localPlayerId === gameState.hostId && (
              <button onClick={() => {
                if (gameState.isPaused) {
                  socketService.resumeGame();
                } else {
                  socketService.pauseGame();
                }
              }} className={`w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white font-black text-sm hover:bg-orange-600 ${gameState.isPaused ? 'bg-green-600' : 'bg-white/10'}`}>
                {gameState.isPaused ? '▶️' : '⏸️'}
              </button>
            )}
            <button onClick={() => setIsChatOpen(!isChatOpen)} className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white font-black text-sm hover:bg-orange-600">💬</button>
            <button onClick={() => {
                sessionStorage.removeItem('whot_recovery_v1');
                if (onMultiplayerExit) {
                  onMultiplayerExit();
                } else {
                  window.location.reload();
                }
            }} className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white font-black border-2 border-white/20">×</button>
        </div>
      </div>

      <div className="flex-1 relative flex items-center justify-center">
        {/* Commentary Bubble */}
        <div className={`absolute top-24 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 transform ${showCommentary ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-4 scale-90'}`}>
            <div className="bg-white text-black px-6 py-3 rounded-2xl font-black text-sm shadow-[0_0_30px_rgba(255,255,255,0.3)] border-2 border-orange-500 relative flex items-center gap-3 max-w-xs text-center">
                <span className="text-2xl">🎙️</span>
                <span className="leading-tight">{gameState.commentary}</span>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rotate-45 border-r-2 border-b-2 border-orange-500" />
            </div>
        </div>

        {/* Reconnection Notifications */}
        <div className="absolute top-32 right-4 z-40 space-y-2 max-w-xs">
          {reconnectionNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-3 rounded-lg shadow-lg border transition-all duration-300 animate-slide-in-right ${
                notification.type === 'success'
                  ? 'bg-green-900/90 border-green-500 text-green-100'
                  : notification.type === 'warning'
                  ? 'bg-yellow-900/90 border-yellow-500 text-yellow-100'
                  : 'bg-blue-900/90 border-blue-500 text-blue-100'
              }`}
            >
              <p className="text-sm font-medium">{notification.message}</p>
            </div>
          ))}
        </div>

        {/* Spectator Information Panel */}
        {isSpectator && (
          <div className="absolute top-4 left-4 z-40 max-w-sm">
            <div className="bg-blue-900/90 backdrop-blur-md border border-blue-500 rounded-lg p-4 shadow-xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">👁️</span>
                <h3 className="text-blue-100 font-bold text-sm uppercase tracking-wider">Spectator Mode</h3>
              </div>
              <p className="text-blue-200 text-xs leading-relaxed">
                You are watching the game. The match will continue with the remaining players.
                You can chat and observe, but cannot make moves.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setIsChatOpen(true)}
                  className="px-3 py-1 bg-blue-700 hover:bg-blue-600 text-blue-100 text-xs rounded font-medium transition-colors"
                >
                  💬 Chat
                </button>
                <button
                  onClick={() => {
                    if (onMultiplayerExit) {
                      onMultiplayerExit();
                    } else {
                      window.location.reload();
                    }
                  }}
                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs rounded font-medium transition-colors"
                >
                  Leave Game
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Why Did This Happen? System */}
        {gameState.explanation && (
            <div className="absolute top-44 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md text-white px-4 py-2 rounded-full font-bold text-[10px] border border-white/10 z-40 shadow-xl animate-pulse">
                💡 {gameState.explanation}
            </div>
        )}

        {/* Opponents */}
        <div className="absolute inset-0 pointer-events-none">
            {(() => {
                // Filter out the local player and get opponents
                const opponents = gameState.players.filter(p => p.id !== localPlayerId);

                // Rotate opponents array so positions are relative to local player
                const rotatedOpponents = opponents.map((opponent, idx) => ({
                    ...opponent,
                    originalIndex: gameState.players.findIndex(p => p.id === opponent.id)
                }));

                return rotatedOpponents.map((opponent, idx) => {
                    // Position opponents in a circle: top, left, right
                    const positions = ['top-10 left-1/2 -translate-x-1/2', 'left-4 top-1/2 -translate-y-1/2', 'right-4 top-1/2 -translate-y-1/2'];
                    const posClass = positions[idx % positions.length];
                    const isActive = gameState.currentPlayerIndex === opponent.originalIndex;
                    const isSpectator = opponent.isSpectator;
                    return (
                        <div key={opponent.id} className={`absolute ${posClass} transition-all duration-700 flex flex-col items-center gap-2 pointer-events-auto ${isSpectator ? 'opacity-40' : ''}`}>
                            <div className={`relative p-1 rounded-full border-4 transition-all ${isActive ? `${skin.accent} scale-110 shadow-lg` : 'border-white/5 opacity-60'}`}>
                                <img src={opponent.avatar} className={`w-12 h-12 md:w-16 md:h-16 rounded-full object-cover ${isSpectator ? 'grayscale' : ''}`} alt={opponent.name} />
                                {isSpectator ? (
                                    <div className="absolute -bottom-2 -right-2 bg-gray-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full border border-white/20 shadow-lg">👁️</div>
                                ) : (
                                    <div className={`absolute -bottom-2 -right-2 ${skin.accent.replace('border', 'bg')} text-white text-[10px] font-black px-2 py-0.5 rounded-full border border-white/20 shadow-lg`}>{Array.isArray(opponent.hand) ? opponent.hand.length : opponent.hand}</div>
                                )}
                            </div>
                            <div className="text-center">
                                <div className={`text-[10px] font-black uppercase tracking-tighter drop-shadow-md ${isSpectator ? 'text-gray-400' : 'text-white'}`}>{opponent.name}</div>
                                <div className={`text-[8px] font-bold uppercase tracking-widest ${isSpectator ? 'text-gray-500' : 'text-orange-500'}`}>
                                    {isSpectator ? 'SPECTATOR' : opponent.title}
                                </div>
                            </div>
                        </div>
                    );
                });
            })()}
        </div>

        {/* The Deck */}
        <div className="flex items-center gap-8 md:gap-24 z-10">
          <div className="relative group cursor-pointer" onClick={() => isMyTurn && !selectingShape && !gameState.isPaused && !isSpectator && onDrawCard()}>
            <CardUI card={gameState.drawPile[0] || {id: 'dummy', shape: Shape.WHOT, number: 20}} isBack className={`transform transition-all ${isMyTurn ? 'hover:-translate-y-2 hover:rotate-2 ring-4 ring-orange-500/20' : 'opacity-50 grayscale'}`} />
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-white/40 text-[8px] font-black uppercase tracking-[0.3em] whitespace-nowrap">MARKET ({gameState.drawPile.length})</div>
            {gameState.pendingPicks > 0 && (
                <div className="absolute -top-6 -right-6 bg-red-600 text-white w-10 h-10 rounded-full flex items-center justify-center font-black animate-bounce shadow-2xl border-4 border-white">+{gameState.pendingPicks}</div>
            )}
          </div>
          <div className="relative">
            {gameState.discardPile.length > 0 && <CardUI card={gameState.discardPile[gameState.discardPile.length - 1]} className="rotate-2 shadow-2xl border-4 border-white/10" />}
            {gameState.currentNumber === 20 && (
                <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-black/90 border-2 border-white/20 px-4 py-2 rounded-2xl flex items-center gap-3 shadow-2xl animate-bounce">
                    <span className="text-white text-[10px] font-black italic">WANT:</span>
                    <span className={`text-3xl ${SHAPE_COLORS[gameState.currentShape]} drop-shadow-md`}>{SHAPE_ICONS[gameState.currentShape]}</span>
                </div>
            )}
          </div>
        </div>
      </div>

      <div className={`p-4 md:p-6 glass border-t-2 border-white/10 relative transition-all duration-500 ${isMyTurn ? 'bg-orange-900/10' : 'bg-black/40'}`}>
        {gameState.undoBuffer && isMyTurn && (
          <button onClick={onUndo} className="absolute -top-12 left-6 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl border border-white/10 font-black text-[10px] uppercase tracking-widest shadow-2xl transition-all">↩️ UNDO MOVE</button>
        )}
        <div className="absolute -top-12 right-6"><button onClick={() => !gameState.isPaused && !isSpectator && onCallLastCard()} className={`px-6 py-2 rounded-xl font-black text-xs transition-all shadow-xl border-2 ${gameState.lastCardDeclared.includes(me.id) ? 'bg-green-600 border-white text-white animate-pulse' : 'bg-white text-black border-transparent hover:bg-orange-500 hover:text-white'}`}>CHECK!</button></div>
        <div className="max-w-6xl mx-auto flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`p-1 rounded-full border-2 ${isMyTurn ? 'border-orange-500 animate-pulse' : 'border-white/10'}`}><img src={me.avatar} className="w-10 h-10 rounded-full" alt="Me" /></div>
                    <div>
                        <div className="text-white font-black uppercase text-xs tracking-tighter flex items-center gap-2">{me.name}</div>
                        <div className={`text-[8px] font-black uppercase tracking-widest ${isMyTurn ? 'text-green-400' : 'text-white/30'}`}>{isMyTurn ? '— YOUR MOVE —' : '— OPPONENT TURN —'}</div>
                    </div>
                </div>
                <div className="text-right"><div className="text-white text-[10px] font-black uppercase">Level {me.level}</div><div className="text-orange-500 text-[10px] font-black tracking-widest">{Array.isArray(me.hand) ? me.hand.length : 0} CARDS</div></div>
            </div>
            <div ref={handRef} className="flex gap-2 md:gap-3 overflow-x-auto py-4 px-2 no-scrollbar justify-start md:justify-center min-h-[140px] touch-pan-x">
                {Array.isArray(me.hand) ? me.hand.map((card) => {
                    const isValid = WhotEngine.isValidMove(card, gameState);
                    const isHovered = hoveredCard === card.id;
                    return (
                        <div key={card.id} className="relative flex-shrink-0" onMouseEnter={() => setHoveredCard(card.id)} onMouseLeave={() => setHoveredCard(null)}>
                            <CardUI card={card} disabled={!isMyTurn || selectingShape || !isValid || isSpectator} onClick={() => onPlayCard(card.id)} className={`transition-all duration-300 ${isMyTurn && isValid && !isSpectator ? 'ring-2 ring-orange-500 scale-105 -translate-y-1' : 'opacity-40'}`} />
                            {isHovered && RULE_TOOLTIPS[card.number] && <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-40 bg-black/95 text-white p-2 rounded-lg text-[8px] font-bold z-50 border border-white/20 shadow-2xl pointer-events-none">{RULE_TOOLTIPS[card.number]}</div>}
                        </div>
                    );
                }) : <div className="text-white/50 text-sm">Loading hand...</div>}
            </div>
        </div>
      </div>

      {selectingShape && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[300] flex items-center justify-center p-6">
          <div className="max-w-sm w-full space-y-8 text-center animate-deal">
            <h3 className="text-4xl font-black text-white italic tracking-tighter uppercase">Pick a Shape!</h3>
            <div className="grid grid-cols-2 gap-4">
              {[Shape.CIRCLE, Shape.TRIANGLE, Shape.CROSS, Shape.SQUARE, Shape.STAR].map(s => (
                <button key={s} onClick={() => !gameState.isPaused && onSelectShape(s)} className="group flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-white/5 hover:border-orange-500 hover:bg-orange-500/10 transition-all gap-2 bg-white/5">
                    <span className={`text-4xl ${SHAPE_COLORS[s]} group-hover:scale-110 transition-transform`}>{SHAPE_ICONS[s]}</span>
                    <span className="text-white font-black text-[8px] uppercase tracking-widest opacity-50">{s}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Game Paused Overlay */}
      {gameState.isPaused && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[350] flex items-center justify-center p-6">
          <div className="max-w-md w-full space-y-8 text-center animate-deal">
            <h2 className="text-6xl font-black text-white italic tracking-tighter uppercase">GAME PAUSED</h2>
            <div className="glass p-6 rounded-2xl space-y-4">
              <p className="text-white text-lg font-bold">
                {gameState.pauseReason || "The host has paused the game."}
              </p>
              {gameState.pauseReason && gameState.pauseReason.includes("Waiting for") && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <p className="text-orange-400 text-sm font-medium">Player disconnected - attempting reconnection...</p>
                  </div>

                  {reconnectionCountdown && Object.keys(reconnectionCountdown).length > 0 && (
                    <div className="space-y-3">
                      <div className="text-center">
                        <div className="relative w-32 h-32 mx-auto mb-4">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                            <path
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeDasharray={`${(Math.max(0, (Object.values(reconnectionCountdown)[0] as number) || 0) / 60) * 100}, 100`}
                              className="text-red-500 transition-all duration-1000"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-red-400 text-3xl font-black animate-pulse">
                              {Math.max(0, (Object.values(reconnectionCountdown)[0] as number) || 0)}
                            </span>
                          </div>
                        </div>
                        <p className="text-gray-300 text-xs font-medium">seconds remaining</p>
                      </div>

                      <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                        <p className="text-red-300 text-sm font-medium mb-2">💡 Reconnection Tips:</p>
                        <ul className="text-left text-xs text-gray-300 space-y-1">
                          <li>• Check your internet connection</li>
                          <li>• Refresh the page if needed</li>
                          <li>• Rejoin using the same room code</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  <p className="text-yellow-400 text-sm bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3">
                    <span className="font-medium">⚠️ Important:</span> If reconnection fails, the player will become a spectator and the game will continue.
                  </p>
                </div>
              )}
              {!gameState.pauseReason?.includes("Waiting for") && (
                <div className="space-y-2">
                  <p className="text-orange-400 text-sm">Please wait for the game to resume...</p>
                  <div className="flex justify-center">
                    <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sportsmanship & Victory Screen */}
      {gameState.status === GameStatus.FINISHED && (
          <div className="fixed inset-0 bg-black/95 z-[500] flex flex-col items-center justify-center p-8 text-center space-y-8 animate-deal">
              <h2 className="text-7xl font-black text-white italic tracking-tighter">{gameState.winnerId === me.id ? 'WINNER!' : 'DEFEAT!'}</h2>

              {/* Reaction Bar */}
              <div className="flex gap-2 mb-4">
                  {SPORTSMANSHIP_SLANGS.map(s => (
                      <button key={s} onClick={() => onSendMessage(s)} className="px-4 py-2 bg-white/10 hover:bg-orange-600 text-white text-[10px] font-black rounded-full border border-white/10 transition-all">{s}</button>
                  ))}
              </div>

              <div className="glass p-6 rounded-2xl w-full max-w-xs space-y-4">
                  {gameState.players.slice().sort((a,b) => getHandCount(a.hand) - getHandCount(b.hand)).map((p, i) => (
                      <div key={p.id} className={`flex justify-between p-3 rounded-xl ${p.id === me.id ? 'bg-orange-600' : 'bg-white/5'}`}>
                          <div className="flex items-center gap-2">
                              <span className="text-xs font-black italic">#{i+1}</span>
                              <img src={p.avatar} className="w-8 h-8 rounded-full" alt="" />
                              <span className="text-[10px] font-bold text-white uppercase">{p.name}</span>
                          </div>
                          <span className="text-xs font-black text-white">{getHandCount(p.hand)} cards</span>
                      </div>
                  ))}
              </div>
              <div className="flex gap-4">
                  <button onClick={() => {
                    sessionStorage.removeItem('whot_recovery_v1');
                    if (onMultiplayerExit) {
                      onMultiplayerExit();
                    } else {
                      window.location.reload();
                    }
                  }} className="px-8 py-4 bg-white text-black font-black rounded-xl">LOBBY</button>
                  <button onClick={() => {
                    sessionStorage.removeItem('whot_recovery_v1');
                    if (onMultiplayerExit) {
                      onMultiplayerExit();
                    } else {
                      window.location.reload();
                    }
                  }} className="px-8 py-4 bg-orange-600 text-white font-black rounded-xl">REMATCH</button>
              </div>
          </div>
      )}

      {/* Chat Panel */}
      <div className={`fixed top-0 right-0 h-full w-80 md:w-96 bg-amber-900/95 backdrop-blur-xl border-l-2 border-orange-600 shadow-2xl z-[400] transition-transform duration-500 ${isChatOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Chat Header */}
          <div className="flex items-center justify-between p-4 border-b border-orange-600/30">
            <h3 className="text-white font-black text-lg italic tracking-tighter">CHAT</h3>
            <button onClick={() => setIsChatOpen(false)} className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center text-white font-black">×</button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {gameState.chatHistory.map((msg, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <img src={msg.senderAvatar} className="w-8 h-8 rounded-full border border-orange-600/50" alt={msg.senderName} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-bold text-sm">{msg.senderName}</span>
                    <span className="text-orange-400 text-xs">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="bg-white/10 rounded-lg p-2 text-white text-sm">{msg.message}</div>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Send Buttons */}
          <div className="p-4 border-t border-orange-600/30">
            <div className="grid grid-cols-2 gap-2 mb-4">
              {SLANGS.map((slang, idx) => (
                <button key={idx} onClick={() => onSendMessage(slang)} className="bg-orange-600/20 hover:bg-orange-600 text-white text-xs font-bold rounded-lg py-2 px-3 border border-orange-600/50 transition-all">
                  {slang}
                </button>
              ))}
            </div>

            {/* Custom Message Input */}
            <form onSubmit={handleSendCustomChat} className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 bg-white/10 border border-orange-600/50 rounded-lg px-3 py-2 text-white placeholder-orange-300 text-sm focus:outline-none focus:border-orange-600"
              />
              <button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-4 py-2 rounded-lg transition-all">
                SEND
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Pause Overlay */}
      {gamePaused && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 max-w-md w-full mx-4 text-center">
            <div className="text-6xl mb-4">⏸️</div>
            <h2 className="text-2xl font-black text-white mb-4">GAME PAUSED</h2>
            <p className="text-white/80 mb-6">{pauseReason}</p>
            {Object.entries(reconnectionCountdown).map(([playerId, countdown]) => {
              const player = gameState.players.find(p => p.id === playerId);
              return (
                <div key={playerId} className="text-orange-400 font-bold text-lg">
                  Waiting for {player?.name}: {countdown}s
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default GameTable;
