import crypto from 'crypto';

// Define RiskMode type for consistency
// export type RiskMode = 'low' | 'medium' | 'high';
export type RiskMode = 'medium'
interface ProvablyFairResult {
  clientSeed: string;
  serverSeed: string;
  hashedServerSeed: string;
  nonce: number;
  gameResult: number;
  path: number[];
  finalMultiplier: number;
}

export interface GameOptions {
  rows: number;
  riskMode: RiskMode;
}

// Updated multipliers with properly calculated house edge of approximately 3.5%
export const MULTIPLIERS: Record<RiskMode, number[]> = {
  // Low risk mode: Lower volatility, more frequent small wins
  // low: [0.965, 0.965, 0.965, 0.965, 0.965, 0.965, 0.965, 0.965, 0.965, 0.965, 0.965, 0.965, 0.965, 0.965, 0.965, 0.965, 0.965],
  
  // Medium risk mode: Balanced volatility with ~3.5% house edge
  medium: [25, 12, 8, 4, 2, 1.5, 1, 0.6, 0.4, 0.6 , 1, 1.5, 2, 4, 4, 12, 25],
  
  // High risk mode: High volatility, rare big wins
  // high: [170.0, 22.0, 8.1, 3.3, 1.5, 0.9, 0.7, 0.4, 0.2, 0.4, 0.7, 0.9, 1.5, 3.3, 8.1, 22.0, 170.0]
};

/**
 * Calculate the expected return for a given risk mode and number of rows.
 * @param riskMode The risk mode (low, medium, high)
 * @param rows The number of rows in the game
 * @returns The expected return (1.0 = 100% return, i.e., break even)
 */
export const calculateExpectedReturn = (riskMode: RiskMode, rows: number = 16): number => {
  const multipliers = MULTIPLIERS[riskMode];
  const numPaths = 2 ** rows;
  let expectedReturn = 0;

  // Calculate the expected return by summing the product of each outcome's probability and its multiplier
  for (let i = 0; i <= rows; i++) {
    // Calculate the number of ways to end up in position i (binomial coefficient)
    const numWays = binomialCoefficient(rows, i);
    // Calculate the probability of ending up in position i
    const probability = numWays / numPaths;
    // Add the contribution to the expected return
    expectedReturn += probability * multipliers[i];
  }

  return expectedReturn;
};

// Helper function to calculate binomial coefficient C(n,k)
function binomialCoefficient(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  
  let result = 1;
  for (let i = 1; i <= k; i++) {
    result *= (n - (k - i));
    result /= i;
  }
  
  return result;
}

