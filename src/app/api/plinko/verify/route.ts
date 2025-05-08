import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { gameId, clientSeed, serverSeed, nonce, rows } = body;
    
    if (!gameId && (!clientSeed || !serverSeed || !nonce || !rows)) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
    const response = await fetch(`${API_URL}/api/plinko/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        gameId,
        clientSeed,
        serverSeed,
        nonce,
        rows
      }),
    });
    
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to verify game result' },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error verifying game result:', error);
    return NextResponse.json(
      { error: 'Failed to connect to game server' },
      { status: 500 }
    );
  }
} 