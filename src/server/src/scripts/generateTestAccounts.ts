import { 
  Connection, 
  Keypair, 
  LAMPORTS_PER_SOL, 
  PublicKey, 
  sendAndConfirmTransaction, 
  SystemProgram, 
  Transaction 
} from '@solana/web3.js';
import * as bs58 from 'bs58';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { QuoteResponse } from '@jup-ag/api';

dotenv.config();

// Configuration
const NUM_ACCOUNTS = 5; // Number of test accounts to generate
const SOL_AMOUNT_PER_TRADE = 0.04; // Amount of SOL to use per trade
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const JUPITER_API_URL = "https://lite-api.jup.ag";
const TEST_TOKEN_MINTS = [
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', // mSOL
  'So11111111111111111111111111111111111111112', // Wrapped SOL
  'AfXGjKVcYKUYz8jGN1NQA5GgxHjrfJVvwL4zzDt5iJqR', // HALO
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', // ETH (Wormhole)
  '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj', // stSOL
  'MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey', // MNDE
  'kinXdEcpDQeHPEuQnqmUgtYykqKGVFq6CeVX5iAHJq6', // KIN
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', // PYTH
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', // RAY
  'poLisWXnNRwC6oBu1vHiuKQzFjGL4XDSu4g9qjz9qVk', // POLIS
  '49Jy3P5J41zkcCgaveKXQfeUU3zNCHCSEEypkJTrpump', // PLINC
  'DfDaFv16v6FaQJ8D7xH5Cy9GF9bm4Qfa8GrRKFqr8Gps', // CHIC
  '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', // SAMO
  'F23R8Bw9HeHaRGQuAVsGyDB9PKCPfK5X5bqUQY6J7U3c', // SIX
  'NeonTjSjsuo3rexttjKF7Kb35Q5Z8tknwJnoEWHuFd7', // NEON
  'DNBKJar7QcHEswh9J6yrDAcrFbZbAhHNMfqUNEVyzgq1', // DUNK
  '8PudpomcDzTCpn6ZgvTuNMu2uDNxT9mW452bQz5JxnN3', // MOLE
];

// Directory to save wallet keypairs
const WALLETS_DIR = path.join(__dirname, 'test-wallets');

// Ensure directories exist
if (!fs.existsSync(WALLETS_DIR)){
  fs.mkdirSync(WALLETS_DIR, { recursive: true });
}

// Initialize connection to Solana
const connection = new Connection(RPC_URL, 'confirmed');

/**
 * Generate a new Solana wallet
 */
function generateWallet(): Keypair {
  const keypair = Keypair.generate();
  return keypair;
}

/**
 * Save wallet keypair to a file
 */
function saveWallet(keypair: Keypair, index: number): void {
  const walletData = {
    publicKey: keypair.publicKey.toString(),
    privateKey: bs58.encode(keypair.secretKey),
  };
  
  const filePath = path.join(WALLETS_DIR, `wallet-${index}.json`);
  fs.writeFileSync(filePath, JSON.stringify(walletData, null, 2));
  console.log(`Wallet ${index} saved to ${filePath}`);
}

/**
 * Load wallet keypair from a file
 */
function loadWallet(index: number): Keypair | null {
  try {
    const filePath = path.join(WALLETS_DIR, `wallet-${index}.json`);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    const walletData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Keypair.fromSecretKey(bs58.decode(walletData.privateKey));
  } catch (error) {
    console.error(`Error loading wallet ${index}:`, error);
    return null;
  }
}

/**
 * Get Jupiter quote for a token swap
 */
