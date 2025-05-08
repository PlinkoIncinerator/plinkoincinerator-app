import { GameResult } from "../types/plinko";
import { PlinkoConfig } from "../types/plinko";

/**
 * Client for interacting with the Plinko API
 */
export const PlinkoApi = {
  /**
   * Get server health status
   */
  async getHealth(): Promise<{ status: string; message: string }> {
    console.log('Checking server health...');
    try {
      const response = await fetch('/api/plinko/health');
      console.log('Health check response status:', response.status);
      
      if (!response.ok) {
        console.error('Health check failed:', response.statusText);
        throw new Error(`Failed to fetch server health: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Health check response data:', data);
      return data;
    } catch (error) {
      console.error('Health check error:', error);
      throw error;
    }
  },

  /**
   * Get plinko game configuration from the server
   * This includes multipliers, number of rows, and other game settings
   */
  async getConfig(riskLevel: string = 'medium'): Promise<PlinkoConfig> {
    console.log('Fetching plinko game configuration...');
    console.log('Using risk level:', riskLevel);
    console.log('API URL from env:', process.env.NEXT_PUBLIC_API_URL);
    
    // TEMPORARY: Use hardcoded URL for debugging
    const hardcodedUrl = '/api/plinko/config?risk=' + riskLevel;
    console.log('Using hardcoded URL:', hardcodedUrl);
    
    try {
      const response = await fetch(hardcodedUrl);
      console.log('Config response status:', response.status);
      
      if (!response.ok) {
        console.error('Config fetch failed:', response.statusText);
        throw new Error(`Failed to fetch game configuration: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Plinko configuration:', data);
      return data;
    } catch (error) {
      console.error('Config fetch error:', error);
      throw error;
    }
  },

  /**
   * Get the current server seed hash for provable fairness
   */
  async getServerSeedHash(): Promise<{ serverSeedHash: string }> {
    console.log('Fetching server seed hash...');
    try {
      const response = await fetch('/api/plinko/seed');
      
      if (!response.ok) {
        console.error('Seed hash fetch failed:', response.statusText);
        throw new Error(`Failed to fetch server seed hash: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Server seed hash:', data);
      return data;
    } catch (error) {
      console.error('Seed hash fetch error:', error);
      throw error;
    }
  },

  /**
   * Generate a new plinko game result from the backend
   * @param betAmount Amount wagered
   * @param riskLevel Risk level (determines the multipliers)
   */
  async generateGameResult(
    betAmount: number, 
    riskLevel: string = 'medium'
  ): Promise<GameResult> {
    console.log(`Generating game result: bet=${betAmount}, risk=${riskLevel}`);
    
    // Generate a client seed for this game
    const clientSeed = crypto.randomUUID();
    
    const requestBody = {
      betAmount,
      clientSeed,
      riskLevel
    };
    
    console.log('Request payload:', requestBody);

    try {
      const response = await fetch('/api/plinko/path', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      console.log('Game result response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Game result error:', errorText);
        throw new Error(`Failed to generate game result: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Game result data:', data);
      
      // Save the client seed and server details for verification
      localStorage.setItem(`plinko-game-${data.gameId}`, JSON.stringify({
        clientSeed,
        gameId: data.gameId,
        nonce: data.nonce,
        timestamp: Date.now()
      }));
      
      return {
        ...data,
        clientSeed
      };
    } catch (error) {
      console.error('Game result request error:', error);
      throw error;
    }
  },
  
  /**
   * Verify a game result for provable fairness
   * @param gameId ID of the game to verify
   */
  async verifyGame(gameId: string): Promise<any> {
    console.log(`Verifying game result: id=${gameId}`);
    
    // Retrieve the saved game data
    const savedGameData = localStorage.getItem(`plinko-game-${gameId}`);
    
    if (!savedGameData) {
      throw new Error('Game data not found for verification');
    }
    
    const { clientSeed } = JSON.parse(savedGameData);
    
    const requestBody = {
      gameId,
      clientSeed
    };
    
    console.log('Verification request payload:', requestBody);

    try {
      const response = await fetch('/api/plinko/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      console.log('Verification response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Verification error:', errorText);
        throw new Error(`Failed to verify game result: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Verification data:', data);
      return data;
    } catch (error) {
      console.error('Verification request error:', error);
      throw error;
    }
  }
};
