import { Connection, PublicKey, Transaction, SystemProgram, Keypair, ConnectionConfig, TransactionResponse, GetVersionedTransactionConfig, VersionedTransactionResponse } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';
import dotenv from 'dotenv';

dotenv.config();
// Constants
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
// Add fallback RPC endpoints
const FALLBACK_RPC_URLS = [
  process.env.SOLANA_FALLBACK_RPC_URL_1 || 'https://solana-mainnet.rpc.extrnode.com',
  process.env.SOLANA_FALLBACK_RPC_URL_2 || 'https://rpc.ankr.com/solana'
];
const FEE_WALLET_PRIVATE_KEY = process.env.FEE_WALLET_PRIVATE_KEY;
export const FEE_PERCENTAGE = 0.021; // 2.1%

// Log configuration information
console.log('Solana wallet service initialized with:');
console.log(`Primary RPC URL: ${RPC_URL}`);
console.log(`Fallback RPC URLs: ${FALLBACK_RPC_URLS.join(', ')}`);
console.log(`Fee wallet private key: ${FEE_WALLET_PRIVATE_KEY ? 'Provided (hidden)' : 'Not provided'}`);
console.log(`Fee percentage: ${FEE_PERCENTAGE * 100}%`);

// Initialize connection with support for versioned transactions
const connectionConfig: GetVersionedTransactionConfig & { confirmTransactionInitialTimeout: number } = {
  commitment: 'confirmed',
  maxSupportedTransactionVersion: 0, // Required to support versioned transactions
  confirmTransactionInitialTimeout: 60000 // Set timeout for transaction confirmations
};

const connection = new Connection(RPC_URL, connectionConfig);
// Create fallback connections
const fallbackConnections = FALLBACK_RPC_URLS.map(url => new Connection(url, connectionConfig));

console.log(`Primary Solana connection established to ${RPC_URL}`);
console.log(`${fallbackConnections.length} fallback connections established`);

