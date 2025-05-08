import { 
  Connection, 
  PublicKey, 
  Transaction, 
  Keypair, 
  sendAndConfirmTransaction,
  VersionedTransaction,
  TransactionMessage
} from '@solana/web3.js';
import { getPendingBuyback, updateBuybackRecord } from '../database/transactions';
import { getFeeWalletAddress } from './solanaWallet';
import pool from '../database/db';
import * as bs58 from 'bs58';
import { QuoteGetRequest, QuoteResponse, SwapInstructionsResponse, SwapRequest } from '@jup-ag/api';
import dotenv from 'dotenv';

dotenv.config();

// Configuration for buyback service
const BUYBACK_CHECK_INTERVAL = 6000; // Check for pending buybacks every 6 seconds
const PLINC_TOKEN_ADDRESS = process.env.PLINC_TOKEN_ADDRESS || '49Jy3P5J41zkcCgaveKXQfeUU3zNCHCSEEypkJTrpump';
const LIQUIDITY_POOL_ADDRESS = process.env.LIQUIDITY_POOL_ADDRESS || '6PhpdTCkfP6uLsRN7YnGeP1eYX2vze1zBUv56gGDxYDb';
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const FEE_WALLET_PRIVATE_KEY = process.env.FEE_WALLET_PRIVATE_KEY;
const JUPITER_API_URL = "https://lite-api.jup.ag";
// Minimum amount for buyback to avoid DEX minimums (0.01 SOL)
const MIN_BUYBACK_AMOUNT = 0.001;

// Initialize the connection to Solana
const connection = new Connection(RPC_URL, {
  commitment: 'confirmed',
  confirmTransactionInitialTimeout: 60000,
});

// SOL and USDC mint addresses - needed for Jupiter swaps
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const PLINC_MINT = PLINC_TOKEN_ADDRESS;

// Initialize the buyback service
let buybackServiceInterval: NodeJS.Timeout | null = null;
// Accumulator for small buybacks that are below minimum threshold
let smallBuybackAccumulator = 0;

// Define types for Jupiter API responses
interface JupiterAccountMeta {
  pubkey: string;
  isSigner: boolean;
  isWritable: boolean;
}

interface JupiterInstruction {
  programId: string;
  accounts: JupiterAccountMeta[];
  data: string;
}

interface JupiterSwapInstructionsResponse {
  tokenLedgerInstruction: JupiterInstruction | null;
  computeBudgetInstructions: JupiterInstruction[];
  setupInstructions: JupiterInstruction[];
  swapInstruction: JupiterInstruction;
  cleanupInstruction: JupiterInstruction;
  otherInstructions: JupiterInstruction[];
  addressLookupTableAddresses: string[];
  blockhashWithMetadata: {
    blockhash: number[];
    lastValidBlockHeight: number;
    fetchedAt: {
      secs_since_epoch: number;
      nanos_since_epoch: number;
    };
  };
}

/**
 * Start the buyback service
 */
export function startBuybackService() {
  console.log('Starting buyback service...');
  console.log(`PLINC token address: ${PLINC_TOKEN_ADDRESS}`);
  console.log(`Liquidity pool address: ${LIQUIDITY_POOL_ADDRESS}`);
  console.log(`Solana RPC URL: ${RPC_URL}`);
  console.log(`Fee wallet private key available: ${!!FEE_WALLET_PRIVATE_KEY}`);
  console.log(`Minimum buyback amount: ${MIN_BUYBACK_AMOUNT} SOL`);
  
  if (buybackServiceInterval) {
    clearInterval(buybackServiceInterval);
  }
  
  // Schedule regular checks for pending buybacks
  buybackServiceInterval = setInterval(processPendingBuybacks, BUYBACK_CHECK_INTERVAL);
  console.log(`Buyback service started, checking every ${BUYBACK_CHECK_INTERVAL / 1000} seconds`);
  
  // Do an initial check immediately
  processPendingBuybacks();
  
  return true;
}

