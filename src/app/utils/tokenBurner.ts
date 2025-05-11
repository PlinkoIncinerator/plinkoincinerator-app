import {
  ComputeBudgetProgram,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
  PublicKey,
  TransactionInstruction,
  Transaction,
} from "@solana/web3.js";
import {
  createCloseAccountInstruction,
  createBurnInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Config } from "../config/solana";
import bs58 from "bs58";
import { getTokenMetadata } from "./tokenMetadata";
import { TokenAccount, TokenAccountData } from "./tokenAccounts";

/**
 * Token Burner Utility
 * 
 * This module handles burning tokens and closing token accounts.
 * 
 * Note on Swap Instructions:
 * When performing a swap through Jupiter, we cannot close the token account
 * in the same transaction due to token account state changes during the swap.
 * Attempting to close the account after a swap results in a "InvalidAccountData"
 * error from the Token Program. Therefore, we skip closing accounts after swap
 * operations. These accounts will need to be closed in a separate transaction.
 */

// Constants for compact array encoding
const LOW_VALUE = 127; // 0x7f
const HIGH_VALUE = 16383; // 0x3fff

/**
 * Compact u16 array header size
 * @param n elements in the compact array
 * @returns size in bytes of array header
 */
const compactHeader = (n: number) => (n <= LOW_VALUE ? 1 : n <= HIGH_VALUE ? 2 : 3);

/**
 * Compact u16 array size
 * @param n elements in the compact array
 * @param size bytes per each element
 * @returns size in bytes of array
 */
const compactArraySize = (n: number, size: number) => compactHeader(n) + n * size;

/**
 * Accurately estimates transaction size in bytes
 * @param instructions Array of TransactionInstructions
 * @param feePayer The public key of the fee payer
 * @returns Estimated size in bytes
 */
const estimateTransactionSize = (
  instructions: TransactionInstruction[],
  feePayer: PublicKey
): number => {
  if (!instructions || instructions.length === 0) return 0;
  
  // Convert to legacy Transaction for size calculation
  const tx = new Transaction().add(...instructions);
  
  const feePayerPk = [feePayer.toBase58()];
  const signers = new Set<string>(feePayerPk);
  const accounts = new Set<string>(feePayerPk);

  const ixsSize = tx.instructions.reduce((acc, ix) => {
    ix.keys.forEach(({ pubkey, isSigner }) => {
      const pk = pubkey.toBase58();
      if (isSigner) signers.add(pk);
      accounts.add(pk);
    });

    accounts.add(ix.programId.toBase58());

    const nIndexes = ix.keys.length;
    const opaqueData = ix.data.length;

    return (
      acc +
      1 + // PID index
      compactArraySize(nIndexes, 1) +
      compactArraySize(opaqueData, 1) + 2
    );
  }, 0);

  return (
    compactArraySize(signers.size, 64) + // signatures
    3 + // header
    compactArraySize(accounts.size, 32) + // accounts
    32 + // blockhash
    compactHeader(tx.instructions.length) + // instructions
    ixsSize
  );
};

interface BurnResult {
  success: boolean;
  message: string;
  signature?: string;
  feeTransferSignature?: string;
  totalAmount?: number;
  closedCount?: number;
  swappedButNotClosed?: number;
  processedTokens?: string[];
}

/**
 * Verifies a transaction with the server
 * @param walletAddress The wallet address
 * @param signature The transaction signature
 * @param feeTransferSignature Optional fee transfer signature
 * @param directWithdrawal Whether this was a direct withdrawal
 * @param forGambling Whether this was for gambling
 * @returns Promise with verification result
 */
