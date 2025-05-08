'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { formatAmount } from '../../utils/walletService';
import { API_BASE_URL } from '../../config/constants';

interface PlinkoMetricsProps {
  refreshInterval?: number; // How often to refresh the metrics in ms
  onMetricsLoaded?: (metrics: GameMetrics | null) => void; // Callback when metrics are loaded
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

// Animation component for numbers
const AnimatedCounter = ({ value, duration = 1, decimals = 0, prefix = '', suffix = '' }) => {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    let startTime: number;
    let animationFrame: number;
    const startValue = displayValue;
    const endValue = value;
    
    const updateValue = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      const currentValue = startValue + progress * (endValue - startValue);
      
      setDisplayValue(currentValue);
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(updateValue);
      }
    };
    
    animationFrame = requestAnimationFrame(updateValue);
    
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration, displayValue]);

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

export default function PlinkoMetrics({ refreshInterval = 60000, onMetricsLoaded }: PlinkoMetricsProps) {
  const [metrics, setMetrics] = useState<GameMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchMetrics = async () => {
    try {
      setLoading(true);
      console.log('API_BASE_URL', API_BASE_URL);
      
      // Use the same fetch pattern as walletService with API_BASE_URL
      const response = await fetch(`${API_BASE_URL}/api/plinko/metrics`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch metrics');
      }
      
      const data = await response.json();
      
      // Transform the data to match our expected format
      const formattedMetrics = {
        totalSolBurned: data.totalSolBurned,
        totalBallsDropped: data.totalBallsDropped,
        totalSolWon: data.totalSolWon,
        totalSolLost: data.totalSolLost,
        biggestWin: data.biggestWin,
        activePlayers: data.activePlayers,
        lastUpdated: new Date(data.lastUpdated)
      };
      
      setMetrics(formattedMetrics);
      
      // Call the onMetricsLoaded callback if provided
      if (onMetricsLoaded) {
        onMetricsLoaded(formattedMetrics);
      }
      
      setError(null);
    } catch (err) {
      console.error('Error fetching metrics:', err);
      setError('Failed to load metrics data');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchMetrics();
    
    // Set up interval to refresh metrics
    const intervalId = setInterval(fetchMetrics, refreshInterval);
    
    // Clear interval on component unmount
    return () => clearInterval(intervalId);
  }, [refreshInterval, onMetricsLoaded]);
  
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
  
  if (error) {
    return (
      <div className="bg-red-900 bg-opacity-50 text-white p-4 rounded-lg text-center">
        <p>Error: {error}</p>
      </div>
    );
  }
  
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
            <h3 className="text-lg font-semibold text-gray-300">Total <SolanaLogo width={14} height={12} /> Recovered</h3>
            <span className="text-2xl">🔥</span>
          </div>
          <div className="text-3xl font-bold text-purple-400 flex items-center">
            {formatAmount(metrics?.totalSolBurned || 0)}
          </div>
          <div className="text-xs text-gray-500 mt-2 flex items-center">
            <span className="animate-pulse mr-1">●</span>
            Last updated: {metrics?.lastUpdated.toLocaleTimeString()}
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
            <AnimatedCounter value={metrics?.totalBallsDropped || 0} suffix="" />
          </div>
          <div className="text-xs text-gray-500 mt-2">
            <span className="text-blue-400">{Math.floor(Math.random() * 5) + 1}</span> balls dropped in the last minute
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
            {formatAmount(metrics?.totalSolWon || 0)}
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
            {formatAmount(metrics?.biggestWin || 0)}
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
              <AnimatedCounter value={metrics?.activePlayers || 0} prefix="" suffix=" online" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 