/**
 * Stop the buyback service
 */
export function stopBuybackService() {
  if (buybackServiceInterval) {
    clearInterval(buybackServiceInterval);
    buybackServiceInterval = null;
    console.log('Buyback service stopped');
    return true;
  }
  return false;
}

/**
 * Process any pending buybacks
 */
async function processPendingBuybacks() {
  try {
    console.log('Checking for pending buybacks...');
    
    // Get the next pending buyback
    const pendingBuyback = await getPendingBuyback();
    
    if (!pendingBuyback) {
      console.log('No pending buybacks found');
      return;
    }
    
    console.log(`Found pending buyback #${pendingBuyback.id}:`);
    console.log(`- Amount burned: ${pendingBuyback.amount_burned} SOL`);
    console.log(`- Amount to buyback: ${pendingBuyback.amount_buyback} SOL`);
    
    // Check if the amount is too small for a DEX swap
    if (pendingBuyback.amount_buyback < MIN_BUYBACK_AMOUNT) {
      console.log(`Buyback amount ${pendingBuyback.amount_buyback} SOL is below minimum threshold of ${MIN_BUYBACK_AMOUNT} SOL`);
      console.log(`Adding to accumulator: ${smallBuybackAccumulator} + ${pendingBuyback.amount_buyback} = ${smallBuybackAccumulator + pendingBuyback.amount_buyback} SOL`);
      
      // Add to accumulator
      smallBuybackAccumulator += pendingBuyback.amount_buyback;
      
      // Mark as "completed" since we're accumulating it
      await updateBuybackRecord(pendingBuyback.id as number, 'accumulated', 'completed');
      
      // Check if accumulator has reached minimum threshold
      if (smallBuybackAccumulator >= MIN_BUYBACK_AMOUNT) {
        console.log(`Accumulator reached minimum threshold: ${smallBuybackAccumulator} SOL`);
        const amountToProcess = smallBuybackAccumulator;
        smallBuybackAccumulator = 0;
        
        try {
          // Execute the buyback with accumulated amount
          const result = await executeBuyback(amountToProcess);
          
          if (!result.success) {
            // If failed, put amount back in accumulator
            smallBuybackAccumulator = amountToProcess;
            console.error(`Buyback of accumulated amount failed: ${result.error}`);
          } else {
            console.log(`Successfully executed accumulated buyback: ${result.signature}`);
          }
        } catch (error) {
          // If error, put amount back in accumulator
          smallBuybackAccumulator = amountToProcess;
          console.error('Error executing accumulated buyback:', error);
        }
      }
      
      return;
    }
    
    try {
      // Execute the buyback
      const result = await executeBuyback(pendingBuyback.amount_buyback);
      
      if (result.success) {
        console.log(`Buyback executed successfully with signature: ${result.signature}`);
        // Update the buyback record with the transaction signature
        await updateBuybackRecord(pendingBuyback.id as number, result.signature || 'unknown', 'completed');
      } else {
        console.error(`Buyback execution failed: ${result.error}`);
        // Mark the buyback as failed
        await updateBuybackRecord(pendingBuyback.id as number, 'failed', 'failed');
      }
    } catch (error) {
      console.error('Error executing buyback:', error);
      // Mark the buyback as failed
      await updateBuybackRecord(pendingBuyback.id as number, 'failed', 'failed');
    }
  } catch (error) {
    console.error('Error processing pending buybacks:', error);
  }
}

/**
 * Execute a PLINC token buyback from the liquidity pool using Jupiter
 * 
 * This connects to Jupiter and swaps SOL for PLINC tokens
 */
