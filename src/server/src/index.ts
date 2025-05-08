// @ts-ignore
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { 
  generateServerSeed, 
  generateClientSeed, 
  hashServerSeed, 
  calculateGameResult, 
  verifyGameResult,
  GameOptions,
  calculateExpectedReturn,
  MULTIPLIERS
} from './utils/provableFairness';
import {
  verifyDeposit,
  processWithdrawal,
  getUserBalance,
  deductBalance,
  addBalance,
  getFeeWalletAddress,
  FEE_PERCENTAGE,
  userBalances
} from './utils/solanaWallet';
import { 
  initializeDatabase, 
  saveDeposit, 
  transactionExists, 
  getWalletDeposits, 
  getWalletGamblingTotal,
  saveGameResult,
  getWalletGameResults,
  getWalletStats,
  saveTransaction,
  getWalletTransactions,
  getWalletBalanceSummary,
  getPlinkoMetrics,
  trackBurnForBuyback,
  getBuybackStats
} from './database/transactions';
import pool from './database/db';
import buybackService from './utils/buybackService';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['DNT', 'User-Agent', 'X-Requested-With', 'If-Modified-Since', 'Cache-Control', 'Content-Type', 'Range', 'Authorization']
  },
  path: '/api/socket/io/',
  transports: ['websocket'],
  pingInterval: 25000,
  pingTimeout: 20000,
  connectTimeout: 20000,
  cookie: {
    name: 'plinko_io',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  }
});

// Initialize the database
initializeDatabase()
  .then(() => console.log('Database initialized successfully'))
  .catch(err => console.error('Failed to initialize database:', err));

// Store user state
interface UserState {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  balance: number;
  walletAddress?: string;
  depositSignatures?: string[];
  previousServerSeed?: string;
}

const userStates = new Map<string, UserState>();

// Middleware
app.use(cors());
app.use(express.json());

// API routes
app.get('/api/health', (req: any, res: any) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'Plinko server is running',
    feeWalletAddress: getFeeWalletAddress() 
  });
});

// New endpoint: Get multipliers and game configuration
app.get('/api/multipliers', (req: any, res: any) => {
  // Get the multipliers from the provable fairness module
  const risk = req.query.risk as 'low' | 'medium' | 'high' || 'medium';
  
  // Calculate expected return (RTP) for each risk level
  const expectedReturns = {
    // low: calculateExpectedReturn('low'),
    medium: calculateExpectedReturn('medium'),
    // high: calculateExpectedReturn('high')
  };
  
  // House edge is 1 - RTP
  const houseEdge = {
    // low: 1 - expectedReturns.low,
    medium: 1 - expectedReturns.medium,
    // high: 1 - expectedReturns.high
  };
  
  res.status(200).json({
    status: 'ok',
    multipliers: {
      // low: MULTIPLIERS.low,
      medium: MULTIPLIERS.medium,
      // high: MULTIPLIERS.high
    },
    expectedReturns,
    houseEdge,
    defaultRows: 16,
    defaultRisk: 'medium'
  });
});

// Provable fairness API
app.get('/api/verify', (req: any, res: any) => {
  const { serverSeed, clientSeed, nonce, riskMode, rows, result } = req.query;
  
  if (!serverSeed || !clientSeed || !nonce || !riskMode || !rows || !result) {
    return res.status(400).json({ status: 'error', message: 'Missing parameters' });
  }
  
  try {
    const options: GameOptions = {
      rows: parseInt(rows as string),
      riskMode: riskMode as 'medium'
    };
    
    const verified = verifyGameResult(
      serverSeed as string,
      clientSeed as string,
      parseInt(nonce as string),
      options,
      JSON.parse(result as string)
    );
    
    res.status(200).json({ status: 'ok', verified });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Verification failed', error: String(error) });
  }
});

// New endpoint: Get the fee wallet address
app.get('/api/fee-wallet', (req: any, res: any) => {
  res.status(200).json({ 
    address: getFeeWalletAddress(),
    feePercentage: 0.021
  });
});

