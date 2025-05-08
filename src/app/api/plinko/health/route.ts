import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
    const response = await fetch(`${API_URL}/api/health`);
    
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Server health check failed' },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error checking server health:', error);
    return NextResponse.json(
      { error: 'Failed to connect to game server' },
      { status: 500 }
    );
  }
} 