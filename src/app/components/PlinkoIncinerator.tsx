"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { isSolanaWallet } from '@dynamic-labs/solana';
import { incinerateTokens, getTokenAccounts, batchGetTokenMetadata, FetchProgressCallback } from "../utils/incinerator";
import { batchBurnTokens } from "../utils/batchTokenBurner";
import { Config } from "../config/solana";
import { PublicKey } from "@solana/web3.js";
import TransactionHistorySection from './TransactionHistorySection';
import { trackPlinkoEvent, ANALYTICS_EVENTS } from '../utils/analytics';
import Image from "next/image";
import IncineratorActions from './IncineratorActions';
import TokenList from './TokenList';
import AmountSlider from './AmountSlider';

// Create a reusable component for the Solana logo
export const SolanaLogo = ({ width = 16, height = 14, className = "" }) => {
  return (
    <Image 
      src="/solana-logo.svg" 
      alt="SOL" 
      width={width} 
      height={height}
      className={`inline-block ${className}`}
    />
  );
};

// Types for token data
interface FormattedTokenAccount {
  pubkey: string;
  mint: string;
  owner: string;
  amount: number;
  decimals: number;
  uiAmount: number;
  symbol?: string;
  name?: string;
  logoUrl?: string;
  isSelected?: boolean;
  isEligible?: boolean;
  isProcessed?: boolean;
  potentialValue?: number;
  valueUsd?: number;
  hasSwapRoutes?: boolean;
  isFrozen?: boolean;
}

// Interface for burn results
interface BurnResult {
  success: boolean;
  message: string;
  signature?: string;
  feeTransferSignature?: string;
  totalAmount?: number;
  closedCount?: number;
  swappedButNotClosed?: number;
  processedTokens?: string[];
  verifiedSignatures?: string[]; // Add this for tracking verified signatures
}

// Game states
type GameState = 'idle' | 'scanning' | 'ready' | 'playing' | 'finished';