// New endpoint: Get user gambling history
app.get('/api/gambling-history/:walletAddress', async (req: any, res: any) => {
  const { walletAddress } = req.params;
  
  if (!walletAddress) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Missing wallet address' 
    });
  }
  
  try {
    // Get all deposits for this wallet that were marked for gambling
    const deposits = await getWalletDeposits(walletAddress);
    const gamblingDeposits = deposits.filter((deposit: { is_gambling: boolean }) => deposit.is_gambling);
    
    // Get total gambling amount
    const totalGambling = await getWalletGamblingTotal(walletAddress);
    
    return res.status(200).json({
      status: 'success',
      data: {
        deposits: gamblingDeposits,
        totalDeposits: gamblingDeposits.length,
        totalAmount: totalGambling
      }
    });
  } catch (error) {
    console.error('Error retrieving gambling history:', error);
    return res.status(500).json({
      status: 'error',
      message: `Server error: ${error instanceof Error ? error.message : String(error)}`
    });
  }
});

// New endpoint: Get user game history
app.get('/api/game-history/:walletAddress', async (req: any, res: any) => {
  const { walletAddress } = req.params;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
  
  if (!walletAddress) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Missing wallet address' 
    });
  }
  
  try {
    // Get game results for this wallet
    const gameResults = await getWalletGameResults(walletAddress, limit);
    
    // Get statistical summary
    const stats = await getWalletStats(walletAddress);
    
    return res.status(200).json({
      status: 'success',
      data: {
        gameResults,
        stats
      }
    });
  } catch (error) {
    console.error('Error retrieving game history:', error);
    return res.status(500).json({
      status: 'error',
      message: `Server error: ${error instanceof Error ? error.message : String(error)}`
    });
  }
});

// New endpoint: Get user transaction history and balance
app.get('/api/transactions/:walletAddress', async (req: any, res: any) => {
  const { walletAddress } = req.params;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
  
  if (!walletAddress) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Missing wallet address' 
    });
  }
  
  try {
    // Get transaction history and balance summary for this wallet
    const transactions = await getWalletTransactions(walletAddress, limit);
    const balanceSummary = await getWalletBalanceSummary(walletAddress);
    
    return res.status(200).json({
      status: 'success',
      data: {
        transactions,
        balance: balanceSummary
      }
    });
  } catch (error) {
    console.error('Error retrieving transaction history:', error);
    return res.status(500).json({
      status: 'error',
      message: `Server error: ${error instanceof Error ? error.message : String(error)}`
    });
  }
});

