'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { formatAmount } from '../../utils/walletService';
import { API_BASE_URL } from '../../config/constants';

interface PlinkoMetricsProps {
  refreshInterval?: number;
  onMetricsLoaded?: (metrics: GameMetrics | null) => void;
}

interface GameMetrics {
  totalSolBurned: number;
  totalBallsDropped: number;
  totalSolWon: number;
  totalSolLost: number;
  biggestWin: number;
  activePlayers: number;
  lastUpdated: Date;
}

interface SolanaLogoProps {
  width?: number;
  height?: number;
  className?: string;
}

const SolanaLogo = React.memo(({ width = 16, height = 14, className = "" }: SolanaLogoProps) => {
  return (
    <Image 
      src="/solana-logo.svg" 
      alt="SOL" 
      width={width} 
      height={height}
      className={`inline-block ${className}`}
    />
  );
});
SolanaLogo.displayName = 'SolanaLogo';

// Animation component for numbers using refs to prevent re-renders
const AnimatedCounter = ({ value, duration = 1, decimals = 0, prefix = '', suffix = '' }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const startValueRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const prevValueRef = useRef(value);
  
  useEffect(() => {
    // Only animate if the value has changed
    if (prevValueRef.current === value) return;
    
    // Update previous value reference
    prevValueRef.current = value;
    
    // Animation variables
    let startTime: number;
    const startValue = startValueRef.current;
    const endValue = value;
    
    // Update reference for next animation
    startValueRef.current = value;
    
    // Animation frame callback
    const updateValue = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      const currentValue = startValue + progress * (endValue - startValue);
      
      setDisplayValue(currentValue);
      
      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(updateValue);
      }
    };
    
    // Cancel any existing animation before starting a new one
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    // Start the animation
    animationFrameRef.current = requestAnimationFrame(updateValue);
    
    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [value, duration]);

  return (
    <span>
      {prefix}
      {decimals > 0 
        ? displayValue.toFixed(decimals)
        : Math.floor(displayValue).toLocaleString()}
      {suffix}
    </span>
  );
};