async function getJupiterQuote(
  inputMint: string, 
  outputMint: string, 
  amount: number
): Promise<QuoteResponse | null> {
  try {
    const amountInLamports = Math.floor(amount * LAMPORTS_PER_SOL);
    const queryParams = new URLSearchParams({
      inputMint: inputMint,
      outputMint: outputMint,
      amount: amountInLamports.toString(),
      slippageBps: '50'  // 0.5% slippage
    }).toString();
    
    const quoteUrl = `${JUPITER_API_URL}/swap/v1/quote?${queryParams}`;
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
 * Execute a token swap using Jupiter
 */
async function executeJupiterSwap(
  wallet: Keypair,
  inputMint: string,
  outputMint: string,
  amount: number
): Promise<string | null> {
  try {
    // 1. Get Jupiter quote for the swap
    console.log(`Getting quote for ${amount} SOL to ${outputMint}...`);
    const quoteResponse = await getJupiterQuote(inputMint, outputMint, amount);
    
    if (!quoteResponse || !quoteResponse.outAmount) {
      throw new Error('Invalid quote response from Jupiter');
    }
    
    console.log(`Quote received: ${quoteResponse.outAmount} tokens`);
    
    // 2. Get swap instructions
    console.log('Getting swap instructions...');
    const swapRequest = {
      quoteResponse: quoteResponse,
      userPublicKey: wallet.publicKey.toString(),
      wrapUnwrapSOL: true
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
    
    // Create a new transaction
    const transaction = new Transaction();
    
    // Add compute budget instructions if present
    if (swapResponse.computeBudgetInstructions) {
      for (const instruction of swapResponse.computeBudgetInstructions) {
        const programId = new PublicKey(instruction.programId);
        const instructionData = Buffer.from(instruction.data, 'base64');
        
        transaction.add({
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
        
        transaction.add({
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
    
    // Add cleanup instruction if present
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
    console.log('Sending transaction...');
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet],
      { commitment: 'confirmed' }
    );
    
    console.log(`Transaction confirmed: ${signature}`);
    return signature;
  } catch (error) {
    console.error('Error executing swap:', error);
    return null;
  }
}

/**
 * Fund a test wallet with SOL from a source wallet
 */
async function fundWallet(sourceKeypair: Keypair, destinationPublicKey: PublicKey, amount: number): Promise<string | null> {
  try {
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: sourceKeypair.publicKey,
        toPubkey: destinationPublicKey,
        lamports: amount * LAMPORTS_PER_SOL
      })
    );
    
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = sourceKeypair.publicKey;
    
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [sourceKeypair],
      { commitment: 'confirmed' }
    );
    
    return signature;
  } catch (error) {
    console.error('Error funding wallet:', error);
    return null;
  }
}

/**
 * Generate test accounts and save them to files
 */
async function generateTestAccounts(): Promise<void> {
  console.log(`Generating ${NUM_ACCOUNTS} test accounts...`);
  
  for (let i = 0; i < NUM_ACCOUNTS; i++) {
    // Check if wallet already exists
    const existingWallet = loadWallet(i);
    
    if (existingWallet) {
      console.log(`Wallet ${i} already exists, skipping generation`);
      continue;
    }
    
    // Generate new wallet
    const wallet = generateWallet();
    console.log(`Generated wallet ${i} with public key: ${wallet.publicKey.toString()}`);
    
    // Save wallet to file
    saveWallet(wallet, i);
  }
}

/**
 * Execute token trades for a specific wallet
 */
async function executeTokenTradesForWallet(
  walletIndex: number, 
  sourceKeypair: Keypair, 
  numTrades: number
): Promise<void> {
  const wallet = loadWallet(walletIndex);
  
  if (!wallet) {
    console.error(`Wallet ${walletIndex} not found`);
    return;
  }
  
  // Check wallet balance
  const balance = await connection.getBalance(wallet.publicKey);
  
  // Fund wallet if needed
  if (balance < SOL_AMOUNT_PER_TRADE * LAMPORTS_PER_SOL * 2) {
    const amountToFund = 0.1 + (numTrades * SOL_AMOUNT_PER_TRADE);
    console.log(`Funding wallet ${walletIndex} with ${amountToFund} SOL...`);
    
    const signature = await fundWallet(sourceKeypair, wallet.publicKey, amountToFund);
    
    if (!signature) {
      console.error(`Failed to fund wallet ${walletIndex}`);
      return;
    }
    
    console.log(`Wallet ${walletIndex} funded with ${amountToFund} SOL: ${signature}`);
    
    // Wait for confirmation
    await new Promise(resolve => setTimeout(resolve, 2000));
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
    
    console.log(`\nExecuting trade ${i + 1}/${numTrades} for wallet ${walletIndex}...`);
    console.log(`Swapping ${SOL_AMOUNT_PER_TRADE} SOL for ${targetToken}...`);
    
    // Buy token
    const buySignature = await executeJupiterSwap(
      wallet,
      'So11111111111111111111111111111111111111112', // Wrapped SOL
      targetToken,
      SOL_AMOUNT_PER_TRADE
    );
    
    if (!buySignature) {
      console.error(`Failed to execute buy swap for wallet ${walletIndex}`);
      continue;
    }
    
    console.log(`Buy transaction confirmed: ${buySignature}`);
    
    // Wait between transactions
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Sell token back to SOL
    console.log(`Swapping ${targetToken} back to SOL...`);
    const sellSignature = await executeJupiterSwap(
      wallet,
      targetToken,
      'So11111111111111111111111111111111111111112', // Wrapped SOL
      0.00001 // Amount doesn't matter here as we're using all tokens
    );
    
    if (!sellSignature) {
      console.error(`Failed to execute sell swap for wallet ${walletIndex}`);
      continue;
    }
    
    console.log(`Sell transaction confirmed: ${sellSignature}`);
    
    // Wait between trades
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log('Starting test account generator...');
  
  // Check for source wallet private key
  const sourcePrivateKey = process.env.TEST_SOURCE_WALLET_PRIVATE_KEY;
  if (!sourcePrivateKey) {
    console.error('Error: TEST_SOURCE_WALLET_PRIVATE_KEY not found in environment variables');
    console.log('Please add a source wallet private key to your .env file');
    process.exit(1);
  }
  
  // Load source wallet
  const sourceKeypair = Keypair.fromSecretKey(bs58.decode(sourcePrivateKey));
  console.log(`Source wallet: ${sourceKeypair.publicKey.toString()}`);
  
  // Check source wallet balance
  const sourceBalance = await connection.getBalance(sourceKeypair.publicKey);
  console.log(`Source wallet balance: ${sourceBalance / LAMPORTS_PER_SOL} SOL`);
  
  if (sourceBalance < 0.1 * LAMPORTS_PER_SOL) {
    console.error('Error: Source wallet has insufficient funds. Please add SOL to it.');
    process.exit(1);
  }
  
  // Generate test accounts
  await generateTestAccounts();
  
  // Number of trades for each wallet
  const numTradesPerWallet = 3;
  
  // Execute trades for each wallet
  for (let i = 0; i < NUM_ACCOUNTS; i++) {
    console.log(`\n=== Processing wallet ${i} ===`);
    await executeTokenTradesForWallet(i, sourceKeypair, numTradesPerWallet);
  }
  
  console.log('\nTest accounts generation and trades completed!');
}

// Run the script
main().catch(error => {
  console.error('Error in main function:', error);
  process.exit(1);
}); 