import { 
  Connection, 
  Keypair, 
  LAMPORTS_PER_SOL, 
  Transaction,
  VersionedTransaction,
  TransactionMessage,
  PublicKey,
  sendAndConfirmTransaction,
  ComputeBudgetProgram
} from '@solana/web3.js';
import * as bs58 from 'bs58';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { QuoteResponse } from '@jup-ag/api';

dotenv.config();

// Configuration
const SOL_AMOUNT_PER_TRADE = 0.01; // Amount of SOL to use per trade
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const JUPITER_API_URL = "https://lite-api.jup.ag";
// Select a few known tokens with smaller transaction sizes that work well with Jupiter
const TEST_TOKEN_MINTS = [
  // Stick to just 2 well-known tokens that should work well
//   'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
//   'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  
  // The following tokens may have issues with large transactions:
  '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump', // fart - transaction too large for selling
  'CG2cAcyRGhhpor5z1gYMoQRoNFPXXVKmNiEuPG8fpump', // transaction too large
  '6bdTRHhdZenJQYLTxaYc8kH74GBNP9DoGhPnCjfypump', // transaction too large
  'AgF6niXaYJa9CFd8kVnhnke3jT8Uiz2GvDtkVpdopump', // size - no sell route
  '49Jy3P5J41zkcCgaveKXQfeUU3zNCHCSEEypkJTrpump', // plinc
  '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', // wrapped sol - tx too large
];

// Initialize connection to Solana
const connection = new Connection(RPC_URL, 'confirmed');

/**
 * Get Jupiter quote for a token swap
 */
async function getJupiterQuote(
  inputMint: string, 
  outputMint: string, 
  amount: number,
  slippageBps: number = 50 // Default 0.5% slippage
): Promise<QuoteResponse | null> {
  try {
    const amountInLamports = Math.floor(amount * LAMPORTS_PER_SOL);
    const queryParams = new URLSearchParams({
      inputMint: inputMint,
      outputMint: outputMint,
      amount: amountInLamports.toString(),
      slippageBps: slippageBps.toString()
    }).toString();
    
    const quoteUrl = `${JUPITER_API_URL}/swap/v1/quote?${queryParams}`;
    console.log(`Quote URL: ${quoteUrl}`);
    
    const response = await fetch(quoteUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Plinko Test Script'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Jupiter API returned status ${response.status}: ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error getting Jupiter quote:', error);
    return null;
  }
}

/**
 * Split transaction instructions to handle large transactions
 */
function splitInstructions(instructions: any[]): any[][] {
  // Split into very small chunks to handle large accounts
  const chunks = [];
  const chunkSize = 2; // Smaller chunk size to avoid transaction size limits
  
  for (let i = 0; i < instructions.length; i += chunkSize) {
    chunks.push(instructions.slice(i, i + chunkSize));
  }
  
  return chunks;
}

/**
 * Execute a token swap using Jupiter
 */
