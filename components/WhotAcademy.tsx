
import React, { useState } from 'react';

const TUTORIAL_STEPS = [
  {
    title: "Welcome to Whot Academy",
    content: "Whot is Nigeria's most famous card game. Match the shape or number of the card on the table to play.",
    icon: "🎓"
  },
  {
    title: "Special Cards",
    content: "1 (Hold On), 2 (Pick Two), 5 (Pick Three), 8 (Suspension), 14 (General Market). Learn these to rule the street!",
    icon: "🔥"
  },
  {
    title: "The WHOT Card (20)",
    content: "The 20 card is your wild card. Play it anytime to change the current shape to whatever you want.",
    icon: "⭐"
  },
  {
    title: "Last Card Rule",
    content: "When you have one card left, you MUST call 'Last Card'. If you don't, you pick two cards!",
    icon: "⚠️"
  }
];

const WhotAcademy: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [step, setStep] = useState(0);

  return (
    <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-6">
      <div className="max-w-md w-full glass rounded-3xl p-8 space-y-6 text-center">
        <div className="text-6xl">{TUTORIAL_STEPS[step].icon}</div>
        <h2 className="text-3xl font-black text-white italic">{TUTORIAL_STEPS[step].title}</h2>
        <p className="text-indigo-200 leading-relaxed">{TUTORIAL_STEPS[step].content}</p>
        
        <div className="flex gap-4 pt-4">
          {step > 0 && (
            <button 
              onClick={() => setStep(s => s - 1)}
              className="flex-1 py-3 bg-white/10 text-white rounded-xl font-bold"
            >
              Previous
            </button>
          )}
          <button 
            onClick={() => step < TUTORIAL_STEPS.length - 1 ? setStep(s => s + 1) : onClose()}
            className="flex-1 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-500 transition-colors"
          >
            {step < TUTORIAL_STEPS.length - 1 ? "Next Tip" : "I'm Ready!"}
          </button>
        </div>

        <div className="flex justify-center gap-2">
          {TUTORIAL_STEPS.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full ${i === step ? 'bg-orange-500' : 'bg-white/20'}`} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default WhotAcademy;