// New endpoint: Verify token incineration transaction
app.post('/api/verify-transaction', async (req: any, res: any) => {
  const { walletAddress, signature, feeTransferSignature, directWithdraw, forGambling } = req.body;
  
  if (!walletAddress || !signature) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Missing wallet address or transaction signature' 
    });
  }
  
  try {
    console.log(`Verifying transaction: ${signature}`);
    if (feeTransferSignature) {
      console.log(`With fee transfer signature: ${feeTransferSignature}`);
    }
    
    // Log the withdrawal mode
    if (directWithdraw) {
      console.log(`Transaction is for direct withdrawal (97.9% to user)`);
    } else if (forGambling) {
      console.log(`Transaction is for gambling (97.9% to user)`);
    }
    
    // Check if transaction already exists in the database
    const txExists = await transactionExists(signature);
    if (txExists) {
      console.log('Transaction already processed and exists in the database');
      return res.status(400).json({
        status: 'error',
        message: 'Transaction already processed'
      });
    }
    
    const result = await verifyDeposit(walletAddress, signature, feeTransferSignature);
    
    console.log(result);
    
    if (result.success) {
      // Save the transaction to the database
      const isGambling = !!forGambling;
      const fullAmount = result.fullAmount || result.amount || 0;
      
      // For gambling, credit 97.9% to user balance, 2.1% retained by platform
      const amount = isGambling ? fullAmount * 0.979 : fullAmount;
      
      try {
        // Save deposit to database
        await saveDeposit({
          wallet_address: walletAddress,
          signature,
          fee_signature: feeTransferSignature,
          amount: fullAmount, // Store full amount in deposit record
          is_gambling: isGambling,
          is_processed: true,
          timestamp: new Date()
        });
        
        // Also save to transactions table
        await saveTransaction({
          wallet_address: walletAddress,
          signature,
          amount,
          type: 'deposit',
          status: 'completed',
          description: isGambling ? 'Deposit for gambling' : 'Regular deposit',
          timestamp: new Date()
        });
        
        console.log(`Saved deposit to database. Gambling: ${isGambling}, Amount: ${amount}`);

        // Track burn for buyback if this was a burning transaction
        if (isGambling) {
          const burnAmount = fullAmount * 0.021; // Only track the 2.1% fee for buyback
          console.log(`Tracking burn of ${burnAmount} SOL for buyback calculations`);
          const buybackResult = await trackBurnForBuyback(burnAmount);
          
          if (buybackResult.buybackTriggered) {
            console.log(`Buyback triggered! Amount to buyback: ${buybackResult.buybackAmount} SOL`);
            // In a real implementation, we would initiate the buyback process here
            // This might involve calling a separate service or queuing a job
          }
        }
      } catch (dbError) {
        console.error('Error saving deposit to database:', dbError);
        // We'll continue even if database save fails
      }
      
      // Get database balance for the response
      let databaseBalance;
      try {
        const balanceSummary = await getWalletBalanceSummary(walletAddress);
        databaseBalance = balanceSummary.currentBalance;
      } catch (dbError) {
        console.error('Error getting database balance:', dbError);
        // Fallback to in-memory balance
        databaseBalance = getUserBalance(walletAddress);
      }
      
      // If we have a user state for this wallet, update it
      for (const [socketId, state] of userStates.entries()) {
        if (state.walletAddress === walletAddress) {
          // Update the state with the database balance
          try {
            const balanceSummary = await getWalletBalanceSummary(walletAddress);
            state.balance = balanceSummary.currentBalance;
            userStates.set(socketId, state);
          } catch (dbError) {
            console.error('Error updating user state balance:', dbError);
            // Fallback to in-memory balance
            state.balance = getUserBalance(walletAddress);
            userStates.set(socketId, state);
          }
          
          // Add the transaction to the registry
          state.depositSignatures = state.depositSignatures || [];
          state.depositSignatures.push(signature);
          if (feeTransferSignature) {
            state.depositSignatures.push(feeTransferSignature);
          }
          
          // Notify client of updated balance
          io.to(socketId).emit('balance:update', { balance: state.balance });
        }
      }
      
      // For the response, we return the amount credited to user (97.9% for gambling)
      return res.status(200).json({
        status: 'success',
        message: 'Transaction verified successfully',
        amount: amount, // Use the calculated amount (97.9% for gambling)
        balance: databaseBalance
      });
    } else {
      return res.status(400).json({
        status: 'error',
        message: result.error || 'Failed to verify transaction'
      });
    }
  } catch (error) {
    console.error('Error verifying transaction:', error);
    return res.status(500).json({
      status: 'error',
      message: `Server error: ${error instanceof Error ? error.message : String(error)}`
    });
  }
});

