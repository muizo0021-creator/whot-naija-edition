
import React, { useState, useEffect } from 'react';
import { SpeedMode, GameMode, TableSkin, Player, GameModeType, ConnectionStatus } from '../types';
import { AVATARS, SKIN_CONFIGS } from '../constants';
import { WhotEngine } from '../engine/WhotGame';
import socketService from '../services/SocketService';

interface LobbyProps {
  onCreateRoom: (config: any) => void;
  onJoinRoom: (code: string) => void;
  onOpenAcademy: () => void;
  gameModeType?: GameModeType;
  onGameModeChange?: (mode: GameModeType) => void;
  connectionStatus?: ConnectionStatus;
  onMultiplayerCreate?: (config: any) => void;
  onMultiplayerJoin?: (code: string, playerData: any) => void;
}

const Lobby: React.FC<LobbyProps> = ({
  onCreateRoom,
  onJoinRoom,
  onOpenAcademy,
  gameModeType = GameModeType.SINGLE_PLAYER,
  onGameModeChange,
  connectionStatus = ConnectionStatus.DISCONNECTED,
  onMultiplayerCreate,
  onMultiplayerJoin
}) => {
  const [view, setView] = useState<'main' | 'create' | 'join' | 'profile'>('main');
  const [roomCode, setRoomCode] = useState('');
  const [nickname, setNickname] = useState(localStorage.getItem('whot_nick') || '');
  const [avatar, setAvatar] = useState(localStorage.getItem('whot_avatar') || AVATARS[0]);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [speed, setSpeed] = useState<SpeedMode>(SpeedMode.NORMAL);
  const [mode, setMode] = useState<GameMode>(GameMode.CLASSIC);
  const [skin, setSkin] = useState<TableSkin>(TableSkin.ANKARA);
  
  // Progression
  const [xp, setXp] = useState(Number(localStorage.getItem('whot_xp')) || 0);
  const level = WhotEngine.getLevel(xp);
  const title = WhotEngine.getTitle(level);

  useEffect(() => {
    localStorage.setItem('whot_nick', nickname);
    localStorage.setItem('whot_avatar', avatar);
  }, [nickname, avatar]);

  const handleCreate = (isQuick = false) => {
    // Critical branching: multiplayer goes to socketService.createRoom, single-player calls initGame
    if (gameModeType === GameModeType.MULTIPLAYER) {
      // Multiplayer room creation
      const config = {
        maxPlayers,
        speedMode: speed,
        gameMode: mode,
        skin,
        playerData: {
          id: `player-${Date.now()}`,
          name: nickname,
          avatar
        }
      };
      onMultiplayerCreate?.(config);
    } else {
      // Single-player game creation (existing logic)
      onCreateRoom({
        nickname, avatar, maxPlayers, speed, mode, skin, isQuick, level, title
      });
    }
  };

  return (
    <div className="min-h-screen ankara-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full glass rounded-3xl p-8 shadow-2xl space-y-8 overflow-hidden relative">
        
        {/* Profile Summary */}
        <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/10 cursor-pointer hover:bg-white/10 transition-all" onClick={() => setView('profile')}>
            <div className="flex items-center gap-3">
                <img src={avatar} className="w-12 h-12 rounded-full border-2 border-orange-500 shadow-lg" />
                <div>
                    <div className="text-white font-black text-sm uppercase tracking-tight">{nickname || "Guest"}</div>
                    <div className="text-[10px] text-orange-400 font-bold uppercase">{title}</div>
                </div>
            </div>
            <div className="text-right">
                <div className="text-white text-xs font-bold">LVL {level}</div>
                <div className="w-16 h-1.5 bg-white/10 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-orange-500" style={{ width: `${(xp % 100)}%` }} />
                </div>
            </div>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-5xl font-black text-white italic tracking-tighter">WHOT<span className="text-orange-500">MASTER</span></h1>
          <p className="text-indigo-300 font-medium text-xs tracking-widest uppercase">Naija Cultural Edition</p>
        </div>

        {view === 'main' && (
          <div className="space-y-4">
            {!nickname && (
               <input 
                 type="text" 
                 placeholder="Enter Nickname" 
                 className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                 value={nickname}
                 onChange={(e) => setNickname(e.target.value)}
               />
            )}

            {/* Game Mode Selector */}
            <div className="space-y-2">
              <div className="text-white/60 text-xs font-bold uppercase tracking-wider">Game Mode</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onGameModeChange?.(GameModeType.SINGLE_PLAYER)}
                  className={`py-2 px-3 rounded-lg font-bold text-sm transition-all ${
                    gameModeType === GameModeType.SINGLE_PLAYER
                      ? 'bg-orange-600 text-white'
                      : 'bg-white/10 text-white/60 hover:bg-white/20'
                  }`}
                >
                  Single Player
                </button>
                <button
                  onClick={() => onGameModeChange?.(GameModeType.MULTIPLAYER)}
                  className={`py-2 px-3 rounded-lg font-bold text-sm transition-all ${
                    gameModeType === GameModeType.MULTIPLAYER
                      ? 'bg-orange-600 text-white'
                      : 'bg-white/10 text-white/60 hover:bg-white/20'
                  }`}
                >
                  Multiplayer
                  {connectionStatus === ConnectionStatus.CONNECTED && (
                    <span className="ml-1 text-green-400">●</span>
                  )}
                  {connectionStatus === ConnectionStatus.CONNECTING && (
                    <span className="ml-1 text-yellow-400">●</span>
                  )}
                  {connectionStatus === ConnectionStatus.ERROR && (
                    <span className="ml-1 text-red-400">●</span>
                  )}
                </button>
              </div>
            </div>

            <button 
              onClick={() => setView('create')}
              className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-black text-lg shadow-xl shadow-orange-900/20 transform active:scale-95 transition-all"
            >
              CREATE PRIVATE ROOM
            </button>
            <button 
              onClick={() => setView('join')}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-lg shadow-xl shadow-indigo-900/20 transform active:scale-95 transition-all"
            >
              JOIN FRIENDS
            </button>
            <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={onOpenAcademy}
                  className="py-3 bg-white/5 border border-white/10 hover:border-white/30 text-white rounded-xl font-bold text-sm transition-all"
                >
                  WHOT ACADEMY
                </button>
                <button 
                  onClick={() => handleCreate(true)}
                  className="py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold text-sm transition-all"
                >
                  QUICK MATCH
                </button>
            </div>
          </div>
        )}

        {view === 'create' && (
          <div className="space-y-5">
            <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">Room Configuration</h2>
            
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
                <div>
                    <label className="text-gray-400 text-[10px] font-bold mb-2 block uppercase tracking-widest">Game Mode</label>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.values(GameMode).filter(m => gameModeType === GameModeType.SINGLE_PLAYER || [GameMode.CLASSIC, GameMode.CHAOS].includes(m)).map(m => (
                        <button key={m} onClick={() => setMode(m)} className={`py-2 rounded-lg text-[10px] font-black border transition-all ${mode === m ? 'bg-orange-600 border-orange-500 text-white' : 'border-white/10 text-gray-500'}`}>
                            {m.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                </div>

                <div>
                    <label className="text-gray-400 text-[10px] font-bold mb-2 block uppercase tracking-widest">Table Skin</label>
                    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                      {Object.keys(SKIN_CONFIGS).map(s => (
                        <button key={s} onClick={() => setSkin(s as TableSkin)} className={`flex-shrink-0 px-4 py-2 rounded-lg text-[10px] font-black border transition-all ${skin === s ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-white/10 text-gray-500'}`}>
                            {s}
                        </button>
                      ))}
                    </div>
                </div>

                <div className={`grid gap-4 ${gameModeType === GameModeType.SINGLE_PLAYER ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    <div>
                        <label className="text-gray-400 text-[10px] font-bold mb-2 block uppercase tracking-widest">Players</label>
                        <select value={maxPlayers} onChange={(e) => setMaxPlayers(Number(e.target.value))} className="w-full bg-white/10 border border-white/10 rounded-lg p-2 text-white font-bold text-xs focus:outline-none">
                            {[2, 3, 4].map(n => <option key={n} value={n} className="bg-slate-900">{n} Players</option>)}
                        </select>
                    </div>
                    {gameModeType === GameModeType.SINGLE_PLAYER && (
                    <div>
                        <label className="text-gray-400 text-[10px] font-bold mb-2 block uppercase tracking-widest">Speed</label>
                        <select value={speed} onChange={(e) => setSpeed(e.target.value as SpeedMode)} className="w-full bg-white/10 border border-white/10 rounded-lg p-2 text-white font-bold text-xs focus:outline-none">
                            {Object.values(SpeedMode).map(s => <option key={s} value={s} className="bg-slate-900">{s}</option>)}
                        </select>
                    </div>
                    )}
                </div>
            </div>

            <button 
              onClick={() => handleCreate()}
              className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-black text-lg shadow-lg"
            >
              LAUNCH ROOM
            </button>
            <button onClick={() => setView('main')} className="w-full text-gray-500 text-xs font-bold uppercase py-2 hover:text-white transition-colors">Go Back</button>
          </div>
        )}

        {view === 'join' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-black text-white italic">Enter Room Code</h2>
            <div className="space-y-2">
              <input 
                type="text" 
                placeholder="NAIJA-XXXX" 
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-5 text-3xl font-black text-center tracking-widest text-orange-500 uppercase focus:outline-none shadow-inner"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              />
            </div>
            <button 
              onClick={() => {
                if (gameModeType === GameModeType.MULTIPLAYER) {
                  const playerData = { id: `player-${Date.now()}`, name: nickname, avatar };
                  onMultiplayerJoin?.(roomCode, playerData);
                } else {
                  onJoinRoom(roomCode);
                }
              }}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-lg"
            >
              JOIN LOBBY
            </button>
            <button onClick={() => setView('main')} className="w-full text-gray-500 text-xs font-bold uppercase">Back</button>
          </div>
        )}

        {view === 'profile' && (
            <div className="space-y-6">
                <div className="flex flex-col items-center gap-4">
                    <img src={avatar} className="w-24 h-24 rounded-full border-4 border-orange-500 shadow-2xl" />
                    <div className="text-center">
                        <h2 className="text-2xl font-black text-white uppercase italic">{nickname || "Sharp Guy"}</h2>
                        <span className="bg-orange-600 px-3 py-1 rounded-full text-[10px] font-black text-white uppercase">{title}</span>
                    </div>
                </div>
                
                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Total Experience</span>
                        <span className="text-white font-black">{xp} XP</span>
                    </div>
                    <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500 transition-all duration-1000" style={{ width: `${(xp % 100)}%` }} />
                    </div>
                    <div className="text-center text-[10px] text-gray-500 font-bold italic">“Lagos road long, but we go reach.”</div>
                </div>

                <div className="space-y-2">
                    <label className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Change Avatar</label>
                    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                        {AVATARS.map((av, i) => (
                            <img 
                                key={i} 
                                src={av} 
                                className={`w-12 h-12 rounded-full cursor-pointer border-2 transition-all ${avatar === av ? 'border-orange-500 scale-110' : 'border-transparent opacity-50'}`}
                                onClick={() => setAvatar(av)}
                            />
                        ))}
                    </div>
                </div>

                <button onClick={() => setView('main')} className="w-full py-4 bg-white/10 text-white rounded-xl font-black uppercase tracking-widest">Done</button>
            </div>
        )}
      </div>
    </div>
  );
};

export default Lobby;
