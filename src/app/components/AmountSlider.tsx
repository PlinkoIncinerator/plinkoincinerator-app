"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

interface AmountSliderProps {
  onChange: (amount: number) => void;
  initialAmount?: number;
}

// A reusable component for the Solana logo
const SolanaLogo = ({ width = 16, height = 14, className = "" }) => {
  return (
    <Image 
      src="/solana-logo.svg" 
      alt="SOL" 
      width={width} 
      height={height}
      className={`inline-block ${className}`}
    />
  );
};

export default function AmountSlider({ onChange, initialAmount = 0 }: AmountSliderProps) {
  const [amount, setAmount] = useState<number>(initialAmount);
  const [usdValue, setUsdValue] = useState<number | null>(null);
  const [solToUsd, setSolToUsd] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch the current SOL price in USD
  useEffect(() => {
    const fetchSolPrice = async () => {
      try {
        setLoading(true);
        // Using CoinGecko API to get SOL price in USD
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        
        if (!response.ok) {
          throw new Error('Failed to fetch SOL price');
        }
        
        const data = await response.json();
        const solPrice = data.solana.usd;
        
        setSolToUsd(solPrice);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching SOL price:', err);
        setError('Could not fetch SOL price');
        setLoading(false);
        // Use a fallback price if API fails
        setSolToUsd(20); // Assuming 1 SOL = $20 as fallback
      }
    };

    fetchSolPrice();
  }, []);

  // Calculate USD value whenever amount or exchange rate changes
  useEffect(() => {
    if (solToUsd !== null) {
      setUsdValue(amount * solToUsd);
    }
  }, [amount, solToUsd]);

  // Handle slider change
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    setAmount(newValue);
    onChange(newValue);
  };

  // Handle direct input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    if (!isNaN(newValue) && newValue >= 0) {
      // Calculate max SOL allowed for $10
      const maxSol = solToUsd ? 10 / solToUsd : 0.5;
      const limitedValue = Math.min(newValue, maxSol);
      setAmount(limitedValue);
      onChange(limitedValue);
    }
  };

  // Calculate max SOL for $10
  const maxSol = solToUsd ? 10 / solToUsd : 0.5;
  
  return (
    <div className="bg-gray-900 bg-opacity-60 rounded-lg p-5 border border-gray-800 shadow-lg">
      <h2 className="text-lg font-semibold text-white mb-4">Set Target Amount</h2>
      
      <div className="flex items-center mb-6">
        <div className="text-xl font-bold text-purple-300 mr-3 min-w-[120px]">
          {amount.toFixed(4)} <SolanaLogo className="ml-1" />
        </div>
        <div className="text-sm text-gray-400">
          ≈ ${usdValue !== null ? usdValue.toFixed(2) : loading ? "Loading..." : "N/A"}
          {usdValue && usdValue > 9.9 && (
            <span className="ml-2 text-yellow-400">($10 max)</span>
          )}
        </div>
      </div>
      
      <div className="relative">
        <input
          type="range"
          min="0"
          max={maxSol}
          step="0.001"
          value={amount}
          onChange={handleSliderChange}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0 SOL</span>
          <span>{maxSol.toFixed(3)} SOL (≈$10)</span>
        </div>
      </div>
      
      <div className="mt-4">
        <label className="block text-sm text-gray-400 mb-1">Custom amount (SOL)</label>
        <div className="relative">
          <input
            type="number"
            min="0"
            max={maxSol}
            step="0.001"
            value={amount}
            onChange={handleInputChange}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white w-full focus:outline-none focus:border-purple-500"
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Maximum amount: {maxSol.toFixed(4)} SOL (≈$10)
        </p>
      </div>
      
      {error && (
        <p className="text-red-400 text-xs mt-2">
          {error} - Using estimated conversion rate.
        </p>
      )}
    </div>
  );
} 