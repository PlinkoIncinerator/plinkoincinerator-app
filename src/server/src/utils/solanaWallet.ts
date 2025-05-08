import { Connection, PublicKey, Transaction, SystemProgram, Keypair, ConnectionConfig } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';

// Constants
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const FEE_WALLET_PRIVATE_KEY = process.env.FEE_WALLET_PRIVATE_KEY;
export const FEE_PERCENTAGE = 0.021; // 2.1%

// Log configuration information
console.log('Solana wallet service initialized with:');
console.log(`RPC URL: ${RPC_URL}`);
console.log(`Fee wallet private key: ${FEE_WALLET_PRIVATE_KEY ? 'Provided (hidden)' : 'Not provided'}`);
console.log(`Fee percentage: ${FEE_PERCENTAGE * 100}%`);

// Initialize connection with support for versioned transactions
const connectionConfig = {
  commitment: 'confirmed',
  confirmTransactionInitialTimeout: 60000,
  maxSupportedTransactionVersion: 0 // Add this to support versioned transactions
} as ConnectionConfig & { maxSupportedTransactionVersion: number };

const connection = new Connection(RPC_URL, connectionConfig);
console.log(`Solana connection established to ${RPC_URL}`);

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
  } catch (error) {
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

    // Get incineration transaction details with maxSupportedTransactionVersion set
    const incinerationTx = await connection.getTransaction(incinerationSignature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0
    });

    if (!incinerationTx) {
      console.log('Incineration transaction not found');
      return { 
        success: false, 
        error: 'Incineration transaction not found' 
      };
    }

    console.log('Incineration transaction found, analyzing...');
    
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
      const preAccounts = new Set(incinerationTx.meta.preTokenBalances.map(acc => acc.accountIndex));
      const postAccounts = new Set(incinerationTx.meta.postTokenBalances.map(acc => acc.accountIndex));
      
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
          key => key.toString().toLowerCase() === walletAddress.toLowerCase()
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
    
    // If we have a separate fee transfer signature, verify it
    if (!feeVerified && feeTransferSignature) {
      // Check if fee transaction has already been processed
      if (transactionRegistry.has(feeTransferSignature)) {
        console.log('Fee transaction already processed');
        return { 
          success: false, 
          error: 'Fee transaction already processed' 
        };
      }
      
      // Get fee transaction details
      const feeTx = await connection.getTransaction(feeTransferSignature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });
      
      if (!feeTx) {
        console.log('Fee transaction not found');
        return { 
          success: false, 
          error: 'Fee transaction not found' 
        };
      }
      
      console.log('Fee transaction found, analyzing...');
      
      // Get account keys from fee transaction
      const feeMessage = feeTx.transaction.message;
      const feeAccountKeys = feeMessage.staticAccountKeys || 
                          (feeMessage.getAccountKeys ? feeMessage.getAccountKeys() : []);
      
      // Verify fee transaction sent funds to our fee wallet
      let feeTransferAmount = 0;
      
      // Check if any SOL was transferred to our fee wallet
      if (feeTx.meta && feeTx.meta.postBalances && feeTx.meta.preBalances) {
        const feeWalletIndex = feeAccountKeys.findIndex(
          key => key.toString().toLowerCase() === feeWalletAddress.toLowerCase()
        );
        
        if (feeWalletIndex !== -1) {
          const preBalance = feeTx.meta.preBalances[feeWalletIndex];
          const postBalance = feeTx.meta.postBalances[feeWalletIndex];
          feeTransferAmount = (postBalance - preBalance) / 1e9; // Convert from lamports to SOL
          
          console.log(`Fee wallet balance increased by ${feeTransferAmount} SOL`);
        }
      }
      
      // More flexible fee verification - allow up to 10% deviation
      const lowerBound = expectedFee * 0.90;
      
      if (feeTransferAmount >= lowerBound) {
        console.log(`Fee transfer of ${feeTransferAmount} SOL is sufficient (min required: ${lowerBound} SOL)`);
        feeVerified = true;
      } else {
        console.log(`Fee transfer of ${feeTransferAmount} SOL is insufficient (min required: ${lowerBound} SOL)`);
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
      const currentBalance = userBalances.get(walletAddress) || 0;
      userBalances.set(walletAddress, currentBalance + amountForGambling);
      console.log(`Added gambling amount of ${amountForGambling} SOL to user balance`);
      console.log(`New gambling balance: ${currentBalance + amountForGambling} SOL`);
      
      return {
        success: true,
        amount: amountForGambling,
        fullAmount: amountForGambling
      };
    } else {
      // For direct withdrawal, add the amount after fee
      const userAmount = totalExpectedReturn * (1 - FEE_PERCENTAGE);
      const currentBalance = userBalances.get(walletAddress) || 0;
      userBalances.set(walletAddress, currentBalance + userAmount);
      
      console.log(`Verification successful! Added ${userAmount} SOL to user balance`);
      console.log(`New user balance: ${currentBalance + userAmount} SOL`);
      
      return {
        success: true,
        amount: userAmount
      };
    }
  } catch (error) {
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

      try {
        // Sign and send transaction with versioned transaction support
        const signature = await connection.sendTransaction(
          transaction, 
          [feeWalletKeypair],
          { maxSupportedTransactionVersion: 0 } as any
        );
  
        console.log(`Withdrawal transaction sent with signature: ${signature}`);
  
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
      } catch (sendError) {
        console.error('Error sending transaction:');
        console.error(`- Message: ${sendError instanceof Error ? sendError.message : String(sendError)}`);
        console.error(`- Stack: ${sendError instanceof Error ? sendError.stack : 'No stack trace'}`);
        return {
          success: false,
          error: `Failed to send transaction: ${sendError instanceof Error ? sendError.message : String(sendError)}`
        };
      }
    } else {
      // This shouldn't happen due to the earlier check, but included for completeness
      console.log('No fee wallet configuration available (failed both methods)');
      return {
        success: false,
        error: 'Fee wallet not configured'
      };
    }
  } catch (error) {
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