export async function verifyTransactionWithServer(
  walletAddress: string,
  signature: string,
  feeTransferSignature?: string,
  directWithdrawal: boolean = false,
  forGambling: boolean = false
): Promise<{ status: string; message?: string; amount?: number }> {
  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
    const verifyResponse = await fetch(`${API_URL}/api/verify-transaction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress,
        signature,
        feeTransferSignature,
        directWithdraw: directWithdrawal,
        forGambling
      }),
    });
    
    if (!verifyResponse.ok) {
      return {
        status: 'error',
        message: `Server responded with status: ${verifyResponse.status}`
      };
    }
    
    const verifyResult = await verifyResponse.json();
    return verifyResult;
  } catch (error) {
    console.error('Error verifying transaction with server:', error);
    return {
      status: 'error',
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Burns tokens, closes accounts, and returns SOL to the wallet
 * @param selectedTokens Array of token account pubkeys to process
 * @param dynamicWallet Dynamic wallet instance for signing (if available)
 * @param directWithdrawal Whether to withdraw directly (true) or use for gambling (false)
 * @param maxTokens Maximum number of tokens to process in one transaction
 * @param onSizeLimitExceeded Callback when transaction size exceeds limit, returns recommended batch size
 * @returns Result object with transaction details
 */
export async function burnTokens(
  selectedTokens?: string[],
  dynamicWallet?: any,
  directWithdrawal: boolean = false,
  maxTokens: number = 15,
  onSizeLimitExceeded?: (recommendedBatchSize: number) => void
): Promise<BurnResult> {
  // Add a tracking variable to count tokens that were swapped but not closed
  let swappedButNotClosed = 0;

  try {
    if (!Config.solWallet.publicKey) {
      return {
        success: false,
        message: "Wallet not connected",
        closedCount: 0,
      };
    }

    // Check if we have a wallet to sign transactions
    if (!dynamicWallet && !Config.solWallet.payer) {
      return {
        success: false,
        message: "No wallet available to sign transactions. Please provide a Dynamic wallet or configure a keypair.",
        closedCount: 0,
      };
    }

    const atas = await Config.connection.getParsedTokenAccountsByOwner(
      Config.solWallet.publicKey,
      {
        programId: TOKEN_PROGRAM_ID,
      }
    );

    console.log("atas", atas);

    // Filter accounts based on selectedTokens if provided
    let accountsToProcess = atas.value;

    console.log("accountsToProcess", accountsToProcess);
    if (selectedTokens && selectedTokens.length > 0) {
      // If specific tokens are selected, only process those
      accountsToProcess = atas.value.filter(ata => {
        return selectedTokens.includes(ata.pubkey.toString());
      });
    }

    console.log("accountsToProcess", accountsToProcess);
    console.log("maxTokens", maxTokens);

    // Calculate approximate SOL return (0.00203928 SOL per token account closed)
    const expectedReturnPerAccount = 0.00203928;
    // Limit to maxTokens token accounts at once to reduce transaction size and complexity
    const accountsToClose = Math.min(accountsToProcess.length, maxTokens);
    
    if (accountsToClose === 0) {
      return {
        success: false,
        message: "No token accounts available to incinerate on tokenBurner.ts",
        closedCount: 0,
      };
    }

    const totalEligibleAccounts = accountsToProcess.length;
    const isBatch = totalEligibleAccounts > accountsToClose;
    
    const expectedReturn = expectedReturnPerAccount * accountsToClose;
    const feeAmount = expectedReturn * Config.FEE_PERCENTAGE;
    
    // Always ensure the fee wallet is set
    
    if (!Config.FEE_WALLET) {
      return {
        success: false,
        message: "Fee wallet not properly configured.",
        closedCount: 0,
      };
    }
    
    // STEP 1: Incinerate token accounts
    console.log(`Preparing to incinerate ${accountsToClose} token accounts...`);
    if (isBatch) {
      console.log(`Processing as batch ${accountsToClose} of ${totalEligibleAccounts} eligible accounts`);
    }
    console.log(`Mode: ${directWithdrawal ? 'Direct Withdrawal' : 'Gambling'}`);
    
    // Initialize the instructions array with the compute budget instructions
    const incinerateInstructions = [
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 25000 }),
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 }),
    ];

    let closedCount = 0;
    
    // Process selected token accounts (up to maxTokens)
    for (const ata of accountsToProcess.slice(0, accountsToClose)) {
      const data = (ata.account.data.parsed as TokenAccountData).info;
      
      // Skip blacklisted tokens (defined in tokenAccounts.ts)
      // import { blacklist } from "./tokenAccounts";
      // if (blacklist.includes(data.mint)) continue;
      
      // Define helper function to burn tokens and close account
      const burnOrCloseAccount = (burn: boolean = true) => {
        // First burn remaining tokens (required before closing non-empty account)
        if (parseInt(data.tokenAmount.amount) > 0 && burn) {
          incinerateInstructions.push(
            createBurnInstruction(
              ata.pubkey,                    // Token account
              new PublicKey(data.mint),      // Mint
              Config.solWallet.publicKey!,   // Owner - using non-null assertion
              parseInt(data.tokenAmount.amount) // Amount to burn
            )
          );
          console.log(`Burning ${data.tokenAmount.uiAmount} tokens from mint ${data.mint}`);
        }
        
        // Then close the account
        incinerateInstructions.push(
          createCloseAccountInstruction(
            ata.pubkey,
            Config.solWallet.publicKey!,     // Using non-null assertion
            Config.solWallet.publicKey!      // Using non-null assertion
          )
        );
        console.log("Incinerating token:", data.mint);
      };
      
      // Skip accounts with non-zero balance
      if (data.tokenAmount.amount !== "0") {
        const amount = data.tokenAmount.amount; // in base units
        const decimals = data.tokenAmount.decimals;
        const amountInBaseUnits = parseInt(amount);
        const tokenAmount = parseFloat(data.tokenAmount.uiAmountString || '0');
        
        console.log(`Token ${data.mint} amount: ${tokenAmount} ${data.mint.slice(0, 4)}`);
        
        // Set up for Jupiter quote
        const inputMint = data.mint;
        const outputMint = "So11111111111111111111111111111111111111112"; // SOL

        // Check current transaction size estimate - if we're already close to the limit,
        // treat this token as non-swappable to avoid complex instructions
        const estimatedCurrentSize = estimateTransactionSize(incinerateInstructions, Config.solWallet.publicKey!);
        console.log("estimatedCurrentSize", estimatedCurrentSize);
        // If already at 80% of max transaction size, treat token as non-swappable
        // to avoid adding complex swap instructions
        const MAX_TX_SIZE = 1232;
        if (estimatedCurrentSize > MAX_TX_SIZE) {
          console.log(`Transaction size already at ${estimatedCurrentSize} bytes (${Math.round(estimatedCurrentSize/MAX_TX_SIZE*100)}% of max). Treating token ${data.mint} as non-swappable.`);
          burnOrCloseAccount();
          closedCount++;
          continue;
        }

        // Get Jupiter quote to determine SOL value
        const queryParams = new URLSearchParams({
          inputMint: inputMint,
          outputMint: outputMint,
          amount: amountInBaseUnits.toString(),
          slippageBps: '100'
        }).toString();
        
        const quoteUrl = `https://quote-api.jup.ag/v6/quote?${queryParams}`;
        
        try {
          const quoteRes = await fetch(quoteUrl);
          const quoteData = await quoteRes.json();
          
          // Check if we successfully got a valid quote that we can use
          if (quoteRes.ok && !quoteData.errorCode) {
            // Extract expected output amount in lamports (SOL's smallest unit)
            const outAmount = quoteData.outAmount;
            const outAmountInSol = parseInt(outAmount) / 1_000_000_000; // Convert lamports to SOL
            
            console.log(`Token ${data.mint} estimated value: ${outAmountInSol} SOL`);
            
            // Check if token value is too small to justify swap costs
            // We need to consider both absolute value and value relative to token amount
            const valuePerToken = outAmountInSol / tokenAmount;
            console.log(`Value per token: ${valuePerToken.toExponential(6)} SOL (${tokenAmount} tokens)`);
            
            // Consider a token low value if:
            // 1. Absolute value is less than 0.000005 SOL (~$0.0001 at $20 SOL price) OR
            // 2. Value per token is extremely low (below 0.00000000001 SOL per token) AND total value below 0.0001 SOL
            if (outAmountInSol < 0.000005 || (valuePerToken < 0.00000000001 && outAmountInSol < 0.0001)) {
              console.log(`Token ${data.mint} has negligible value (${outAmountInSol} SOL), proceeding with burn and close`);
              
              // Handle as low value - burn tokens and close account
              burnOrCloseAccount();
              closedCount++;
              continue;
            }
            
            // Check if the swap route is too complex (has too many hops)
            // if (quoteData?.routePlan && quoteData.routePlan.length > 2) {
            //   console.log(`Route too complex for ${data.mint}, defaulting to burn and close`);
              
            //   // Handle as low value - burn tokens and close account
            //   burnOrCloseAccount();
            //   closedCount++;
            //   continue;
            // }

            console.log("quoteData", quoteData);
            // Get swap instructions for successful Jupiter quote with optimizations
            const swapReq = {
              quoteResponse: quoteData,
              userPublicKey: Config.solWallet.publicKey.toString(),
              wrapUnwrapSOL: false,
              slippageBps: 50,
              useSharedAccounts: true, // Use shared program accounts to reduce transaction size
              dynamicComputeUnitLimit: false, // Turn off dynamic limit since we're setting our own
              computeUnitPriceMicroLamports: 25000, // Match our compute budget price
              // Don't skip RPC calls to ensure proper account setup
              skipUserAccountsRpcCalls: true,
            };
            const swapRes = await fetch("https://quote-api.jup.ag/v6/swap-instructions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(swapReq)
            });

            console.log("swapRes", swapRes);
            
            if (!swapRes.ok) {
              console.log(`Failed to get swap instructions for ${data.mint}, defaulting to burn and close`);
              
              // Handle as low value - burn tokens and close account
              burnOrCloseAccount();
              closedCount++;
              continue;
            }
            
            const swapInstructions = await swapRes.json();

            console.log("swapInstructions", swapInstructions);

            // Validate the swap instructions structure
            if (!swapInstructions || 
                !swapInstructions.swapInstruction || 
                !swapInstructions.swapInstruction.accounts ||
                !swapInstructions.swapInstruction.data ||
                !swapInstructions.swapInstruction.programId) {
              console.log(`Invalid swap instruction format for ${data.mint}, defaulting to burn and close`);
              
              // Handle as low value - burn tokens and close account
              burnOrCloseAccount();
              closedCount++;
              continue;
            }

            // Add all Jupiter instructions to your transaction

            console.log("swapInstructions.setupInstructions", swapInstructions.setupInstructions);
            console.log("swapInstructions.swapInstruction", swapInstructions.swapInstruction);
            console.log("swapInstructions.cleanupInstruction", swapInstructions.cleanupInstruction);
            for (const ix of [
              ...(swapInstructions.setupInstructions || []),
              swapInstructions.swapInstruction,
              ...(swapInstructions.cleanupInstruction ? [swapInstructions.cleanupInstruction] : [])
            ]) {
              try {
                console.log("ix", ix);
                // Convert raw Jupiter instruction to TransactionInstruction
                const keys = ix.accounts.map((acc: any) => ({
                  pubkey: new PublicKey(acc.pubkey),
                  isSigner: acc.isSigner,
                  isWritable: acc.isWritable
                }));

                console.log("keys", keys);
                const programId = new PublicKey(ix.programId);
                
                // Safely decode the data
                let data;
                try {
                  // Handle different data formats from Jupiter API
                  if (typeof ix.data === 'string') {
                    // If data is base64 string
                    data = Buffer.from(ix.data, 'base64');
                  } else if (ix.data instanceof Uint8Array) {
                    // If data is already a Uint8Array
                    data = Buffer.from(ix.data);
                  } else if (Array.isArray(ix.data)) {
                    // If data is array of numbers
                    data = Buffer.from(ix.data);
                  } else {
                    console.log("Unknown data format:", ix.data);
                    // Skip this instruction if data format is unknown
                    continue;
                  }
                } catch (dataError) {
                  console.error("Error decoding instruction data:", dataError);
                  console.log("Problematic data:", ix.data);
                  // Skip this instruction
                  continue;
                }
                
                const transactionInstruction = new TransactionInstruction({
                  keys,
                  programId,
                  data
                });

                console.log("transactionInstruction", transactionInstruction);
                
                incinerateInstructions.push(transactionInstruction);
              } catch (ixError) {
                console.error("Error processing instruction:", ixError);
                // Skip this instruction and continue with others
                continue;
              }
            }
            // DON'T add close account instruction here - we'll add it conditionally below

            console.log("incinerateInstructions", incinerateInstructions);
            // Check if transaction size would exceed limit if we add close instruction
            const currentSizeAfterSwap = estimateTransactionSize(incinerateInstructions, Config.solWallet.publicKey!);
            console.log(`Transaction size after swap: ${currentSizeAfterSwap} bytes`);
            
            // Only try to close the account if transaction size allows
            if (currentSizeAfterSwap + 100 < MAX_TX_SIZE) { // 100 bytes buffer for close instruction
              try {
                console.log("Adding close account instruction after swap");
                incinerateInstructions.push(
                  createCloseAccountInstruction(
                    ata.pubkey,
                    Config.solWallet.publicKey!,
                    Config.solWallet.publicKey!
                  )
                );
                console.log("Account will be closed in same transaction as swap");
              } catch (closeError) {
                console.error(`Error adding close instruction: ${closeError}`);
                // If adding the close instruction fails, increment the counter
                swappedButNotClosed++;
                console.log(`WARNING: Account ${ata.pubkey.toString()} for token ${data.mint} will remain in wallet with zero balance`);
              }
            } else {
              console.log(`Skipping close account instruction - transaction size would exceed limit (${currentSizeAfterSwap} bytes)`);
              swappedButNotClosed++;
              console.log(`WARNING: Account ${ata.pubkey.toString()} for token ${data.mint} will remain in wallet with zero balance`);
            }

            console.log("incinerateInstructions", incinerateInstructions);
            
            // After a successful swap, count the token as processed
            closedCount++;
            continue;
          } else {

            console.log("quoteData", quoteData);
            // Jupiter returned an error or couldn't find a route
            // Check specifically for "no route" errors
            if (quoteData.error === 'Could not find any route' || quoteData.errorCode === 'RouteNotFound') {
              console.log(`No swap route available for ${data.mint}. Treating as non-swappable and proceeding with burn and close.`);
              
              // Handle as non-swappable - burn tokens and close account
              burnOrCloseAccount();
              closedCount++;
              continue;
            }
            
            // For other errors, try to use token metadata as fallback
            console.log(`Jupiter API error for ${data.mint}: ${quoteData.error || quoteData.errorCode || 'Unknown error'}`);
            
            try {
              // Try getting the token metadata which might have price info
              const tokenMetadata = await getTokenMetadata(data.mint);
              
              if (tokenMetadata.priceUsd) {
                // If we have USD price, we can calculate SOL value
                // Assume 1 SOL = $20 if we don't have exact price
                const solPrice = 140; 
                
                // Calculate estimated SOL value
                const estimatedValueInSol = (tokenMetadata.priceUsd * tokenAmount) / solPrice;
                console.log(`Token ${data.mint} metadata-estimated value: ${estimatedValueInSol} SOL`);
                
                // Check if token value is too small to justify swap costs
                if (estimatedValueInSol < 0.000005 || (estimatedValueInSol / tokenAmount < 0.00000000001 && estimatedValueInSol < 0.0001)) {
                  console.log(`Token ${data.mint} has negligible value based on metadata, proceeding with burn and close`);
                  
                  // Handle as low value - burn tokens and close account
                  burnOrCloseAccount();
                  closedCount++;
                  continue;
                } else {
                  // MODIFY THIS SECTION: If Jupiter couldn't find a route, we should treat it as likely a scam token
                  // or otherwise not swappable, regardless of its reported value
                  if (quoteData.error === 'Could not find any route' || quoteData.errorCode === 'RouteNotFound') {
                    console.log(`Token ${data.mint} has reported value but no swap route available. Treating as non-swappable and proceeding with burn and close.`);
                    
                    // Handle as non-swappable - burn tokens and close account
                    burnOrCloseAccount();
                    closedCount++;
                    continue;
                  }
                  
                  // This is the only case where we skip a token - when we know it has significant value
                  // but we can't swap it through Jupiter for some other reason than no routes
                  console.log(`Token ${data.mint} has significant value (${estimatedValueInSol} SOL) but no swap route. Skipping.`);
                  continue;
                }
              } else {
                // No price data in metadata, default to burn and close
                console.log(`No price data found for ${data.mint}, defaulting to burn and close`);
                
                // Handle as low value - burn tokens and close account
                burnOrCloseAccount();
                closedCount++;
                continue;
              }
            } catch (metadataError) {
              // Error fetching metadata, default to burn and close
              console.log(`Error fetching metadata for ${data.mint}, defaulting to burn and close`);
              
              // Handle as low value - burn tokens and close account
              burnOrCloseAccount();
              closedCount++;
              continue;
            }
          }
        } catch (error) {
          console.error(`Error getting quote for ${data.mint}:`, error);
          
          // For network/API errors, default to burn and close
          console.log(`Error occurred for ${data.mint}, defaulting to burn and close`);
          
          // Handle as low value - burn tokens and close account
          burnOrCloseAccount();
          closedCount++;
          continue;
        }
      } else {
        // Account has zero balance, just close it
        incinerateInstructions.push(
          createCloseAccountInstruction(
            ata.pubkey,
            Config.solWallet.publicKey!,
            Config.solWallet.publicKey!
          )
        );
        console.log("Incinerating empty token account:", data.mint);
        closedCount++;
      }
    }
    
    console.log("closedCount", closedCount);
    if (closedCount === 0) {
      return {
        success: false,
        message: "No eligible token accounts to incinerate",
        closedCount: 0,
      };
    }

    // If this is a direct withdrawal, add a fee transfer instruction to the incineration transaction
    // For gambling mode, we also include the fee transfer but send the full amount to the fee wallet
    if (directWithdrawal) {
      console.log(`Adding fee transfer of ${feeAmount} SOL to ${Config.FEE_WALLET.toString()} in the same transaction`);
      
      // Create fee transfer instruction directly in the incineration transaction
      incinerateInstructions.push(
        SystemProgram.transfer({
          fromPubkey: Config.solWallet.publicKey,
          toPubkey: Config.FEE_WALLET,
          lamports: Math.floor(feeAmount * 1_000_000_000), // Convert SOL to lamports
        })
      );
    } else {
      // For gambling, we send the entire expected return to the fee wallet
      // The server will recognize this as a gambling deposit and add it to the user's balance
      console.log(`Adding full transfer of ${expectedReturn} SOL to ${Config.FEE_WALLET.toString()} for gambling`);
      
      // Create fee transfer instruction directly in the incineration transaction
      incinerateInstructions.push(
        SystemProgram.transfer({
          fromPubkey: Config.solWallet.publicKey,
          toPubkey: Config.FEE_WALLET,
          lamports: Math.floor(expectedReturn * 1_000_000_000), // Convert SOL to lamports
        })
      );
    }

    // Sign and send the transaction
    let signature: string;
    
    // Use Dynamic wallet if provided
    if (dynamicWallet) {
      try {
        console.log("Using Dynamic wallet to sign incineration transaction");
        
        // Get the latest blockhash
        const connection = await dynamicWallet.getConnection();
        const blockhash = await connection.getLatestBlockhash();

        console.log("incinerateInstructions", incinerateInstructions);
        
        console.log(`Instructions count: ${incinerateInstructions.length}`);
        // Debugging to inspect transaction size
        const instructionsSizes = incinerateInstructions.map((ix, index) => {
          const size = ix.data ? ix.data.length : 0;
          return `Instruction #${index}: ${size} bytes`;
        });
        console.log("Instructions sizes:", instructionsSizes);
        
        // Create the transaction message
        const messageV0 = new TransactionMessage({
          instructions: incinerateInstructions,
          payerKey: Config.solWallet.publicKey,
          recentBlockhash: blockhash.blockhash,
        }).compileToV0Message();
        
        // Create the versioned transaction
        const incinerateTxn = new VersionedTransaction(messageV0);
        
        // Check transaction size before attempting serialization
        // Use accurate transaction size estimation
        const estimatedSize = estimateTransactionSize(incinerateInstructions, Config.solWallet.publicKey!);
        
        console.log(`Estimated transaction size: ${estimatedSize} bytes`);
        
        // Solana has a transaction size limit of 1232 bytes
        const MAX_TX_SIZE = 1232;
        // if (estimatedSize > MAX_TX_SIZE) { // Allow 10% margin since our estimate is now more accurate
        //   throw new Error(`Transaction too large: ${estimatedSize} bytes (max: ${MAX_TX_SIZE}). Try closing fewer accounts at once.`);
        // }
        
        try {
          // Try to serialize the transaction to check actual size
          const serializedTx = incinerateTxn.serialize();
          console.log(`Actual transaction size: ${serializedTx.length} bytes`);
          
          if (serializedTx.length > MAX_TX_SIZE) {
            // Calculate a recommended batch size based on the current size
            const recommendedSize = Math.max(1, Math.floor(maxTokens * (MAX_TX_SIZE / serializedTx.length) * 0.8));
            console.log(`Transaction too large: ${serializedTx.length} bytes (max: ${MAX_TX_SIZE}). Recommended batch size: ${recommendedSize}`);
            
            // Call the callback if provided
            if (onSizeLimitExceeded) {
              onSizeLimitExceeded(recommendedSize);
            }
            
            throw new Error(`Transaction too large: ${serializedTx.length} bytes (max: ${MAX_TX_SIZE}). Try closing fewer accounts at once.`);
          }
        } catch (serializationError) {
          console.error("Transaction serialization failed:", serializationError);
          
          // If we have many complex instructions, reduce the number of token accounts processed
          if (serializationError instanceof RangeError || 
              (serializationError.message && serializationError.message.includes("overrun"))) {
            // Calculate a conservative recommended batch size
            const recommendedSize = Math.max(1, Math.floor(maxTokens / 2));
            console.log(`Transaction exceeds size limits. Recommended batch size: ${recommendedSize}`);
            
            // Call the callback if provided
            if (onSizeLimitExceeded) {
              onSizeLimitExceeded(recommendedSize);
            }
            
            throw new Error("Transaction exceeds size limits. Please try incinerating fewer token accounts at once.");
          }
          
          // Re-throw other serialization errors
          throw serializationError;
        }
        
        // Get the signer from the wallet
        console.log("Getting signer from Dynamic wallet");
        const signer = await dynamicWallet.getSigner();
        
        // Sign and send the transaction
        console.log("Calling signAndSendTransaction");
        const result = await signer.signAndSendTransaction(incinerateTxn);
        signature = result.signature;
        
        console.log(`Incineration transaction sent with signature: ${signature}`);
        
        // Wait for confirmation with a more resilient strategy
        console.log(`Waiting for incineration transaction confirmation...`);
        try {
          // Use a longer timeout and more attempts for confirmation
          const confirmationOptions = {
            signature,
            ...blockhash,
            commitment: 'confirmed',
            timeout: 60000 // 60 seconds timeout
          };
          
          const confirmationResult = await connection.confirmTransaction(confirmationOptions);
          
          if (confirmationResult.value.err) {
            throw new Error(`Transaction failed: ${confirmationResult.value.err}`);
          }
          
          console.log(`Incineration transaction confirmed successfully`);
          
          // Verify the transaction with the server immediately after confirmation
          if (dynamicWallet && dynamicWallet.address) {
            console.log('Verifying transaction with server...');
            const verificationResult = await verifyTransactionWithServer(
              dynamicWallet.address,
              signature,
              undefined, // feeTransferSignature is undefined at this point
              directWithdrawal,
              !directWithdrawal // forGambling is the opposite of directWithdrawal
            );
            
            if (verificationResult.status !== 'success') {
              console.warn(`Server verification warning: ${verificationResult.message}`);
            } else {
              console.log('Transaction verified with server successfully');
            }
          }
        } catch (confirmError) {
          // Don't throw for blockheight exceeded - check transaction status directly
          if (confirmError.message && confirmError.message.includes('block height exceeded')) {
            console.log("Transaction confirmation timed out, checking status directly...");
            
            // The transaction might still be successful even if confirmation timed out
            try {
              // Wait a moment before checking status
              await new Promise(resolve => setTimeout(resolve, 5000));
              
              // Check transaction status directly
              const status = await connection.getSignatureStatus(signature);
              
              if (status && status.value && !status.value.err) {
                console.log("Transaction was successful despite confirmation timeout");
                // Continue with success path
              } else if (status && status.value && status.value.err) {
                throw new Error(`Transaction failed: ${status.value.err}`);
              } else {
                throw new Error("Unable to determine transaction status");
              }
            } catch (statusError) {
              throw new Error(`Failed to check transaction status: ${statusError.message}`);
            }
          } else {
            // For other confirmation errors, throw normally
            throw confirmError;
          }
        }
      } catch (error) {
        console.error("Error signing with Dynamic wallet:", error);
        let errorMessage = "Unknown error";
        
        if (error instanceof Error) {
          errorMessage = error.message;
          
          // Check for common error types
          if (errorMessage.includes("timeout")) {
            errorMessage = "Transaction timed out. The network may be congested.";
          } else if (errorMessage.includes("rejected")) {
            errorMessage = "Transaction was rejected by the wallet.";
          } else if (errorMessage.includes("large") || errorMessage.includes("size") || errorMessage.includes("exceeds")) {
            // Make sure to throw this error rather than returning, so it can be caught in PlinkoIncinerator.tsx
            throw new Error("Transaction is too large. Try incinerating fewer tokens at once.");
          } else if (errorMessage.includes("insufficient funds")) {
            errorMessage = "Insufficient funds to complete the transaction.";
          } else if (errorMessage.includes("Ve: Unexpected")) {
            // This specific error seems to occur with Dynamic wallet
            errorMessage = "Dynamic wallet error. Try again with fewer tokens or restart your browser.";
          }
        }
        
        return {
          success: false,
          message: `Error signing with Dynamic wallet: ${errorMessage}`,
          closedCount: 0,
        };
      }
    } else {
      // Use direct keypair to sign (for testing environments)
      if (!Config.solWallet.payer) {
        return {
          success: false,
          message: "No wallet keypair available for signing",
          closedCount: 0,
        };
      }
      
      const block = await Config.connection.getLatestBlockhash({
        commitment: "processed",
      });
      
      const incinerateTxMessage = new TransactionMessage({
        instructions: incinerateInstructions,
        payerKey: Config.solWallet.publicKey,
        recentBlockhash: block.blockhash,
      }).compileToV0Message();
      
      const incinerateTxn = new VersionedTransaction(incinerateTxMessage);
      incinerateTxn.sign([Config.solWallet.payer]);
      signature = bs58.encode(incinerateTxn.signatures[0]);
      
      // Send the transaction
      console.log(`Sending incineration transaction with signature ${signature}`);
      await Config.connection.sendTransaction(incinerateTxn, {
        preflightCommitment: "processed",
        skipPreflight: false,
        maxRetries: 10,
      });
      
      console.log(`Confirming incineration transaction ${signature}`);
      const incinerateRes = await Config.connection.confirmTransaction(
        {
          ...block,
          signature,
        },
        "processed"
      );
      
      if (incinerateRes.value.err) {
        console.error(`Incineration transaction ${signature} failed: ${incinerateRes.value.err}`);
        return {
          success: false,
          message: `Incineration transaction failed: ${incinerateRes.value.err}`,
          signature,
          closedCount: 0,
        };
      }
      
      console.log(`Incineration transaction ${signature} confirmed successfully`);
    }
    
    // With a single line to set the feeSignature to undefined
    const feeSignature: string | undefined = undefined;

    const batchMessage = isBatch ? 
      ` (batch of ${closedCount}/${totalEligibleAccounts} accounts)` : '';
    
    let statusMessage = '';
    if (directWithdrawal) {
      statusMessage = `${closedCount} token accounts successfully incinerated with fee deducted${batchMessage}`;
    } else {
      statusMessage = `${closedCount} token accounts successfully incinerated with funds sent to gambling${batchMessage}`;
    }
    
    // Add note about accounts that were swapped but not closed
    if (swappedButNotClosed > 0) {
      statusMessage += `. Note: ${swappedButNotClosed} token accounts were swapped but remain in your wallet with zero balance.`;
    }
    
    return {
      success: true,
      message: statusMessage,
      signature,
      feeTransferSignature: feeSignature,
      totalAmount: expectedReturn,
      closedCount,
      swappedButNotClosed,
      processedTokens: selectedTokens,
    };
  } catch (error: any) {
    console.error("Incineration error:", error);
    
    // Check for specific errors that should bubble up
    if (error.message && (
      error.message.includes('Transaction too large') ||
      error.message.includes('exceeds size limits') ||
      error.message.includes('is too large') ||
      error.message.includes('transaction size')
    )) {
      // Re-throw transaction size errors so they can be caught in PlinkoIncinerator.tsx
      throw error;
    }
    
    // For other errors, return a failed result
    return {
      success: false,
      message: `Error: ${error.message || "Unknown error"}`,
      closedCount: 0,
    };
  }
}