import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { betAmount, clientSeed, riskLevel } = body;
    
    if (!betAmount || !clientSeed) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
    const response = await fetch(`${API_URL}/api/plinko/path`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        betAmount,
        clientSeed,
        riskLevel: riskLevel || 'medium'
      }),
    });
    
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to generate game path' },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error generating game path:', error);
    return NextResponse.json(
      { error: 'Failed to connect to game server' },
      { status: 500 }
    );
  }
} 