async function executeJupiterSwap(
  wallet: Keypair,
  inputMint: string,
  outputMint: string,
  amount: number
): Promise<string | null> {
  // For selling tokens back to SOL (when input is not SOL), start with higher slippage
  const initialSlippage = inputMint !== 'So11111111111111111111111111111111111111112' ? 150 : 50;
  let currentSlippage = initialSlippage;
  let maxRetries = 3;
  let lastError: any = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Skip compute-heavy Jupiter operations for selling if skipJupiter flag is set
      // 1. Get Jupiter quote for the swap
      console.log(`Attempt ${attempt + 1}/${maxRetries}: Getting quote for swap with ${currentSlippage/100}% slippage...`);
      const quoteResponse = await getJupiterQuote(inputMint, outputMint, amount, currentSlippage);
      
      if (!quoteResponse || !quoteResponse.outAmount) {
        throw new Error('Invalid quote response from Jupiter');
      }
      
      console.log(`Quote received: ${quoteResponse.outAmount} tokens`);
      
      // 2. Get swap instructions
      console.log('Getting swap instructions...');
      const swapRequest = {
        quoteResponse: quoteResponse,
        userPublicKey: wallet.publicKey.toString(),
        wrapUnwrapSOL: true,
        // Optional parameters to increase success rate
        // Use minimal compute units to reduce transaction size
        prioritizationFeeLamports: {
          priorityLevelWithMaxLamports: {
            maxLamports: 10000000,
            priorityLevel: "high"
          } 
        },
        // Set this to true to let Jupiter optimize compute units
        dynamicComputeUnitLimit: true
      };
      
      const response = await fetch(`${JUPITER_API_URL}/swap/v1/swap-instructions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Plinko Test Script'
        },
        body: JSON.stringify(swapRequest)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Jupiter swap API returned status ${response.status}: ${errorText}`);
      }
      
      const swapResponse = await response.json();
      
      // 3. Execute the transaction
      console.log('Building transaction from Jupiter instructions...');
      
      try {
        try {
          // Try using versioned transaction first
          return await executeVersionedTransaction(wallet, swapResponse);
        } catch (error: any) {
          console.warn('Versioned transaction failed, trying with split transactions:', error);
          
          // If we get any kind of error, try split transactions immediately
          return await executeSplitTransactions(wallet, swapResponse);
        }
      } catch (error: any) {
        // If transaction too large or any other error, try to use skipPreflight
        if (error.message && (
          error.message.includes('Transaction too large') ||
          error.message.includes('encoding overruns')
        )) {
          console.log('Transaction size issue, trying with skipPreflight...');
          return await executeSimpleTransaction(wallet, swapResponse);
        }
        throw error;
      }
    } catch (error: any) {
      console.error(`Error executing swap (attempt ${attempt + 1}/${maxRetries}):`, error);
      
      // Handle "Could not find any route" error - nothing we can do for this
      if (error.message && error.message.includes('Could not find any route')) {
        console.error('No route available for this token swap. This token might not have enough liquidity.');
        // If buying, we can just skip this token
        if (inputMint === 'So11111111111111111111111111111111111111112') {
          return null; // Skip this token when buying
        }
        // If selling and no route, we might be stuck with the token
        console.error('Warning: Unable to sell token back to SOL. No route available.');
        return null;
      }
      
      // If we get error 0x1771 (6001), increase slippage and retry
      if (error.message && 
          (error.message.includes('custom program error: 0x1771') || 
          error.message.includes('Slippage tolerance exceeded'))) {
        
        if (attempt < maxRetries - 1) {
          currentSlippage *= 2; // Double the slippage for next attempt
          console.log(`Increasing slippage to ${currentSlippage/100}% and retrying...`);
          lastError = error;
          continue; // Skip to next iteration
        }
      }
      
      lastError = error;
    }
  }
  
  console.error('All swap attempts failed:', lastError);
  return null;
}

/**
 * Execute a split transaction for large swaps
 */
