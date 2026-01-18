
import React from 'react';
import { Card, Shape } from '../types';
import { SHAPE_COLORS, SHAPE_ICONS } from '../constants';

interface CardUIProps {
  card: Card;
  onClick?: () => void;
  disabled?: boolean;
  isBack?: boolean;
  className?: string;
}

const CardUI: React.FC<CardUIProps> = ({ card, onClick, disabled, isBack, className = "" }) => {
  if (isBack) {
    return (
      <div 
        className={`w-20 h-32 md:w-24 md:h-36 rounded-xl border-4 border-gray-800 bg-gradient-to-br from-indigo-900 to-black flex items-center justify-center card-shadow overflow-hidden cursor-pointer transition-transform hover:-translate-y-2 ${className}`}
        onClick={onClick}
      >
        <div className="w-full h-full p-2 border-2 border-indigo-500/30 rounded-lg flex items-center justify-center">
            <div className="text-3xl font-black text-indigo-500/50 rotate-45">WHOT</div>
        </div>
      </div>
    );
  }

  const colorClass = SHAPE_COLORS[card.shape] || 'text-white';
  const icon = SHAPE_ICONS[card.shape];

  return (
    <div 
      onClick={!disabled ? onClick : undefined}
      className={`relative w-20 h-32 md:w-24 md:h-36 rounded-xl border-2 border-gray-200 bg-white flex flex-col items-center justify-between p-2 card-shadow transition-all duration-300 ${disabled ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:-translate-y-4 hover:rotate-3 cursor-pointer'} ${className}`}
    >
      <div className={`self-start text-xl font-bold ${colorClass}`}>{card.number === 20 ? 'W' : card.number}</div>
      <div className={`text-4xl ${colorClass} drop-shadow-sm`}>{icon}</div>
      <div className={`self-end text-xl font-bold rotate-180 ${colorClass}`}>{card.number === 20 ? 'W' : card.number}</div>
      
      {/* Pattern details */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none flex flex-wrap gap-1 p-1">
          {Array(12).fill(0).map((_, i) => <span key={i} className="text-[8px]">{icon}</span>)}
      </div>
    </div>
  );
};

export default CardUI;
