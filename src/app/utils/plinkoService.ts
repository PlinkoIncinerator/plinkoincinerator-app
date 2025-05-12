'use client';

import { io, Socket } from 'socket.io-client';
import { getSocketIoConfig } from './apiConfig';

export interface GameState {
  clientSeed: string;
  hashedServerSeed: string;
  serverSeed?: string;
  balance: number;
  isPlaying: boolean;
  nonce?: number;
  gameHistory: GameResult[];
  multipliers?: {
    low: number[];
    medium: number[];
    high: number[];
  };
  houseEdge?: number;
}

export interface GameOptions {
  betAmount: number;
  // riskMode: 'low' | 'medium' | 'high';
  riskMode: 'medium';
  rows?: number;
  isAuto: boolean;
}

export interface GameResult {
  clientSeed: string;
  serverSeed: string;
  hashedServerSeed: string;
  nonce: number;
  gameResult: number;
  path: number[];
  finalMultiplier: number;
  betAmount: number;
  winAmount: number;
  balance: number;
  timestamp?: number;
  // riskMode: 'low' | 'medium' | 'high';
  riskMode: 'medium';
  rows: number;
  isTestMode?: boolean;
}

// Default multipliers as fallback (will be overridden by server values)
export const DEFAULT_MULTIPLIERS = {
  low: [1.6, 1.4, 1.2, 1.1, 1.0, 0.9, 0.7, 0.5, 0.3, 0.5, 0.7, 0.9, 1.0, 1.1, 1.2, 1.4, 1.6],
  medium: [5.8, 3.2, 2.1, 1.4, 1.0, 0.7, 0.5, 0.3, 0.2, 0.3, 0.5, 0.7, 1.0, 1.4, 2.1, 3.2, 5.8],
  high: [130, 42, 10.5, 4.8, 2.5, 1.6, 1.0, 0.7, 0.3, 0.7, 1.0, 1.6, 2.5, 4.8, 10.5, 42, 130]
};

export class PlinkoService {
  private socket: Socket | null = null;
  private listeners: Map<string, ((data: any) => void)[]> = new Map();
  private multipliers = DEFAULT_MULTIPLIERS;
  private houseEdge = 0.035; // Default house edge (3.5%)
  
  constructor() {
    // No need to store server URL, we'll use the apiConfig utility
  }
  
