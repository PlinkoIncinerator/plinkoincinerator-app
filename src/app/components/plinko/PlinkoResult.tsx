'use client';

import React from 'react';

interface PlinkoResultProps {
  isVisible: boolean;
  multiplier: number;
  betAmount: number;
  winAmount: number;
}

export default function PlinkoResult({
  isVisible,
  multiplier,
  betAmount,
  winAmount
}: PlinkoResultProps) {
  if (!isVisible) return null;
  
  // Determine color based on outcome
  const isWin = winAmount > betAmount;
  const textColor = isWin ? 'text-green-500' : 'text-red-500';
  
  // Format amounts
  const formattedBet = betAmount.toFixed(4);
  const formattedWin = winAmount.toFixed(4);
  
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md mx-auto text-white animate-scale-in">
        <div className="flex flex-col items-center gap-4">
          <h2 className="text-xl font-semibold">Game Result</h2>
          
          <div className={`text-5xl font-bold ${textColor}`}>
            {multiplier}x
          </div>
          
          <div className="grid grid-cols-2 gap-4 w-full">
            <div className="flex flex-col items-center">
              <div className="text-gray-400 text-sm">Bet Amount</div>
              <div className="font-medium">${formattedBet}</div>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="text-gray-400 text-sm">Win Amount</div>
              <div className={`font-medium ${textColor}`}>${formattedWin}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Add a CSS animation
const customStyles = `
@keyframes scale-in {
  0% {
    opacity: 0;
    transform: scale(0.8);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-scale-in {
  animation: scale-in 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}
`;

// Add the styles to the document
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.innerHTML = customStyles;
  document.head.appendChild(styleElement);
} 