'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { API_BASE_URL } from '../config/constants';

interface LiveStatsCounterProps {
  refreshInterval?: number;
}

// Create a reusable component for the Solana logo similar to the main page
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

interface StatsData {
  totalBallsDropped: number;
  totalSolBurned: number;
}

export default function LiveStatsCounter({ refreshInterval = 30000 }: LiveStatsCounterProps) {
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [isMetricsLoading, setIsMetricsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setIsMetricsLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/plinko/metrics`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      
      const data = await response.json();
      
      setStatsData({
        totalBallsDropped: data.totalBallsDropped || 0,
        totalSolBurned: data.totalSolBurned || 0
      });
      setError(null);
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError('Failed to load stats data');
    } finally {
      setIsMetricsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchStats();
    
    // Set up interval for refreshing
    const interval = setInterval(fetchStats, refreshInterval);
    
    // Cleanup
    return () => clearInterval(interval);
  }, [fetchStats, refreshInterval]);

  return (
    <div className="flex flex-wrap justify-center gap-3 mb-8">
      <div className="bg-black bg-opacity-50 px-4 py-2 rounded-full flex items-center group hover:bg-opacity-70 transition-all">
        <span className="inline-block h-2 w-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
        <span className="text-blue-300 font-medium mr-1">Balls Dropped:</span>
        <span className="text-white font-bold">
          {isMetricsLoading ? (
            <span className="inline-block w-12 h-5 bg-gray-700 animate-pulse rounded"></span>
          ) : (
            (statsData?.totalBallsDropped || 0).toLocaleString()
          )}
        </span>
      </div>
      
      <div className="bg-black bg-opacity-50 px-4 py-2 rounded-full flex items-center group hover:bg-opacity-70 transition-all">
        <span className="inline-block h-2 w-2 bg-purple-500 rounded-full mr-2 animate-pulse"></span>
        <span className="text-purple-300 font-medium mr-1">SOL Recovered:</span>
        <span className="text-white font-bold flex items-center">
          {isMetricsLoading ? (
            <span className="inline-block w-16 h-5 bg-gray-700 animate-pulse rounded"></span>
          ) : (
            <>
              {(statsData?.totalSolBurned || 0).toFixed(2)} <SolanaLogo width={12} height={10} className="ml-1" />
            </>
          )}
        </span>
      </div>
    </div>
  );
} 