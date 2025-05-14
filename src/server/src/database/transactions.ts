import pool from './db';
import { ensureDatabaseExists } from './dbInitialization';
import { runMigrations } from './migrations';

interface DepositRecord {
  id?: number;
  wallet_address: string;
  signature: string;
  fee_signature?: string;
  amount: number;
  timestamp: Date;
  is_gambling: boolean;
  is_processed: boolean;
  swapped_value?: number; // Amount of SOL from token swaps
}

interface GameResultRecord {
  id?: number;
  wallet_address: string;
  bet_amount: number;
  win_amount: number;
  final_multiplier: number;
  risk_mode: string;
  server_seed: string;
  client_seed: string;
  nonce: number;
  timestamp: Date;
  path?: number[];
}

interface TransactionRecord {
  id?: number;
  wallet_address: string;
  signature: string;
  amount: number;
  type: 'deposit' | 'withdrawal' | 'game_win' | 'game_bet';
  timestamp: Date;
  status: 'pending' | 'completed' | 'failed';
  description?: string;
}

interface BuybackRecord {
  id?: number;
  amount_burned: number;
  amount_buyback: number;
  transaction_signature?: string;
  timestamp: Date;
  status: 'pending' | 'completed' | 'failed';
}

// New interfaces for the referral system
interface SocialConnection {
  id?: number;
  wallet_address: string;
  provider: string;
  provider_id?: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  created_at?: Date;
}

interface ReferralCode {
  id?: number;
  wallet_address: string;
  referral_code: string;
  username: string;
  created_at?: Date;
}

interface ReferralUse {
  id?: number;
  referrer_wallet: string;
  referred_wallet: string;
  created_at?: Date;
}

interface ReferralDeposit {
  id?: number;
  referral_use_id: number;
  deposit_id: number;
  amount: number;
  referrer_reward: number;
  created_at?: Date;
}

/**
 * Create the deposits table if it doesn't exist
 */
