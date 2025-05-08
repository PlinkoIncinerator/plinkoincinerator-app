import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const risk = searchParams.get('risk') || 'medium';
    
    
    const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
    const response = await fetch(`${API_URL}/api/plinko/config?risk=${risk}`);
    
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch plinko configuration' },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching plinko configuration:', error);
    return NextResponse.json(
      { error: 'Failed to connect to game server' },
      { status: 500 }
    );
  }
} 