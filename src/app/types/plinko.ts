export interface PlinkoConfig {
  // Basic configuration
  rows: number;
  columns: number;
  buckets: number;
  houseEdge: number;
  
  // Multipliers array for client-side display
  multipliers: number[];
  
  // Canvas and rendering settings
  canvasWidth: number;
  canvasHeight: number;
  pegRadius: number;
  ballRadius: number;
  wallThickness: number;
  bucketHeight: number;
  bucketDividerWidth: number;
  
  // Physics settings
  gravity: { x: number; y: number };
  forceMagnitude: number;
  ballRestitution: number;
  ballFriction: number;
  ballFrictionAir: number;
  ballDensity: number;
  
  // Visual settings
  ballColor: string;
  ballStrokeColor: string;
  ballStrokeWidth: number;
  fadeInterval: number;
  checkInterval: number;
  
  // Available options
  availableRows: number[];
  riskLevels: {
    id: string;
    name: string;
  }[];
  
  // Bucket color rules based on multiplier values
  bucketColors: {
    threshold: number;
    color: string;
  }[];
}

export interface RiskLevel {
  id: string;
  name: string;
}

export interface BucketColorRule {
  threshold: number;
  color: string;
}

/**
 * Game result from the server
 */
export interface GameResult {
  gameId: string;
  bucket: number;
  path: number[];
  multiplier: number;
  payout: number;
  nonce: number;
  clientSeed?: string;
  revealedSeed?: string;
} 