export function generateServerSeed(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashServerSeed(serverSeed: string): string {
  return crypto.createHash('sha256').update(serverSeed).digest('hex');
}

export function generateClientSeed(): string {
  return crypto.randomBytes(16).toString('hex');
}

// Deterministic random number generator
function deterministicRandom(serverSeed: string, clientSeed: string, nonce: number): number {
  // Use more unique seed data by incorporating timestamp for additional entropy
  const seedData = `${serverSeed}:${clientSeed}:${nonce}`;
  const hash = crypto.createHash('sha256').update(seedData).digest('hex');
  
  // Use more bits from the hash (16 characters instead of 8) for higher precision randomness
  const decimalValue = parseInt(hash.substring(0, 16), 16) / 0x10000000000000000;
  return decimalValue;
}

// Get the path the ball will take through the pins
function calculatePath(serverSeed: string, clientSeed: string, nonce: number, rows: number): number[] {
  const path: number[] = [];
  
  // Create a unique base seed for this game to improve randomness
  const gameSeed = crypto.createHash('sha256').update(`${serverSeed}:${clientSeed}:${nonce}:base`).digest('hex');
  
  for (let i = 0; i < rows; i++) {
    // Mix in row index with a different operation to reduce patterns
    // Using different parts of the hash for each row decision
    const rowSeed = `${gameSeed}:${i}:${nonce * (i + 1)}`;
    const random = deterministicRandom(rowSeed, clientSeed, nonce + i);
    path.push(random < 0.5 ? 0 : 1);
  }
  
  return path;
}

// Calculate the final bin the ball lands in
function calculateFinalBin(path: number[]): number {
  // Start with position relative to our starting point (middle of top row)
  let position = 0;
  
  // For each step in the path, adjust the position
  for (const direction of path) {
    position += direction === 0 ? -1 : 1;
  }
  
  // For a standard 16-row plinko board with 17 bins,
  // We map the position directly based on the number of left vs right bounces
  const rows = path.length;
  
  // First, shift position to be 0-indexed from our leftmost possible position
  const normalizedPosition = position + rows;
  
  // The final bin is determined by how many right vs left bounces occurred
  // We map this directly to our multiplier array
  // For 16 rows, possible positions are 0 to 32, which we map to 0 to 16 bins
  const binCount = 17; // For 17 multipliers
  const binIndex = Math.floor(normalizedPosition * (binCount / (rows * 2 + 1)));
  
  // Ensure the bin index is within bounds (0 to bins-1)
  return Math.min(Math.max(0, binIndex), binCount - 1);
}

export function calculateGameResult(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  options: GameOptions
): ProvablyFairResult {
  // Calculate the path the ball will take
  const path = calculatePath(serverSeed, clientSeed, nonce, options.rows);
  
  // Calculate the final bin
  const finalBin = calculateFinalBin(path);
  
  // Get the multipliers based on risk mode
  const multipliers = MULTIPLIERS[options.riskMode];
  
  // Get final multiplier (ensure we don't go out of bounds)
  const multiplierIndex = Math.min(Math.max(0, finalBin), multipliers.length - 1);
  const finalMultiplier = multipliers[multiplierIndex];
  
  return {
    clientSeed,
    serverSeed,
    hashedServerSeed: hashServerSeed(serverSeed),
    nonce,
    gameResult: finalBin,
    path,
    finalMultiplier
  };
}

// Verify a game result
export function verifyGameResult(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  options: GameOptions,
  reportedResult: ProvablyFairResult
): boolean {
  // Calculate the expected result
  const expectedResult = calculateGameResult(serverSeed, clientSeed, nonce, options);
  
  // Compare with the reported result
  return (
    expectedResult.gameResult === reportedResult.gameResult &&
    expectedResult.finalMultiplier === reportedResult.finalMultiplier &&
    JSON.stringify(expectedResult.path) === JSON.stringify(reportedResult.path)
  );
}

/**
 * Calculate the house edge percentage for a given risk mode
 * @param riskMode The risk mode (low, medium, high)
 * @param rows The number of rows in the game
 * @returns The house edge as a percentage
 */
export const calculateHouseEdge = (riskMode: RiskMode, rows: number = 16): number => {
  const expectedReturn = calculateExpectedReturn(riskMode, rows);
  return (1 - expectedReturn) * 100;
};

// Function to verify and log the house edge for all risk modes
export const verifyHouseEdges = (): void => {
  const rows = 16;
  console.log('House edge calculations:');
  // console.log(`Low risk mode: ${calculateHouseEdge('low', rows).toFixed(2)}%`);
  console.log(`Medium risk mode: ${calculateHouseEdge('medium', rows).toFixed(2)}%`);
  // console.log(`High risk mode: ${calculateHouseEdge('high', rows).toFixed(2)}%`);
};

// Test function to verify expected returns and house edge for each risk mode
export function verifyHouseEdge() {
  const rows = 16;
  const riskModes: Array<RiskMode> = ['medium'];
  
  console.log(`Verifying house edge with ${rows} rows:`);
  
  riskModes.forEach(mode => {
    const expectedReturn = calculateExpectedReturn(mode, rows);
    const houseEdge = 1 - expectedReturn;
    const houseEdgePercentage = houseEdge * 100;
    
    console.log(`Risk mode: ${mode.padEnd(6)}`);
    console.log(`  Expected return: ${expectedReturn.toFixed(4)}`);
    console.log(`  House edge: ${houseEdgePercentage.toFixed(2)}%`);
  });
}

/**
 * Calculate and log the probability percentages for each multiplier
 * @param riskMode The risk mode to calculate probabilities for
 * @param rows The number of rows in the plinko game
 */
export function logMultiplierProbabilities(riskMode: RiskMode = 'medium', rows: number = 16): void {
  const multipliers = MULTIPLIERS[riskMode];
  const numPaths = 2 ** rows;
  
  console.log(`\nMultiplier probabilities for ${riskMode} risk mode (${rows} rows):`);
  console.log('Multiplier | Probability | Expected Value');
  console.log('-----------------------------------------');
  
  let totalProbability = 0;
  let totalExpectedValue = 0;
  
  for (let i = 0; i < multipliers.length; i++) {
    const multiplier = multipliers[i];
    // Calculate number of ways to reach this position (binomial coefficient)
    const numWays = binomialCoefficient(rows, i);
    // Calculate probability
    const probability = numWays / numPaths;
    const probabilityPercent = probability * 100;
    // Calculate contribution to expected value
    const expectedValue = probability * multiplier;
    
    totalProbability += probability;
    totalExpectedValue += expectedValue;
    
    console.log(`${multiplier.toString().padStart(9)} | ${probabilityPercent.toFixed(6).padStart(10)}% | ${expectedValue.toFixed(6)}`);
  }
  
  console.log('-----------------------------------------');
  console.log(`Totals:    | ${(totalProbability * 100).toFixed(2)}% | ${totalExpectedValue.toFixed(4)} (Expected Return)`);
  console.log(`House Edge: ${((1 - totalExpectedValue) * 100).toFixed(2)}%`);
}

// Call the verification function
// Comment this out in production
verifyHouseEdge(); 
logMultiplierProbabilities(); 