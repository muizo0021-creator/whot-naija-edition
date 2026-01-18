// Test script for tournament functionality
const { v4: uuidv4 } = require('uuid');

// Mock tournament data
const mockPlayers = [
  { id: 'player1', name: 'Alice', avatar: '🎯' },
  { id: 'player2', name: 'Bob', avatar: '🎲' },
  { id: 'player3', name: 'Charlie', avatar: '🎪' },
  { id: 'player4', name: 'Diana', avatar: '🎨' },
  { id: 'player5', name: 'Eve', avatar: '🎭' }
];

// Tournament functions (copied from server.js for testing)
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

function endTournamentMatch(tournament, matchId, winnerId) {
  const match = tournament.matches.find(m => m.id === matchId);
  if (!match) return;

  const winner = match.players.find(p => p && p.id === winnerId);
  match.winner = winner;
  match.status = 'completed';

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

// Test cases
console.log('=== Tournament Logic Testing ===\n');

// Test 1: Generate bracket with 4 players
console.log('Test 1: Generate bracket with 4 players');
const bracket4 = generateTournamentBracket(mockPlayers.slice(0, 4), 8);
console.log(`Generated ${bracket4.length} matches for round 1`);
bracket4.forEach((match, i) => {
  console.log(`  Match ${i+1}: ${match.players[0]?.name || 'BYE'} vs ${match.players[1]?.name || 'BYE'} (${match.status})`);
});

// Test 2: Generate bracket with 5 players (odd number)
console.log('\nTest 2: Generate bracket with 5 players (odd number)');
const bracket5 = generateTournamentBracket(mockPlayers.slice(0, 5), 8);
console.log(`Generated ${bracket5.length} matches for round 1`);
bracket5.forEach((match, i) => {
  console.log(`  Match ${i+1}: ${match.players[0]?.name || 'BYE'} vs ${match.players[1]?.name || 'BYE'} (${match.status})`);
});

// Test 3: Simulate tournament progression
console.log('\nTest 3: Simulate tournament progression with 4 players');
const tournament = {
  id: 'test-tournament',
  name: 'Test Tournament',
  participants: mockPlayers.slice(0, 4),
  matches: bracket4,
  currentRound: 1,
  status: 'in-progress'
};

// Round 1: Complete matches
console.log('Round 1 matches:');
tournament.matches.forEach((match, i) => {
  if (match.status === 'pending') {
    const winner = match.players[0]; // Player 1 wins each match
    endTournamentMatch(tournament, match.id, winner.id);
    console.log(`  Match ${i+1}: ${match.players[0].name} defeats ${match.players[1].name}`);
  }
});

// Check round 2 creation
const round2Matches = tournament.matches.filter(m => m.round === 2);
console.log(`\nRound 2 created with ${round2Matches.length} matches:`);
round2Matches.forEach((match, i) => {
  console.log(`  Match ${i+1}: ${match.players[0]?.name || 'BYE'} vs ${match.players[1]?.name || 'BYE'}`);
});

// Complete round 2
console.log('\nCompleting Round 2:');
round2Matches.forEach((match, i) => {
  const winner = match.players[0];
  endTournamentMatch(tournament, match.id, winner.id);
  console.log(`  Match ${i+1}: ${match.players[0].name} defeats ${match.players[1].name}`);
});

console.log(`\nTournament Status: ${tournament.status}`);
console.log(`Tournament Winner: ${tournament.winner?.name || 'None'}`);

// Test 4: Edge case - 2 players
console.log('\nTest 4: Tournament with 2 players');
const bracket2 = generateTournamentBracket(mockPlayers.slice(0, 2), 8);
const tournament2 = {
  id: 'test-tournament-2',
  name: 'Test Tournament 2',
  participants: mockPlayers.slice(0, 2),
  matches: bracket2,
  currentRound: 1,
  status: 'in-progress'
};

console.log('Completing final match:');
const finalMatch = tournament2.matches[0];
const winner = finalMatch.players[0];
endTournamentMatch(tournament2, finalMatch.id, winner.id);
console.log(`  ${finalMatch.players[0].name} defeats ${finalMatch.players[1].name}`);

console.log(`\nTournament Status: ${tournament2.status}`);
console.log(`Tournament Winner: ${tournament2.winner?.name || 'None'}`);

console.log('\n=== All Tests Completed ===');
