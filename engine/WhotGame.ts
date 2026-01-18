
import { Shape, Card, Player, GameState, GameMode, SpeedMode, AIPersonality } from '../types';

export class WhotEngine {
  static createDeck(): Card[] {
    const deck: Card[] = [];
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

  static isValidMove(card: Card, gameState: GameState): boolean {
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

  static getExplanation(card: Card): string {
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

  static applyRules(card: Card, gameState: GameState): Partial<GameState> {
    const updates: Partial<GameState> = {
      currentNumber: card.number,
      currentShape: card.shape,
      explanation: this.getExplanation(card)
    };

    switch (card.number) {
      case 1: 
        updates.currentPlayerIndex = gameState.currentPlayerIndex;
        break;
      case 2:
        updates.pendingPicks = (gameState.pendingPicks || 0) + 2;
        updates.currentPlayerIndex = this.getNextPlayerIndex(gameState, 1);
        break;
      case 5:
        updates.pendingPicks = (gameState.pendingPicks || 0) + 3;
        updates.currentPlayerIndex = this.getNextPlayerIndex(gameState, 1);
        break;
      case 8:
        updates.currentPlayerIndex = this.getNextPlayerIndex(gameState, 2);
        break;
      case 14:
        updates.currentPlayerIndex = this.getNextPlayerIndex(gameState, 1);
        break;
      case 20:
        // WHOT: don't advance player yet, shape selection will happen
        updates.currentPlayerIndex = gameState.currentPlayerIndex;
        break;
      default:
        updates.currentPlayerIndex = this.getNextPlayerIndex(gameState, 1);
        break;
    }

    if (gameState.gameMode === GameMode.CHAOS && card.number === 8) {
        updates.turnDirection = (gameState.turnDirection * -1) as (1 | -1);
    }

    return updates;
  }

  static getNextPlayerIndex(state: GameState, skipCount: number = 1): number {
    const total = state.players.length;
    if (total === 0) return 0;
    let next = (state.currentPlayerIndex + (state.turnDirection * skipCount)) % total;
    while (next < 0) next += total;
    return next % total;
  }

  static getAIAction(player: Player, state: GameState): string | null {
    if (!player || !player.hand || !Array.isArray(player.hand)) return null;
    const validMoves = player.hand.filter(c => this.isValidMove(c, state));
    if (validMoves.length === 0) return null;

    // Adaptive AI Fairness Logic
    const isPlayerWinning = state.players[0].hand && Array.isArray(state.players[0].hand) && state.players[0].hand.length <= 2;
    
    switch (player.personality) {
      case AIPersonality.AGGRESSIVE:
        // Attack if anyone is low, especially the human
        const attacks = validMoves.filter(c => [2, 5, 14, 20].includes(c.number));
        if (attacks.length > 0 && (isPlayerWinning || Math.random() > 0.5)) return attacks[0].id;
        break;
      case AIPersonality.DEFENSIVE:
        // Hold onto specials to skip or block
        const defense = validMoves.filter(c => [1, 8].includes(c.number));
        if (defense.length > 0 && Array.isArray(player.hand) && player.hand.length < 4) return defense[0].id;
        break;
      case AIPersonality.TRICKSTER:
        // Change shapes frequently with WHOT
        const whot = validMoves.find(c => c.number === 20);
        if (whot && Math.random() > 0.6) return whot.id;
        break;
    }

    // Default: play highest number to reduce score risk
    return validMoves.sort((a, b) => b.number - a.number)[0].id;
  }

  static getXPForAction(action: string, state: GameState): number {
      switch(action) {
          case 'WIN': return 500;
          case 'PLAY_SPECIAL': return 50;
          case 'CALL_LAST': return 30;
          case 'CORRECT_WHOT': return 40;
          case 'UNDO': return -20; // Small penalty for using undo
          default: return 10;
      }
  }

  static getLevel(xp: number): number {
      return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
  }

  static getTitle(level: number): string {
      const titles = ["Learner", "Area Boy", "Street Smart", "Whot Major", "Area Champion", "Lagos Boss", "Whot General", "Street King"];
      return titles[Math.min(Math.max(0, level - 1), titles.length - 1)];
  }
}
