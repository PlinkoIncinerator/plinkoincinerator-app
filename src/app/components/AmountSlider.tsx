"use client";

import { useState, useEffect, useRef } from "react";
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

export default function AmountSlider({ onChange, initialAmount = 0.1 }: AmountSliderProps) {
  // The fixed values for the slider in dollars - changed to $0, $2.5, $5, $10
  const valueOptionsUsd = [0, 2.5, 5, 10]; 
  
  const [solToUsd, setSolToUsd] = useState<number>(20); // Default fallback value
  
  // Convert initial SOL value to USD for initial state
  const initialUsdValue = initialAmount * solToUsd;
  
  // Find closest initial value from our options
  const getClosestValue = (value: number) => {
    return valueOptionsUsd.reduce((prev, curr) => 
      Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
    );
  };
  
  const [selectedUsdValue, setSelectedUsdValue] = useState<number>(
    getClosestValue(initialUsdValue)
  );

  // Add ref to store previous value to prevent duplicate updates
  const previousUsdValueRef = useRef<number>(selectedUsdValue);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialRenderRef = useRef<boolean>(true);

  // Fetch the current SOL price in USD
  useEffect(() => {
    const fetchSolPrice = async () => {
      try {
        // Using CoinGecko API to get SOL price in USD
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        
        if (response.ok) {
          const data = await response.json();
          setSolToUsd(data.solana.usd);
          
          // Re-calculate the equivalent SOL value when price changes
          // but don't trigger onChange as that would cause recursive updates
          previousUsdValueRef.current = selectedUsdValue;
        }
      } catch (err) {
        console.error('Error fetching SOL price:', err);
        // Keep using the fallback price
      }
    };

    fetchSolPrice();
  }, []);

  // Trigger onChange on initial render
  useEffect(() => {
    if (initialRenderRef.current) {
      initialRenderRef.current = false;
      // Trigger the onChange with the initial value
      const solValue = selectedUsdValue / solToUsd;
      onChange(solValue);
    }
  }, [onChange, selectedUsdValue, solToUsd]);

  // Safely trigger the onChange callback with debounce
  const triggerOnChange = (usdValue: number) => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Skip if the value hasn't changed
    if (usdValue === previousUsdValueRef.current) {
      return;
    }
    
    // Update the previous value ref
    previousUsdValueRef.current = usdValue;
    
    // Debounce the onChange call
    timeoutRef.current = setTimeout(() => {
      const solValue = usdValue / solToUsd;
      onChange(solValue);
    }, 300); // 300ms debounce
  };

  // Handle slider change
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value);
    const newUsdValue = valueOptionsUsd[index];
    setSelectedUsdValue(newUsdValue);
    
    // Trigger the onChange callback
    triggerOnChange(newUsdValue);
  };

  // Handle direct click on the value buttons
  const handleValueClick = (value: number) => {
    setSelectedUsdValue(value);
    
    // Trigger the onChange callback
    triggerOnChange(value);
  };

  // Calculate SOL value from USD
  const solValue = selectedUsdValue / solToUsd;

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="bg-gray-900 bg-opacity-60 rounded-lg p-3 border border-gray-800 shadow-lg">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center space-x-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium text-white">Max Token Value:</span>
        </div>
        <div className="flex items-center">
          <span className="font-bold text-green-400 text-md">
            ${selectedUsdValue % 1 === 0 ? selectedUsdValue.toFixed(0) : selectedUsdValue.toFixed(1)}
          </span>
          <span className="text-sm font-normal text-gray-400 ml-2">
            ≈ {solValue.toFixed(2)} <SolanaLogo className="ml-1" />
          </span>
        </div>
      </div>
      
      <div className="mb-1">
        <input
          type="range"
          min="0"
          max={valueOptionsUsd.length - 1}
          step="1"
          value={valueOptionsUsd.indexOf(selectedUsdValue)}
          onChange={handleSliderChange}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
        />
      </div>
      
      <div className="flex justify-between text-xs mt-1">
        {valueOptionsUsd.map((value, index) => (
          <button 
            key={index}
            onClick={() => handleValueClick(value)}
            className={`px-2 py-1 rounded-md transition-colors ${
              selectedUsdValue === value 
                ? 'bg-green-800 text-white font-medium' 
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            ${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}
          </button>
        ))}
      </div>
      
      <p className="text-xs text-gray-400 mt-2 text-center">
        Tokens valued above ${selectedUsdValue % 1 === 0 ? selectedUsdValue.toFixed(0) : selectedUsdValue.toFixed(1)} will not be eligible for incineration
      </p>
    </div>
  );
} 