import { Config } from "../config/solana";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { burnTokens, verifyTransactionWithServer } from "./tokenBurner";

/**
 * Process tokens in smaller batches
 */
export async function batchBurnTokens(
  selectedTokens?: string[],
  dynamicWallet?: any,
  directWithdrawal: boolean = false,
  batchSize: number = 3, // Default to smaller batch size
  progressCallback?: (progress: number, message: string) => void
): Promise<{
  success: boolean;
  message: string;
  processedCount: number;
  totalCount: number;
  signatures: string[];
  swappedButNotClosed?: number;
  processedTokens?: string[]; // Add this to track which specific tokens were processed
  verifiedSignatures?: string[]; // Add this to track verified transaction signatures
}> {
  try {
    if (!Config.solWallet.publicKey) {
      return {
        success: false,
        message: "Wallet not connected",
        processedCount: 0,
        totalCount: 0,
        signatures: [],
        processedTokens: [],
        verifiedSignatures: []
      };
    }
    
    // Check if we have a wallet to sign transactions
    if (!dynamicWallet && !Config.solWallet.payer) {
      return {
        success: false,
        message: "No wallet available to sign transactions",
        processedCount: 0,
        totalCount: 0,
        signatures: [],
        processedTokens: [],
        verifiedSignatures: []
      };
    }

    // Get all token accounts
    const atas = await Config.connection.getParsedTokenAccountsByOwner(
      Config.solWallet.publicKey,
      {
        programId: TOKEN_PROGRAM_ID,
      }
    );

    // Filter accounts based on selectedTokens if provided
    let accountsToProcess = atas.value;
    if (selectedTokens && selectedTokens.length > 0) {
      accountsToProcess = atas.value.filter(ata => 
        selectedTokens.includes(ata.pubkey.toString())
      );
    }
    
    const totalCount = accountsToProcess.length;
    
    // Sort accounts by complexity - empty accounts first, then accounts with tokens
    // This allows us to process empty accounts in larger batches, and accounts with tokens in smaller batches
    accountsToProcess.sort((a, b) => {
      const aEmpty = (a.account.data.parsed.info.tokenAmount.amount === "0");
      const bEmpty = (b.account.data.parsed.info.tokenAmount.amount === "0");
      
      if (aEmpty && !bEmpty) return -1; // Empty accounts first
      if (!aEmpty && bEmpty) return 1;
      return 0;
    });
    
    console.log("Sorted accounts by complexity - empty accounts first");
    const emptyCount = accountsToProcess.filter(a => a.account.data.parsed.info.tokenAmount.amount === "0").length;
    console.log(`Found ${emptyCount} empty accounts out of ${totalCount} total`);
    
    if (totalCount === 0) {
      return {
        success: false,
        message: "No token accounts available to incinerate on batchTokenBurner.ts",
        processedCount: 0,
        totalCount: 0,
        signatures: [],
        processedTokens: [],
        verifiedSignatures: []
      };
    }
    
    console.log(`Starting batch incineration of ${totalCount} tokens with batch size ${batchSize}`);
    
    // Track tokens that were swapped but not closed
    let totalSwappedButNotClosed = 0;
    
    // Track verified signatures
    const verifiedSignatures: string[] = [];
    
    // Process in batches
    const signatures: string[] = [];
    let processedCount = 0;
    let failedCount = 0;
    let remainingAccounts = [...accountsToProcess];
    let currentBatchSize = batchSize;
    let processedTokens: string[] = []; // Track which tokens were successfully processed
    
    // Start with larger batch size for empty accounts
    const initialEmptyAccountsCount = remainingAccounts.filter(a => 
      a.account.data.parsed.info.tokenAmount.amount === "0"
    ).length;
    
    // Use larger batch size for empty accounts (up to 15), smaller for accounts with tokens
    if (initialEmptyAccountsCount > 0) {
      currentBatchSize = Math.min(15, initialEmptyAccountsCount);
      console.log(`Starting with batch size ${currentBatchSize} for empty accounts`);
    } else {
      // For accounts with tokens that need swapping, start with smaller batch size
      currentBatchSize = Math.min(5, remainingAccounts.length);
      console.log(`Starting with smaller batch size ${currentBatchSize} for accounts with tokens`);
    }
    
    console.log("remainingAccounts", remainingAccounts);
    console.log("currentBatchSize", currentBatchSize);
    
    // Process batches until we've processed all accounts or reached a minimum batch size that still fails
    while (remainingAccounts.length > 0 && currentBatchSize > 0) {
      // Take the next batch of accounts
      const batch = remainingAccounts.slice(0, currentBatchSize);
      const batchTokenPubkeys = batch.map(ata => ata.pubkey.toString());
      
      // Calculate progress
      const progress = Math.floor(((totalCount - remainingAccounts.length) / totalCount) * 100);
      const batchNumber = Math.ceil((totalCount - remainingAccounts.length) / currentBatchSize) + 1;
      const batchCount = Math.ceil(totalCount / currentBatchSize);
      
      // Update progress
      if (progressCallback) {
        progressCallback(progress, `Processing batch ${batchNumber} of ~${batchCount} (${currentBatchSize} tokens)...`);
      }
      
      try {
        console.log(`Processing batch of ${batch.length} tokens (batch size: ${currentBatchSize})`);
        
        // Create a callback function to adjust batch size when transaction is too large
        const sizeLimitCallback = (recommendedSize: number) => {
          console.log(`Transaction size limit exceeded. Reducing batch size from ${currentBatchSize} to ${recommendedSize}`);
          // Update current batch size for next iteration
          currentBatchSize = recommendedSize;
          if (progressCallback) {
            progressCallback(progress, `Adjusting batch size to ${recommendedSize} tokens...`);
          }
        };
        
        // Call the burnTokens function from tokenBurner.ts with retry logic for compute unit errors
        let retryCount = 0;
        const MAX_RETRIES = 2;
        let result;
        
        while (retryCount <= MAX_RETRIES) {
          try {
            result = await burnTokens(
              batchTokenPubkeys,
              dynamicWallet,
              directWithdrawal,
              currentBatchSize,  // Pass current batch size as maxTokens
              sizeLimitCallback  // Pass the callback
            );
            
            // If successful, break out of retry loop
            if (result.success) {
              break;
            }
            
            // If failed due to compute unit error, adjust compute units and retry
            if (result.message && (
              result.message.includes('exceeded CUs meter') || 
              result.message.includes('compute budget') ||
              result.message.includes('compute unit')
            )) {
              console.log(`Compute unit error detected, retrying with higher compute budget (attempt ${retryCount + 1})`);
              // The compute budget is already increased in tokenBurner.ts, just retry
              retryCount++;
              // Add a small delay before retrying
              await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
              // If it's a different error, don't retry
              break;
            }
          } catch (retryError) {
            console.error(`Error during retry ${retryCount}:`, retryError);
            // If it's the last retry, throw the error
            if (retryCount >= MAX_RETRIES) {
              throw retryError;
            }
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
        
        if (result && result.success) {
          if (result.signature) {
            signatures.push(result.signature);
            
            // Immediately verify the transaction with the server
            if (dynamicWallet && dynamicWallet.address) {
              if (progressCallback) {
                progressCallback(progress, `Verifying transaction ${signatures.length} with server...`);
              }
              
              try {
                const verificationResult = await verifyTransactionWithServer(
                  dynamicWallet.address,
                  result.signature,
                  result.feeTransferSignature,
                  directWithdrawal,
                  !directWithdrawal // forGambling is the opposite of directWithdrawal
                );
                
                if (verificationResult.status === 'success') {
                  console.log(`Transaction ${result.signature} verified successfully with server`);
                  verifiedSignatures.push(result.signature);
                  
                  if (progressCallback) {
                    progressCallback(progress, `Transaction ${signatures.length} verified successfully`);
                  }
                } else {
                  console.warn(`Transaction ${result.signature} verification warning: ${verificationResult.message}`);
                  
                  if (progressCallback) {
                    progressCallback(progress, `Transaction ${signatures.length} verification warning`);
                  }
                }
              } catch (verifyError) {
                console.error(`Error verifying transaction ${result.signature} with server:`, verifyError);
              }
            }
          }
          
          processedCount += (result.closedCount || 0);
          // Track tokens that were swapped but not closed
          if (result.swappedButNotClosed) {
            totalSwappedButNotClosed += result.swappedButNotClosed;
          }
          console.log(`Batch completed successfully`);
          
          // Add tracking of processed tokens
          // Add successfully processed tokens to our tracking array
          processedTokens = [...processedTokens, ...batchTokenPubkeys];
          
          // Remove processed accounts from the remaining accounts
          remainingAccounts = remainingAccounts.slice(currentBatchSize);
          
          // Adjust batch size for next iteration based on remaining account types
          const remainingEmptyAccounts = remainingAccounts.filter(a => 
            a.account.data.parsed.info.tokenAmount.amount === "0"
          ).length;
          
          if (remainingEmptyAccounts > 0) {
            // If we still have empty accounts, process them at higher batch size
            currentBatchSize = Math.min(15, remainingEmptyAccounts);
            console.log(`Adjusting batch size to ${currentBatchSize} for remaining empty accounts`);
          } else if (remainingAccounts.length > 0) {
            // For non-empty accounts, use smaller batch size
            currentBatchSize = Math.min(5, remainingAccounts.length);
            console.log(`Adjusting batch size to ${currentBatchSize} for remaining accounts with tokens`);
          }
          
          // Add a delay between batches to allow network to process
          // Use a longer delay to prevent rate limits and network congestion
          if (remainingAccounts.length > 0) {
            console.log("Waiting between batches...");
            await new Promise(resolve => setTimeout(resolve, 8000));
          }
        } else {
          console.log(`Batch failed: ${result ? result.message : 'Unknown error'}`);
          failedCount++;
          
          // If the failure was due to something other than transaction size, exit the loop
          if (result && !result.message.includes('too large') && 
              !result.message.includes('size') && 
              !result.message.includes('exceeds')) {
            throw new Error(result ? result.message : 'Failed to process batch');
          }
        }
      } catch (error: any) {
        console.error(`Error processing batch:`, error);
        
        // Check if error is related to transaction size
        if (error.message && (
          error.message.includes('too large') || 
          error.message.includes('size limit') || 
          error.message.includes('exceeds') ||
          error.message.includes('Transaction is too large')
        )) {
          // Extract recommended size if present in the error message
          const sizeMatch = error.message.match(/Recommended batch size: (\d+)/);
          if (sizeMatch && sizeMatch[1]) {
            currentBatchSize = parseInt(sizeMatch[1]);
          } else {
            // Fallback to 1/2 reduction if no recommendation
            currentBatchSize = Math.max(1, Math.floor(currentBatchSize / 2));
          }
          
          console.log(`Reducing batch size to ${currentBatchSize} due to transaction size limitations`);
          
          if (progressCallback) {
            progressCallback(progress, `Reducing batch size to ${currentBatchSize} tokens...`);
          }
          
          // If we're already at batch size 1 and still failing, we need to skip this token
          if (currentBatchSize === 1) {
            console.log(`Cannot process token ${batchTokenPubkeys[0]} even individually. Skipping.`);
            remainingAccounts = remainingAccounts.slice(1);
            failedCount++;
            
            if (progressCallback) {
              progressCallback(progress, `Skipping token that cannot be processed...`);
            }
          }
        } else {
          // For other errors, throw and abort
          throw error;
        }
      }
    }
    
    // Final progress update
    if (progressCallback) {
      progressCallback(100, "Processing complete");
    }
    
    // Determine final message based on results
    let message = "";
    if (processedCount === 0) {
      message = "Failed to incinerate any tokens";
      return {
        success: false,
        message,
        processedCount,
        totalCount,
        signatures,
        processedTokens: [],
        verifiedSignatures: []
      };
    } else if (processedCount < totalCount) {
      message = `Partially completed: ${processedCount} of ${totalCount} tokens incinerated`;
    } else {
      message = `Successfully incinerated all ${totalCount} tokens`;
    }
    
    // Add information about swapped but not closed tokens
    if (totalSwappedButNotClosed > 0) {
      message += `. Note: ${totalSwappedButNotClosed} token accounts were swapped but remain in your wallet with zero balance.`;
    }
    
    return {
      success: true,
      message,
      processedCount,
      totalCount,
      signatures,
      swappedButNotClosed: totalSwappedButNotClosed,
      processedTokens: processedTokens,
      verifiedSignatures: verifiedSignatures
    };
  } catch (error: any) {
    console.error("Batch incineration error:", error);
    return {
      success: false,
      message: `Error: ${error.message || "Unknown error"}`,
      processedCount: 0,
      totalCount: 0,
      signatures: [],
      processedTokens: [],
      verifiedSignatures: []
    };
  }
} 