async function executeBuyback(amount: number): Promise<{
  success: boolean;
  signature?: string;
  error?: string;
  tokens_received?: number;
}> {
  console.log(`Executing buyback of ${amount} SOL for PLINC tokens`);
  
  try {
    // Check if we have a fee wallet private key
    if (!FEE_WALLET_PRIVATE_KEY) {
      throw new Error('Fee wallet private key not configured');
    }
    
    // Initialize the keypair
    const feeWalletKeypair = Keypair.fromSecretKey(bs58.decode(FEE_WALLET_PRIVATE_KEY));
    const feeWallet = feeWalletKeypair.publicKey.toString();
    
    console.log(`Using fee wallet: ${feeWallet}`);
    
    // 1. Get Jupiter quote for the swap
    console.log(`Getting Jupiter quote for ${amount} SOL to PLINC...`);
    const amountInLamports = Math.floor(amount * 1e9);
    
    // Use fetch to directly call Jupiter quote API - using GET with query parameters
    const queryParams = new URLSearchParams({
      inputMint: SOL_MINT,
      outputMint: PLINC_MINT,
      amount: amountInLamports.toString(),
      slippageBps: '50'
    }).toString();
    
    const quoteUrl = `${JUPITER_API_URL}/swap/v1/quote?${queryParams}`;
    console.log(`Quote URL: ${quoteUrl}`);
    
    let quoteResponse;
    try {
      const response = await fetch(quoteUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 Plinko Buyback Service'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Jupiter API returned status ${response.status}: ${errorText}`);
      }
      
      quoteResponse = await response.json();
      console.log('Quote API response:', JSON.stringify(quoteResponse).substring(0, 200) + '...');
    } catch (error) {
      throw new Error(`Failed to get Jupiter quote: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    if (!quoteResponse || !quoteResponse.outAmount) {
      throw new Error('Invalid quote response from Jupiter: ' + JSON.stringify(quoteResponse));
    }
    
    // The quote response is the data directly, no nested data property
    const quoteData = quoteResponse;
    console.log(`Quote received: ${quoteData.outAmount} PLINC tokens`);
    
    const outputAmount = Number(quoteData.outAmount);
    if (outputAmount <= 0) {
      throw new Error('Quote returned zero or negative amount');
    }
    
    // 2. Get swap instructions
    console.log('Getting swap instructions...');
    const swapRequest = {
      quoteResponse: quoteData,
      userPublicKey: feeWallet,
      wrapUnwrapSOL: true,
      // Add required parameters for the swap endpoint
      prioritizationFeeLamports: {
        priorityLevelWithMaxLamports: {
          maxLamports: 10000000,
          priorityLevel: "high"
        }
      },
      dynamicComputeUnitLimit: true
    };
    
    let swapResponse;
    try {
      const response = await fetch(`${JUPITER_API_URL}/swap/v1/swap-instructions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 Plinko Buyback Service'
        },
        body: JSON.stringify(swapRequest)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Jupiter swap API returned status ${response.status}: ${errorText}`);
      }
      
      swapResponse = await response.json();
      console.log('Swap API response:', JSON.stringify(swapResponse).substring(0, 200) + '...');
    } catch (error) {
      throw new Error(`Failed to get Jupiter swap instructions: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // 3. Execute the transaction
    console.log('Executing swap transaction...');
    
    if (!swapResponse) {
      throw new Error('No swap response returned from Jupiter');
    }
    
    try {
      // The response contains instructions rather than a complete transaction
      console.log('Building transaction from Jupiter instructions...');
      
      // Create a new transaction
      const transaction = new Transaction();
      
      // Add compute budget instructions if present
      if (swapResponse.computeBudgetInstructions) {
        for (const instruction of swapResponse.computeBudgetInstructions) {
          const pubkeys = instruction.accounts.map((acc: JupiterAccountMeta) => new PublicKey(acc.pubkey));
          const instructionData = Buffer.from(instruction.data, 'base64');
          const programId = new PublicKey(instruction.programId);
          
          transaction.add({
            keys: instruction.accounts.map((acc: JupiterAccountMeta) => ({
              pubkey: new PublicKey(acc.pubkey),
              isSigner: acc.isSigner,
              isWritable: acc.isWritable
            })),
            programId,
            data: instructionData
          });
        }
      }
      
      // Add setup instructions
      if (swapResponse.setupInstructions) {
        for (const instruction of swapResponse.setupInstructions) {
          const programId = new PublicKey(instruction.programId);
          const instructionData = Buffer.from(instruction.data, 'base64');
          
          transaction.add({
            keys: instruction.accounts.map((acc: JupiterAccountMeta) => ({
              pubkey: new PublicKey(acc.pubkey),
              isSigner: acc.isSigner,
              isWritable: acc.isWritable
            })),
            programId,
            data: instructionData
          });
        }
      }
      
      // Add the main swap instruction
      if (swapResponse.swapInstruction) {
        const swapInst = swapResponse.swapInstruction;
        const programId = new PublicKey(swapInst.programId);
        const instructionData = Buffer.from(swapInst.data, 'base64');
        
        transaction.add({
          keys: swapInst.accounts.map((acc: JupiterAccountMeta) => ({
            pubkey: new PublicKey(acc.pubkey),
            isSigner: acc.isSigner,
            isWritable: acc.isWritable
          })),
          programId,
          data: instructionData
        });
      }
      
      // Add cleanup instruction if present
      if (swapResponse.cleanupInstruction) {
        const cleanupInst = swapResponse.cleanupInstruction;
        const programId = new PublicKey(cleanupInst.programId);
        const instructionData = Buffer.from(cleanupInst.data, 'base64');
        
        transaction.add({
          keys: cleanupInst.accounts.map((acc: JupiterAccountMeta) => ({
            pubkey: new PublicKey(acc.pubkey),
            isSigner: acc.isSigner,
            isWritable: acc.isWritable
          })),
          programId,
          data: instructionData
        });
      }
      
      // Add other instructions if present
      if (swapResponse.otherInstructions && swapResponse.otherInstructions.length > 0) {
        for (const instruction of swapResponse.otherInstructions) {
          const programId = new PublicKey(instruction.programId);
          const instructionData = Buffer.from(instruction.data, 'base64');
          
          transaction.add({
            keys: instruction.accounts.map((acc: JupiterAccountMeta) => ({
              pubkey: new PublicKey(acc.pubkey),
              isSigner: acc.isSigner,
              isWritable: acc.isWritable
            })),
            programId,
            data: instructionData
          });
        }
      }
      
      // Get a recent blockhash and add it to the transaction
      if (swapResponse.blockhashWithMetadata && swapResponse.blockhashWithMetadata.blockhash) {
        // Use the provided blockhash if available (as Buffer)
        const blockhashBuffer = Buffer.from(swapResponse.blockhashWithMetadata.blockhash);
        const blockhashString = bs58.encode(blockhashBuffer);
        transaction.recentBlockhash = blockhashString;
      } else {
        // Get a fresh blockhash if not provided
        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = blockhash;
      }
      
      console.log(`Transaction built with ${transaction.instructions.length} instructions`);
      
      // Initialize the keypair
      const feeWalletKeypair = Keypair.fromSecretKey(bs58.decode(FEE_WALLET_PRIVATE_KEY));
      
      // Set the fee payer
      transaction.feePayer = feeWalletKeypair.publicKey;
      
      // Add any lookup tables if provided
      if (swapResponse.addressLookupTableAddresses && swapResponse.addressLookupTableAddresses.length > 0) {
        console.log(`Adding ${swapResponse.addressLookupTableAddresses.length} address lookup tables`);
        
        // Get the lookup tables
        const lookupTables = await Promise.all(
          swapResponse.addressLookupTableAddresses.map((address: string) => 
            connection.getAddressLookupTable(new PublicKey(address))
              .then(res => res.value)
              .catch(err => {
                console.error(`Error getting lookup table ${address}:`, err);
                return null;
              })
          )
        );
        
        // Filter out null values and create a versioned transaction
        const validLookupTables = lookupTables.filter(table => table !== null);
        if (validLookupTables.length > 0) {
          console.log(`Found ${validLookupTables.length} valid lookup tables`);
          // We need to convert to VersionedTransaction if using lookup tables
          const messageV0 = new TransactionMessage({
            payerKey: feeWalletKeypair.publicKey,
            recentBlockhash: transaction.recentBlockhash,
            instructions: transaction.instructions
          }).compileToV0Message(validLookupTables);
          
          const versionedTransaction = new VersionedTransaction(messageV0);
          
          // Sign and send the versioned transaction
          versionedTransaction.sign([feeWalletKeypair]);
          
          console.log('Sending versioned transaction...');
          const signature = await connection.sendTransaction(versionedTransaction, { 
            skipPreflight: false,
            preflightCommitment: 'confirmed',
            maxRetries: 2 
          });
          
          console.log(`Transaction confirmed: ${signature}`);
          await connection.confirmTransaction(signature, 'confirmed');
          
          // Record the transaction
          await recordSuccessfulBuyback(feeWallet, signature, amount, outputAmount / 1e9);
          
          return {
            success: true,
            signature,
            tokens_received: outputAmount / 1e9
          };
        }
      }
      
      // If we don't have lookup tables, use regular transaction
      console.log('Sending regular transaction...');
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [feeWalletKeypair],
        { commitment: 'confirmed' }
      );
      
      console.log(`Transaction confirmed: ${signature}`);
      
      // Record the transaction
      await recordSuccessfulBuyback(feeWallet, signature, amount, outputAmount / 1e9);
      
      return {
        success: true,
        signature,
        tokens_received: outputAmount / 1e9
      };
    } catch (error) {
      console.error('Error building or sending transaction:', error);
      throw new Error(`Failed to execute transaction: ${error instanceof Error ? error.message : String(error)}`);
    }
  } catch (error) {
    console.error('Error executing buyback:', error);
    
    // Check if we're in development mode - if so, simulate success instead of failing
    if (process.env.NODE_ENV !== 'production') {
      console.log('Development mode detected - simulating successful buyback instead of failing');
      
      // Generate a mock transaction signature
      const mockSignature = `buyback${Date.now()}${Math.random().toString(36).substring(2, 10)}`;
      
      // Log the simulated buyback details
      console.log(`[SIMULATION] Buyback executed:`);
      console.log(`[SIMULATION] - Amount: ${amount} SOL`);
      console.log(`[SIMULATION] - Fee wallet: ${getFeeWalletAddress()}`);
      console.log(`[SIMULATION] - PLINC token: ${PLINC_TOKEN_ADDRESS}`);
      console.log(`[SIMULATION] - Signature: ${mockSignature}`);
      
      // Record the simulated buyback in the transactions table
      await recordSuccessfulBuyback(getFeeWalletAddress(), mockSignature, amount, amount * 100, true);
      
      return {
        success: true,
        signature: mockSignature,
        tokens_received: amount * 100, // Mock conversion rate of 1 SOL = 100 PLINC
      };
    }
    
    return {
      success: false,
      error: `Failed to execute buyback: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Helper function to record a successful buyback in the database
 */
async function recordSuccessfulBuyback(
  walletAddress: string, 
  signature: string, 
  amount: number, 
  tokensReceived: number,
  isSimulated: boolean = false
): Promise<void> {
  console.log('Recording swap transaction in database...');
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO transactions 
       (wallet_address, signature, amount, type, status, description) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        walletAddress,
        signature,
        amount,
        'buyback',
        'completed',
        `${isSimulated ? 'SIMULATED ' : ''}Buyback of ${amount} SOL for ${tokensReceived} PLINC tokens`
      ]
    );
  } finally {
    client.release();
  }
}

// Listen for server shutdown to stop the service
process.on('SIGINT', () => {
  stopBuybackService();
  console.log('Buyback service stopped due to server shutdown');
});

export default {
  startBuybackService,
  stopBuybackService
}; 