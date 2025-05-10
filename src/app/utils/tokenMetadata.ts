// Types for token metadata
export interface TokenMetadata {
  name: string;
  symbol: string;
  image: string;
  mint: string;
  priceUsd?: number;
  hasSwapRoutes?: boolean; // Add flag to indicate if token has swap routes
}

// Cache for token metadata to avoid repeated API calls
const tokenMetadataCache: Record<string, TokenMetadata> = {};

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

// Fetch token metadata from DexScreener API
export async function getTokenMetadata(mintAddress: string): Promise<TokenMetadata> {
  // Return from cache if available
  if (tokenMetadataCache[mintAddress]) {
    return tokenMetadataCache[mintAddress];
  }
  
  try {
    // Use DexScreener API to get token metadata
    const url = `https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`;
    console.log(`Fetching metadata for ${mintAddress} from DexScreener`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch token metadata: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data || !data.pairs || data.pairs.length === 0) {
      // If DexScreener has no data and token ends with 'pump', try Pump.fun API
      if (mintAddress.toLowerCase().endsWith('pump')) {
        console.log(`No DexScreener data found for ${mintAddress}, trying Pump.fun API`);
        return await getPumpFunMetadata(mintAddress);
      }
      console.log(`No DexScreener data found for ${mintAddress}`);
      throw new Error("No metadata found");
    }
    
    // Get the first pair data which contains token info
    const tokenData = data.pairs[0];
    console.log("Debug: DexScreener token data:", tokenData);
    
    // Use the image URL from the info section if available
    let imageUrl = '';
    if (tokenData.info && tokenData.info.imageUrl) {
      imageUrl = tokenData.info.imageUrl;
    } else {
      // Fallback to generic source
      imageUrl = `https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/${mintAddress}/logo.png`;
    }
    
    // Get price in USD if available
    // priceUsd is the price per token in USD
    const priceUsd = tokenData.priceUsd ? parseFloat(tokenData.priceUsd) : undefined;
    console.log(`Debug: Token ${mintAddress} price per token: $${priceUsd}`);
    
    // Check if token has swap routes available via Jupiter
    const hasSwapRoutes = priceUsd ? await checkJupiterSwapAvailability(mintAddress) : false;
    
    console.log("hasSwapRoutes", hasSwapRoutes);
    
    const result: TokenMetadata = {
      name: tokenData.baseToken.name || 'Unknown Token',
      symbol: tokenData.baseToken.symbol || '???',
      image: imageUrl,
      mint: mintAddress,
      priceUsd: hasSwapRoutes ? priceUsd : undefined, // Only show price if swap routes exist
      hasSwapRoutes
    };
    
    console.log(`Token ${mintAddress} has swap routes: ${hasSwapRoutes}, displaying price: ${hasSwapRoutes ? priceUsd : 'hidden'}`);
    
    // Cache the result
    tokenMetadataCache[mintAddress] = result;
    console.log(`Cached metadata for ${mintAddress}:`, result);
    return result;
  } catch (error) {
    console.error(`Error fetching metadata for ${mintAddress}:`, error);
    
    // If token ends with 'pump', try Pump.fun API as fallback
    if (mintAddress.toLowerCase().endsWith('pump')) {
      try {
        return await getPumpFunMetadata(mintAddress);
      } catch (pumpError) {
        console.error(`Error fetching from Pump.fun API: ${pumpError}`);
      }
    }
   
    // Fallback to basic metadata
    const fallbackMetadata: TokenMetadata = {
      name: `Token ${mintAddress.slice(0, 4)}...${mintAddress.slice(-4)}`,
      symbol: '???',
      image: '',
      mint: mintAddress,
      hasSwapRoutes: false
    };
    
    // Cache the fallback result
    tokenMetadataCache[mintAddress] = fallbackMetadata;
    return fallbackMetadata;
  }
}

// Function to fetch metadata from Pump.fun API
async function getPumpFunMetadata(mintAddress: string): Promise<TokenMetadata> {
  const url = `https://frontend-api-v3.pump.fun/coins/${mintAddress}`;
  console.log(`Fetching metadata for ${mintAddress} from Pump.fun API`);
  
  const response = await fetch(url, {
    headers: {
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.5',
      'Content-Type': 'application/json',
      'Origin': 'https://pump.fun',
      'Referer': 'https://pump.fun/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:135.0) Gecko/20100101 Firefox/135.0'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch from Pump.fun API: ${response.statusText}`);
  }
  
  const data = await response.json();
  console.log("Debug: Pump.fun token data:", data);
  
  // Calculate price per token in USD
  // market_cap is in USD, total_supply is the total token supply
  const priceUsd = data.market_cap && data.total_supply 
    ? data.market_cap / (data.total_supply / Math.pow(10, 9)) // Convert from raw amount to actual tokens
    : undefined;
  
  console.log(`Debug: Token ${mintAddress} price per token from Pump.fun: $${priceUsd}`);
  
  // Only check Jupiter if we have a price
  const hasSwapRoutes = priceUsd ? await checkJupiterSwapAvailability(mintAddress) : false;
  
  const result: TokenMetadata = {
    name: data.name || `Token ${mintAddress.slice(0, 4)}...${mintAddress.slice(-4)}`,
    symbol: data.symbol || '???',
    image: data.image_uri || '',
    mint: mintAddress,
    priceUsd: hasSwapRoutes ? priceUsd : undefined, // Only show price if swap routes exist
    hasSwapRoutes
  };
  
  console.log(`Pump token ${mintAddress} has swap routes: ${hasSwapRoutes}, displaying price: ${hasSwapRoutes ? priceUsd : 'hidden'}`);
  
  // Cache the result
  tokenMetadataCache[mintAddress] = result;
  console.log(`Cached Pump.fun metadata for ${mintAddress}:`, result);
  return result;
}

// Batch fetch token metadata for multiple tokens
export async function batchGetTokenMetadata(mintAddresses: string[]): Promise<Record<string, TokenMetadata>> {
  // Using a map to track promises for each address
  const metadataPromises: Record<string, Promise<TokenMetadata>> = {};
  
  // Filter out mints we already have in cache
  for (const mint of mintAddresses) {
    if (tokenMetadataCache[mint]) {
      continue; // Skip if already in cache
    }
    
    // Create a promise for each token's metadata
    metadataPromises[mint] = getTokenMetadata(mint);
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
            name: `Token ${mintAddress.slice(0, 4)}...${mintAddress.slice(-4)}`,
            symbol: '???',
            image: '',
            mint: mintAddress,
            hasSwapRoutes: false
          };
        }
      });
    } catch (error) {
      console.error("Error batch fetching token metadata:", error);
    }
  }
  
  // Return metadata for all requested mints from cache
  return mintAddresses.reduce((acc, mint) => {
    acc[mint] = tokenMetadataCache[mint] || {
      name: `Token ${mint.slice(0, 4)}...${mint.slice(-4)}`,
      symbol: '???',
      image: '',
      mint: mint,
      hasSwapRoutes: false
    };
    return acc;
  }, {} as Record<string, TokenMetadata>);
} 