export default function PlinkoIncinerator() {
  const { primaryWallet } = useDynamicContext();
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [tokenAccounts, setTokenAccounts] = useState<FormattedTokenAccount[]>([]);
  const [showTokenList, setShowTokenList] = useState<boolean>(false);
  const [gameBalance, setGameBalance] = useState(0);
  const [incineratedValue, setIncineratedValue] = useState(0);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState<boolean>(false);
  // const [scanTimeout, setScanTimeout] = useState<NodeJS.Timeout | null>(null);
  const [gameState, setGameState] = useState<GameState>('idle');
  const [showGameOptions, setShowGameOptions] = useState(false);
  const [tokenSearch, setTokenSearch] = useState('');
  const [scanProgress, setScanProgress] = useState(0);
  const [scannedMints, setScannedMints] = useState<string[]>([]);
  const [scanStage, setScanStage] = useState<'init' | 'accounts' | 'metadata' | 'done'>('init');
  const [lastTransactionInfo, setLastTransactionInfo] = useState<{
    walletAddress: string;
    signature: string;
    feeTransferSignature?: string;
    totalValue: number;
    userValue: number;
    feeAmount: number;
  } | null>(null);
  const [incinerationMode, setIncinerationMode] = useState<'withdraw' | 'gamble' | null>(null);
  const [incinerationOptionsVisible, setIncinerationOptionsVisible] = useState(false);
  const [maxTokenValue, setMaxTokenValue] = useState<number>(0.1); // Default max value in SOL
  const [solToUsd, setSolToUsd] = useState<number | null>(null);
  const [feePercentage, setFeePercentage] = useState<number>(0.021); // Default to 2.1%
  
  // Add a ref to track the current value and prevent recursive updates
  const currentMaxValueRef = useRef(maxTokenValue);
  const isRefreshingRef = useRef(false);

  // Clear any existing error messages on component mount
  useEffect(() => {
    setLoadingMessage('');
  }, []);

  // Fetch SOL price in USD and fee percentage
  useEffect(() => {
    const fetchSolPriceAndFee = async () => {
      try {
        const [solRes, feeRes] = await Promise.all([
          fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/fee-wallet`)
        ]);
        let solPrice = 20;
        if (solRes.ok) {
          const data = await solRes.json();
          solPrice = data.solana.usd;
          setSolToUsd(solPrice);
          addDebugMessage(`SOL price: $${solPrice}`);
        }
        if (feeRes.ok) {
          const data = await feeRes.json();
          if (typeof data.feePercentage === 'number') {
            setFeePercentage(data.feePercentage);
            addDebugMessage(`Fee percentage: ${(data.feePercentage * 100).toFixed(2)}%`);
          }
        }
      } catch (err) {
        console.error('Error fetching SOL price or fee percentage:', err);
        setSolToUsd(20);
        setFeePercentage(0.021);
        addDebugMessage('Failed to fetch SOL price or fee, using fallback values');
      }
    };
    fetchSolPriceAndFee();
  }, []);

  // Function to add debug messages
  const addDebugMessage = (message: string) => {
    setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // Add useEffect to log current max value on changes to help debug
  useEffect(() => {
    console.log(`Max token value updated: ${maxTokenValue} SOL (ref value: ${currentMaxValueRef.current} SOL)`);
  }, [maxTokenValue]);

  // Memoize fetchTokenAccounts to avoid dependency issues in useEffect
  const fetchTokenAccounts = useCallback(async () => {
    if (!primaryWallet || !Config.solWallet.publicKey || isRefreshingRef.current) return;
    
    // Set the flag to prevent recursive calls
    isRefreshingRef.current = true;
    
    console.log('fetching token accounts');
    addDebugMessage('Fetching token accounts...');
    addDebugMessage(`Using max token value: ${currentMaxValueRef.current} SOL ($${(currentMaxValueRef.current * (solToUsd || 20)).toFixed(2)})`);
    
    try {
      // Track scan initiation
      trackPlinkoEvent(ANALYTICS_EVENTS.CONNECT_WALLET, {
        wallet_type: primaryWallet.connector?.name || 'unknown',
      });
      
      // Set the wallet public key first to ensure it's available for RPC calls
      if (primaryWallet.address) {
        try {
          const publicKey = new PublicKey(primaryWallet.address);
          Config.setWalletConnection(publicKey);
          addDebugMessage(`Set public key: ${publicKey.toString()}`);
        } catch (error) {
          addDebugMessage(`Error setting public key: ${error}`);
          throw new Error(`Invalid wallet address: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      setLoading(true);
      setLoadingMessage('Scanning for token accounts...');
      setScanStage('accounts');
      setScanProgress(10); // Starting progress
      
      // Create progress callback to update UI state
      const progressCallback: FetchProgressCallback = (stage, progress, message) => {
        setScanProgress(progress);
        if (message) {
          setLoadingMessage(message);
          addDebugMessage(message);
        }
        
        if (stage === 'accounts') {
          setScanStage('accounts');
        } else if (stage === 'metadata') {
          setScanStage('metadata');
        } else if (stage === 'error') {
          // Only update message, keep current stage
          addDebugMessage(`Error: ${message}`);
        }
      };
      
      // Create a specific timeout for the getTokenAccounts call
      const tokenAccountsPromise = getTokenAccounts(progressCallback);
      
      // Race the promise against a timeout
      const accounts = await Promise.race([
        tokenAccountsPromise,
        new Promise<never>((_, reject) => {
          // This timeout is specifically for the getTokenAccounts function
          setTimeout(() => {
            reject(new Error('Token account scan timed out. Network may be congested.'));
          }, 25000); // 25 second timeout for the token accounts fetch
        })
      ]);

      console.log("accounts", accounts);
      
      setScanProgress(75);
      
      addDebugMessage(`Found ${accounts.length} token accounts`);
      
      if (accounts.length === 0) {
        addDebugMessage('No token accounts found, but scan completed successfully');
        setLoading(false);
        setLoadingMessage('No token accounts found');
        setScanProgress(100);
        setScanStage('done');
        setGameState('ready');
        return;
      }

      // First, format the accounts with basic info
      const formattedAccounts = accounts
        .map((account: { pubkey: { toString: () => string; }; account: { data: { parsed: { info: any; }; }; }; }) => {
          try {
            const data = account.account.data.parsed.info;
            const tokenAmountFloat = parseFloat(data.tokenAmount.amount) / Math.pow(10, data.tokenAmount.decimals);
            const isEmptyAccount = data.tokenAmount.amount === "0";
            
            return {
              pubkey: account.pubkey.toString(),
              mint: data.mint,
              owner: data.owner,
              amount: parseInt(data.tokenAmount.amount),
              decimals: data.tokenAmount.decimals,
              uiAmount: data.tokenAmount.uiAmount,
              valueUsd: 0, // Will be updated with DEX price
              isEligible: false, // Will be updated after price check
              isSelected: false, // Will be updated after price check
              potentialValue: 0 // Will be updated after price check
            };
          } catch (err) {
            addDebugMessage(`Error parsing account: ${err}`);
            return null;
          }
        })
        .filter(Boolean) as FormattedTokenAccount[];

      // Then fetch metadata and prices for all tokens
      setLoadingMessage('Fetching token prices...');
      setScanStage('metadata');
      
      const mintAddresses = formattedAccounts.map(account => account.mint);
      const metadata = await batchGetTokenMetadata(mintAddresses, primaryWallet.address);
      
      // Update accounts with prices and calculate eligibility
      const updatedAccounts = formattedAccounts.map(account => {
        const tokenMetadata = metadata[account.mint];
        const tokenAmountFloat = account.amount / Math.pow(10, account.decimals);
        
        // Get DEX price if available
        const dexPriceUsd = tokenMetadata?.priceUsd;
        console.log(`Debug: Token ${account.mint} amount: ${tokenAmountFloat}, price: $${dexPriceUsd}`);
        
        // Calculate total value
        const tokenValueUsd = dexPriceUsd ? tokenAmountFloat * dexPriceUsd : 0;
        console.log(`Debug: Token ${account.mint} total value: $${tokenValueUsd}`);
        
        // Check eligibility based on value and swap availability
        const maxValueInUsd = currentMaxValueRef.current * (solToUsd || 20);
        
        // A token is eligible if:
        // 1. It has zero balance (empty account), OR
        // 2. It has no swap routes available (regardless of reported value), OR
        // 3. Its value is below the max threshold
        // 4. BUT, a token is NEVER eligible if it's frozen

        console.log("tokenMetadata", tokenMetadata);
      
        const hasNoSwapRoutes = tokenMetadata?.hasSwapRoutes === false;
        const isFrozen = tokenMetadata?.isFrozen === true;
        
        // Frozen tokens are never eligible
        const isEligible = !isFrozen && (account.amount === 0 || hasNoSwapRoutes || tokenValueUsd <= maxValueInUsd);

        console.log("hasNoSwapRoutes", hasNoSwapRoutes);
        console.log("isFrozen", isFrozen);
        console.log("isEligible", isEligible);
        console.log("account.amount", account.amount);
        console.log("tokenValueUsd", tokenValueUsd);
        console.log("maxValueInUsd", maxValueInUsd);

        if (isFrozen) {
          console.log(`Token ${account.mint} is frozen and cannot be incinerated`);
        } else if (hasNoSwapRoutes && tokenValueUsd > 0) {
          console.log(`Token ${account.mint} has reported value of $${tokenValueUsd.toFixed(2)} but insufficient liquidity - marking as eligible for burning`);
        }
        
        return {
          ...account,
          name: tokenMetadata?.name || `Token ${account.mint.slice(0, 6)}...${account.mint.slice(-4)}`,
          symbol: tokenMetadata?.symbol || account.mint.slice(0, 4).toUpperCase(),
          logoUrl: tokenMetadata?.image || '',
          valueUsd: tokenValueUsd,
          hasSwapRoutes: tokenMetadata?.hasSwapRoutes || false,
          isFrozen: isFrozen,
          isEligible,
          isSelected: isEligible,
          potentialValue: isEligible ? 0.00203928 * (1 - feePercentage) : 0
        };
      });
      
      // Preserve processed tokens when refreshing
      setTokenAccounts(prevTokens => {
        // Create a map of existing processed tokens by mint address
        const processedTokenMap = new Map();
        prevTokens.forEach(token => {
          if (token.isProcessed) {
            processedTokenMap.set(token.mint, token);
          }
        });
        
        // Merge processed tokens with newly fetched ones, preferring processed tokens
        return updatedAccounts.map(newToken => {
          const existingProcessed = processedTokenMap.get(newToken.mint);
          if (existingProcessed) {
            // Keep the processed token's state but update any relevant fields
            return {
              ...existingProcessed,
              // Update any fields that might have changed
              amount: newToken.amount,
              uiAmount: newToken.uiAmount,
              valueUsd: newToken.valueUsd,
              isRefreshing: false
            };
          }
          return newToken;
        });
      });
      addDebugMessage('Token prices and eligibility updated');
      
      // Add this after line 202 (after token prices and eligibility are updated and accounted)
      const frozenTokens = updatedAccounts.filter(account => account.isFrozen);
      if (frozenTokens.length > 0) {
        addDebugMessage(`Found ${frozenTokens.length} frozen token accounts that cannot be incinerated`);
        frozenTokens.forEach(token => {
          addDebugMessage(`Frozen token: ${token.name} (${token.mint.slice(0, 6)}...${token.mint.slice(-4)})`);
        });
      }
      
      setScanProgress(100);
      setScanStage('done');
      setGameState('ready');
    } catch (error) {
      addDebugMessage(`Error fetching token accounts: ${error}`);
      console.error('Error fetching token accounts:', error);
      
      if (!primaryWallet || !primaryWallet.address) {
        setLoadingMessage('');
        return;
      }
      
      const errorMessage = String(error);
      if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
        setLoadingMessage('Connection timeout. The Solana network may be experiencing high load.');
      } else if (errorMessage.includes('429')) {
        setLoadingMessage('Rate limit exceeded. The Solana RPC may be under high demand.');
      } else if (errorMessage.includes('503')) { 
        setLoadingMessage('Service unavailable. The Solana RPC may be down temporarily.');
      } else {
        setLoadingMessage('Failed to fetch token accounts. The Solana RPC may be unavailable.');
      }
      
      setGameState('idle');
      setScanProgress(0);
      setScanStage('init');
    } finally {
      setLoading(false);
      // Reset the flag when done
      isRefreshingRef.current = false;
    }
  }, [primaryWallet, solToUsd, feePercentage]);

  // Reset states when wallet changes
  useEffect(() => {
    if (primaryWallet && primaryWallet.address) {
      // Clear any existing messages first
      setLoadingMessage('');
      addDebugMessage(`Wallet connected: ${primaryWallet.address}`);
      
      // Don't automatically scan for tokens on initial connection
      // Instead, show the idle state with a clear button to scan
      setGameState('idle');
      setLoading(false);
      
      // Set wallet public key for later use
      try {
        const publicKey = new PublicKey(primaryWallet.address);
        Config.setWalletConnection(publicKey);
        addDebugMessage(`Set public key: ${publicKey.toString()}`);
      } catch (error) {
        addDebugMessage(`Error setting public key: ${error}`);
      }
    } else {
      addDebugMessage('Wallet disconnected');
      setTokenAccounts([]);
      setLoadingMessage('');
      setLoading(false);
      setGameState('idle');
    }
  }, [primaryWallet]);

  // Toggle token selection
  const toggleTokenSelection = (pubkey: string) => {
    setTokenAccounts(prev => prev.map(account => {
      if (account.pubkey === pubkey) {
        return {
          ...account,
          isSelected: !account.isSelected
        };
      }
      return account;
    }));
  };

  // Select/deselect all tokens
  const toggleAllTokens = (selected: boolean) => {
    setTokenAccounts(prev => prev.map(account => {
      // Only toggle eligible tokens
      if (account.isEligible) {
        return {
          ...account,
          isSelected: selected
        };
      }
      return account;
    }));
  };

  // This function shows the options instead of immediately incinerating
  const handleShowIncinerateOptions = () => {
    const eligibleTokens = tokenAccounts
      .filter(account => account.isEligible && account.isSelected)
      .map(account => account.pubkey);
    
    if (eligibleTokens.length === 0) {
      addDebugMessage('No tokens selected to incinerate');
      setLoadingMessage('No tokens selected');
      setTimeout(() => setLoadingMessage(''), 2000);
      return;
    }
    
    // Calculate potential value for all selected tokens
    const totalPotentialValue = eligibleTokens.length * 0.00203928;
    const feeAmount = totalPotentialValue * feePercentage;
    const userValue = totalPotentialValue - feeAmount; // 85% goes to user

    // Calculate value for the first batch (max 15 accounts)
    const maxAccountsPerBatch = 15;
    const firstBatchCount = Math.min(eligibleTokens.length, maxAccountsPerBatch);
    const firstBatchValue = firstBatchCount * 0.00203928;
    const firstBatchUserValue = firstBatchValue * (1 - feePercentage);
    const hasMultipleBatches = eligibleTokens.length > maxAccountsPerBatch;

    addDebugMessage(`Showing incineration options: Direct withdrawal (${userValue.toFixed(6)} SOL) or Gambling (${totalPotentialValue.toFixed(6)} SOL)`);
    if (hasMultipleBatches) {
      addDebugMessage(`First batch will process ${firstBatchCount} tokens for ${firstBatchUserValue.toFixed(6)} SOL`);
    }
    
    setIncinerationOptionsVisible(true);
    
    // Track when user clicks to show incineration options
    trackPlinkoEvent('view_incineration_options', {
      eligible_tokens: eligibleTokens.length,
      potential_value: totalPotentialValue,
      first_batch_count: firstBatchCount,
      has_multiple_batches: hasMultipleBatches
    });
  };

  // This function performs the actual incineration based on the chosen mode
  const handleIncinerate = async () => {
    if (!primaryWallet || !Config.solWallet.publicKey || !incinerationMode) return;
    
    // Get only eligible AND selected tokens
    const eligibleTokens = tokenAccounts
      .filter(account => account.isEligible && account.isSelected)
      .map(account => account.pubkey);
    
    // We now use the entire eligibleTokens array instead of slicing it
    const accountsToProcess = eligibleTokens;
    
    // Skip the rest if no tokens are selected
    if (accountsToProcess.length === 0) {
      addDebugMessage('No tokens selected for incineration');
      setLoadingMessage('No tokens selected for incineration');
      setTimeout(() => setLoadingMessage(''), 2000);
      return;
    }
    
    // Track incineration attempt with mode
    trackPlinkoEvent(
      incinerationMode === 'withdraw' 
        ? ANALYTICS_EVENTS.WITHDRAW_SOL 
        : ANALYTICS_EVENTS.BURN_TOKENS,
      {
        mode: incinerationMode,
        token_count: accountsToProcess.length,
        estimated_value: accountsToProcess.length * 0.00203928,
        total_eligible: eligibleTokens.length,
        is_batch: accountsToProcess.length > 5 // Consider batching when more than 5 tokens
      }
    );
    
    try {
      setLoading(true);
      setLoadingMessage(`Preparing to incinerate ${accountsToProcess.length} tokens...`);
      addDebugMessage(`Starting token incineration in ${incinerationMode} mode...`);
      
      // Hide options once we start
      setIncinerationOptionsVisible(false);
      
      // Verify that we have a Solana wallet
      if (!isSolanaWallet(primaryWallet)) {
        throw new Error('This feature requires a Solana wallet');
      }
      
      if (accountsToProcess.length === 0) {
        addDebugMessage('No eligible tokens to incinerate');
        setLoadingMessage('No eligible tokens found');
        setTimeout(() => setLoadingMessage(''), 2000);
        setLoading(false);
        return;
      }
      
      // Get the fee wallet address from the server before incinerating
      const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
      const feeWalletResponse = await fetch(`${API_URL}/api/fee-wallet`);
      const feeWalletData = await feeWalletResponse.json();
      if (!feeWalletData.address) {
        throw new Error('Could not retrieve fee wallet address from server');
      }
      
      // Set the fee wallet address in Config
      if (!Config.setFeeWallet(feeWalletData.address)) {
        throw new Error('Invalid fee wallet address received from server');
      }
      addDebugMessage(`Using fee wallet: ${feeWalletData.address}`);
      
      // Step 1: Call the token incineration function with the Dynamic wallet
      addDebugMessage('Executing token incineration...');
      setLoadingMessage('Please approve the transaction in your wallet...');
      
      let result;
      try {
        // First attempt to use normal incineration
        // Pass the Solana wallet to the incinerator
        result = await incinerateTokens(
          accountsToProcess,
          primaryWallet, // Dynamic wallet will use getSigner()
          incinerationMode === 'withdraw' // true = direct withdrawal, false = gambling
        );
      } catch (txError: any) {
        // If we get a transaction too large error, switch to batch processing
        if (txError.message && (
            txError.message.includes('Transaction too large') || 
            txError.message.includes('exceeds size limits') ||
            txError.message.includes('overruns Uint8Array') ||
            txError.message.includes('is too large') ||
            txError.message.includes('transaction size')
          )) {
          addDebugMessage('Transaction too large. Switching to batch processing...');
          setLoadingMessage('Transaction size exceeded. Processing in smaller batches...');
          
          // Use batch processing instead
          // Use a higher initial batch size since our improved strategy sorts by complexity
          const batchSize = 15; // Will be adjusted based on token account types
          
          // Progress callback to update UI during batch processing
          const batchProgressCallback = (progress: number, message: string) => {
            setLoadingMessage(`${message} (${progress}% complete)`);
          };
          
          try {
            result = await batchBurnTokens(
              accountsToProcess,
              primaryWallet,
              incinerationMode === 'withdraw',
              batchSize,
              batchProgressCallback
            );
            
            // If batch processing succeeded, continue with normal flow
            if (result.success) {
              // Store the processed token pubkeys for proper UI update
              const processedTokenPubkeys = result.processedTokens || [];
              
              // Convert batch result to normal result format for consistency
              result = {
                success: true,
                message: result.message,
                signature: result.signatures[0], // Use the first signature
                feeTransferSignature: undefined,
                totalAmount: result.processedCount * 0.00203928, // Estimate based on processed count
                closedCount: result.processedCount,
                swappedButNotClosed: result.swappedButNotClosed,
                processedTokens: processedTokenPubkeys, // Pass along the processed token pubkeys
                verifiedSignatures: result.verifiedSignatures // Include verified signatures
              };
            } else {
              throw new Error(result.message);
            }
          } catch (batchError: any) {
            addDebugMessage(`Batch processing error: ${batchError.message}`);
            throw new Error(`Failed to process tokens: ${batchError.message}`);
          }
        } else {
          // For other types of errors, just re-throw
          throw txError;
        }
      }
      
      if (!result.success) {
        throw new Error(`Incineration failed: ${result.message}`);
      }
      
      addDebugMessage(`Token incineration successful: ${result.message}`);
      addDebugMessage(`Incineration signature: ${result.signature}`);
      
      if (result.swappedButNotClosed && result.swappedButNotClosed > 0) {
        addDebugMessage(`${result.swappedButNotClosed} token accounts were swapped but couldn't be closed (they will remain in your wallet with zero balance)`);
      }
      
      if (result.feeTransferSignature) {
        addDebugMessage(`Fee transfer signature: ${result.feeTransferSignature}`);
      }
      
      // Calculate the total value gained from incineration
      const totalValue = result.totalAmount || (accountsToProcess.length * 0.00203928);
      
      // Apply the fee
      const feeAmount = totalValue * feePercentage;
      const userValue = totalValue - feeAmount; // User gets value after fee
      
      if (incinerationMode === 'withdraw') {
        addDebugMessage(`Incinerated ${result.closedCount} tokens for direct withdrawal of ${userValue.toFixed(6)} SOL (after ${feePercentage * 100}% fee)`);
      } else {
        addDebugMessage(`Incinerated ${result.closedCount} tokens for gambling with ${totalValue.toFixed(6)} SOL`);
      }
      
      // Update UI based on processed tokens
      const processedTokenPubkeys = new Set(result.processedTokens || accountsToProcess);
      
      setTokenAccounts(prev => prev.map(account => {
        if (processedTokenPubkeys.has(account.pubkey)) {
          // Mark as processed
          return { ...account, isEligible: false, isProcessed: true };
        }
        return account;
      }));
      
      if (incinerationMode === 'withdraw') {
        addDebugMessage(`Transaction completed: ${userValue.toFixed(6)} SOL sent to wallet.`);
        setIncineratedValue(prev => prev + userValue);
        
        const remainingMessage = accountsToProcess.length > 5 
          ? `Tokens successfully incinerated! ${eligibleTokens.length - accountsToProcess.length} more tokens can be processed.`
          : 'Tokens successfully incinerated and SOL sent to your wallet!';
          
        setLoadingMessage(remainingMessage);
        
        // Track successful incineration
        trackPlinkoEvent(
          'withdrawal_success',
          {
            mode: incinerationMode,
            token_count: accountsToProcess.length,
            total_value: totalValue,
            user_value: userValue,
            fee_amount: feeAmount,
            is_batch: accountsToProcess.length > 5,
            remaining_tokens: eligibleTokens.length - accountsToProcess.length
          }
        );
      } else {
        addDebugMessage(`Transaction completed: ${totalValue.toFixed(6)} SOL added to gambling balance`);
        setGameBalance(totalValue);
        setIncineratedValue(prev => prev + totalValue);
        
        const remainingMessage = accountsToProcess.length > 5 
          ? `Tokens successfully incinerated for gambling! ${eligibleTokens.length - accountsToProcess.length} more tokens can be processed.`
          : 'Tokens successfully incinerated. Ready to gamble!';
          
        setLoadingMessage(remainingMessage);
        setShowGameOptions(true);
        
        // Track successful incineration
        trackPlinkoEvent(
          'incineration_success',
          {
            mode: incinerationMode,
            token_count: accountsToProcess.length,
            total_value: totalValue,
            user_value: userValue,
            fee_amount: feeAmount,
            is_batch: accountsToProcess.length > 5,
            remaining_tokens: eligibleTokens.length - accountsToProcess.length
          }
        );
      }
      
      // If there are more tokens to process, keep the incineration options visible
      // but update them to reflect the remaining tokens
      setTimeout(() => {
        setIncinerationOptionsVisible(false);
        setIncinerationMode(null);
        setLoading(false);
        setLoadingMessage('');
        
        // If we still have remaining tokens, show a message prompting user to continue processing
        if (accountsToProcess.length > 5) {
          setLoadingMessage(`You have ${eligibleTokens.length - accountsToProcess.length} more tokens to process!`);
          setTimeout(() => {
            setLoadingMessage('');
            showIncinerationOptionsForRemainingTokens();
          }, 3000);
        }
      }, 5000);
    } catch (error: unknown) {
      addDebugMessage(`Error during incineration: ${error}`);
      console.error('Error during incineration:', error);
      
      // Provide a more user-friendly error message for transaction size issues
      if (error instanceof Error && error.message.includes('Transaction too large')) {
        setLoadingMessage('Transaction is too large. Try incinerating fewer tokens at once.');
      } else {
        setLoadingMessage(`Failed to incinerate tokens: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      setTimeout(() => setLoadingMessage(''), 3000);
      
      // Track failed incineration
      trackPlinkoEvent('incineration_error', {
        mode: incinerationMode,
        error_message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
      setIncinerationMode(null);
    }
  };

  // Function to handle direct withdrawal using the new component
  const handleDirectWithdrawAction = () => {
    setIncinerationMode('withdraw');
    handleIncinerate();
  };
  
  // Function to handle gambling using the new component
  const handleGambleAction = () => {
    setIncinerationMode('gamble');
    handleIncinerate();
  };
  
  // Function to cancel incineration options
  const handleCancelIncineration = () => {
    setIncinerationOptionsVisible(false);
  };

  const refreshTokens = () => {
    if (!primaryWallet || !Config.solWallet.publicKey) return;
    addDebugMessage('Manually refreshing token accounts');
    // Log the current max value being used
    const maxValueInUsd = currentMaxValueRef.current * (solToUsd || 20);
    addDebugMessage(`Using max token value: ${currentMaxValueRef.current} SOL ($${maxValueInUsd.toFixed(2)})`);
    
    // Instead of clearing the tokens completely, mark them as being refreshed
    setLoadingMessage(`Refreshing token accounts with max value $${maxValueInUsd.toFixed(2)}...`);
    setTokenAccounts(prevTokens => prevTokens.map(token => ({
      ...token,
      isRefreshing: true
    })));
    setScannedMints([]);
    setScanProgress(0);
    setScanStage('init');
    fetchTokenAccounts();
  };

  // Filter eligible tokens
  const eligibleTokens = tokenAccounts.filter(account => account.isEligible);
  const selectedTokens = tokenAccounts.filter(account => account.isEligible && account.isSelected);
  const processedTokens = tokenAccounts.filter(account => account.isProcessed);
  const frozenTokens = tokenAccounts.filter(account => account.isFrozen === true);
  
  console.log("PlinkoIncinerator frozenTokens", frozenTokens) 
  console.log("PlinkoIncinerator eligibleTokens", eligibleTokens)
  console.log("PlinkoIncinerator processedTokens", processedTokens)
  console.log("PlinkoIncinerator selectedTokens", selectedTokens)
  console.log("PlinkoIncinerator tokenAccounts", tokenAccounts)
  // Show processed tokens in the UI but mark them differently
  const allDisplayTokens = [...eligibleTokens, ...processedTokens, ...frozenTokens];
  
  // Log counts to help with debugging
  console.log(`Token counts - Eligible: ${eligibleTokens.length}, Selected: ${selectedTokens.length}, Processed: ${processedTokens.length}, Frozen: ${frozenTokens.length}, Total: ${tokenAccounts.length}`);
  
  // Calculate potential SOL from burning tokens
  const totalPotentialValue = selectedTokens.reduce((total, token) => {
    // Convert token USD value to SOL and add account closure value
    const tokenValueInSol = token.valueUsd && solToUsd ? token.valueUsd / solToUsd : 0;
    const accountClosureValue = 0.00203928;
    return total + tokenValueInSol + accountClosureValue;
  }, 0);

  const feeAmount = totalPotentialValue * feePercentage;
  const potentialSol = totalPotentialValue - feeAmount; // net to user

  // Calculate if we need to process in batches
  const maxAccountsPerBatch = 15;
  const needsBatching = selectedTokens.length > maxAccountsPerBatch;
  const batchCount = needsBatching ? Math.ceil(selectedTokens.length / maxAccountsPerBatch) : 1;
  const firstBatchValue = Math.min(selectedTokens.length, maxAccountsPerBatch) * 0.00203928 * (1 - feePercentage);

  // Listen for the custom close-token-list event from the TokenList component
  useEffect(() => {
    const handleCloseTokenList = () => {
      setShowTokenList(false);
    };
    
    window.addEventListener('close-token-list', handleCloseTokenList);
    
    return () => {
      window.removeEventListener('close-token-list', handleCloseTokenList);
    };
  }, []);

  // Handle max token value change from the slider
  const handleMaxValueChange = (value: number) => {
    // Skip if the value hasn't actually changed or we're already refreshing
    if (value === currentMaxValueRef.current || isRefreshingRef.current) {
      return;
    }
    
    // Update both state and ref
    setMaxTokenValue(value);
    currentMaxValueRef.current = value;
    
    // The value parameter is now in SOL (converted from USD in the slider component)
    const usdValue = value * (solToUsd || 20);
    addDebugMessage(`Max token value set to $${usdValue.toFixed(2)} (${value.toFixed(4)} SOL)`);
    
    // Automatically refresh token eligibility when the value changes
    if (primaryWallet && Config.solWallet.publicKey && gameState === 'ready' && !isRefreshingRef.current) {
      addDebugMessage('Automatically refreshing token eligibility with new threshold');
      setLoadingMessage(`Updating token eligibility with $${usdValue.toFixed(2)} threshold...`);
      
      // Use setTimeout to ensure this happens after state updates
      setTimeout(() => {
        fetchTokenAccounts();
      }, 0);
    }
  };

  // Update this function to show appropriate options after batch is completed
  const showIncinerationOptionsForRemainingTokens = () => {
    // Count remaining eligible tokens that are still selected
    const remainingTokens = tokenAccounts.filter(account => account.isEligible && account.isSelected);
    
    if (remainingTokens.length > 0) {
      // Show options for remaining tokens
      setIncinerationOptionsVisible(true);
      addDebugMessage(`Showing incineration options for remaining ${remainingTokens.length} tokens`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Wallet Status */}
      <div className="bg-gray-800 bg-opacity-40 p-6 rounded-lg border border-gray-700">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-purple-300">Wallet Status</h2>
          <div>
            {gameBalance > 0 && (
              <span className="text-accent-green font-bold mr-4">
                Balance: {gameBalance.toFixed(6)} SOL
              </span>
            )}
            {primaryWallet && gameState === 'ready' && (
              <button 
                onClick={refreshTokens}
                disabled={loading}
                className="bg-gradient-to-r from-purple-800 via-pink-700 to-blue-800 hover:from-purple-700 hover:via-pink-600 hover:to-blue-700 text-white py-1.5 px-4 rounded-md transition-all hover:scale-105 shadow-sm text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Scanning...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 4v6h-6M1 20v-6h6" />
                      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                    </svg>
                    Refresh Tokens
                  </>
                )}
              </button>
            )}
          </div>
        </div>
        
        {loading && (
          <div className="mt-4 text-center">
            <div className="animate-spin mb-3 h-8 w-8 border-t-2 border-b-2 border-purple-500 rounded-full mx-auto"></div>
            <p className="text-lg text-purple-300 font-medium">{loadingMessage || "Loading..."}</p>
            
            {/* Progress bar */}
            <div className="mt-3 w-full max-w-md mx-auto bg-gray-700 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-purple-500 h-2.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${scanProgress}%` }}
              ></div>
            </div>
            
            <div className="mt-2 text-sm text-gray-400 max-w-md mx-auto">
              <p>
                {scanStage === 'init' && 'Preparing scan...'}
                {scanStage === 'accounts' && (
                  <>Scanning token accounts: {Math.round(scanProgress)}%</>
                )}
                {scanStage === 'metadata' && (
                  <>Fetching token metadata: {scannedMints.length} accounts found</>
                )}
              </p>
              
              {scanProgress > 0 && scanProgress < 100 && scanStage === 'accounts' && (
                <p className="mt-1 text-xs text-gray-500">
                  This process can take up to 20 seconds during high network activity
                </p>
              )}
            </div>
          </div>
        )}
        
        {!loading && !primaryWallet && (
          <div className="text-center py-10">
            <p className="text-gray-400 mb-4">Connect your wallet to start burning tokens</p>
          </div>
        )}
        
        {/* Always show the value slider regardless of state, as long as wallet is connected */}
        {primaryWallet && (
          <div className="w-full max-w-md mx-auto my-4">
            <AmountSlider 
              onChange={handleMaxValueChange} 
              initialAmount={maxTokenValue}
            />
          </div>
        )}
        
        {!loading && primaryWallet && gameState === 'idle' && (
          <div className="flex flex-col items-center justify-center p-4 gap-4">
            <p className="text-center text-blue-400">
              {loadingMessage || 'Ready to scan for tokens'}
            </p>
            
            <div className="flex flex-col md:flex-row gap-3">
              <button
                onClick={() => {
                  setLoadingMessage(''); // Clear any existing error message
                  setLoading(true);
                  setGameState('scanning');
                  const maxValueInUsd = currentMaxValueRef.current * (solToUsd || 20);
                  setLoadingMessage(`Scanning for tokens with value below $${maxValueInUsd.toFixed(2)}...`);
                  fetchTokenAccounts();
                }}
                className="bg-gradient-to-r from-purple-800 via-pink-700 to-blue-800 hover:from-purple-700 hover:via-pink-600 hover:to-blue-700 text-white py-2 px-6 rounded-lg transition-all hover:scale-105 shadow-md text-base font-medium flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Scan Token Accounts
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Solana RPC nodes can experience congestion during high network activity.
            </p>
          </div>
        )}
        
        {!loading && primaryWallet && gameState === 'ready' && (
          <div className="mt-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 p-4 bg-gray-900 bg-opacity-60 rounded-lg">
              <div>
                <p className="text-sm text-gray-300 mb-1">Selected Tokens:</p>
                <p className="text-xl font-bold text-accent-green">{selectedTokens.length} of {eligibleTokens.length} eligible</p>
              </div>
              <div>
                <p className="text-sm text-gray-300 mb-1">Potential Value:</p>
                <p className="text-xl font-bold text-accent-blue glow-pulse px-3 py-1 rounded">
                  {potentialSol.toFixed(6)} <SolanaLogo className="ml-1" />
                  {solToUsd && (
                    <span className="text-gray-400 ml-2">
                      (${(potentialSol * solToUsd).toFixed(2)})
                    </span>
                  )}
                </p>
                {needsBatching && (
                  <p className="text-xs text-yellow-400 mt-1">
                    Will be processed in {batchCount} batches of 15 accounts max
                  </p>
                )}
              </div>

              {!incinerationOptionsVisible && selectedTokens.length > 0 && (
                <button
                  onClick={handleShowIncinerateOptions}
                  disabled={selectedTokens.length === 0 || loading}
                  className={`shine-border py-2 px-6 ${selectedTokens.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="bg-gray-900 p-2 rounded flex items-center justify-center">
                    <span className="flame-animation text-accent-red font-bold">🔥 INCINERATE TOKENS 🔥</span>
                  </div>
                </button>
              )}
            </div>
            
            {incinerationOptionsVisible && (
              <IncineratorActions
                eligibleTokens={eligibleTokens.length}
                selectedTokens={selectedTokens.length}
                totalPotentialValue={totalPotentialValue}
                potentialSol={potentialSol}
                maxAccountsPerBatch={maxAccountsPerBatch}
                needsBatching={needsBatching}
                onWithdraw={handleDirectWithdrawAction}
                onGamble={handleGambleAction}
                onCancel={handleCancelIncineration}
              />
            )}
            
            {eligibleTokens.length > 0 && (
              <div className="mt-4">
                <div className="flex justify-between items-center">
                  <button 
                    onClick={() => setShowTokenList(!showTokenList)}
                    className="text-accent-blue text-sm underline hover:text-accent-purple"
                  >
                    {showTokenList ? "Hide Token List" : "Show Token List"}
                  </button>
                </div>
                {showTokenList && (
                  <TokenList 
                    eligibleTokens={eligibleTokens}
                    selectedTokens={selectedTokens}
                    processedTokens={processedTokens}
                    frozenTokens={frozenTokens}
                    tokenSearch={tokenSearch}
                    onTokenSearchChange={setTokenSearch}
                    onToggleTokenSelection={toggleTokenSelection}
                    onToggleAllTokens={toggleAllTokens}
                    solToUsd={solToUsd}
                    feePercentage={feePercentage}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Use the new TransactionHistorySection component */}
      {primaryWallet && (
        <TransactionHistorySection walletAddress={primaryWallet.address} />
      )}
      
      {/* Debug Panel */}
      <div className="mt-8">
        <button 
          onClick={() => setShowDebug(!showDebug)}
          className="text-xs text-gray-500 hover:text-gray-300"
        >
          {showDebug ? "Hide Debug Info" : "Show Debug Info"}
        </button>
        
        {showDebug && (
          <div className="mt-2 p-2 bg-black text-gray-400 text-xs font-mono rounded h-40 overflow-y-auto">
            {debugInfo.map((msg, i) => (
              <div key={i}>{msg}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 