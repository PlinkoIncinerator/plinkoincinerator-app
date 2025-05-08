import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// In a real implementation, these would be fetched from a database
async function getGameMetrics() {
  try {
    // Connect to the server API to get real metrics
    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3333';
    
    // Fetch game metrics
    const metricsResponse = await fetch(`${serverUrl}/api/plinko/metrics`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });
    
    if (!metricsResponse.ok) {
      throw new Error(`Failed to fetch metrics: ${metricsResponse.status}`);
    }
    
    const metrics = await metricsResponse.json();
    
    // Fetch buyback metrics
    const buybackResponse = await fetch(`${serverUrl}/api/plinko/buybacks`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });
    
    // If buyback fetch fails, we'll still return the game metrics
    let buybacks = {};
    if (buybackResponse.ok) {
      buybacks = await buybackResponse.json();
    }
    
    // Combine metrics with buyback info
    return {
      ...metrics,
      ...buybacks,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching metrics from server:', error);
    
    // Fall back to mock data if server is unavailable
    return {
      totalSolBurned: 1298.45,
      totalBallsDropped: 54768,
      totalSolWon: 1087.23, 
      totalSolLost: 211.22,
      biggestWin: 43.75,
      activePlayers: 12,
      // Buyback mock data
      totalBuybacks: 67.25,
      pendingBuybacks: 1,
      lastBuybackAmount: 0.42,
      currentAccumulator: 0.15,
      buybackThreshold: 0.2,
      buybackPercentage: 3.0,
      lastUpdated: new Date().toISOString()
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const metrics = await getGameMetrics();
    
    // Return the metrics as JSON
    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
} 