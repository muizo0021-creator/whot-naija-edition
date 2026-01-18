import React, { useState, useEffect } from 'react';
import { TournamentData, TournamentMatch, Player } from '../types';

interface TournamentProps {
  tournament: TournamentData;
  currentUserId: string;
  onJoinTournament: () => void;
  onLeaveTournament: () => void;
  onStartTournament: () => void;
}

const Tournament: React.FC<TournamentProps> = ({
  tournament,
  currentUserId,
  onJoinTournament,
  onLeaveTournament,
  onStartTournament
}) => {
  const [selectedMatch, setSelectedMatch] = useState<TournamentMatch | null>(null);

  const isParticipant = tournament.participants.some(p => p.id === currentUserId);
  const isHost = tournament.hostId === currentUserId;
  const canStart = isHost && tournament.participants.length >= 4 && tournament.status === 'waiting';

  const getBracketStructure = () => {
    const rounds: TournamentMatch[][] = [];
    const participants = [...tournament.participants];

    // For simplicity, assume 4-8 players, single elimination
    if (participants.length === 4) {
      // Round 1: 2 matches
      rounds.push([
        { id: 'r1m1', round: 1, players: [participants[0], participants[1]], winner: null, status: 'pending' },
        { id: 'r1m2', round: 1, players: [participants[2], participants[3]], winner: null, status: 'pending' }
      ]);
      // Round 2: 1 match
      rounds.push([
        { id: 'r2m1', round: 2, players: [], winner: null, status: 'pending' }
      ]);
    }

    return rounds;
  };

  const bracket = getBracketStructure();

  return (
    <div className="min-h-screen ankara-bg flex items-center justify-center p-4">
      <div className="max-w-6xl w-full glass rounded-3xl p-8 shadow-2xl space-y-8 overflow-hidden relative">

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-black text-white italic tracking-tighter">TOURNAMENT</h1>
          <p className="text-indigo-300 font-medium text-xs tracking-widest uppercase">
            {tournament.name} - {tournament.status}
          </p>
          <p className="text-white/60 text-sm">
            {tournament.participants.length} / {tournament.maxParticipants} players
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-4">
          {!isParticipant && tournament.status === 'waiting' && (
            <button
              onClick={onJoinTournament}
              className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold"
            >
              JOIN TOURNAMENT
            </button>
          )}
          {isParticipant && tournament.status === 'waiting' && (
            <button
              onClick={onLeaveTournament}
              className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold"
            >
              LEAVE TOURNAMENT
            </button>
          )}
          {canStart && (
            <button
              onClick={onStartTournament}
              className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold"
            >
              START TOURNAMENT
            </button>
          )}
        </div>

        {/* Participants */}
        <div className="space-y-4">
          <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">Participants</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {tournament.participants.map((player, index) => (
              <div key={player.id} className="bg-white/10 rounded-xl p-4 text-center">
                <div className="text-white font-bold text-sm">{player.name}</div>
                <div className="text-white/60 text-xs">Seed #{index + 1}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bracket Visualization */}
        {tournament.status !== 'waiting' && (
          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">Tournament Bracket</h2>
            <div className="flex justify-center">
              <div className="space-y-8">
                {bracket.map((round, roundIndex) => (
                  <div key={roundIndex} className="flex gap-8">
                    {round.map((match) => (
                      <div
                        key={match.id}
                        className="bg-white/10 rounded-xl p-4 min-w-48 cursor-pointer hover:bg-white/20 transition-all"
                        onClick={() => setSelectedMatch(match)}
                      >
                        <div className="text-white/60 text-xs mb-2">Round {match.round}</div>
                        <div className="space-y-2">
                          {match.players.map((player, idx) => (
                            <div key={idx} className={`text-sm ${match.winner?.id === player.id ? 'text-green-400 font-bold' : 'text-white'}`}>
                              {player?.name || 'TBD'}
                            </div>
                          ))}
                        </div>
                        {match.winner && (
                          <div className="text-green-400 text-xs mt-2 font-bold">
                            Winner: {match.winner.name}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Champion Display */}
        {tournament.winner && (
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-black text-yellow-400 italic tracking-tighter">🏆 CHAMPION 🏆</h2>
            <div className="bg-gradient-to-r from-yellow-600 to-orange-600 rounded-xl p-6">
              <div className="text-4xl mb-2">{tournament.winner.avatar}</div>
              <div className="text-white font-black text-xl">{tournament.winner.name}</div>
              <div className="text-yellow-200 text-sm">Tournament Champion</div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Tournament;