export async function initializeDatabase() {
  try {
    await ensureDatabaseExists();
    const client = await pool.connect();
    try {
      // Create the deposits table
      await client.query(`
        CREATE TABLE IF NOT EXISTS deposits (
          id SERIAL PRIMARY KEY,
          wallet_address TEXT NOT NULL,
          signature TEXT UNIQUE NOT NULL,
          fee_signature TEXT,
          amount DECIMAL(18, 9) NOT NULL,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          is_gambling BOOLEAN DEFAULT FALSE,
          is_processed BOOLEAN DEFAULT TRUE
        );
      `);
      
      // Create index on wallet_address for faster lookups
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_deposits_wallet_address
        ON deposits(wallet_address);
      `);
      
      // Create index on signature for uniqueness checks
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_deposits_signature
        ON deposits(signature);
      `);
      
      // Create game results table for tracking play history
      await client.query(`
        CREATE TABLE IF NOT EXISTS game_results (
          id SERIAL PRIMARY KEY,
          wallet_address TEXT NOT NULL,
          bet_amount DECIMAL(18, 9) NOT NULL,
          win_amount DECIMAL(18, 9) NOT NULL,
          final_multiplier DECIMAL(10, 6) NOT NULL,
          risk_mode TEXT NOT NULL,
          server_seed TEXT NOT NULL,
          client_seed TEXT NOT NULL,
          nonce INTEGER NOT NULL,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          path INTEGER[] DEFAULT NULL
        );
      `);
      
      // Create index on wallet_address for faster lookups in game_results
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_game_results_wallet_address
        ON game_results(wallet_address);
      `);
      
      // Create transactions table for all financial transactions
      await client.query(`
        CREATE TABLE IF NOT EXISTS transactions (
          id SERIAL PRIMARY KEY,
          wallet_address TEXT NOT NULL,
          signature TEXT UNIQUE NOT NULL,
          amount DECIMAL(18, 9) NOT NULL,
          type TEXT NOT NULL,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          status TEXT NOT NULL,
          description TEXT
        );
      `);
      
      // Create index on wallet_address for faster lookups in transactions
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_transactions_wallet_address
        ON transactions(wallet_address);
      `);
      
      // Create index on signature for uniqueness checks
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_transactions_signature
        ON transactions(signature);
      `);

      // Create buyback tracking table
      await client.query(`
        CREATE TABLE IF NOT EXISTS buybacks (
          id SERIAL PRIMARY KEY,
          amount_burned DECIMAL(18, 9) NOT NULL,
          amount_buyback DECIMAL(18, 9) NOT NULL,
          transaction_signature TEXT,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          status TEXT NOT NULL
        );
      `);

      // Create buyback_accumulator table to track burn progress towards next buyback
      await client.query(`
        CREATE TABLE IF NOT EXISTS buyback_accumulator (
          id SERIAL PRIMARY KEY,
          current_accumulated DECIMAL(18, 9) NOT NULL DEFAULT 0,
          buyback_threshold DECIMAL(18, 9) NOT NULL DEFAULT 0.2,
          buyback_percentage DECIMAL(5, 2) NOT NULL DEFAULT 3.0,
          last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Initialize the accumulator if it doesn't exist
      await client.query(`
        INSERT INTO buyback_accumulator (current_accumulated, buyback_threshold, buyback_percentage)
        SELECT 0, 0.2, 3.0
        WHERE NOT EXISTS (SELECT 1 FROM buyback_accumulator);
      `);
      
      // Create social_connections table
      await client.query(`
        CREATE TABLE IF NOT EXISTS social_connections (
          id SERIAL PRIMARY KEY,
          wallet_address TEXT,
          provider TEXT NOT NULL,
          provider_id TEXT,
          username TEXT NOT NULL,
          display_name TEXT,
          avatar_url TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      // Create index on wallet_address for faster lookups in social_connections
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_social_connections_wallet_address
        ON social_connections(wallet_address);
      `);
      
      // Create index on username+provider for uniqueness checks
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_social_connections_username_provider
        ON social_connections(username, provider);
      `);
      
      // Create referral_codes table
      await createReferralCodesTable(client);
      
      // Create referral_uses table
      await client.query(`
        CREATE TABLE IF NOT EXISTS referral_uses (
          id SERIAL PRIMARY KEY,
          referrer_wallet TEXT NOT NULL,
          referred_wallet TEXT NOT NULL UNIQUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      // Create index on referrer_wallet for faster lookups in referral_uses
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_referral_uses_referrer
        ON referral_uses(referrer_wallet);
      `);
      
      // Create index on referred_wallet for uniqueness checks
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_referral_uses_referred
        ON referral_uses(referred_wallet);
      `);
      
      // Create referral_deposits table
      await client.query(`
        CREATE TABLE IF NOT EXISTS referral_deposits (
          id SERIAL PRIMARY KEY,
          referral_use_id INTEGER REFERENCES referral_uses(id),
          deposit_id INTEGER REFERENCES deposits(id),
          amount DECIMAL(18, 9) NOT NULL,
          referrer_reward DECIMAL(18, 9) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      // Create index on referral_use_id for faster lookups
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_referral_deposits_use_id
        ON referral_deposits(referral_use_id);
      `);
      
      // Create index on deposit_id for uniqueness
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_referral_deposits_deposit_id
        ON referral_deposits(deposit_id);
      `);
      
      // Create referral_rewards table to track pending and claimed rewards
      await client.query(`
        CREATE TABLE IF NOT EXISTS referral_rewards (
          id SERIAL PRIMARY KEY,
          wallet_address TEXT NOT NULL,
          amount DECIMAL(18, 9) NOT NULL,
          is_claimed BOOLEAN DEFAULT FALSE,
          claimed_at TIMESTAMP WITH TIME ZONE,
          claim_transaction TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      // Create index on wallet_address for faster lookups in referral_rewards
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_referral_rewards_wallet
        ON referral_rewards(wallet_address);
      `);


      // plinkoincinerator-db  | 2025-05-14 17:51:20.451 UTC [3399] STATEMENT:  INSERT INTO shared_images (wallet_address, image_url, recovered_sol, created_at) VALUES ($1, $2, $3, NOW())
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS shared_images (
          id SERIAL PRIMARY KEY,
          wallet_address TEXT NOT NULL,
          image_url TEXT NOT NULL,
          recovered_sol DECIMAL(18, 9) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create index on wallet_address for faster lookups in shared_images
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_shared_images_wallet_address 
        ON shared_images(wallet_address);
      `);

      console.log('Database initialized - all tables ready');
    } finally {
      client.release();
    }
    
    // Run migrations after tables are created
    await runMigrations();
    
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Create the referral_codes table if it doesn't exist
 */
const createReferralCodesTable = async (client: any) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS referral_codes (
      id SERIAL PRIMARY KEY,
      wallet_address TEXT,
      referral_code TEXT UNIQUE NOT NULL,
      username TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // Create index on wallet_address for faster lookups in referral_codes
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_referral_codes_wallet_address
    ON referral_codes(wallet_address);
  `);
  
  // Create index on referral_code for uniqueness checks
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_referral_codes_code
    ON referral_codes(referral_code);
  `);

  // Create index on username for lookups
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_referral_codes_username
    ON referral_codes(username);
  `);
}

/**
 * Save a transaction record to the database
 */
export async function saveTransaction(transaction: TransactionRecord): Promise<TransactionRecord> {
  try {
    const client = await pool.connect();
    try {
      const { wallet_address, signature, amount, type, status, description } = transaction;
      
      const result = await client.query(
        `INSERT INTO transactions 
         (wallet_address, signature, amount, type, status, description) 
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [wallet_address, signature, amount, type, status, description]
      );
      
      return result.rows[0];
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Failed to save transaction:', error);
    throw error;
  }
}

