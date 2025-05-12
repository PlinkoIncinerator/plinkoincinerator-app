// Types for token metadata
export interface TokenMetadata {
  name: string;
  symbol: string;
  image: string;
  mint: string;
  priceUsd?: number;
  hasSwapRoutes?: boolean; // Add flag to indicate if token has swap routes
  isFrozen?: boolean; // Add flag to indicate if token account is frozen
}

// Simple delay function to help with rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Cache for token metadata to avoid repeated API calls
const tokenMetadataCache: Record<string, TokenMetadata> = {};

// Cache for token logos to avoid repeated calls
const logoCache: Record<string, string> = {};

// Function to try fetching token logo from multiple sources
async function fetchTokenLogo(mintAddress: string): Promise<string> {
  // Check if we already have this logo in the cache
  if (logoCache[mintAddress]) {
    return logoCache[mintAddress];
  }
  
  try {
    // Try multiple sources for the logo
    
    // 1. Try Jupiter token info endpoint directly
    try {
      const jupiterResponse = await fetch(`https://lite-api.jup.ag/tokens/v1/token/${mintAddress}`);
      if (jupiterResponse.ok) {
        const tokenInfo = await jupiterResponse.json();
        if (tokenInfo && tokenInfo.logoURI) {
          console.log(`Found logo for ${mintAddress} in Jupiter token info`);
          logoCache[mintAddress] = tokenInfo.logoURI;
          return tokenInfo.logoURI;
        }
      }
    } catch (e) {
      console.log(`Jupiter token info error for ${mintAddress}:`, e);
    }
    
    // 2. Try Solana token list
    try {
      const tokenListURL = `https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/${mintAddress}/logo.png`;
      const response = await fetch(tokenListURL, { method: 'HEAD' });
      if (response.ok) {
        console.log(`Found logo for ${mintAddress} in Solana token list`);
        logoCache[mintAddress] = tokenListURL;
        return tokenListURL;
      }
    } catch (e) {
      console.log(`Solana token list error for ${mintAddress}:`, e);
    }
    
    // 3. Try DexScreener via direct token info endpoint
    try {
      const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`);
      if (dexResponse.ok) {
        const data = await dexResponse.json();
        if (data?.pairs && data.pairs.length > 0 && data.pairs[0]?.info?.imageUrl) {
          console.log(`Found logo for ${mintAddress} in DexScreener data`);
          logoCache[mintAddress] = data.pairs[0].info.imageUrl;
          return data.pairs[0].info.imageUrl;
        }
      }
    } catch (e) {
      console.log(`DexScreener error for ${mintAddress}:`, e);
    }
    
    // No logo found from any source
    logoCache[mintAddress] = ''; // Cache the empty result too
    return '';
  } catch (error) {
    console.error(`Error fetching logo for ${mintAddress}:`, error);
    logoCache[mintAddress] = ''; // Cache the error result
    return '';
  }
}

// Check if a token has swap routes via Jupiter with sufficient liquidity
async function checkJupiterSwapAvailability(mintAddress: string): Promise<boolean> {
  // Use a more substantial amount to check real liquidity
  // For tokens with very low value, even 100,000 base units might be a tiny amount
  const testAmount = "100000"; // 100,000 base units
  const solMint = "So11111111111111111111111111111111111111112"; // SOL mint address
  
  try {
    // Query Jupiter for quote
    const queryParams = new URLSearchParams({
      inputMint: mintAddress,
      outputMint: solMint,
      amount: testAmount,
      slippageBps: '100'
    }).toString();

    console.log("Making Jupiter API call with queryParams:", queryParams);
    
    const quoteUrl = `https://lite-api.jup.ag/swap/v1/quote?${queryParams}`;
    console.log(`Checking swap availability for ${mintAddress}`);
    
    const response = await fetch(quoteUrl);
    console.log("Response:", response);
    const data = await response.json();
    console.log("Data:", data);
    
    // If Jupiter can find a route, verify there's enough liquidity
    if (response.ok && !data.errorCode && !data.error) {
      console.log(`Token ${mintAddress} has swap routes available`);
      
      // Check for minimum output amount to confirm real liquidity
      // Jupiter returns outAmount in lamports (SOL's smallest unit)
      const outAmount = data.outAmount ? parseInt(data.outAmount) : 0;
      const outAmountInSol = outAmount; // Convert lamports to SOL

      
      // If output amount is extremely low (like 0.000001 SOL), it likely means there's 
      // not enough liquidity to make a meaningful swap
      const MINIMUM_LIQUIDITY_THRESHOLD_SOL = 0.000005; // 0.000005 SOL (about $0.0001 at $20 SOL)
      console.log("MINIMUM_LIQUIDITY_THRESHOLD_SOL", MINIMUM_LIQUIDITY_THRESHOLD_SOL);
      
      if (outAmountInSol < MINIMUM_LIQUIDITY_THRESHOLD_SOL) {
        console.log(`Token ${mintAddress} has routes but insufficient liquidity - output amount: ${outAmountInSol} SOL`);
        return false;
      }
      
      // Check price impact - if it's extremely high, the liquidity is too low
      if (data.priceImpactPct) {
        const priceImpact = parseFloat(data.priceImpactPct);
        if (priceImpact > 20) { // More than 20% price impact is extremely high
          console.log(`Token ${mintAddress} has too high price impact: ${priceImpact}%`);
          return false;
        }
      }
      
      console.log(`Token ${mintAddress} has sufficient liquidity - output: ${outAmountInSol} SOL`);
      return true;
    }
    
    // Check if error is specifically about no routes
    if (data.error === 'Could not find any route' || data.errorCode === 'RouteNotFound') {
      console.log(`No swap routes available for ${mintAddress}`);
      return false;
    }
    
    // For other errors, assume false but log for debugging
    console.log(`Error checking swap routes for ${mintAddress}: ${data.error || data.errorCode || 'Unknown error'}`);
    return false;
  } catch (error) {
    console.error(`Exception when checking swap availability for ${mintAddress}:`, error);
    return false;
  }
}

// Function to check if token has frozen authority (using Jupiter token info)
async function checkForFrozenAuthority(mintAddress: string, walletPublicKey?: string): Promise<boolean> {
  try {
    // Use Jupiter's token info endpoint which provides freeze_authority
    const jupiterResponse = await fetch(`https://lite-api.jup.ag/tokens/v1/token/${mintAddress}`);
    if (jupiterResponse.ok) {
      const tokenInfo = await jupiterResponse.json();
      // If token has a freeze_authority, it can potentially be frozen
      // This doesn't guarantee the token IS frozen, only that it CAN BE frozen
      return !!tokenInfo.freeze_authority;
    }
    
    return false;
  } catch (error) {
    console.error(`Error checking freeze authority for ${mintAddress}:`, error);
    return false;
  }
}

// Check if wallet has any frozen token accounts for a specific mint
async function checkForFrozenTokenAccount(mintAddress: string, walletPublicKey?: string): Promise<boolean> {
  try {
    // Use the Helius RPC URL from environment
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://mainnet.helius-rpc.com/?api-key=72959397-0aec-447f-88c3-e31260375242';
    
    // If no wallet address is provided, we can't check for frozen accounts
    if (!walletPublicKey) {
      console.log('No wallet public key provided to check for frozen accounts');
      return false;
    }
    
    console.log(`Checking if ${mintAddress} has frozen accounts for wallet ${walletPublicKey}`);
    
    // Delay to help with rate limiting (20ms = max ~50 requests/sec)
    await delay(20);
    
    // Get token accounts owned by this wallet
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'frozen-check-' + Date.now(),
        method: 'getTokenAccountsByOwner',
        params: [
          walletPublicKey,
          {
            mint: mintAddress
          },
          {
            encoding: 'jsonParsed'
          }
        ]
      })
    });
    
    const data = await response.json();
    console.log(`Token account data for ${mintAddress}:`, data);
    
    // Check if any accounts for this mint are in the frozen state
    if (data.result && data.result.value) {
      for (const account of data.result.value) {
        // Safely access the data to avoid errors
        try {
          const state = account.account.data.parsed.info.state;
          if (state === 'frozen') {
            console.log(`Token ${mintAddress} has a frozen account: ${account.pubkey}`);
            return true;
          }
        } catch (error) {
          console.error(`Error accessing token account data for ${mintAddress}:`, error);
          // If we can't access the state, assume it's not frozen
          continue;
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error(`Error checking for frozen accounts for ${mintAddress}:`, error);
    return false;
  }
}

// Combined approach - check both freeze authority and actual frozen state
async function isTokenFrozen(mintAddress: string, walletPublicKey?: string): Promise<boolean> {
  try {
    // First check if any accounts are actually frozen via RPC
    const isFrozenAccount = await checkForFrozenTokenAccount(mintAddress, walletPublicKey);
    if (isFrozenAccount) {
      console.log(`Token ${mintAddress} has frozen accounts in wallet`);
      return true;
    }
    
    // As a fallback, check if token has freeze authority via Jupiter
    try {
      const jupiterResponse = await fetch(`https://lite-api.jup.ag/tokens/v1/token/${mintAddress}`);
      if (jupiterResponse.ok) {
        const tokenInfo = await jupiterResponse.json();
        // If token has a freeze_authority, indicate this to users
        if (tokenInfo.freeze_authority) {
          console.log(`Token ${mintAddress} has freeze authority: ${tokenInfo.freeze_authority}`);
          return true;
        }
      }
    } catch (jupiterError) {
      console.error(`Error checking Jupiter freeze authority for ${mintAddress}:`, jupiterError);
    }
    
    return false;
  } catch (error) {
    console.error(`Error checking if token is frozen ${mintAddress}:`, error);
    return false;
  }
}

// Add a new function to fetch price data from Jupiter
async function fetchJupiterTokenPrice(mintAddress: string): Promise<number | undefined> {
  try {
    console.log(`Fetching Jupiter price data for ${mintAddress}`);
    
    // Use Jupiter's v2 price API which gives us price data for many tokens
    const jupiterPriceResponse = await fetch(`https://api.jup.ag/price/v2?ids=${mintAddress}`);
    
    if (!jupiterPriceResponse.ok) {
      console.log(`No Jupiter price data found for ${mintAddress}`);
      return undefined;
    }
    
    const priceData = await jupiterPriceResponse.json();
    console.log(`Jupiter price data for ${mintAddress}:`, priceData);
    
    // Check if we have price data for this token
    if (priceData.data && priceData.data[mintAddress]) {
      const price = parseFloat(priceData.data[mintAddress].price);
      console.log(`Found Jupiter price for ${mintAddress}: $${price}`);
      return price;
    }
    
    return undefined;
  } catch (error) {
    console.error(`Error fetching Jupiter price data for ${mintAddress}:`, error);
    return undefined;
  }
}

// Fetch token metadata from on-chain data using Jupiter instead of Helius RPC
async function fetchTokenInfo(mintAddress: string, walletPublicKey?: string): Promise<TokenMetadata | null> {
  try {
    console.log(`Fetching token info for ${mintAddress} from Jupiter`);
    
    // Use Jupiter's token info endpoint
    const jupiterResponse = await fetch(`https://lite-api.jup.ag/tokens/v1/token/${mintAddress}`);
    console.log("jupiterResponse", jupiterResponse);
    
    if (!jupiterResponse.ok) {
      console.log(`No Jupiter token info found for ${mintAddress}`);
      return null;
    }
    
    const tokenInfo = await jupiterResponse.json();
    if (!tokenInfo) {
      console.log(`No token info data for ${mintAddress}`);
      return null;
    }

    console.log("tokenInfo", tokenInfo);
    
    // Check if token is frozen using our combined approach
    const isFrozen = await isTokenFrozen(mintAddress, walletPublicKey);
    console.log(`Token ${mintAddress} frozen status: ${isFrozen}`);
    
    // Try to fetch price from Jupiter's price API
    const priceUsd = await fetchJupiterTokenPrice(mintAddress);
    
    return {
      name: tokenInfo.name || `Token ${mintAddress.slice(0, 8)}...${mintAddress.slice(-4)}`,
      symbol: tokenInfo.symbol || mintAddress.slice(0, 4).toUpperCase(),
      image: tokenInfo.logoURI || '',
      mint: mintAddress,
      priceUsd: priceUsd, // Include price if we found it
      hasSwapRoutes: false, // Will be set later
      isFrozen: isFrozen // Use our combined frozen check
    };
  } catch (error) {
    console.error(`Error fetching token info for ${mintAddress}:`, error);
    return null;
  }
}

// Fetch token metadata from on-chain data using Jupiter
export async function getTokenMetadata(mintAddress: string, walletPublicKey?: string): Promise<TokenMetadata> {
  // Return from cache if available
  if (tokenMetadataCache[mintAddress]) {
    return tokenMetadataCache[mintAddress];
  }
  
  try {
    // Try fetching from Jupiter token info endpoint
    const jupiterTokenInfo = await fetchTokenInfo(mintAddress, walletPublicKey);
    if (jupiterTokenInfo) {
      console.log(`Found Jupiter token info for ${mintAddress}:`, jupiterTokenInfo);
      
      // Check for swap routes if we have token info and it's not frozen
      if (!jupiterTokenInfo.isFrozen) {
        // Check if token has swap routes available via Jupiter
        const hasSwapRoutes = await checkJupiterSwapAvailability(mintAddress);
        jupiterTokenInfo.hasSwapRoutes = hasSwapRoutes;
      }
      
      // Cache the result from Jupiter data
      tokenMetadataCache[mintAddress] = jupiterTokenInfo;
      return jupiterTokenInfo;
    }
    
    // If Jupiter token info fails, try to at least get the price
    const priceUsd = await fetchJupiterTokenPrice(mintAddress);
    
    // Check if token is frozen using our combined approach
    const isFrozen = await isTokenFrozen(mintAddress, walletPublicKey);
    
    // Try to get logo in the background
    let logoUrl = '';
    try {
      logoUrl = await fetchTokenLogo(mintAddress);
    } catch (logoError) {
      console.error(`Error fetching logo for ${mintAddress}:`, logoError);
    }
    
    // Only check swap routes if not frozen and we have a price
    const hasSwapRoutes = !isFrozen && priceUsd ? await checkJupiterSwapAvailability(mintAddress) : false;
    
    // Create basic metadata with the information we were able to gather
    const basicMetadata: TokenMetadata = {
      name: `Token ${mintAddress.slice(0, 8)}...${mintAddress.slice(-4)}`,
      symbol: mintAddress.slice(0, 4).toUpperCase(),
      image: logoUrl,
      mint: mintAddress,
      priceUsd: priceUsd, // Always include price when available
      hasSwapRoutes,
      isFrozen: isFrozen
    };
    
    console.log(`Token ${mintAddress} basic info - price: $${priceUsd || 'not found'}, swap routes: ${hasSwapRoutes}, frozen: ${isFrozen}`);
    
    // Cache the result
    tokenMetadataCache[mintAddress] = basicMetadata;
    return basicMetadata;
  } catch (error) {
    console.error(`Error fetching metadata for ${mintAddress}:`, error);
    
    // Check for freeze status as a fallback
    const isFrozen = await isTokenFrozen(mintAddress, walletPublicKey);
    
    // Create fallback metadata
    const fallbackMetadata: TokenMetadata = {
      name: `Token ${mintAddress.slice(0, 8)}...${mintAddress.slice(-4)}`,
      symbol: mintAddress.slice(0, 4).toUpperCase(),
      image: '',
      mint: mintAddress,
      hasSwapRoutes: false,
      isFrozen: isFrozen
    };
    
    // Cache the fallback result
    tokenMetadataCache[mintAddress] = fallbackMetadata;
    return fallbackMetadata;
  }
}

// Batch fetch token metadata for multiple tokens
export async function batchGetTokenMetadata(mintAddresses: string[], walletPublicKey?: string): Promise<Record<string, TokenMetadata>> {
  // Using a map to track promises for each address
  const metadataPromises: Record<string, Promise<TokenMetadata>> = {};
  
  // Filter out mints we already have in cache
  for (const mint of mintAddresses) {
    if (tokenMetadataCache[mint]) {
      continue; // Skip if already in cache
    }
    
    // Create a promise for each token's metadata
    metadataPromises[mint] = getTokenMetadata(mint, walletPublicKey);
  }
  
  // Wait for all promises to resolve
  if (Object.keys(metadataPromises).length > 0) {
    try {
      const mintAddressesArray = Object.keys(metadataPromises);
      const promisesArray = Object.values(metadataPromises);
      
      console.log(`Fetching metadata for ${mintAddressesArray.length} tokens`);
      
      // Resolve all promises
      const results = await Promise.allSettled(promisesArray);
      
      // Process results
      results.forEach((result, index) => {
        const mintAddress = mintAddressesArray[index];
        
        if (result.status === 'fulfilled') {
          // Successful result is already cached in getTokenMetadata
        } else {
          console.error(`Failed to fetch metadata for ${mintAddress}:`, result.reason);
          // Create fallback for failures
          tokenMetadataCache[mintAddress] = {
            name: `Token ${mintAddress.slice(0, 8)}...${mintAddress.slice(-4)}`,
            symbol: mintAddress.slice(0, 4).toUpperCase(),
            image: '',
            mint: mintAddress,
            hasSwapRoutes: false,
            isFrozen: false  // Default to not frozen for failures
          };
        }
      });
    } catch (error) {
      console.error("Error batch fetching token metadata:", error);
    }
  }
  
  // Check for any mints still not in cache
  const remainingMints = mintAddresses.filter(mint => !tokenMetadataCache[mint]);
  if (remainingMints.length > 0) {
    console.log(`Checking remaining ${remainingMints.length} tokens for frozen status`);
    
    // Create promises for all remaining mints to check in parallel
    const tokenPromises = remainingMints.map(async (mint) => {
      try {
        // Check freeze status using our combined approach
        const isFrozen = await isTokenFrozen(mint, walletPublicKey);
        
        // Try to get logo in the background
        let logoUrl = '';
        try {
          logoUrl = await fetchTokenLogo(mint);
        } catch (logoError) {
          console.error(`Error fetching logo for ${mint}:`, logoError);
        }
        
        // Create and cache a minimal entry
        tokenMetadataCache[mint] = {
          name: isFrozen 
            ? `Frozen Token ${mint.slice(0, 8)}...${mint.slice(-4)}`
            : `Token ${mint.slice(0, 8)}...${mint.slice(-4)}`,
          symbol: isFrozen ? 'FROZEN' : mint.slice(0, 4).toUpperCase(),
          image: logoUrl,
          mint: mint,
          hasSwapRoutes: false,
          isFrozen: isFrozen
        };
      } catch (error) {
        console.error(`Error checking token ${mint}:`, error);
        
        // Create a generic entry if checks fail
        tokenMetadataCache[mint] = {
          name: `Token ${mint.slice(0, 8)}...${mint.slice(-4)}`,
          symbol: mint.slice(0, 4).toUpperCase(),
          image: '',
          mint: mint,
          hasSwapRoutes: false,
          isFrozen: false // Default to not frozen for errors
        };
      }
    });
    
    // Wait for all checks to complete
    await Promise.allSettled(tokenPromises);
  }
  
  // Return metadata for all requested mints from cache
  return mintAddresses.reduce((acc, mint) => {
    acc[mint] = tokenMetadataCache[mint] || {
      name: `Token ${mint.slice(0, 8)}...${mint.slice(-4)}`,
      symbol: mint.slice(0, 4).toUpperCase(),
      image: '',
      mint: mint,
      hasSwapRoutes: false,
      isFrozen: false // Default to not frozen for missing tokens
    };
    return acc;
  }, {} as Record<string, TokenMetadata>);
} 