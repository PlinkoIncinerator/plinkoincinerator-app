import { Metadata } from 'next';
import Image from 'next/image';
import RedirectClient from './redirect-client';

// Interface for the route parameters
type Props = {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

// Function to calculate the exact value based on token count and any token value
function calculateEstimatedValue(tokenCount: number, tokenValueParam?: string): string {
  // Important values from PlinkoIncinerator.tsx:
  // 1. Each token closure value is exactly 0.00203928 SOL 
  // 2. Fee percentage is 2.1% (0.021)
  // 3. Net value to user is the closure value * (1 - fee)
  
  const accountClosureValue = 0.00203928; // SOL
  const feePercentage = 0.021; // 2.1%
  
  // The user gets 97.9% of the value after fee
  const netValuePerToken = accountClosureValue * (1 - feePercentage);
  const totalValue = netValuePerToken * tokenCount;
  
  // Add additional token value if provided
  let additionalValue = 0;
  if (typeof tokenValueParam === 'string' && parseFloat(tokenValueParam) > 0) {
    // Additional value is also subject to fee
    additionalValue = parseFloat(tokenValueParam) * (1 - feePercentage);
  }
  
  // Final calculation
  const finalValue = totalValue + additionalValue;
  
  // Format to exactly 6 decimal places
  return finalValue.toFixed(6);
}

// Generate dynamic metadata for the page
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  // Get parameters from URL with simpler names
  const id = params.id;
  
  // Get the token count and calculate the recovered SOL if not provided
  const tokensBurned = typeof searchParams.n === 'string' ? parseInt(searchParams.n) : 0;
  
  // Check if there's a token value parameter (for tokens with value)
  const tokenValue = searchParams.v as string | undefined;
  
  // Use the provided SOL value if available, otherwise calculate it
  let recoveredSol = typeof searchParams.sol === 'string' ? searchParams.sol : '0';
  
  // If recoveredSol is 0 or not provided but we have tokens, calculate it
  if ((recoveredSol === '0' || !searchParams.sol) && tokensBurned > 0) {
    recoveredSol = calculateEstimatedValue(tokensBurned, tokenValue);
  }
  
  // Construct image URL from the ID
  const imageUrl = `${process.env.NEXT_PUBLIC_API_URL || ''}/api/share-images/${id}.png`;
  
  return {
    title: `Recovered ${recoveredSol} SOL on PlinkoIncinerator`,
    description: `I just recovered ${recoveredSol} SOL by incinerating ${tokensBurned} dust tokens with PlinkoIncinerator!`,
    openGraph: {
      title: `Recovered ${recoveredSol} SOL on PlinkoIncinerator`,
      description: `I just recovered ${recoveredSol} SOL by incinerating ${tokensBurned} dust tokens with PlinkoIncinerator!`,
      images: [imageUrl],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Recovered ${recoveredSol} SOL on PlinkoIncinerator`,
      description: `I just recovered ${recoveredSol} SOL by incinerating ${tokensBurned} dust tokens!`,
      images: [imageUrl],
    }
  };
}

// This is a server component
export default function SharePage({ params, searchParams }: Props) {
  // Get the token count and calculate the recovered SOL if not provided
  const tokenCount = typeof searchParams.n === 'string' ? parseInt(searchParams.n) : 0;
  
  // Check if there's a token value parameter (for tokens with value)
  const tokenValue = searchParams.v as string | undefined;
  
  // Use the provided SOL value if available, otherwise calculate it
  let recoveredSol = typeof searchParams.sol === 'string' ? searchParams.sol : '0';
  
  // If recoveredSol is 0 or not provided but we have tokens, calculate it
  if ((recoveredSol === '0' || !searchParams.sol) && tokenCount > 0) {
    recoveredSol = calculateEstimatedValue(tokenCount, tokenValue);
  }
  
  // Construct the share info object to pass to the client component
  const shareInfo = {
    recoveredSol,
    tokenCount,
    // Include information about whether this includes token value
    hasTokenValue: typeof tokenValue === 'string' && parseFloat(tokenValue) > 0
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-black text-white">
      {/* Client component for handling redirect and displaying modal */}
      <RedirectClient shareInfo={shareInfo} />
      
      {/* Simple page content that will be visible briefly and blurred behind the modal */}
      <div className="container mx-auto px-4 py-16 text-center">
        <Image 
          src="/logo_no_bg.png" 
          alt="PlinkoIncinerator Logo" 
          width={120} 
          height={120}
          className="mx-auto"
        />
        
        <h1 className="text-3xl font-bold mt-8 mb-2 bg-gradient-to-r from-pink-400 to-purple-600 bg-clip-text text-transparent">
          PlinkoIncinerator
        </h1>
        
        <p className="text-xl text-gray-300">
          Loading shared result...
        </p>
      </div>
    </div>
  );
} 