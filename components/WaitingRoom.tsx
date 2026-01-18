import React from 'react';
import { MultiplayerRoom, MultiplayerPlayer } from '../types';
import { AVATARS } from '../constants';
import socketService from '../services/SocketService';

interface WaitingRoomProps {
  currentRoom: MultiplayerRoom;
  isHost: boolean;
  localPlayerId: string;
  onMultiplayerExit: () => void;
}

const WaitingRoom: React.FC<WaitingRoomProps> = ({ currentRoom, isHost, localPlayerId, onMultiplayerExit, reconnectionCountdown = {} }) => {
  const localPlayer = currentRoom.players.find(p => p.id === localPlayerId);

  const handleToggleReady = () => {
    socketService.setPlayerReady(!localPlayer?.isReady);
  };

  const handleStartGame = () => {
    // Mirror Room.canStartGame() logic: at least 2 players and all players ready
    if (isHost && currentRoom.players.length >= 2 && currentRoom.players.every(p => p.isReady)) {
      socketService.startGame();
    }
  };

  const canStartGame = () => {
    return currentRoom.players.length >= 2 && currentRoom.players.every(p => p.isReady);
  };

  return (
    <div className="min-h-screen ankara-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full glass rounded-3xl p-8 shadow-2xl space-y-8 overflow-hidden relative">
        
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-black text-white italic tracking-tighter">WAITING ROOM</h1>
          <p className="text-indigo-300 font-medium text-xs tracking-widest uppercase">Room Code: {currentRoom.code}</p>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">Players ({currentRoom.players.length}/{currentRoom.config.maxPlayers})</h2>
          
          <div className="space-y-3">
            {currentRoom.players.map((player: MultiplayerPlayer) => (
              <div key={player.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                <div className="flex items-center gap-3">
                  <img src={player.avatar} className="w-10 h-10 rounded-full border-2 border-orange-500" />
                  <div>
                    <div className="text-white font-bold text-sm">{player.name}</div>
                    {player.isHost && <div className="text-orange-400 text-xs font-bold">HOST</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {player.isConnected ? (
                    player.isReady ? (
                      <span className="text-green-400 font-bold text-sm">READY</span>
                    ) : (
                      <span className="text-gray-400 font-bold text-sm">WAITING</span>
                    )
                  ) : (
                    <span className="text-red-400 font-bold text-sm">OFFLINE</span>
                  )}
                  {player.id === localPlayerId && (
                    <span className="text-blue-400 text-xs">(YOU)</span>
                  )}
                  {isHost && !player.isConnected && player.id !== localPlayerId && (
                    <button
                      onClick={() => socketService.replaceDisconnectedPlayer(player.id)}
                      className="ml-2 px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-all"
                    >
                      REPLACE
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {!localPlayer?.isReady ? (
            <button 
              onClick={handleToggleReady}
              className="w-full py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl font-black text-lg shadow-xl"
            >
              I'M READY
            </button>
          ) : (
            <button 
              onClick={handleToggleReady}
              className="w-full py-4 bg-gray-600 hover:bg-gray-500 text-white rounded-xl font-black text-lg shadow-xl"
            >
              NOT READY
            </button>
          )}

          {isHost && (
            <button 
              onClick={handleStartGame}
              disabled={!canStartGame()}
              className={`w-full py-4 rounded-xl font-black text-lg shadow-xl ${
                canStartGame()
                  ? 'bg-orange-600 hover:bg-orange-500 text-white'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              START GAME
            </button>
          )}

          <button 
            onClick={onMultiplayerExit}
            className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-sm shadow-xl"
          >
            LEAVE ROOM
          </button>
        </div>

        <div className="text-center">
          <p className="text-gray-400 text-xs">
            {isHost ? 'Wait for all players to be ready, then start the game.' : 'Click "I\'M READY" when you\'re set to play.'}
          </p>
        </div>

        {/* Reconnection Overlay */}
        {Object.keys(reconnectionCountdown).length > 0 && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 rounded-3xl">
            <div className="max-w-sm w-full mx-4 text-center space-y-6">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                <h3 className="text-xl font-black text-white">RECONNECTION IN PROGRESS</h3>
              </div>

              <div className="space-y-4">
                {Object.entries(reconnectionCountdown).map(([playerId, countdown]) => {
                  const player = currentRoom.players.find(p => p.id === playerId);
                  return (
                    <div key={playerId} className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                      <div className="flex items-center justify-center gap-3 mb-2">
                        <img src={player?.avatar} className="w-8 h-8 rounded-full border border-red-500/50" alt="" />
                        <span className="text-red-200 font-bold text-sm">{player?.name}</span>
                      </div>
                      <div className="relative w-24 h-24 mx-auto mb-2">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                          <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeDasharray={`${((countdown as number) / 60) * 100}, 100`}
                            className="text-red-500 transition-all duration-1000"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-red-400 text-2xl font-black animate-pulse">
                            {countdown as number}
                          </span>
                        </div>
                      </div>
                      <p className="text-red-300 text-xs">seconds remaining</p>
                    </div>
                  );
                })}
              </div>

              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-yellow-300 text-sm font-medium mb-2">💡 Reconnection Tips:</p>
                <ul className="text-left text-xs text-gray-300 space-y-1">
                  <li>• Check your internet connection</li>
                  <li>• Refresh the page if needed</li>
                  <li>• Rejoin using the same room code</li>
                </ul>
              </div>

              <p className="text-gray-400 text-xs">
                If reconnection fails, disconnected players will become spectators.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WaitingRoom;