/**
 * Get transaction history for a wallet address
 */
export async function getWalletTransactions(walletAddress: string, limit: number = 50): Promise<TransactionRecord[]> {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM transactions WHERE wallet_address = $1 ORDER BY timestamp DESC LIMIT $2',
        [walletAddress, limit]
      );
      
      return result.rows;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Failed to get wallet transactions:', error);
    throw error;
  }
}

/**
 * Get wallet balance summary
 */
export async function getWalletBalanceSummary(walletAddress: string): Promise<{
  totalDeposits: number;
  totalWithdrawals: number;
  totalGameWins: number;
  totalGameLosses: number;
  currentBalance: number;
}> {
  console.log(`[DB] Getting balance summary for wallet: ${walletAddress}`);
  console.log(`[DB] Current pool status - Total: ${pool.totalCount}, Idle: ${pool.idleCount}, Waiting: ${pool.waitingCount}`);
  
  let client;
  try {
    console.log(`[DB] Attempting to connect to database for wallet ${walletAddress}`);
    client = await pool.connect();
    console.log(`[DB] Successfully acquired database client for wallet ${walletAddress}`);
    
    try {
      console.log(`[DB] Executing balance query for wallet ${walletAddress}`);
      const startTime = Date.now();
      
      const result = await client.query(
        `SELECT 
          COALESCE(SUM(CASE WHEN t.type = 'deposit' AND d.is_gambling = true THEN t.amount ELSE 0 END), 0) as total_deposits,
          COALESCE(SUM(CASE WHEN t.type = 'withdrawal' THEN t.amount ELSE 0 END), 0) as total_withdrawals,
          COALESCE(SUM(CASE WHEN t.type = 'game_win' THEN t.amount ELSE 0 END), 0) as total_game_wins,
          COALESCE(SUM(CASE WHEN t.type = 'game_bet' THEN t.amount ELSE 0 END), 0) as total_game_losses
        FROM transactions t
        LEFT JOIN deposits d ON t.signature = d.signature
        WHERE t.wallet_address = $1 AND t.status = 'completed'`,
        [walletAddress]
      );
      
      const queryTime = Date.now() - startTime;
      console.log(`[DB] Balance query completed in ${queryTime}ms for wallet ${walletAddress}`);

      // Don't log the entire result object which can cause issues
      console.log(`[DB] Successfully retrieved balance summary for ${walletAddress}`);
      
      const summary = result.rows[0];
      
      // Calculate current balance
      const totalDeposits = parseFloat(summary.total_deposits) || 0;
      const totalWithdrawals = parseFloat(summary.total_withdrawals) || 0;
      const totalGameWins = parseFloat(summary.total_game_wins) || 0;
      const totalGameLosses = parseFloat(summary.total_game_losses) || 0;
      
      const currentBalance = totalDeposits - totalWithdrawals + totalGameWins - totalGameLosses;
      
      console.log(`[DB] Balance components for ${walletAddress}: Deposits=${totalDeposits}, Withdrawals=${totalWithdrawals}, Wins=${totalGameWins}, Losses=${totalGameLosses}`);
      console.log(`[DB] Final calculated balance for ${walletAddress}: ${currentBalance}`);
      
      return {
        totalDeposits,
        totalWithdrawals,
        totalGameWins,
        totalGameLosses,
        currentBalance
      };
    } finally {
      // Make sure to release the client even if there's an error
      if (client) {
        try {
          console.log(`[DB] Releasing database client for wallet ${walletAddress}`);
          client.release();
          console.log(`[DB] Successfully released database client for wallet ${walletAddress}`);
        } catch (releaseError) {
          console.error(`[DB] Error releasing database client for wallet ${walletAddress}:`, releaseError);
        }
      }
    }
  } catch (error) {
    console.error(`[DB] Failed to get wallet balance summary for ${walletAddress}:`, error);
    // Return a default balance summary if there's a database error
    // This allows the application to continue functioning
    return {
      totalDeposits: 0,
      totalWithdrawals: 0,
      totalGameWins: 0,
      totalGameLosses: 0,
      currentBalance: 0
    };
  }
}

/**
 * Save a deposit record to the database
 */
