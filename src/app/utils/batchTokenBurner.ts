import { Config } from "../config/solana";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { burnTokens } from "./tokenBurner";

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
}> {
  try {
    if (!Config.solWallet.publicKey) {
      return {
        success: false,
        message: "Wallet not connected",
        processedCount: 0,
        totalCount: 0,
        signatures: []
      };
    }
    
    // Check if we have a wallet to sign transactions
    if (!dynamicWallet && !Config.solWallet.payer) {
      return {
        success: false,
        message: "No wallet available to sign transactions",
        processedCount: 0,
        totalCount: 0,
        signatures: []
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
    
    if (totalCount === 0) {
      return {
        success: false,
        message: "No token accounts available to incinerate on batchTokenBurner.ts",
        processedCount: 0,
        totalCount: 0,
        signatures: []
      };
    }
    
    console.log(`Starting batch incineration of ${totalCount} tokens with batch size ${batchSize}`);
    
    // Process in batches
    const signatures: string[] = [];
    let processedCount = 0;
    let failedCount = 0;
    
    // Create batches
    const batches: any[][] = [];
    for (let i = 0; i < accountsToProcess.length; i += batchSize) {
      batches.push(accountsToProcess.slice(i, i + batchSize));
    }
    
    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const batchTokenPubkeys = batch.map(ata => ata.pubkey.toString());
      
      // Update progress
      if (progressCallback) {
        const progress = Math.floor((batchIndex / batches.length) * 100);
        progressCallback(progress, `Processing batch ${batchIndex + 1} of ${batches.length}...`);
      }
      
      try {
        console.log(`Processing batch ${batchIndex + 1} of ${batches.length}`);
        
        // Call the burnTokens function from tokenBurner.ts
        const result = await burnTokens(
          batchTokenPubkeys,
          dynamicWallet,
          directWithdrawal
        );
        
        if (result.success) {
          if (result.signature) {
            signatures.push(result.signature);
          }
          processedCount += (result.closedCount || 0);
          console.log(`Batch ${batchIndex + 1} completed successfully`);
        } else {
          console.log(`Batch ${batchIndex + 1} failed: ${result.message}`);
          failedCount++;
        }
        
        // Add a delay between batches to allow network to process
        if (batchIndex < batches.length - 1) {
          console.log("Waiting between batches...");
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (error) {
        console.error(`Error processing batch ${batchIndex + 1}:`, error);
        failedCount++;
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
        signatures
      };
    } else if (processedCount < totalCount) {
      message = `Partially completed: ${processedCount} of ${totalCount} tokens incinerated`;
    } else {
      message = `Successfully incinerated all ${totalCount} tokens`;
    }
    
    return {
      success: true,
      message,
      processedCount,
      totalCount,
      signatures
    };
  } catch (error: any) {
    console.error("Batch incineration error:", error);
    return {
      success: false,
      message: `Error: ${error.message || "Unknown error"}`,
      processedCount: 0,
      totalCount: 0,
      signatures: []
    };
  }
} 