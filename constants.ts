
import { Shape, TableSkin } from './types';

export const SHAPES = [Shape.CIRCLE, Shape.TRIANGLE, Shape.CROSS, Shape.SQUARE, Shape.STAR];

export const SLANGS = [
  "Oya play!",
  "You dey whine?",
  "Na God win am",
  "Check your card!",
  "General Market!",
  "I don finish work",
  "Don't dull!",
  "Lagos Boss move",
  "Comot for road!",
  "Who go pay?",
  "I don check o!",
  "No shaking!"
];

export const SPORTSMANSHIP_SLANGS = [
  "Good Game!",
  "Well Played!",
  "Omo you try!",
  "Rematch soon?",
  "Fair play abeg.",
  "You're a legend!"
];

export const PERSONALITY_COMMENTARY: Record<string, Record<string, string[]>> = {
  AGGRESSIVE: {
    ATTACK: ["Take that! No mercy!", "Enjoy these cards, my friend!", "Wahala for who no get cards!"],
    WIN: ["I told you, I'm the king of this street!", "Bow down to the General!"],
    DRAW: ["Mtchew, this deck is stingy today."]
  },
  DEFENSIVE: {
    ATTACK: ["Sorry o, I have to protect myself.", "Lagos is tight, I'm just surviving."],
    WIN: ["Phew, that was close!", "Steady win, no shaking."],
    DRAW: ["Better safe than sorry."]
  },
  TRICKSTER: {
    ATTACK: ["Surprise! You weren't expecting that, eh?", "Changing the game like magic!"],
    WIN: ["You never saw me coming!", "Master of the Whot card!"],
    DRAW: ["Part of my master plan... trust me."]
  }
};

export const COMMENTARY_POOL: Record<string, string[]> = {
  DRAW: ["Market mode activated!", "Chai, you don enter market o!", "Search well, the card dey inside.", "Omo, market don full basket!"],
  PLAY_2: ["Pick Two! No be small thing.", "Omo, who you offend?", "Two cards for the culture.", "Double wahala for dead body!"],
  PLAY_5: ["Pick Three! Wahala pro max!", "Lagos traffic cards, enjoy.", "Street is not smiling.", "Odogwu move!"],
  GENERAL_MARKET: ["EVERYONE TO MARKET!", "Oya, carry your basket!", "Market day for Lagos.", "Mass mobilization to market!"],
  HOLD_ON: ["Hold on! I never finish.", "Wait first, Lagos no de move.", "Wait there, I de come.", "Patience is a virtue, wait there!"],
  LAST_CARD: ["LAST CARD! Danger zone!", "Omo, check your life o!", "One more to go, Lagos Boss!", "Pressure is getting wesser!"],
  VICTORY: ["ODOGWU! You too much!", "Lagos Boss for a reason!", "Na you get the table today!", "E don finish! I don collect!"],
  CHAOS: ["CHAOS MODE! Anything can happen.", "Rules don change! Shine your eye.", "Inside life, inside Lagos!"],
  WHOT: ["W-H-O-T! What you want?", "I change the shape, no be your choice!", "Whot master in the building!"]
};

export const RULE_TOOLTIPS: Record<number, string> = {
  1: "HOLD ON: The next player waits. You play again!",
  2: "PICK TWO: The next player draws 2 cards unless they have a 2 too!",
  5: "PICK THREE: The next player draws 3 cards! Huge wahala.",
  8: "SUSPENSION: The next player is skipped entirely. Comot for road!",
  14: "GENERAL MARKET: Everyone except the person who played must draw 1 card.",
  20: "WHOT (Wild): You can play this anytime to change the current shape to whatever you want."
};

export const SKIN_CONFIGS: Record<TableSkin, { bg: string, accent: string, text: string }> = {
  [TableSkin.CLASSIC]: { bg: 'bg-slate-900', accent: 'border-indigo-500', text: 'text-indigo-400' },
  [TableSkin.ANKARA]: { bg: 'bg-amber-900', accent: 'border-orange-600', text: 'text-orange-400' },
  [TableSkin.NEON_LAGOS]: { bg: 'bg-black', accent: 'border-fuchsia-600', text: 'text-fuchsia-400' },
  [TableSkin.STREET]: { bg: 'bg-zinc-800', accent: 'border-yellow-500', text: 'text-yellow-400' }
};

export const AVATARS = [
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Nala",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Jabari",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Zuri",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Kofi",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Binta",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Malik",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Sana",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Tayo",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Funke",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Obi"
];

export const SHAPE_COLORS: Record<Shape, string> = {
  [Shape.CIRCLE]: 'text-red-500',
  [Shape.TRIANGLE]: 'text-yellow-400',
  [Shape.CROSS]: 'text-green-500',
  [Shape.SQUARE]: 'text-blue-500',
  [Shape.STAR]: 'text-orange-500',
  [Shape.WHOT]: 'text-purple-500'
};

export const SHAPE_ICONS: Record<Shape, string> = {
  [Shape.CIRCLE]: '●',
  [Shape.TRIANGLE]: '▲',
  [Shape.CROSS]: '✚',
  [Shape.SQUARE]: '■',
  [Shape.STAR]: '★',
  [Shape.WHOT]: 'W'
};

export const TURN_DURATIONS = {
  NORMAL: 10
};