export async function saveDeposit(deposit: DepositRecord): Promise<DepositRecord> {
  try {
    const client = await pool.connect();
    try {
      const { wallet_address, signature, fee_signature, amount, is_gambling, is_processed, swapped_value } = deposit;
      
      const result = await client.query(
        `INSERT INTO deposits 
         (wallet_address, signature, fee_signature, amount, is_gambling, is_processed, swapped_value) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [wallet_address, signature, fee_signature, amount, is_gambling, is_processed, swapped_value || 0]
      );
      
      return result.rows[0];
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Failed to save deposit:', error);
    throw error;
  }
}

/**
 * Save a game result to the database
 */
export async function saveGameResult(result: GameResultRecord): Promise<GameResultRecord> {
  try {
    const client = await pool.connect();
    try {
      const { 
        wallet_address, 
        bet_amount, 
        win_amount, 
        final_multiplier, 
        risk_mode, 
        server_seed, 
        client_seed, 
        nonce,
        path
      } = result;
      
      const dbResult = await client.query(
        `INSERT INTO game_results 
         (wallet_address, bet_amount, win_amount, final_multiplier, risk_mode, server_seed, client_seed, nonce, path) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [wallet_address, bet_amount, win_amount, final_multiplier, risk_mode, server_seed, client_seed, nonce, path]
      );
      
      return dbResult.rows[0];
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Failed to save game result:', error);
    throw error;
  }
}

/**
 * Get game results for a wallet
 */
export async function getWalletGameResults(walletAddress: string, limit: number = 50): Promise<GameResultRecord[]> {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM game_results WHERE wallet_address = $1 ORDER BY timestamp DESC LIMIT $2',
        [walletAddress, limit]
      );
      
      return result.rows;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Failed to get wallet game results:', error);
    throw error;
  }
}

/**
 * Get statistical summary for a wallet
 */
export async function getWalletStats(walletAddress: string): Promise<{
  totalBets: number;
  totalWagered: number;
  totalWon: number;
  netProfit: number;
  biggestWin: number;
  biggestMultiplier: number;
}> {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT 
          COUNT(*) as total_bets,
          SUM(bet_amount) as total_wagered,
          SUM(win_amount) as total_won,
          SUM(win_amount - bet_amount) as net_profit,
          MAX(win_amount) as biggest_win,
          MAX(final_multiplier) as biggest_multiplier
        FROM game_results 
        WHERE wallet_address = $1`,
        [walletAddress]
      );
      
      const stats = result.rows[0];
      
      return {
        totalBets: parseInt(stats.total_bets) || 0,
        totalWagered: parseFloat(stats.total_wagered) || 0,
        totalWon: parseFloat(stats.total_won) || 0,
        netProfit: parseFloat(stats.net_profit) || 0,
        biggestWin: parseFloat(stats.biggest_win) || 0,
        biggestMultiplier: parseFloat(stats.biggest_multiplier) || 0
      };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Failed to get wallet stats:', error);
    throw new Error(`Failed to get wallet stats: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Check if a transaction signature already exists in the database
 */
export async function transactionExists(signature: string): Promise<boolean> {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT EXISTS(SELECT 1 FROM deposits WHERE signature = $1)', 
        [signature]
      );
      
      return result.rows[0].exists;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Failed to check if transaction exists:', error);
    throw error;
  }
}

/**
 * Get all deposits for a wallet address
 */
export async function getWalletDeposits(walletAddress: string): Promise<DepositRecord[]> {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM deposits WHERE wallet_address = $1 ORDER BY timestamp DESC',
        [walletAddress]
      );
      
      return result.rows;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Failed to get wallet deposits:', error);
    throw error;
  }
}

/**
 * Get total gambling deposits for a wallet
 */
export async function getWalletGamblingTotal(walletAddress: string): Promise<number> {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT SUM(amount) AS total FROM deposits WHERE wallet_address = $1 AND is_gambling = true',
        [walletAddress]
      );
      
      return parseFloat(result.rows[0]?.total || '0');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Failed to get wallet gambling total:', error);
    throw error;
  }
}

/**
 * Mark a deposit as processed
 */
export async function markDepositProcessed(signature: string, processed: boolean = true): Promise<boolean> {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'UPDATE deposits SET is_processed = $1 WHERE signature = $2 RETURNING *',
        [processed, signature]
      );
      
      return result.rows.length > 0;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Failed to mark deposit as processed:', error);
    throw error;
  }
}

/**
 * Get metrics for the Plinko game dashboard
 */
