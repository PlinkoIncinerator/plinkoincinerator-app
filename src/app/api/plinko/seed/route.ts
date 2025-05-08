import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
    const response = await fetch(`${API_URL}/api/plinko/seed`);
    
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch server seed hash' },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching server seed hash:', error);
    return NextResponse.json(
      { error: 'Failed to connect to game server' },
      { status: 500 }
    );
  }
} 