// New endpoint: Process withdrawal
app.post('/api/withdraw', async (req: any, res: any) => {
  const { walletAddress, amount, directWithdraw } = req.body;
  
  if (!walletAddress || !amount) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Missing wallet address or amount' 
    });
  }
  
  try {
    console.log(`[API] Processing withdrawal request: ${amount} SOL for ${walletAddress}`);
    if (directWithdraw) {
      console.log('[API] This is a direct withdrawal (85% after fee)');
    }
    
    // Check database balance before processing withdrawal
    let databaseBalance;
    let useMemoryBalance = false;
    
    // Implement a retry mechanism for database operations
    const MAX_RETRIES = 3;
    let retryCount = 0;
    let dbError;
    
    while (retryCount < MAX_RETRIES) {
      try {
        console.log(`[API] Attempting to get balance from database for ${walletAddress} (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        const balanceSummary = await getWalletBalanceSummary(walletAddress);
        databaseBalance = balanceSummary.currentBalance;
        
        console.log(`[API] Database balance for ${walletAddress}: ${databaseBalance} SOL`);
        
        // Validate balance is sufficient (unless it's a direct withdrawal)
        if (!directWithdraw && parseFloat(amount) > databaseBalance) {
          return res.status(400).json({
            status: 'error',
            message: 'Insufficient balance in database'
          });
        }
        
        // If we reach here, we've successfully retrieved the balance
        break;
      } catch (error) {
        dbError = error;
        retryCount++;
        console.error(`[API] Error getting database balance (attempt ${retryCount}/${MAX_RETRIES}):`, error);
        
        if (retryCount < MAX_RETRIES) {
          // Wait before retrying (exponential backoff)
          const delay = 1000 * Math.pow(2, retryCount - 1);
          console.log(`[API] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // If we've exhausted all retries, use memory balance
    if (retryCount >= MAX_RETRIES) {
      console.log(`[API] Falling back to memory balance after ${MAX_RETRIES} failed database attempts`);
      useMemoryBalance = true;
      
      // Fallback to checking in-memory balance
      const memoryBalance = getUserBalance(walletAddress);
      console.log(`[API] Using memory balance for ${walletAddress}: ${memoryBalance} SOL`);
      
      if (!directWithdraw && parseFloat(amount) > memoryBalance) {
        return res.status(400).json({
          status: 'error',
          message: 'Insufficient balance'
        });
      }
    }
    
    console.log(`[API] Proceeding with withdrawal of ${amount} SOL for ${walletAddress}`);
    const result = await processWithdrawal(walletAddress, parseFloat(amount), !!directWithdraw);
    
    if (result.success) {
      console.log(`[API] Withdrawal processed successfully for ${walletAddress}, signature: ${result.signature}`);
      
      // Record the withdrawal in the transactions table
      let savedToDb = false;
      retryCount = 0;
      
      while (retryCount < MAX_RETRIES && !savedToDb) {
        try {
          console.log(`[API] Saving withdrawal record to database (attempt ${retryCount + 1}/${MAX_RETRIES})`);
          await saveTransaction({
            wallet_address: walletAddress,
            signature: result.signature || '',
            amount: parseFloat(amount),
            type: 'withdrawal',
            status: 'completed',
            description: directWithdraw ? 'Direct withdrawal' : 'Regular withdrawal',
            timestamp: new Date()
          });
          
          console.log(`[API] Saved withdrawal to transactions table: ${amount} SOL`);
          savedToDb = true;
        } catch (error) {
          retryCount++;
          console.error(`[API] Error saving withdrawal to database (attempt ${retryCount}/${MAX_RETRIES}):`, error);
          
          if (retryCount < MAX_RETRIES) {
            // Wait before retrying
            const delay = 1000 * Math.pow(2, retryCount - 1);
            console.log(`[API] Retrying database save in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      if (!savedToDb) {
        console.error(`[API] Failed to save withdrawal record after ${MAX_RETRIES} attempts, but withdrawal was processed`);
      }
      
      // Get updated database balance for the response
      let updatedDatabaseBalance;
      try {
        if (!useMemoryBalance) {
          console.log(`[API] Getting updated balance after withdrawal for ${walletAddress}`);
          const balanceSummary = await getWalletBalanceSummary(walletAddress);
          updatedDatabaseBalance = balanceSummary.currentBalance;
          console.log(`[API] Updated database balance: ${updatedDatabaseBalance}`);
        } else {
          // Use memory balance if database failed earlier
          updatedDatabaseBalance = getUserBalance(walletAddress);
          console.log(`[API] Using updated memory balance: ${updatedDatabaseBalance}`);
        }
      } catch (error) {
        console.error('[API] Error getting updated database balance:', error);
        // Fallback to in-memory balance
        updatedDatabaseBalance = getUserBalance(walletAddress);
        console.log(`[API] Fallback to memory balance: ${updatedDatabaseBalance}`);
      }
      
      // Update any user states for this wallet
      for (const [socketId, state] of userStates.entries()) {
        if (state.walletAddress === walletAddress) {
          try {
            // Use the balance we already calculated to avoid another database query
            console.log(`[API] Updating socket client ${socketId} with new balance for ${walletAddress}`);
            state.balance = updatedDatabaseBalance;
            userStates.set(socketId, state);
            
            // Notify client of updated balance
            io.to(socketId).emit('balance:update', { balance: state.balance });
            console.log(`[API] Notified client of updated balance: ${updatedDatabaseBalance}`);
          } catch (updateError) {
            console.error('[API] Error updating user state:', updateError);
          }
        }
      }
      
      return res.status(200).json({
        status: 'success',
        message: 'Withdrawal processed successfully',
        signature: result.signature,
        balance: updatedDatabaseBalance
      });
    } else {
      console.error(`[API] Withdrawal processing failed for ${walletAddress}: ${result.error}`);
      return res.status(400).json({
        status: 'error',
        message: result.error || 'Failed to process withdrawal'
      });
    }
  } catch (error) {
    console.error('[API] Unexpected error processing withdrawal:', error);
    return res.status(500).json({
      status: 'error',
      message: `Server error: ${error instanceof Error ? error.message : String(error)}`
    });
  }
});

// New endpoint: Get Plinko game metrics
app.get('/api/plinko/metrics', async (req: any, res: any) => {
  try {
    // Use the getPlinkoMetrics function from transactions module
    const metrics = await getPlinkoMetrics();
    
    // Return metrics with timestamp
    return res.status(200).json({
      ...metrics,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching plinko metrics:', error);
    return res.status(500).json({
      status: 'error',
      message: `Server error: ${error instanceof Error ? error.message : String(error)}`
    });
  }
});

// New endpoint: Get Plinko buyback metrics
app.get('/api/plinko/buybacks', async (req: any, res: any) => {
  try {
    // Use the getBuybackStats function from transactions module
    const stats = await getBuybackStats();
    
    // Return buyback metrics with timestamp
    return res.status(200).json({
      ...stats,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching buyback metrics:', error);
    return res.status(500).json({
      status: 'error',
      message: `Server error: ${error instanceof Error ? error.message : String(error)}`
    });
  }
});

// Socket events
io.on('connection', (socket: any) => {
  console.log(`New client connected: ${socket.id}`);
  
  // Initialize user state with a server seed and client seed
  const serverSeed = generateServerSeed();
  const clientSeed = generateClientSeed();
  
  userStates.set(socket.id, {
    serverSeed,
    clientSeed,
    nonce: 0,
    balance: 0 // Default starting balance will be updated from database when wallet connects
  });
  
  // Send initial seed data to client
  socket.emit('game:init', {
    hashedServerSeed: hashServerSeed(serverSeed),
    clientSeed,
    balance: 0 // Will be updated when wallet connects
  });
  
  // Link wallet address to socket
  socket.on('wallet:connect', async (data: any) => {
    const { walletAddress } = data;
    
    if (walletAddress) {
      const state = userStates.get(socket.id);
      if (state) {
        state.walletAddress = walletAddress;
        
        try {
          // Get balance from database instead of in-memory storage
          const balanceSummary = await getWalletBalanceSummary(walletAddress);
          state.balance = balanceSummary.currentBalance;
          
          // Update in-memory balance for consistency
          userBalances.set(walletAddress, balanceSummary.currentBalance);
          
          userStates.set(socket.id, state);
          
          // Send updated balance
          socket.emit('balance:update', { balance: state.balance });
        } catch (error) {
          console.error('Error accessing database balance:', error);
          // Fall back to in-memory balance if database query fails
          state.balance = getUserBalance(walletAddress);
          userStates.set(socket.id, state);
          socket.emit('balance:update', { balance: state.balance });
        }
      }
    }
  });
  
  // Handle client requesting a new server seed
  socket.on('game:new-server-seed', () => {
    const userState = userStates.get(socket.id);
    
    if (userState) {
      // Reveal the old server seed
      socket.emit('game:reveal-seed', {
        serverSeed: userState.serverSeed,
        hashedServerSeed: hashServerSeed(userState.serverSeed),
        nonce: userState.nonce
      });
      
      // Generate a new server seed
      const newServerSeed = generateServerSeed();
      userState.previousServerSeed = userState.serverSeed;
      userState.serverSeed = newServerSeed;
      userState.nonce = 0;
      
      userStates.set(socket.id, userState);
      
      // Send the new hashed server seed
      socket.emit('game:new-seed', {
        hashedServerSeed: hashServerSeed(newServerSeed)
      });
    }
  });
  
  // Handle client requesting to reveal a previous server seed
  socket.on('game:reveal-previous-seed', () => {
    const userState = userStates.get(socket.id);
    
    if (userState && userState.previousServerSeed) {
      socket.emit('game:reveal-previous-seed', {
        previousServerSeed: userState.previousServerSeed,
        hashedPreviousServerSeed: hashServerSeed(userState.previousServerSeed)
      });
    } else {
      socket.emit('game:error', { message: 'No previous server seed available' });
    }
  });
  
  // Handle client requesting a new client seed
  socket.on('game:new-client-seed', (data: any) => {
    const userState = userStates.get(socket.id);
    
    if (userState) {
      // Update the client seed
      userState.clientSeed = data.clientSeed || generateClientSeed();
      userState.nonce = 0;
      
      userStates.set(socket.id, userState);
      
      // Confirm new client seed
      socket.emit('game:new-seed', {
        clientSeed: userState.clientSeed
      });
    }
  });
  
  // Handle game play request
  socket.on('game:play', async (data: any) => {
    const userState = userStates.get(socket.id);
    
    if (!userState) {
      socket.emit('game:error', { message: 'User state not found' });
      return;
    }
    
    const { betAmount, riskMode, rows } = data;
    const walletAddress = userState.walletAddress;
    
    // Generate a unique game ID for tracking multiple simultaneous games
    const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Add entropy by refreshing the server seed every few games to prevent long streaks
    if (userState.nonce > 0 && userState.nonce % 5 === 0) {
      // Generate a new server seed for added unpredictability
      const newServerSeed = generateServerSeed();
      
      // Notify client about the new hashed server seed (keeping the old seed private until requested)
      socket.emit('game:seed-refreshed', {
        hashedServerSeed: hashServerSeed(newServerSeed),
        previousNonce: userState.nonce
      });
      
      // Store the old server seed to reveal later if requested
      userState.previousServerSeed = userState.serverSeed;
      userState.serverSeed = newServerSeed;
      
      console.log(`Game ${gameId} - Auto-refreshed server seed after ${userState.nonce} games`);
    }
    
    // Validate bet amount and balance
    if (betAmount <= 0) {
      socket.emit('game:error', { message: 'Invalid bet amount' });
      return;
    }
    
    // Debug log for tracking balance issues
    console.log(`[DEBUG] Game ${gameId} - Processing bet for socket ${socket.id}, wallet: ${walletAddress || 'unknown'}`);
    
    if (walletAddress) {
      try {
        // Use a retry mechanism for balance checks to avoid transient database issues
        let realBalance = 0;
        let balanceSuccess = false;
        const maxRetries = 3;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            // Get balance from database instead of in-memory map
            console.log(`[DEBUG] Game ${gameId} - Checking balance attempt ${attempt} of ${maxRetries}`);
            const balanceSummary = await getWalletBalanceSummary(walletAddress);
            realBalance = balanceSummary.currentBalance;
            balanceSuccess = true;
            console.log(`[DEBUG] Game ${gameId} - Database balance: ${realBalance}, Bet amount: ${betAmount}`);
            break; // Exit the retry loop on success
          } catch (balanceError) {
            console.error(`[ERROR] Game ${gameId} - Balance check attempt ${attempt} failed:`, balanceError);
            if (attempt < maxRetries) {
              // Wait before retrying (exponential backoff)
              const delay = 100 * Math.pow(2, attempt - 1);
              console.log(`[DEBUG] Game ${gameId} - Retrying balance check in ${delay}ms...`);
              await new Promise(r => setTimeout(r, delay));
            }
          }
        }
        
        if (!balanceSuccess) {
          console.error(`[ERROR] Game ${gameId} - Failed to retrieve balance after ${maxRetries} attempts`);
          socket.emit('game:error', { message: 'Unable to verify balance, please try again' });
          return;
        }

        // Check if balance is sufficient with some grace for rounding errors
        const minBalanceThreshold = betAmount * 0.99; // Allow small rounding errors
        if (realBalance < minBalanceThreshold) {
          console.log(`[DEBUG] Game ${gameId} - Insufficient balance: ${realBalance} < ${betAmount}`);
          socket.emit('game:error', { message: 'Insufficient balance' });
          return;
        }
        
        // Save the bet transaction first
        await saveTransaction({
          wallet_address: walletAddress,
          signature: `game_${Date.now()}_${walletAddress.substring(0, 8)}`,
          amount: betAmount,
          type: 'game_bet',
          status: 'completed',
          description: `Plinko bet with ${riskMode} risk`,
          timestamp: new Date()
        });
        
        // Then update in-memory balance for consistency
        deductBalance(walletAddress, betAmount);
        
        // Update user state with database balance
        userState.balance = (await getWalletBalanceSummary(walletAddress)).currentBalance;
      } catch (error) {
        console.error(`[ERROR] Game ${gameId} - Error processing bet:`, error);
        socket.emit('game:error', { message: 'Error processing bet, please try again' });
        return;
      }
    } else {
      // Demo mode - use virtual balance
      if (betAmount > userState.balance) {
        socket.emit('game:error', { message: 'Insufficient balance' });
        return;
      }
      
      // Deduct from virtual balance
      userState.balance -= betAmount;
    }
    
    // Validate risk mode is one of the allowed values
    const validRiskModes = ['low', 'medium', 'high'];
    const validatedRiskMode = validRiskModes.includes(riskMode) ? riskMode : 'medium';

    // Calculate the game result - use a separate nonce for each game
    const gameNonce = userState.nonce++;
    const gameOptions: GameOptions = {
      rows: 16, // Always use 16 rows regardless of client input
      riskMode: validatedRiskMode as 'medium'
    };
    
    const result = calculateGameResult(
      userState.serverSeed,
      userState.clientSeed,
      gameNonce,
      gameOptions
    );
    
    // Calculate winnings
    const winAmount = betAmount * result.finalMultiplier;
    
    if (walletAddress) {
      try {
        // Save win transaction to database
        if (winAmount > 0) {
          await saveTransaction({
            wallet_address: walletAddress,
            signature: `win_${Date.now()}_${walletAddress.substring(0, 8)}`,
            amount: winAmount,
            type: 'game_win',
            status: 'completed',
            description: `Plinko win with ${result.finalMultiplier}x multiplier`,
            timestamp: new Date()
          });
        }
        
        // Add winnings to in-memory balance for consistency
        addBalance(walletAddress, winAmount);
        
        // Update user state with latest database balance
        userState.balance = (await getWalletBalanceSummary(walletAddress)).currentBalance;
        
        // Save the game result to the database
        await saveGameResult({
          wallet_address: walletAddress,
          bet_amount: betAmount,
          win_amount: winAmount,
          final_multiplier: result.finalMultiplier,
          risk_mode: gameOptions.riskMode,
          server_seed: userState.serverSeed,
          client_seed: userState.clientSeed,
          nonce: gameNonce,
          path: result.path,
          timestamp: new Date()
        });
      } catch (error) {
        console.error(`[ERROR] Game ${gameId} - Error updating database after game:`, error);
        // Continue even if database update fails, but log the error
      }
    } else {
      // Demo mode - add to virtual balance
      userState.balance += winAmount;
    }
    
    // Store updated state (nonce already incremented)
    userStates.set(socket.id, userState);
    
    // Log detailed result
    console.log(`Game ${gameId} - Result: ${result.finalMultiplier}x - Bet: ${betAmount} - Win: ${winAmount}`);
    
    // Send result to client
    socket.emit('game:result', {
      ...result,
      betAmount,
      winAmount,
      balance: userState.balance,
      gameId // Include game ID for client-side tracking
    });
  });
  
  // Handle game state refresh request (for reconnections)
  socket.on('game:refresh', async (data: any, callback: Function) => {
    const userState = userStates.get(socket.id);
    
    if (!userState) {
      callback({ error: 'User state not found' });
      return;
    }
    
    try {
      // If wallet is connected, refresh the balance from database
      if (userState.walletAddress) {
        try {
          const balanceSummary = await getWalletBalanceSummary(userState.walletAddress);
          userState.balance = balanceSummary.currentBalance;
          
          // Update in-memory balance for consistency
          userBalances.set(userState.walletAddress, balanceSummary.currentBalance);
        } catch (error) {
          console.error('Error fetching balance during refresh:', error);
          // Keep using existing balance if database query fails
        }
      }
      
      // Try to fetch recent game history if wallet is connected
      let gameHistory: GameHistoryEntry[] = [];
      if (userState.walletAddress) {
        try {
          // Use type assertion to ensure TypeScript understands the type
          gameHistory = await getRecentGames(userState.walletAddress, 10) as GameHistoryEntry[];
        } catch (error) {
          console.error('Error fetching game history during refresh:', error);
          // Continue without game history if query fails
        }
      }
      
      // Return the current state
      callback({
        hashedServerSeed: hashServerSeed(userState.serverSeed),
        clientSeed: userState.clientSeed,
        balance: userState.balance,
        walletAddress: userState.walletAddress,
        gameHistory: gameHistory as GameHistoryEntry[],
        nonce: userState.nonce
      });
      
      console.log(`Game state refreshed for client: ${socket.id}`);
    } catch (error) {
      console.error('Error refreshing game state:', error);
      callback({ error: 'Failed to refresh game state' });
    }
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    userStates.delete(socket.id);
  });
});

// Define the interface for game history entries
interface GameHistoryEntry {
  clientSeed: string;
  serverSeed: string;
  hashedServerSeed: string;
  nonce: number;
  path: number[];
  finalMultiplier: number;
  betAmount: number;
  winAmount: number;
  balance: number;
  timestamp: number;
  riskMode: 'medium';
  rows: number;
  gameResult: number;
}

// Function to get recent games for a wallet in the format expected by the client
async function getRecentGames(walletAddress: string, limit: number = 10): Promise<GameHistoryEntry[]> {
  try {
    // Get the recent game results from the database
    const gameResults = await getWalletGameResults(walletAddress, limit);
    
    // Transform the results to match the client's expected format
    return gameResults.map(game => ({
      clientSeed: game.client_seed,
      serverSeed: game.server_seed,
      hashedServerSeed: hashServerSeed(game.server_seed),
      nonce: game.nonce,
      path: game.path || [],
      finalMultiplier: game.final_multiplier,
      betAmount: game.bet_amount,
      winAmount: game.win_amount,
      balance: 0, // Balance at that time is not stored, so we leave it as 0
      timestamp: game.timestamp.getTime(),
      riskMode: game.risk_mode as 'medium',
      rows: 16, // Fixed number of rows
      gameResult: 0 // This field isn't critical for history display
    }));
  } catch (error) {
    console.error('Error getting recent games:', error);
    return [];
  }
}

// Start server
const PORT = process.env.PORT || 3333;
server.listen(PORT, () => {
  console.log(`Plinko game server running on port ${PORT}`);
  
  // Start the buyback service
  buybackService.startBuybackService();
  console.log('Buyback service initialized');
}); 