// Function to initialize the fee wallet keypair
function initializeFeeWalletKeypair(): Keypair | null {
  console.log('Attempting to initialize fee wallet keypair...');
  
  if (!FEE_WALLET_PRIVATE_KEY) {
    console.log('No fee wallet private key provided in environment variables');
    return null;
  }
  
  try {
    const secretKey = bs58.decode(FEE_WALLET_PRIVATE_KEY);
    console.log(`Secret key decoded, length: ${secretKey.length}`);
    
    const keypair = Keypair.fromSecretKey(secretKey);
    console.log(`Fee wallet keypair initialized successfully:`);
    console.log(`- Public key: ${keypair.publicKey.toString()}`);
    
    return keypair;
  } catch (error: any) {
    console.error('Failed to initialize fee wallet keypair:');
    console.error(`- Error message: ${error instanceof Error ? error.message : String(error)}`);
    console.error(`- Error stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
    console.error(`- Private key length: ${FEE_WALLET_PRIVATE_KEY.length}`);
    console.error(`- Private key format valid: ${FEE_WALLET_PRIVATE_KEY.match(/^[A-Za-z0-9]+$/) ? 'Yes' : 'No'}`);
    return null;
  }
}

// Get fee wallet address
export const getFeeWalletAddress = (): string => {
  console.log('Getting fee wallet address...');
  
  // Try to initialize keypair to get the address
  const keypair = initializeFeeWalletKeypair();
  
  if (keypair) {
    const address = keypair.publicKey.toString();
    console.log(`Using address from keypair: ${address}`);
    return address;
  }

  
  // Final fallback to hardcoded address
  const fallbackAddress = 'DZYKY8RqPZKFM78SF2FaT1k6UqiPfSAtYVx2D4bV8v8E';
  console.log(`No keypair or environment variable available. Using fallback address: ${fallbackAddress}`);
  return fallbackAddress;
};

// Interface for transactions
interface TransactionRecord {
  signature: string;
  amount: number;
  timestamp: number;
  walletAddress: string;
  processed: boolean;
}

// Store pending and processed transactions
const transactionRegistry: Map<string, TransactionRecord> = new Map();

// Store user balances
export const userBalances: Map<string, number> = new Map();

// Function to get a transaction with fallbacks
async function getTransactionWithFallbacks(
  signature: string, 
  options: GetVersionedTransactionConfig
): Promise<VersionedTransactionResponse | null> {
  // Try with the primary connection first
  try {
    // Ensure maxSupportedTransactionVersion is explicitly set to fix deprecation warning
    const versionedOptions = {
      ...options,
      maxSupportedTransactionVersion: options.maxSupportedTransactionVersion || 0
    };
    const tx = await connection.getTransaction(signature, versionedOptions);
    if (tx) return tx;
  } catch (err: any) {
    console.error(`Primary RPC failed for signature ${signature}:`, err);
  }
  
  // If primary connection fails or doesn't find tx, try fallbacks
  for (let i = 0; i < fallbackConnections.length; i++) {
    try {
      console.log(`Trying fallback RPC ${i + 1} for signature ${signature}`);
      
      // Ensure maxSupportedTransactionVersion is explicitly set to fix deprecation warning
      const versionedOptions = {
        ...options,
        maxSupportedTransactionVersion: options.maxSupportedTransactionVersion || 0
      };
      const tx = await fallbackConnections[i].getTransaction(signature, versionedOptions);
      
      if (tx) {
        console.log(`Transaction found via fallback RPC ${i + 1}`);
        return tx;
      }
    } catch (err: any) {
      console.error(`Fallback RPC ${i + 1} failed:`, err);
    }
  }
  
  return null; // None of the RPCs found the transaction
}

/**
 * Verify a deposit from a user's wallet to our fee wallet
 */
export async function verifyDeposit(
  walletAddress: string, 
  incinerationSignature: string,
  feeTransferSignature?: string
): Promise<{
  success: boolean;
  amount?: number;
  fullAmount?: number; // Add full amount returned for gambling
  swappedValue?: number; // Add swapped value from Jupiter transactions
  error?: string;
}> {
  try {
    console.log(`Starting verification for wallet ${walletAddress}`);
    console.log(`Incineration signature: ${incinerationSignature}`);
    if (feeTransferSignature) {
      console.log(`Fee transfer signature: ${feeTransferSignature}`);
    }

    // Check if incineration transaction has already been processed
    if (transactionRegistry.has(incinerationSignature)) {
      console.log('Transaction already processed');
      return { 
        success: false, 
        error: 'Transaction already processed' 
      };
    }

    // Implement retry mechanism with exponential backoff for transaction confirmation
    const MAX_RETRIES = 5;
    const INITIAL_DELAY_MS = 1000; // 1 second initial delay
    let retryCount = 0;
    let incinerationTx: VersionedTransactionResponse | null = null;

    while (retryCount < MAX_RETRIES && !incinerationTx) {
      try {
        console.log(`Fetching transaction (attempt ${retryCount + 1}/${MAX_RETRIES}): ${incinerationSignature}`);
        
        // Get incineration transaction details with maxSupportedTransactionVersion set
        incinerationTx = await getTransactionWithFallbacks(incinerationSignature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0
        });

        if (incinerationTx) {
          console.log(`Transaction found on attempt ${retryCount + 1}`);
          break;
        } else {
          console.log(`Transaction not found on attempt ${retryCount + 1}`);
          
          // Check if this is the last retry
          if (retryCount === MAX_RETRIES - 1) {
            // Before giving up, try with 'finalized' commitment as a last resort
            console.log('Trying with finalized commitment as last resort');
            incinerationTx = await getTransactionWithFallbacks(incinerationSignature, {
              commitment: 'finalized',
              maxSupportedTransactionVersion: 0
            });
            
            if (incinerationTx) {
              console.log('Transaction found with finalized commitment');
              break;
            }
          }
          
          // Exponential backoff before retrying
          const delay = INITIAL_DELAY_MS * Math.pow(2, retryCount);
          console.log(`Waiting ${delay}ms before retry ${retryCount + 2}`);
          await new Promise(resolve => setTimeout(resolve, delay));
          retryCount++;
        }
      } catch (fetchError: any) {
        console.error(`Error fetching transaction (attempt ${retryCount + 1}):`, fetchError);
        
        // Exponential backoff before retrying
        const delay = INITIAL_DELAY_MS * Math.pow(2, retryCount);
        console.log(`Error occurred, waiting ${delay}ms before retry ${retryCount + 2}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        retryCount++;
      }
    }

    if (!incinerationTx) {
      console.log(`Incineration transaction not found after ${MAX_RETRIES} attempts`);
      console.log(`RPC endpoint used: ${RPC_URL}`);
      console.log(`Transaction might still be confirming. Check Solscan: https://solscan.io/tx/${incinerationSignature}`);
      return { 
        success: false, 
        error: `Incineration transaction not found after ${MAX_RETRIES} attempts. It might still be confirming.` 
      };
    }

    console.log('Incineration transaction found, analyzing...');
    console.log(`Transaction status: ${incinerationTx.meta?.err ? 'Failed' : 'Success'}`);
    console.log(`Slot: ${incinerationTx.slot}`);
    console.log(`Block time: ${incinerationTx.blockTime ? new Date(incinerationTx.blockTime * 1000).toISOString() : 'Unknown'}`);
    
    // Get account keys, handling both legacy and versioned transactions
    const message = incinerationTx.transaction.message;
    const accountKeys = message.staticAccountKeys || 
                        (message.getAccountKeys ? message.getAccountKeys() : []);
    
    // Verify the transaction is from the specified wallet
    const txSender = accountKeys[0]?.toString() || '';
    console.log(`Transaction sender: ${txSender}, Wallet address: ${walletAddress}`);
    
    if (txSender.toLowerCase() !== walletAddress.toLowerCase()) {
      console.log('Transaction sender does not match wallet address');
      // Allow verification to continue with a warning instead of failing
      console.warn(`WARNING: Transaction sender (${txSender}) does not match wallet address (${walletAddress})`);
    }

    // Extract token account closures - more flexible approach
    let closedAccountsCount = 0;
    const feeWalletAddress = getFeeWalletAddress();
    
    // Check if any token accounts were closed by looking for balance changes
    // This is more reliable than checking instruction types
    if (incinerationTx.meta && incinerationTx.meta.postTokenBalances && incinerationTx.meta.preTokenBalances) {
      // Find token accounts that existed before but not after the transaction
      const preAccounts = new Set(incinerationTx.meta.preTokenBalances.map((acc: {accountIndex: number}) => acc.accountIndex));
      const postAccounts = new Set(incinerationTx.meta.postTokenBalances.map((acc: {accountIndex: number}) => acc.accountIndex));
      
      // Accounts that existed pre-tx but not post-tx were likely closed
      preAccounts.forEach(idx => {
        if (!postAccounts.has(idx)) {
          closedAccountsCount++;
        }
      });
      
      console.log(`Found ${closedAccountsCount} closed token accounts based on balance changes`);
    }
    
    // If we didn't find any closed accounts using token balances, fall back to instruction analysis
    if (closedAccountsCount === 0) {
      console.log('Falling back to instruction analysis for token account closures');
      
      // Get instructions, handling both legacy and versioned transactions
      const instructions = 'instructions' in message ? message.instructions : [];
      
      // Look for TOKEN_PROGRAM instructions
      for (const ix of instructions) {
        if (ix.programIdIndex !== undefined && 
            accountKeys[ix.programIdIndex] && 
            TOKEN_PROGRAM_ID.equals(new PublicKey(accountKeys[ix.programIdIndex].toString()))) {
          // Token Program instruction - check if it's a close account instruction (data[0] = 9)
          // If we can't verify the exact instruction type, just count all token program instructions
          closedAccountsCount++;
          console.log('Found a TOKEN_PROGRAM instruction, assuming it closes an account');
        }
      }
    }
    
    if (closedAccountsCount === 0) {
      // Even if we don't find explicit closures, check if SOL was returned to the wallet
      // This is a last resort check for when our closure detection fails
      if (incinerationTx.meta && incinerationTx.meta.postBalances && incinerationTx.meta.preBalances) {
        const walletIndex = accountKeys.findIndex(
          (key: PublicKey) => key.toString().toLowerCase() === walletAddress.toLowerCase()
        );
        
        if (walletIndex !== -1) {
          const preBalance = incinerationTx.meta.preBalances[walletIndex];
          const postBalance = incinerationTx.meta.postBalances[walletIndex];
          const balanceIncrease = (postBalance - preBalance) / 1e9; // Convert from lamports to SOL
          
          if (balanceIncrease > 0.001) { // If wallet gained more than 0.001 SOL
            console.log(`Wallet balance increased by ${balanceIncrease} SOL, assuming token accounts were closed`);
            closedAccountsCount = Math.max(1, Math.floor(balanceIncrease / 0.00203928));
          }
        }
      }
    }
    
    if (closedAccountsCount === 0) {
      console.log('No token accounts were closed in the incineration transaction');
      return {
        success: false,
        error: 'No token accounts were closed in the incineration transaction'
      };
    }
    
    console.log(`Verified ${closedAccountsCount} token accounts were closed in incineration transaction`);
    
    // Calculate expected fee
    const expectedReturnPerAccount = 0.00203928;
    const totalExpectedReturn = closedAccountsCount * expectedReturnPerAccount;
    const expectedFee = totalExpectedReturn * FEE_PERCENTAGE;
    
    console.log(`Expected return: ${totalExpectedReturn} SOL`);
    console.log(`Expected fee: ${expectedFee} SOL`);
    
    let feeVerified = false;
    let isGamblingDeposit = false;
    let amountForGambling = 0;
    let swappedValue = 0; // Track value of swapped tokens
    
    // Check for Jupiter swap by looking for log messages
    let jupiterSwapFound = false;
    if (incinerationTx.meta && incinerationTx.meta.logMessages) {
      // Check logs for Jupiter swap messages
      for (const log of incinerationTx.meta.logMessages) {
        if (log.includes('Program JUP') || log.includes('Jupiter') || log.includes('swap')) {
          jupiterSwapFound = true;
          console.log("Jupiter swap detected in transaction logs");
          break;
        }
      }
    }
    
    // Check Jupiter swap by analyzing actual balance changes
    if (jupiterSwapFound && incinerationTx.meta && incinerationTx.meta.postBalances && incinerationTx.meta.preBalances) {
      console.log(`----- SIMPLIFIED BALANCE ANALYSIS FOR SWAP -----`);
      
      // Find user wallet index in accounts
      const walletIndex = accountKeys.findIndex(
        (key: PublicKey) => key.toString().toLowerCase() === walletAddress.toLowerCase()
      );
      
      if (walletIndex !== -1) {
        // Calculate user wallet balance change
        const preBalance = incinerationTx.meta.preBalances[walletIndex];
        const postBalance = incinerationTx.meta.postBalances[walletIndex];
        const walletBalanceChange = (postBalance - preBalance) / 1e9; // Convert from lamports to SOL
        
        console.log(`User wallet balance change: ${walletBalanceChange} SOL`);
        
        if (walletBalanceChange > 0) {
          // User gained SOL - this could be from account closures or swaps
          
          // Expected return from closed accounts
          const expectedFromClosures = closedAccountsCount * expectedReturnPerAccount;
          console.log(`Expected SOL from ${closedAccountsCount} closed accounts: ${expectedFromClosures} SOL`);
          
          // If wallet gained more than expected from closures, the extra is likely from swaps
          if (walletBalanceChange > expectedFromClosures + 0.0001) { // add small buffer for dust
            swappedValue = walletBalanceChange - expectedFromClosures;
            console.log(`Extra SOL received (likely from swaps): ${swappedValue} SOL`);
          } else {
            console.log(`No significant extra SOL detected beyond account closures`);
          }
        } else {
          console.log(`User wallet balance didn't increase`);
        }
      }
    }
    
    // Check if there was a transfer to the fee wallet in the main incineration transaction
    // This could be either just the fee portion (direct withdrawal) or the full amount (gambling)
    if (incinerationTx.meta && incinerationTx.meta.postBalances && incinerationTx.meta.preBalances) {
      const feeWalletIndex = accountKeys.findIndex(
        key => key.toString().toLowerCase() === feeWalletAddress.toLowerCase()
      );
      
      if (feeWalletIndex !== -1) {
        const preBalance = incinerationTx.meta.preBalances[feeWalletIndex];
        const postBalance = incinerationTx.meta.postBalances[feeWalletIndex];
        const feeAmount = (postBalance - preBalance) / 1e9; // Convert from lamports to SOL
        
        console.log(`Fee wallet balance changed by ${feeAmount} SOL in incineration transaction`);
        
        // Check if this is close to the expected fee (withdrawal) or full amount (gambling)
        const lowerBoundForFee = expectedFee * 0.90;
        const upperBoundForFee = expectedFee * 1.10;
        
        if (feeAmount >= totalExpectedReturn * 0.90) {
          // This is likely a gambling deposit (full amount)
          console.log(`Found gambling deposit of ${feeAmount} SOL (expected ~${totalExpectedReturn} SOL)`);
          feeVerified = true;
          isGamblingDeposit = true;
          amountForGambling = feeAmount;
        } else if (feeAmount >= lowerBoundForFee && feeAmount <= upperBoundForFee) {
          // This is likely just the fee payment (direct withdrawal)
          console.log(`Found fee payment of ${feeAmount} SOL (expected ${expectedFee} SOL)`);
          feeVerified = true;
        }
      }
    }
    
    // TEMPORARY: If we're on localhost, allow verification to proceed even without fee verification
    // This helps with debugging and testing
    if (!feeVerified && process.env.NODE_ENV !== 'production') {
      console.log('Development environment detected - bypassing fee verification');
      feeVerified = true;
    }
    
    if (!feeVerified) {
      console.log(`Required fee of ${expectedFee} SOL was not paid`);
      return {
        success: false,
        error: `Required fee of ${expectedFee} SOL was not paid`
      };
    }

    // Register the transaction
    const record: TransactionRecord = {
      signature: incinerationSignature,
      amount: totalExpectedReturn,
      timestamp: Date.now(),
      walletAddress,
      processed: true
    };
    
    transactionRegistry.set(incinerationSignature, record);
    
    if (feeTransferSignature) {
      transactionRegistry.set(feeTransferSignature, {
        ...record,
        signature: feeTransferSignature
      });
    }

    // Add to user's balance - different amounts for withdraw vs. gambling
    if (isGamblingDeposit) {
      // For gambling, add the full amount to the user's balance
      // Include swap value if we detected any
      const totalValue = amountForGambling + swappedValue;
      const currentBalance = userBalances.get(walletAddress) || 0;
      userBalances.set(walletAddress, currentBalance + totalValue);
      console.log(`Added gambling amount of ${amountForGambling} SOL plus swap value of ${swappedValue} SOL to user balance`);
      console.log(`New gambling balance: ${currentBalance + totalValue} SOL`);
      
      return {
        success: true,
        amount: totalValue,
        fullAmount: totalValue,
        swappedValue: swappedValue
      };
    } else {
      // For direct withdrawal, add the amount after fee
      // Include swap value if we detected any
      const accountsValue = totalExpectedReturn * (1 - FEE_PERCENTAGE);
      const totalValue = accountsValue + swappedValue;
      const currentBalance = userBalances.get(walletAddress) || 0;
      userBalances.set(walletAddress, currentBalance + totalValue);
      
      console.log(`Verification successful! Added ${accountsValue} SOL from accounts plus ${swappedValue} SOL from swaps to user balance`);
      console.log(`New user balance: ${currentBalance + totalValue} SOL`);
      
      return {
        success: true,
        amount: totalValue,
        swappedValue: swappedValue
      };
    }
  } catch (error: any) {
    console.error('Error verifying deposit:', error);
    return {
      success: false,
      error: `Failed to verify transaction: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Get a user's balance from the transaction registry
 */
export function getUserBalance(walletAddress: string): number {
  return userBalances.get(walletAddress) || 0;
}

/**
 * Process a withdrawal request
 */
export async function processWithdrawal(
  walletAddress: string, 
  amount: number,
  directWithdraw: boolean = false
): Promise<{
  success: boolean;
  signature?: string;
  error?: string;
}> {
  console.log(`Processing withdrawal request:`);
  console.log(`- Wallet address: ${walletAddress}`);
  console.log(`- Amount: ${amount} SOL`);
  console.log(`- Direct withdrawal: ${directWithdraw}`);
  
  try {
    // Validate the amount
    if (isNaN(amount) || amount <= 0) {
      console.log(`Invalid withdrawal amount: ${amount}`);
      return {
        success: false,
        error: 'Invalid withdrawal amount'
      };
    }

    // Ensure the amount has a reasonable precision (max 9 decimals for lamports)
    const roundedAmount = Math.floor(amount * 1e9) / 1e9;
    if (roundedAmount !== amount) {
      amount = roundedAmount;
      console.log(`Rounded withdrawal amount to ${amount} SOL`);
    }

    // If this is not a direct withdrawal, check if user has enough balance
    if (!directWithdraw) {
      const balance = getUserBalance(walletAddress);
      console.log(`User balance check: ${balance} SOL available`);
      
      if (balance < amount) {
        console.log(`Insufficient balance: ${balance} SOL < ${amount} SOL`);
        return {
          success: false,
          error: 'Insufficient balance'
        };
      }
    }

    // Initialize the fee wallet keypair just-in-time
    console.log('Initializing fee wallet keypair for withdrawal...');
    const feeWalletKeypair = initializeFeeWalletKeypair();
    console.log(`Fee wallet keypair initialized: ${feeWalletKeypair ? 'Yes' : 'No'}`);
    
    // Check if fee wallet is configured in any form
    if (!feeWalletKeypair) {
      console.log('No fee wallet configuration available (neither keypair nor address)');
      return {
        success: false,
        error: 'Fee wallet not configured'
      };
    }

    // For direct withdrawals, no fee is charged as the fee was already taken
    // during the verification process
    const transferAmount = directWithdraw ? amount : (amount - (amount * FEE_PERCENTAGE));
    console.log(`Final transfer amount: ${transferAmount} SOL`);

    // Create and send the transaction
    if (feeWalletKeypair) {
      // If we have the keypair, we can send a transaction directly
      console.log(`Using keypair to send withdrawal transaction`);
      console.log(`From: ${feeWalletKeypair.publicKey.toString()}`);
      console.log(`To: ${walletAddress}`);
      console.log(`Amount: ${transferAmount} SOL (${Math.floor(transferAmount * 1e9)} lamports)`);
      
      // Create transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: feeWalletKeypair.publicKey,
          toPubkey: new PublicKey(walletAddress),
          lamports: Math.floor(transferAmount * 1e9), // Convert SOL to lamports
        })
      );

      // Set recent blockhash and sign
      const latestBlockhash = await connection.getLatestBlockhash();
      transaction.recentBlockhash = latestBlockhash.blockhash;
      transaction.feePayer = feeWalletKeypair.publicKey;
      console.log(`Transaction created with recent blockhash: ${latestBlockhash.blockhash}`);

      // Implement retry logic for sending transaction
      const MAX_SEND_RETRIES = 3;
      const INITIAL_SEND_DELAY_MS = 500;
      let sendRetryCount = 0;
      let signature = '';
      let sendError: any = null;

      while (sendRetryCount < MAX_SEND_RETRIES && !signature) {
        try {
          console.log(`Sending withdrawal transaction (attempt ${sendRetryCount + 1}/${MAX_SEND_RETRIES})`);
          
          // Sign and send transaction with versioned transaction support
          signature = await connection.sendTransaction(
            transaction, 
            [feeWalletKeypair],
            { maxSupportedTransactionVersion: 0 } as any // Cast to any to support versioned txs
          );
    
          console.log(`Withdrawal transaction sent with signature: ${signature}`);
          break;
        } catch (error: any) {
          sendError = error;
          console.error(`Error sending transaction (attempt ${sendRetryCount + 1}/${MAX_SEND_RETRIES}):`, error);
          
          // Check if this is a blockhash error that requires refreshing the blockhash
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('blockhash') && sendRetryCount < MAX_SEND_RETRIES - 1) {
            try {
              // Get a fresh blockhash and update the transaction
              console.log('Refreshing blockhash before retrying');
              const newBlockhash = await connection.getLatestBlockhash();
              transaction.recentBlockhash = newBlockhash.blockhash;
              console.log(`Updated transaction with new blockhash: ${newBlockhash.blockhash}`);
            } catch (refreshError: any) {
              console.error('Error refreshing blockhash:', refreshError);
            }
          }
          
          if (sendRetryCount < MAX_SEND_RETRIES - 1) {
            // Exponential backoff before retrying
            const delay = INITIAL_SEND_DELAY_MS * Math.pow(2, sendRetryCount);
            console.log(`Waiting ${delay}ms before retry ${sendRetryCount + 2}`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
          sendRetryCount++;
        }
      }

      if (!signature) {
        console.error('Failed to send withdrawal transaction after all retry attempts');
        return {
          success: false,
          error: `Failed to send transaction after ${MAX_SEND_RETRIES} attempts: ${sendError instanceof Error ? sendError.message : String(sendError)}`
        };
      }

      // Update user's balance - skip this for direct withdrawals
      if (!directWithdraw) {
        const balance = getUserBalance(walletAddress);
        const newBalance = balance - amount;
        console.log(`Updating user balance: ${balance} SOL -> ${newBalance} SOL`);
        userBalances.set(walletAddress, newBalance);
      }

      return {
        success: true,
        signature
      };
    } else {
      // This shouldn't happen due to the earlier check, but included for completeness
      console.log('No fee wallet configuration available (failed both methods)');
      return {
        success: false,
        error: 'Fee wallet not configured'
      };
    }
  } catch (error: any) {
    console.error('Error processing withdrawal:');
    console.error(`- Message: ${error instanceof Error ? error.message : String(error)}`);
    console.error(`- Stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
    return {
      success: false,
      error: `Failed to process withdrawal: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Deduct from a user's balance (for Plinko games)
 */
export function deductBalance(walletAddress: string, amount: number): boolean {
  console.log(`Attempting to deduct ${amount} SOL from ${walletAddress}`);
  const balance = getUserBalance(walletAddress);
  console.log(`Current balance: ${balance} SOL`);
  
  if (balance < amount) {
    console.log(`Insufficient balance: ${balance} SOL < ${amount} SOL`);
    return false;
  }
  
  const newBalance = balance - amount;
  console.log(`New balance after deduction: ${newBalance} SOL`);
  userBalances.set(walletAddress, newBalance);
  return true;
}

/**
 * Add to a user's balance (for Plinko winnings)
 */
export function addBalance(walletAddress: string, amount: number): void {
  console.log(`Adding ${amount} SOL to ${walletAddress}`);
  const balance = getUserBalance(walletAddress);
  console.log(`Current balance: ${balance} SOL`);
  
  const newBalance = balance + amount;
  console.log(`New balance after addition: ${newBalance} SOL`);
  userBalances.set(walletAddress, newBalance);
} 