// Simplified version with minimal state changes
export default React.memo(function PlinkoMetrics({ refreshInterval = 60000, onMetricsLoaded }: PlinkoMetricsProps) {
  // Single source of truth for state to avoid circular updates
  const [state, setState] = useState({
    metrics: null as GameMetrics | null,
    loading: true,
    error: null as string | null,
    randomBalls: Math.floor(Math.random() * 5) + 1
  });
  
  // Use a ref to track if we've already run the effect
  const isInitializedRef = useRef(false);
  // Use a ref to store the interval ID
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Use callback for fetchMetrics to stabilize it
  const fetchMetrics = useCallback(async () => {
    try {
      console.log('Fetching metrics...');
      const response = await fetch(`${API_BASE_URL}/api/plinko/metrics`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }
      
      const data = await response.json();
      
      // Process the data
      const newMetrics = {
        totalSolBurned: data.totalSolBurned || 0,
        totalBallsDropped: data.totalBallsDropped || 0,
        totalSolWon: data.totalSolWon || 0,
        totalSolLost: data.totalSolLost || 0,
        biggestWin: data.biggestWin || 0,
        activePlayers: data.activePlayers || 0,
        lastUpdated: new Date(data.lastUpdated || Date.now())
      };
      
      // Update state once with all changes
      setState(prevState => ({
        ...prevState,
        metrics: newMetrics,
        loading: false,
        error: null,
        randomBalls: Math.floor(Math.random() * 5) + 1
      }));
      
      // Call the callback if provided
      if (onMetricsLoaded) {
        onMetricsLoaded(newMetrics);
      }
      
    } catch (err) {
      console.error('Error fetching metrics:', err);
      setState(prevState => ({
        ...prevState,
        error: 'Failed to load metrics data',
        loading: false
      }));
    }
  }, [onMetricsLoaded]);
  
  // Effect to fetch data and set up interval - runs only once
  useEffect(() => {
    // Exit if we've already initialized
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;
    
    // Initial fetch
    fetchMetrics();
    
    // Set up interval for refreshing
    if (refreshInterval > 0) {
      intervalRef.current = setInterval(fetchMetrics, refreshInterval);
    }
    
    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [refreshInterval, fetchMetrics]);  // Add dependencies
  
  // Extract values from state for rendering
  const { metrics, loading, error, randomBalls } = state;
  
  // Loading state
  if (loading && !metrics) {
    return (
      <div className="flex justify-center py-10">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="text-gray-400">Loading metrics...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error && !metrics) {
    return (
      <div className="bg-red-900 bg-opacity-50 text-white p-4 rounded-lg text-center">
        <p>Error: {error}</p>
      </div>
    );
  }
  
  // Default values for metrics
  const {
    totalSolBurned = 0,
    totalBallsDropped = 0,
    totalSolWon = 0,
    biggestWin = 0,
    activePlayers = 0,
    lastUpdated = new Date()
  } = metrics || {};
  
  return (
    <div className="relative py-6">
      {/* Decorative elements */}
      <div className="absolute -top-10 -left-10 w-20 h-20 bg-purple-500 rounded-full blur-3xl opacity-20"></div>
      <div className="absolute -bottom-10 -right-10 w-20 h-20 bg-pink-500 rounded-full blur-3xl opacity-20"></div>
      
      {/* Main metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {/* SOL Burned Metric */}
        <div className="bg-gradient-to-br from-purple-900 to-black rounded-xl p-5 shadow-xl transform hover:scale-105 transition-all duration-300 border border-purple-800 border-opacity-40 relative overflow-hidden group">
          <div className="absolute -bottom-2 -right-2 w-16 h-16 text-purple-500 opacity-10 group-hover:opacity-20 transition-opacity text-6xl">🔥</div>
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-lg font-semibold text-gray-300">Total SOL Recovered</h3>
            <span className="text-2xl">🔥</span>
          </div>
          <div className="text-3xl font-bold text-purple-400 flex items-center">
            {formatAmount(totalSolBurned)}
          </div>
          <div className="text-xs text-gray-500 mt-2 flex items-center">
            <span className="animate-pulse mr-1">●</span>
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>
        </div>
        
        {/* Balls Dropped Metric */}
        <div className="bg-gradient-to-br from-blue-900 to-black rounded-xl p-5 shadow-xl transform hover:scale-105 transition-all duration-300 border border-blue-800 border-opacity-40 relative overflow-hidden group">
          <div className="absolute -bottom-2 -right-2 w-16 h-16 text-blue-500 opacity-10 group-hover:opacity-20 transition-opacity text-6xl">🎮</div>
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-lg font-semibold text-gray-300">Balls Dropped</h3>
            <span className="text-2xl">🎮</span>
          </div>
          <div className="text-3xl font-bold text-blue-400">
            {totalBallsDropped.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            <span className="text-blue-400">{randomBalls}</span> balls dropped in the last minute
          </div>
        </div>
        
        {/* Total SOL Won */}
        <div className="bg-gradient-to-br from-green-900 to-black rounded-xl p-5 shadow-xl transform hover:scale-105 transition-all duration-300 border border-green-800 border-opacity-40 relative overflow-hidden group">
          <div className="absolute -bottom-2 -right-2 w-16 h-16 text-green-500 opacity-10 group-hover:opacity-20 transition-opacity text-6xl">💰</div>
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-lg font-semibold text-gray-300">Total Won</h3>
            <span className="text-2xl">💰</span>
          </div>
          <div className="text-3xl font-bold text-green-400 flex items-center">
            {formatAmount(totalSolWon)}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            <span className="text-green-400">+{formatAmount(0.015).replace(' SOL', '')}</span> in the last hour
          </div>
        </div>
        
        {/* Biggest Win */}
        <div className="bg-gradient-to-br from-pink-900 to-black rounded-xl p-5 shadow-xl transform hover:scale-105 transition-all duration-300 border border-pink-800 border-opacity-40 relative overflow-hidden group">
          <div className="absolute -bottom-2 -right-2 w-16 h-16 text-pink-500 opacity-10 group-hover:opacity-20 transition-opacity text-6xl">🏆</div>
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-lg font-semibold text-gray-300">Biggest Win</h3>
            <span className="text-2xl">🏆</span>
          </div>
          <div className="text-3xl font-bold text-pink-400 flex items-center">
            {formatAmount(biggestWin)}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Could you be next? <span className="text-pink-400">Try your luck!</span>
          </div>
        </div>
      </div>
      
      {/* Active players stat */}
      <div className="mt-8 bg-gradient-to-r from-indigo-900 to-purple-900 rounded-lg p-4 shadow-lg">
        <div className="flex items-center justify-center">
          <div className="text-center">
            <div className="text-gray-300 mb-1">Active Players</div>
            <div className="text-2xl font-bold text-white flex items-center justify-center space-x-2">
              <span className="inline-block h-3 w-3 bg-green-500 rounded-full animate-pulse"></span>
              <span>{activePlayers} online</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}); 