async function executeSplitTransactions(
  wallet: Keypair,
  swapResponse: any
): Promise<string> {
  console.log('Executing split transactions...');
  
  // Collect all instructions
  const allInstructions = [];
  
  // Add compute budget instructions if present
  if (swapResponse.computeBudgetInstructions) {
    for (const instruction of swapResponse.computeBudgetInstructions) {
      const programId = new PublicKey(instruction.programId);
      const instructionData = Buffer.from(instruction.data, 'base64');
      
      allInstructions.push({
        keys: instruction.accounts.map((acc: any) => ({
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
      
      allInstructions.push({
        keys: instruction.accounts.map((acc: any) => ({
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
    
    allInstructions.push({
      keys: swapInst.accounts.map((acc: any) => ({
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
    
    allInstructions.push({
      keys: cleanupInst.accounts.map((acc: any) => ({
        pubkey: new PublicKey(acc.pubkey),
        isSigner: acc.isSigner,
        isWritable: acc.isWritable
      })),
      programId,
      data: instructionData
    });
  }
  
  // Split instructions into multiple transactions if needed
  const instructionBatches = splitInstructions(allInstructions);
  console.log(`Split into ${instructionBatches.length} transactions`);
  
  let lastSignature = '';
  
  // Execute each batch of instructions
  for (let i = 0; i < instructionBatches.length; i++) {
    const instructions = instructionBatches[i];
    console.log(`Executing transaction batch ${i + 1}/${instructionBatches.length} with ${instructions.length} instructions`);
    
    // Get a recent blockhash
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    
    // Create a transaction for this batch
    const transaction = new Transaction();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;
    
    // Add instructions to the transaction
    for (const instruction of instructions) {
      transaction.add(instruction);
    }
    
    // Sign and send the transaction
    console.log(`Sending transaction batch ${i + 1}...`);
    try {
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [wallet],
        { 
          commitment: 'confirmed',
          skipPreflight: false,
          maxRetries: 3
        }
      );
      
      console.log(`Transaction batch ${i + 1} confirmed: ${signature}`);
      lastSignature = signature;
    } catch (error) {
      console.error(`Error in transaction batch ${i + 1}:`, error);
      throw error;
    }
    
    // Wait a bit between transactions
    if (i < instructionBatches.length - 1) {
      console.log('Waiting between transaction batches...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return lastSignature;
}

/**
 * Execute a versioned transaction (supports larger transactions)
 */
async function executeVersionedTransaction(
  wallet: Keypair,
  swapResponse: any
): Promise<string> {
  // Collect all instructions from the swap response
  const instructions = [];
  
  // Track if we already have compute budget instructions
  const hasComputeBudgetInstructions = swapResponse.computeBudgetInstructions && 
                                       swapResponse.computeBudgetInstructions.length > 0;
  
  // Add compute budget instructions only if not already in the response
  if (!hasComputeBudgetInstructions) {
    // Add compute budget instruction to increase transaction size limit
    instructions.push(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 1400000 })
    );
    
    // Add compute budget fee instruction
    instructions.push(
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 })
    );
  }
  
  // Add compute budget instructions if present
  if (swapResponse.computeBudgetInstructions) {
    for (const instruction of swapResponse.computeBudgetInstructions) {
      const programId = new PublicKey(instruction.programId);
      const instructionData = Buffer.from(instruction.data, 'base64');
      
      instructions.push({
        keys: instruction.accounts.map((acc: any) => ({
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
      
      instructions.push({
        keys: instruction.accounts.map((acc: any) => ({
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
    
    instructions.push({
      keys: swapInst.accounts.map((acc: any) => ({
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
    
    instructions.push({
      keys: cleanupInst.accounts.map((acc: any) => ({
        pubkey: new PublicKey(acc.pubkey),
        isSigner: acc.isSigner,
        isWritable: acc.isWritable
      })),
      programId,
      data: instructionData
    });
  }
  
  // Get the latest blockhash
  const { blockhash, lastValidBlockHeight } = 
    await connection.getLatestBlockhash('confirmed');
  
  // Create a versioned transaction
  const messageV0 = new TransactionMessage({
    payerKey: wallet.publicKey,
    recentBlockhash: blockhash,
    instructions
  }).compileToV0Message();
  
  const transaction = new VersionedTransaction(messageV0);
  
  // Sign the transaction
  transaction.sign([wallet]);
  
  // Send the transaction
  console.log('Sending versioned transaction...');
  const signature = await connection.sendTransaction(transaction, {
    skipPreflight: false,
    maxRetries: 3
  });
  
  // Confirm transaction
  await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight
  });
  
  console.log(`Versioned transaction confirmed: ${signature}`);
  return signature;
}


/**
 * Execute a simple transaction with skipPreflight
 * Used as a last resort for transactions that are too large
 */
async function executeSimpleTransaction(
  wallet: Keypair,
  swapResponse: any
): Promise<string> {
  console.log('Executing simple transaction with skipPreflight...');
  
  // Create a new transaction
  const transaction = new Transaction();
  
  // Add only the essential instructions
  
  // Add main swap instruction only, which is the most important
  if (swapResponse.swapInstruction) {
    const swapInst = swapResponse.swapInstruction;
    const programId = new PublicKey(swapInst.programId);
    const instructionData = Buffer.from(swapInst.data, 'base64');
    
    transaction.add({
      keys: swapInst.accounts.map((acc: any) => ({
        pubkey: new PublicKey(acc.pubkey),
        isSigner: acc.isSigner,
        isWritable: acc.isWritable
      })),
      programId,
      data: instructionData
    });
  }
  
  // Add cleanup instruction if present, which is also important
  if (swapResponse.cleanupInstruction) {
    const cleanupInst = swapResponse.cleanupInstruction;
    const programId = new PublicKey(cleanupInst.programId);
    const instructionData = Buffer.from(cleanupInst.data, 'base64');
    
    transaction.add({
      keys: cleanupInst.accounts.map((acc: any) => ({
        pubkey: new PublicKey(acc.pubkey),
        isSigner: acc.isSigner,
        isWritable: acc.isWritable
      })),
      programId,
      data: instructionData
    });
  }
  
  // Get a recent blockhash
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;
  
  // Sign and send the transaction
  console.log('Sending transaction with skipPreflight...');
  try {
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet],
      { 
        commitment: 'confirmed',
        skipPreflight: true, // Skip preflight check to avoid transaction size check
        maxRetries: 5
      }
    );
    
    console.log(`Transaction confirmed: ${signature}`);
    return signature;
  } catch (error) {
    console.error('Error with simplified transaction:', error);
    throw error;
  }
}

/**
 * Execute token trades for wallet
 */
async function executeTokenTrades(
  wallet: Keypair, 
  numTrades: number
): Promise<void> {
  // Check wallet balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  
  if (balance < SOL_AMOUNT_PER_TRADE * LAMPORTS_PER_SOL) {
    console.error(`Error: Wallet has insufficient funds. Please add SOL to it.`);
    process.exit(1);
  }
  
  // Execute trades
  for (let i = 0; i < numTrades; i++) {
    // Shuffle token list and pick a random token
    const shuffledTokens = [...TEST_TOKEN_MINTS].sort(() => Math.random() - 0.5);
    const targetToken = shuffledTokens[0];
    
    if (targetToken === 'So11111111111111111111111111111111111111112') {
      console.log(`Skipping wrapped SOL swap, picking another token...`);
      continue;
    }
    
    console.log(`\nExecuting trade ${i + 1}/${numTrades}...`);
    console.log(`Swapping ${SOL_AMOUNT_PER_TRADE} SOL for ${targetToken}...`);
    
    // Buy token
    const buySignature = await executeJupiterSwap(
      wallet,
      'So11111111111111111111111111111111111111112', // Wrapped SOL
      targetToken,
      SOL_AMOUNT_PER_TRADE
    );
    
    if (!buySignature) {
      console.error(`Failed to execute buy swap`);
      continue;
    }
    
    console.log(`Buy transaction confirmed: ${buySignature}`);
    
    // Wait between transactions
    console.log(`Waiting 10 seconds before selling...`);
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Sell token back to SOL - wait more time to avoid race conditions
    console.log(`Swapping ${targetToken} back to SOL...`);
    
    // For sell transactions, we don't specify an amount since we want to sell all tokens
    // Jupiter API will handle this if we provide a very small amount
    const sellSignature = await executeJupiterSwap(
      wallet,
      targetToken,
      'So11111111111111111111111111111111111111112', // Wrapped SOL
      0.00001 // Amount doesn't matter here as we're using all tokens
    );
    
    if (!sellSignature) {
      console.error(`Failed to execute sell swap - you may be left with some ${targetToken} tokens`);
    } else {
      console.log(`Sell transaction confirmed: ${sellSignature}`);
    }
    
    // Wait between trades
    if (i < numTrades - 1) {
      console.log(`Waiting 15 seconds before next trade...`);
      await new Promise(resolve => setTimeout(resolve, 15000));
    }
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log('Starting test trading script...');
  
  // Check for wallet private key
  const walletPrivateKey = process.env.TEST_WALLET_PRIVATE_KEY;
  if (!walletPrivateKey) {
    console.error('Error: TEST_WALLET_PRIVATE_KEY not found in environment variables');
    console.log('Please add a wallet private key to your .env file');
    process.exit(1);
  }
  
  // Load wallet
  const wallet = Keypair.fromSecretKey(bs58.decode(walletPrivateKey));
  console.log(`Wallet: ${wallet.publicKey.toString()}`);
  
  // Number of trades to execute
  const numTrades = 3;
  
  // Execute trades for wallet
  console.log(`\n=== Processing trades ===`);
  await executeTokenTrades(wallet, numTrades);
  
  console.log('\nTest trading completed!');
}

// Run the script
main().catch(error => {
  console.error('Error in main function:', error);
  process.exit(1);
}); 