  // Connect to the server
  connect(): Promise<GameState> {
    return new Promise((resolve, reject) => {
      try {
        console.log('Attempting to connect to Plinko server');
        // Get socket.io configuration
        const socketConfig = getSocketIoConfig();
        
        // First clean up any existing socket connection
        if (this.socket) {
          console.log('Cleaning up existing socket connection');
          this.socket.disconnect();
          this.socket = null;
        }
        
        // Connect to the same host as the frontend, Next.js will proxy this
        this.socket = io(socketConfig.url, socketConfig.options);

        console.log('Socket config:', socketConfig);
        console.log('Socket instance created, connecting...');
        
        // Debug logging for socket transport state
        this.socket.on('reconnect_attempt', (attempt) => {
          console.log(`Socket.IO reconnect attempt #${attempt}`);
        });
        
        this.socket.on('reconnecting', (attemptNumber) => {
          console.log(`Socket.IO reconnecting... Attempt #${attemptNumber}`);
        });
        
        this.socket.io.on('reconnect_error', (error) => {
          console.error('Socket.IO reconnect error:', error);
        });
        
        this.socket.io.on('packet', (data) => {
          console.log('Socket.IO packet received:', data.type);
        });
        
        // Fetch multipliers from server
        this.fetchMultipliers()
          .then(multiplierData => {
            console.log('Retrieved multipliers from server:', multiplierData);
            if (multiplierData.multipliers) {
              this.multipliers = multiplierData.multipliers;
            }
            if (multiplierData.houseEdge && multiplierData.houseEdge.medium) {
              this.houseEdge = multiplierData.houseEdge.medium;
            }
          })
          .catch(error => {
            console.log('Failed to fetch multipliers from server, using defaults:', error);
          });
        
        // Set up event listeners
        this.socket.on('connect', () => {
          console.log('Connected to Plinko server, socket ID:', this.socket?.id);
          console.log('Socket transport:', this.socket?.io.engine.transport.name);
          
          // Notify when transport changes (polling -> websocket)
          this.socket?.io.engine.on('upgrade', (transport) => {
            console.log('Socket transport upgraded to:', transport);
          });
        });
        
        this.socket.on('disconnect', (reason) => {
          console.log('Disconnected from Plinko server:', reason);
          this.notifyListeners('disconnect', { reason });
        });
        
        this.socket.on('connect_error', (error) => {
          console.error('Connection error to Plinko server:', error);
          reject(error);
        });
        
        // Handle game initialization
        this.socket.on('game:init', (data: any) => {
          console.log('Game initialized with data:', data);
          const gameState: GameState = {
            clientSeed: data.clientSeed,
            hashedServerSeed: data.hashedServerSeed,
            balance: data.balance,
            isPlaying: false,
            gameHistory: [],
            multipliers: this.multipliers,
            houseEdge: this.houseEdge
          };
          
          resolve(gameState);
          this.notifyListeners('game:init', gameState);
        });
        
        // Handle reconnect event - notify listeners that we've reconnected
        this.socket.on('reconnect', (attemptNumber) => {
          console.log(`Reconnected to Plinko server after ${attemptNumber} attempts`);
          this.notifyListeners('reconnect', { attemptNumber });
        });
        
        // Handle game results
        this.socket.on('game:result', (data: any) => {
          console.log('Game result received:', data);
          this.notifyListeners('game:result', data);
        });
        
        // Handle errors
        this.socket.on('game:error', (data: any) => {
          console.error('Game error from server:', data);
          this.notifyListeners('game:error', data);
        });
        
        // Handle seed changes
        this.socket.on('game:new-seed', (data: any) => {
          console.log('New seed received:', data);
          this.notifyListeners('game:new-seed', data);
        });
        
        this.socket.on('game:reveal-seed', (data: any) => {
          console.log('Revealed seed received:', data);
          this.notifyListeners('game:reveal-seed', data);
        });
        
        // Handle balance updates
        this.socket.on('balance:update', (data: any) => {
          console.log('Balance update received:', data);
          this.notifyListeners('balance:update', data);
        });
        
        // Set a connection timeout
        const connectionTimeout = setTimeout(() => {
          if (!this.socket?.connected) {
            console.error('Socket connection timed out');
            reject(new Error('Connection timed out'));
          }
        }, 15000); // 15 second timeout
        
        // Clear timeout on connect
        this.socket.on('connect', () => {
          clearTimeout(connectionTimeout);
        });
        
      } catch (error) {
        console.error('Exception during socket connection:', error);
        reject(error);
      }
    });
  }
  