export async function getPlinkoMetrics(): Promise<{
  totalSolBurned: number;
  totalBallsDropped: number;
  totalSolWon: number;
  totalSolLost: number;
  biggestWin: number;
  activePlayers: number;
}> {
  try {
    const client = await pool.connect();
    try {
      // Get total games played (total balls dropped)
      const gamesResult = await client.query('SELECT COUNT(*) as total_games FROM game_results');
      const totalGames = parseInt(gamesResult.rows[0]?.total_games) || 0;
      
      // Get total SOL burned (sum of all deposits marked for gambling)
      const burnedResult = await client.query('SELECT SUM(amount) as total_burned FROM deposits');
      const totalBurned = parseFloat(burnedResult.rows[0]?.total_burned) || 0;
      
      // Get total SOL won
      const wonResult = await client.query('SELECT SUM(win_amount) as total_won FROM game_results');
      const totalWon = parseFloat(wonResult.rows[0]?.total_won) || 0;
      
      // Get total SOL lost (total bets)
      const lostResult = await client.query('SELECT SUM(bet_amount) as total_bets FROM game_results');
      const totalBets = parseFloat(lostResult.rows[0]?.total_bets) || 0;
      
      // Get biggest win
      const bigWinResult = await client.query('SELECT MAX(win_amount) as biggest_win FROM game_results');
      const biggestWin = parseFloat(bigWinResult.rows[0]?.biggest_win) || 0;
      
      // Get active players (unique players in the last hour)
      const activePlayersResult = await client.query(
        'SELECT COUNT(DISTINCT wallet_address) as active_players FROM game_results WHERE timestamp > NOW() - INTERVAL \'1 hour\''
      );
      const activePlayers = parseInt(activePlayersResult.rows[0]?.active_players) || 0;
      
      return {
        totalSolBurned: totalBurned,
        totalBallsDropped: totalGames,
        totalSolWon: totalWon,
        totalSolLost: totalBets - totalWon, // Net losses
        biggestWin: biggestWin,
        activePlayers: activePlayers
      };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Failed to get Plinko metrics:', error);
    // Return default values in case of error
    return {
      totalSolBurned: 0,
      totalBallsDropped: 0,
      totalSolWon: 0,
      totalSolLost: 0,
      biggestWin: 0,
      activePlayers: 0
    };
  }
}

/**
 * Track burned tokens and trigger buyback if threshold reached
 * @param burnAmount The amount of tokens that were burned
 * @returns Object containing whether a buyback was triggered and the buyback amount
 */
export async function trackBurnForBuyback(burnAmount: number): Promise<{
  buybackTriggered: boolean;
  buybackAmount: number;
}> {
  try {
    const client = await pool.connect();
    try {
      // Start a transaction
      await client.query('BEGIN');

      // Get the current accumulator state
      const accResult = await client.query('SELECT * FROM buyback_accumulator LIMIT 1');
      if (accResult.rows.length === 0) {
        throw new Error('Buyback accumulator not initialized');
      }

      const accumulator = accResult.rows[0];
      const newAccumulated = parseFloat(accumulator.current_accumulated) + burnAmount;
      const threshold = parseFloat(accumulator.buyback_threshold);
      const percentage = parseFloat(accumulator.buyback_percentage) / 100; // Convert to decimal

      // Update the accumulator with the new burn
      await client.query(
        'UPDATE buyback_accumulator SET current_accumulated = $1, last_updated = NOW() WHERE id = $2',
        [newAccumulated, accumulator.id]
      );

      let buybackTriggered = false;
      let buybackAmount = 0;

      // Check if we've reached the threshold
      if (newAccumulated >= threshold) {
        // Calculate how many full thresholds we've reached
        const thresholdCount = Math.floor(newAccumulated / threshold);
        const totalBuybackAmount = thresholdCount * threshold * percentage;
        
        // Create a buyback record
        await client.query(
          'INSERT INTO buybacks (amount_burned, amount_buyback, status) VALUES ($1, $2, $3)',
          [thresholdCount * threshold, totalBuybackAmount, 'pending']
        );

        // Update the accumulator to remove the processed amount
        const remainingAmount = newAccumulated - (thresholdCount * threshold);
        await client.query(
          'UPDATE buyback_accumulator SET current_accumulated = $1 WHERE id = $2',
          [remainingAmount, accumulator.id]
        );

        buybackTriggered = true;
        buybackAmount = totalBuybackAmount;
      }

      // Commit the transaction
      await client.query('COMMIT');

      return {
        buybackTriggered,
        buybackAmount
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Failed to track burn for buyback:', error);
    throw error;
  }
}

/**
 * Update a buyback record with transaction signature after processing
 */
export async function updateBuybackRecord(id: number, signature: string, status: 'completed' | 'failed'): Promise<BuybackRecord | null> {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'UPDATE buybacks SET transaction_signature = $1, status = $2 WHERE id = $3 RETURNING *',
        [signature, status, id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Failed to update buyback record:', error);
    throw error;
  }
}

/**
 * Get the latest pending buyback that needs processing
 */
export async function getPendingBuyback(): Promise<BuybackRecord | null> {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM buybacks WHERE status = $1 ORDER BY timestamp ASC LIMIT 1',
        ['pending']
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Failed to get pending buyback:', error);
    throw error;
  }
}

/**
 * Get buyback statistics
 */
export async function getBuybackStats(): Promise<{
  totalBurned: number;
  totalBuybacks: number;
  pendingBuybacks: number;
  lastBuybackAmount: number;
  lastBuybackTimestamp: Date | null;
  currentAccumulator: number;
  buybackThreshold: number;
  buybackPercentage: number;
}> {
  try {
    const client = await pool.connect();
    try {
      // Get total amounts
      const totalResult = await client.query(`
        SELECT 
          COALESCE(SUM(amount_burned), 0) as total_burned, 
          COALESCE(SUM(amount_buyback), 0) as total_buybacks,
          COUNT(*) FILTER (WHERE status = 'pending') as pending_count
        FROM buybacks
      `);

      // Get last completed buyback
      const lastBuybackResult = await client.query(`
        SELECT amount_buyback, timestamp 
        FROM buybacks 
        WHERE status = 'completed' 
        ORDER BY timestamp DESC 
        LIMIT 1
      `);

      // Get current accumulator state
      const accumulatorResult = await client.query('SELECT * FROM buyback_accumulator LIMIT 1');

      const stats = {
        totalBurned: parseFloat(totalResult.rows[0]?.total_burned || '0'),
        totalBuybacks: parseFloat(totalResult.rows[0]?.total_buybacks || '0'),
        pendingBuybacks: parseInt(totalResult.rows[0]?.pending_count || '0'),
        lastBuybackAmount: lastBuybackResult.rows.length > 0 ? parseFloat(lastBuybackResult.rows[0].amount_buyback) : 0,
        lastBuybackTimestamp: lastBuybackResult.rows.length > 0 ? lastBuybackResult.rows[0].timestamp : null,
        currentAccumulator: parseFloat(accumulatorResult.rows[0]?.current_accumulated || '0'),
        buybackThreshold: parseFloat(accumulatorResult.rows[0]?.buyback_threshold || '0.2'),
        buybackPercentage: parseFloat(accumulatorResult.rows[0]?.buyback_percentage || '3.0')
      };

      return stats;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Failed to get buyback stats:', error);
    throw error;
  }
}

/**
 * Save social connection to database and generate/retrieve referral code
 */
export async function saveSocialConnection(socialData: SocialConnection): Promise<{ referralCode: string; username: string }> {
  try {
    const client = await pool.connect();
    try {
      // Start a transaction
      await client.query('BEGIN');

      const { wallet_address, provider, provider_id, username, display_name, avatar_url } = socialData;
      
      // Check if this social connection already exists
      const existingResult = await client.query(
        'SELECT * FROM social_connections WHERE provider = $1 AND username = $2',
        [provider, username]
      );
      
      let socialConnectionId;
      let existingWalletAddress = null;
      
      if (existingResult.rows.length > 0) {
        // Get existing connection data
        const existingConnection = existingResult.rows[0];
        socialConnectionId = existingConnection.id;
        existingWalletAddress = existingConnection.wallet_address;
        
        // Update existing connection if wallet address is provided
        if (wallet_address && (!existingWalletAddress || existingWalletAddress !== wallet_address)) {
          await client.query(
            'UPDATE social_connections SET wallet_address = $1, display_name = $2, avatar_url = $3 WHERE id = $4',
            [wallet_address, display_name, avatar_url, existingConnection.id]
          );
        } else if (display_name || avatar_url) {
          // Update display name or avatar if changed
          await client.query(
            'UPDATE social_connections SET display_name = $1, avatar_url = $2 WHERE id = $3',
            [display_name, avatar_url, existingConnection.id]
          );
        }
      } else {
        // Insert new social connection
        const result = await client.query(
          `INSERT INTO social_connections 
           (wallet_address, provider, provider_id, username, display_name, avatar_url) 
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [wallet_address, provider, provider_id, username, display_name, avatar_url]
        );
        
        socialConnectionId = result.rows[0].id;
      }
      
      // Get or generate referral code
      let referralCode;
      
      // First, check if this social connection already has a referral code linked
      // Check if user already has a referral code based on social identity first
      const socialCodeResult = await client.query(
        `SELECT rc.referral_code 
         FROM referral_codes rc
         JOIN social_connections sc ON rc.username = sc.username
         WHERE sc.provider = $1 AND sc.username = $2`,
        [provider, username]
      );
      
      if (socialCodeResult.rows.length > 0) {
        referralCode = socialCodeResult.rows[0].referral_code;
      }
      
      // Then check if the wallet has a referral code (if a wallet is provided)
      if (!referralCode && wallet_address) {
        const walletCodeResult = await client.query(
          'SELECT referral_code FROM referral_codes WHERE wallet_address = $1',
          [wallet_address]
        );
        
        if (walletCodeResult.rows.length > 0) {
          referralCode = walletCodeResult.rows[0].referral_code;
        }
      }
      
      // If no code found, generate a new one based on username
      if (!referralCode) {
        // Base the code on the username
        let baseCode = username.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (baseCode.length > 6) {
          baseCode = baseCode.substring(0, 6);
        } else if (baseCode.length < 3) {
          baseCode = baseCode.padEnd(3, 'X');
        }
        
        // Add some random characters for uniqueness
        const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
        referralCode = `${baseCode}-${randomChars}`;
        
        // Check if this code is already taken, if so, try again with different random chars
        let isUnique = false;
        let attempts = 0;
        const maxAttempts = 5;
        
        while (!isUnique && attempts < maxAttempts) {
          const codeCheckResult = await client.query(
            'SELECT id FROM referral_codes WHERE referral_code = $1',
            [referralCode]
          );
          
          if (codeCheckResult.rows.length === 0) {
            isUnique = true;
          } else {
            const newRandomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
            referralCode = `${baseCode}-${newRandomChars}`;
            attempts++;
          }
        }
        
        // Save the referral code
        await client.query(
          'INSERT INTO referral_codes (wallet_address, referral_code, username) VALUES ($1, $2, $3)',
          [wallet_address, referralCode, username]
        );
      }
      
      // Commit the transaction
      await client.query('COMMIT');
      
      return { referralCode, username };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Failed to save social connection:', error);
    throw error;
  }
}

/**
 * Get social connections for a wallet
 */
export async function getWalletSocialConnections(walletAddress: string): Promise<SocialConnection[]> {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM social_connections WHERE wallet_address = $1',
        [walletAddress]
      );
      
      return result.rows;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Failed to get wallet social connections:', error);
    throw error;
  }
}

/**
 * Generate or retrieve a referral code for a wallet
 */
export async function getWalletReferralCode(walletAddress: string): Promise<string | null> {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT referral_code FROM referral_codes WHERE wallet_address = $1',
        [walletAddress]
      );
      
      return result.rows.length > 0 ? result.rows[0].referral_code : null;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Failed to get wallet referral code:', error);
    throw error;
  }
}

/**
 * Apply a referral code for a wallet
 * This is called when a user enters someone else's referral code
 */
export async function applyReferralCode(referralCode: string, walletAddress: string): Promise<boolean> {
  try {
    const client = await pool.connect();
    
    // First, check if the referral code exists
    const referralResult = await client.query(
      'SELECT id, wallet_address FROM referral_codes WHERE referral_code = $1',
      [referralCode]
    );
    
    if (referralResult.rows.length === 0) {
      console.log(`Referral code ${referralCode} not found`);
      client.release();
      return false;
    }
    
    const referralId = referralResult.rows[0].id;
    const referrerWallet = referralResult.rows[0].wallet_address;
    
    // Make sure the user isn't referring themselves
    if (referrerWallet === walletAddress) {
      console.log(`User ${walletAddress} attempted to use their own referral code`);
      client.release();
      return false;
    }
    
    // Check if this wallet has already been referred
    const existingReferralResult = await client.query(
      'SELECT id FROM referral_uses WHERE referred_wallet = $1',
      [walletAddress]
    );
    
    if (existingReferralResult.rows.length > 0) {
      console.log(`Wallet ${walletAddress} already has a referrer`);
      client.release();
      return false;
    }
    
    // Add the referral use
    await client.query(
      'INSERT INTO referral_uses (referrer_wallet, referred_wallet) VALUES ($1, $2)',
      [referrerWallet, walletAddress]
    );
    
    console.log(`Applied referral code ${referralCode} for wallet ${walletAddress}`);
    client.release();
    return true;
  } catch (error) {
    console.error('Error applying referral code:', error);
    return false;
  }
}

/**
 * Get all wallets referred by a specific wallet
 */
export async function getWalletReferrals(walletAddress: string): Promise<{ referred_wallet: string; created_at: Date }[]> {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT referred_wallet, created_at FROM referral_uses WHERE referrer_wallet = $1 ORDER BY created_at DESC',
        [walletAddress]
      );
      
      return result.rows;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Failed to get wallet referrals:', error);
    throw error;
  }
}

/**
 * Get the total available and claimed referral rewards for a wallet
 */
export async function getWalletReferralRewards(walletAddress: string): Promise<{
  availableRewards: number;
  claimedRewards: number;
}> {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT 
          SUM(CASE WHEN is_claimed = FALSE THEN amount ELSE 0 END) as available,
          SUM(CASE WHEN is_claimed = TRUE THEN amount ELSE 0 END) as claimed
        FROM referral_rewards
        WHERE wallet_address = $1`,
        [walletAddress]
      );
      
      return {
        availableRewards: parseFloat(result.rows[0]?.available || '0'),
        claimedRewards: parseFloat(result.rows[0]?.claimed || '0')
      };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Failed to get wallet referral rewards:', error);
    throw error;
  }
}

/**
 * Claim referral rewards for a wallet
 */
export async function claimReferralRewards(walletAddress: string, amount: number): Promise<boolean> {
  try {
    const client = await pool.connect();
    try {
      // Start transaction
      await client.query('BEGIN');
      
      // Check available balance
      const balanceResult = await client.query(
        `SELECT SUM(amount) as available
        FROM referral_rewards
        WHERE wallet_address = $1 AND is_claimed = FALSE`,
        [walletAddress]
      );
      
      const availableBalance = parseFloat(balanceResult.rows[0]?.available || '0');
      
      if (availableBalance < amount) {
        await client.query('ROLLBACK');
        return false; // Insufficient balance
      }
      
      // Get rewards to claim, starting with oldest first
      const rewardsResult = await client.query(
        `SELECT id, amount
        FROM referral_rewards
        WHERE wallet_address = $1 AND is_claimed = FALSE
        ORDER BY created_at ASC`,
        [walletAddress]
      );
      
      // Mark rewards as claimed
      let remainingAmount = amount;
      for (const reward of rewardsResult.rows) {
        if (remainingAmount <= 0) break;
        
        const rewardId = reward.id;
        const rewardAmount = parseFloat(reward.amount);
        
        if (rewardAmount <= remainingAmount) {
          // Claim the full reward
          await client.query(
            `UPDATE referral_rewards
            SET is_claimed = TRUE, claimed_at = NOW()
            WHERE id = $1`,
            [rewardId]
          );
          
          remainingAmount -= rewardAmount;
        } else {
          // Split the reward - claim part and leave the rest
          await client.query(
            `UPDATE referral_rewards
            SET amount = $1
            WHERE id = $2`,
            [rewardAmount - remainingAmount, rewardId]
          );
          
          // Create a new record for the claimed portion
          await client.query(
            `INSERT INTO referral_rewards
            (wallet_address, amount, is_claimed, claimed_at)
            VALUES ($1, $2, TRUE, NOW())`,
            [walletAddress, remainingAmount]
          );
          
          remainingAmount = 0;
        }
      }
      
      // Commit the transaction
      await client.query('COMMIT');
      
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Failed to claim referral rewards:', error);
    throw error;
  }
}

/**
 * Add a referral deposit
 * Called when a referred user makes a deposit
 */
export async function addReferralDeposit(depositId: number, amount: number): Promise<boolean> {
  try {
    const client = await pool.connect();
    
    // Get the deposit details
    const depositResult = await client.query(
      'SELECT wallet_address FROM deposits WHERE id = $1',
      [depositId]
    );
    
    if (depositResult.rows.length === 0) {
      console.log(`Deposit ${depositId} not found`);
      client.release();
      return false;
    }
    
    const userWallet = depositResult.rows[0].wallet_address;
    
    // Check if this user was referred
    const referralResult = await client.query(
      `SELECT ru.id as referral_use_id, rc.wallet_address as referrer_wallet 
       FROM referral_uses ru 
       JOIN referral_codes rc ON ru.referrer_wallet = rc.wallet_address 
       WHERE ru.referred_wallet = $1`,
      [userWallet]
    );
    
    if (referralResult.rows.length === 0) {
      console.log(`User ${userWallet} was not referred by anyone`);
      client.release();
      return false;
    }
    
    const referralUseId = referralResult.rows[0].referral_use_id;
    const referrerWallet = referralResult.rows[0].referrer_wallet;
    const referralRate = 0.2; // Default to 20%
    
    // Calculate the referral reward (20% of the house profit)
    const houseProfit = amount * 0.021; // 2.1% house fee
    const referralReward = houseProfit * referralRate;
    
    // Add the referral deposit record
    await client.query(
      `INSERT INTO referral_deposits
       (referral_use_id, deposit_id, amount, referrer_reward)
       VALUES ($1, $2, $3, $4)`,
      [referralUseId, depositId, amount, referralReward]
    );
    
    // Add the reward to referral_rewards for the referrer
    await client.query(
      `INSERT INTO referral_rewards
       (wallet_address, amount)
       VALUES ($1, $2)`,
      [referrerWallet, referralReward]
    );
    
    console.log(`Added referral reward of ${referralReward} SOL for referrer ${referrerWallet} from deposit ${depositId}`);
    client.release();
    return true;
  } catch (error) {
    console.error('Error adding referral reward:', error);
    return false;
  }
}

/**
 * Get referral information for a wallet
 */
export async function getWalletReferralInfo(walletAddress: string): Promise<{
  referralCode: string | null;
  referrals: { referred_wallet: string; created_at: Date }[];
  availableRewards: number;
  claimedRewards: number;
  totalEarned: number;
}> {
  try {
    const code = await getWalletReferralCode(walletAddress);
    const referrals = await getWalletReferrals(walletAddress);
    const rewards = await getWalletReferralRewards(walletAddress);
    
    return {
      referralCode: code,
      referrals,
      availableRewards: rewards.availableRewards,
      claimedRewards: rewards.claimedRewards,
      totalEarned: rewards.availableRewards + rewards.claimedRewards
    };
  } catch (error) {
    console.error('Failed to get wallet referral info:', error);
    throw error;
  }
}