  // Fetch multipliers from server
  private async fetchMultipliers(): Promise<any> {
    try {

      console.log('Fetching multipliers from server');
      // Use the API config utility to build the URL
      const response = await fetch('/api/multipliers');
      console.log('Multipliers response:', response);
      if (!response.ok) {
        throw new Error('Failed to fetch multipliers');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching multipliers:', error);
      throw error;
    }
  }
  
  // Get multipliers for a specific risk mode
  getMultipliers(riskMode: 'low' | 'medium' | 'high'): number[] {
    return this.multipliers[riskMode];
  }
  
  // Connect wallet to the server
  connectWallet(walletAddress: string): void {
    if (!this.socket) {
      console.error('Not connected to server, cannot connect wallet');
      throw new Error('Not connected to the Plinko server');
    }
    
    if (!walletAddress) {
      console.error('No wallet address provided');
      return;
    }
    
    console.log('Connecting wallet to Plinko server:', walletAddress);
    this.socket.emit('wallet:connect', { walletAddress });
  }
  
  // Disconnect from the server
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
  
  // Play a game
  play(options: GameOptions): void {
    if (!this.socket) {
      console.error('Not connected to server, cannot play');
      throw new Error('Not connected to the Plinko server');
    }
    
    // Validate the bet amount
    if (!options.betAmount || options.betAmount <= 0) {
      console.error('Invalid bet amount:', options.betAmount);
      throw new Error('Bet amount must be greater than 0');
    }
    
    console.log('Emitting game:play event with options:', options);
    // Send play request without rows - the backend will use its fixed value
    const playOptions = {
      betAmount: options.betAmount,
      riskMode: options.riskMode,
      isAuto: options.isAuto
    };
    this.socket.emit('game:play', playOptions);
  }
  
  // Request a new server seed
  requestNewServerSeed(): void {
    if (!this.socket) {
      throw new Error('Not connected to the Plinko server');
    }
    
    this.socket.emit('game:new-server-seed');
  }
  
  // Update the client seed
  updateClientSeed(clientSeed: string): void {
    if (!this.socket) {
      throw new Error('Not connected to the Plinko server');
    }
    
    this.socket.emit('game:new-client-seed', { clientSeed });
  }
  
  // Add an event listener
  on(event: string, callback: (data: any) => void): void {
    const callbacks = this.listeners.get(event) || [];
    callbacks.push(callback);
    this.listeners.set(event, callbacks);
  }
  
  // Remove an event listener
  off(event: string, callback: (data: any) => void): void {
    const callbacks = this.listeners.get(event) || [];
    const index = callbacks.indexOf(callback);
    
    if (index !== -1) {
      callbacks.splice(index, 1);
      this.listeners.set(event, callbacks);
    }
  }
  
  // Notify all listeners for an event
  private notifyListeners(event: string, data: any): void {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(callback => callback(data));
  }
  
  // Verify a game result based on client seed, server seed, etc.
  async verifyGameResult(result: GameResult): Promise<boolean> {
    try {
      // Use the API config utility to build the URL
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientSeed: result.clientSeed,
          serverSeed: result.serverSeed,
          nonce: result.nonce,
          path: result.path,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to verify result with server');
      }
      
      const data = await response.json();
      return data.verified === true;
    } catch (error) {
      console.error('Error verifying game result:', error);
      return false;
    }
  }
  
  // Force reconnection to the server
  reconnect(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        console.log('Forcing socket reconnection...');
        if (this.socket) {
          console.log('Disconnecting existing socket...');
          this.socket.disconnect();
          this.socket = null;
        }
        
        // Wait a moment before reconnecting to ensure clean state
        await new Promise(r => setTimeout(r, 1000));
        
        // Create a new connection
        console.log('Creating new socket connection...');
        const gameState = await this.connect();
        console.log('Reconnected successfully');
        
        // If reconnection was successful, notify listeners
        this.notifyListeners('reconnect', { success: true });
        
        resolve();
      } catch (error) {
        console.error('Reconnection failed:', error);
        reject(error);
      }
    });
  }
  
  // Refresh game state after reconnection
  async refreshGameState(): Promise<GameState | null> {
    if (!this.socket) {
      console.error('Not connected to server, cannot refresh game state');
      return null;
    }
    
    return new Promise((resolve, reject) => {
      this.socket!.emit('game:refresh', {}, (response: any) => {
        if (response.error) {
          console.error('Error refreshing game state:', response.error);
          reject(response.error);
          return;
        }
        
        console.log('Game state refreshed:', response);
        const gameState: GameState = {
          clientSeed: response.clientSeed,
          hashedServerSeed: response.hashedServerSeed,
          balance: response.balance || 0,
          isPlaying: false,
          gameHistory: response.gameHistory || [],
          multipliers: this.multipliers,
          houseEdge: this.houseEdge
        };
        
        this.notifyListeners('game:refresh', gameState);
        resolve(gameState);
      });
    });
  }
  
  // Check if the socket is connected
  isConnected(): boolean {
    return this.socket !== null && this.socket.connected;
  }
}

// Create a singleton instance to share across components
let plinkoServiceInstance: PlinkoService | null = null;

// Function to get the singleton instance
export function getPlinkoService(): PlinkoService {
  if (!plinkoServiceInstance) {
    console.log('Creating new PlinkoService singleton instance');
    plinkoServiceInstance = new PlinkoService();
  }
  return plinkoServiceInstance;
} 