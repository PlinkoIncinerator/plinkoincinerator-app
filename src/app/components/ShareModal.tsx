import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { SolanaLogo } from './PlinkoIncinerator';
import { toPng } from 'html-to-image';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  recoveredSol: number;
  walletAddress: string;
  tokensBurned: number;
  isWithdraw: boolean;
}

export default function ShareModal({ 
  isOpen, 
  onClose, 
  recoveredSol, 
  walletAddress,
  tokensBurned,
  isWithdraw
}: ShareModalProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [storedImageUrl, setStoredImageUrl] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Generate the image when the modal opens
  useEffect(() => {
    if (isOpen && cardRef.current) {
      setIsLoading(true);
      setUploadError(null);
      
      // Small delay to ensure the DOM is fully rendered
      setTimeout(() => {
        if (cardRef.current) {
          toPng(cardRef.current, { 
            quality: 0.6, // Further reduce quality to decrease file size
            pixelRatio: 1.5, // Lower pixel ratio to reduce size
            cacheBust: true
          })
            .then((dataUrl) => {
              setImageUrl(dataUrl);
              
              // Store the image on the server immediately
              if (dataUrl) {
                // Request data in smaller chunks to avoid payload size issues
                const smallerImage = compressImage(dataUrl);
                storeImageOnServer(smallerImage);
              } else {
                setIsLoading(false);
              }
            })
            .catch((error) => {
              console.error('Error generating image:', error);
              setIsLoading(false);
              setUploadError('Failed to generate image');
            });
        }
      }, 200);
    }
  }, [isOpen, walletAddress, recoveredSol, tokensBurned]);
  
  // Generate shareable URL when we have the stored image URL
  useEffect(() => {
    if (storedImageUrl) {
      const baseUrl = window.location.origin;
      // Create a unique ID from the image URL or timestamp
      const imageId = storedImageUrl.split('/').pop()?.split('.')[0] || Date.now().toString();
      
      // Generate a cleaner, shorter share URL with minimal parameters
      // We'll store just the essential information and derive the rest on the share page
      const url = new URL(`${baseUrl}/shares/${imageId}`);
      url.searchParams.set('sol', recoveredSol.toFixed(6));
      url.searchParams.set('n', tokensBurned.toString());
      
      // Don't include the wallet address in the URL unless necessary
      // Don't include the full image URL - we'll construct it on the share page
      
      setShareUrl(url.toString());
    }
  }, [storedImageUrl, recoveredSol, walletAddress, tokensBurned]);
  
  // Function to compress image by reducing quality
  const compressImage = (dataUrl: string): string => {
    try {
      // Convert the image to JPEG with lower quality
      // This significantly reduces the payload size
      return dataUrl.replace(/^data:image\/png;base64,/, 'data:image/jpeg;base64,');
    } catch (error) {
      console.error('Error compressing image:', error);
      return dataUrl; // Fall back to original if compression fails
    }
  };
  
  // Function to store image on server
  const storeImageOnServer = (imageData: string) => {
    const apiEndpoint = `${process.env.NEXT_PUBLIC_API_URL || ''}/api/store-share-image`;
    
    // Define a function to make the API call that we can retry
    const attemptUpload = (attempt = 1, maxAttempts = 2) => {
      console.log(`Attempting to upload image (attempt ${attempt} of ${maxAttempts})`);
      
      fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          imageData: imageData,
          walletAddress: walletAddress,
          recoveredSol: recoveredSol
        })
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        if (data.imageUrl) {
          setStoredImageUrl(data.imageUrl);
        }
        setIsLoading(false);
      })
      .catch(error => {
        console.error(`Error storing image (attempt ${attempt}):`, error);
        
        // If we haven't exceeded max attempts and error seems retryable, try again
        // This helps when the bucket is being created on first attempt
        if (attempt < maxAttempts) {
          console.log('Retrying upload after short delay...');
          // Wait 2 seconds before retrying to allow bucket creation to complete
          setTimeout(() => attemptUpload(attempt + 1, maxAttempts), 2000);
        } else {
          setIsLoading(false);
          setUploadError('Failed to upload image. Using text-only sharing.');
        }
      });
    };
    
    // Start the first attempt
    attemptUpload();
  };
  
  // Reset state when closing
  useEffect(() => {
    if (!isOpen) {
      setCopySuccess(false);
      setUploadError(null);
    }
  }, [isOpen]);
  
  // Handle click outside to close the modal
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);
  
  const handleCopyShareLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };
  
  const handleShareWithoutImage = () => {
    // Fallback sharing method that doesn't use the image
    const baseText = `🔥 I just recovered ${recoveredSol.toFixed(6)} SOL by incinerating ${tokensBurned} dust tokens with @plinkcinerator!`;
    const websiteUrl = "https://plinkoincinerator.com";
    const shareText = encodeURIComponent(`${baseText}\n\nClean your wallet & earn: ${websiteUrl}`);
    
    // Open in a new tab for the user to share
    window.open(`https://twitter.com/intent/tweet?text=${shareText}`, '_blank');
  };
  
  const handleTweetShare = () => {
    if (uploadError || !shareUrl) {
      handleShareWithoutImage();
      return;
    }
    
    // Use the shareable URL instead of including the image directly
    const baseText = `🔥 I just recovered ${recoveredSol.toFixed(6)} SOL by incinerating ${tokensBurned} dust tokens with @plinkcinerator!`;
    const shareText = encodeURIComponent(`${baseText}\n\nCheck out my result: ${shareUrl}`);
    
    window.open(`https://twitter.com/intent/tweet?text=${shareText}`, '_blank');
  };
  
  const handleTelegramShare = () => {
    if (uploadError || !shareUrl) {
      // Use text-only sharing for Telegram as well
      const baseText = `🔥 I just recovered ${recoveredSol.toFixed(6)} SOL by incinerating ${tokensBurned} dust tokens with PlinkoIncinerator!`;
      const websiteUrl = "https://plinkoincinerator.com";
      const shareText = encodeURIComponent(`${baseText}\n\nClean your wallet & earn: ${websiteUrl}`);
      
      window.open(`https://t.me/share/url?url=${encodeURIComponent(websiteUrl)}&text=${shareText}`, '_blank');
      return;
    }
    
    // For Telegram, share the URL directly
    const shareText = encodeURIComponent(`🔥 I just recovered ${recoveredSol.toFixed(6)} SOL by incinerating ${tokensBurned} dust tokens with PlinkoIncinerator! Check out my result:`);
    
    window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${shareText}`, '_blank');
  };
  
  if (!isOpen) return null;
  
  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
      onClick={(e) => {
        // Close when clicking outside the modal
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Floating fire emojis animation - only show for withdraw */}
      {isWithdraw && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 15 }).map((_, i) => (
            <div 
              key={i}
              className="absolute animate-float-up text-3xl"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100 + 100}%`,
                animationDuration: `${Math.random() * 5 + 8}s`,
                animationDelay: `${Math.random() * 5}s`,
                opacity: 0.7
              }}
            >
              {['🔥', '💰', '✨', '💎', '🎉'][Math.floor(Math.random() * 5)]}
            </div>
          ))}
        </div>
      )}
      
      <div 
        ref={modalRef}
        className="bg-gray-900 rounded-xl border border-purple-700 shadow-2xl max-w-md w-full p-6 overflow-hidden animate-fadeIn"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white flex items-center">
            <span className="mr-2">🎉</span> Share Your Success!
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Celebratory message - only show for withdraw */}
        {isWithdraw && (
          <div className="text-center mb-4">
            <div className="inline-block bg-gradient-to-r from-green-400 to-blue-500 text-transparent bg-clip-text text-lg font-bold animate-pulse">
              Congratulations! You've recovered SOL!
            </div>
          </div>
        )}
        
        {/* Shareable card */}
        <div className="mb-6">
          <div 
            ref={cardRef} 
            className="bg-gradient-to-br from-purple-900 via-black to-pink-900 p-6 rounded-xl border-2 border-purple-600 shadow-lg overflow-hidden relative"
          >
            <div className="absolute top-4 left-4 z-10">
              <Image 
                src="/logo_no_bg.png" 
                alt="PlinkoIncinerator Logo" 
                width={60} 
                height={60}
              />
            </div>
            
            <div className="text-center mb-2 pt-16">
              <h4 className="text-2xl font-bold text-white mb-1">
                🔥 Tokens Incinerated! 🔥
              </h4>
              <p className="text-purple-300 text-sm">PlinkoIncinerator.com</p>
            </div>
            
            <div className="bg-black bg-opacity-50 p-4 rounded-lg mb-4">
              <div className="text-center">
                <p className="text-sm text-gray-300 mb-1">I just recovered</p>
                <p className="text-3xl font-bold text-green-400 mb-1 flex items-center justify-center">
                  {recoveredSol.toFixed(6)} <SolanaLogo className="ml-2" width={20} height={18} />
                </p>
                <p className="text-sm text-gray-300">by incinerating {tokensBurned} dust tokens</p>
              </div>
            </div>
            
            <div className="text-center text-xs text-gray-400">
              Clean your wallet & earn SOL at plinkoincinerator.com
            </div>
          </div>
        </div>
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-center mb-4">
            <div className="animate-spin h-6 w-6 border-2 border-purple-500 border-t-transparent rounded-full"></div>
          </div>
        )}
        
        {/* Error message */}
        {uploadError && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-800/50 rounded-lg text-red-400 text-sm">
            <p>{uploadError}</p>
            <button 
              onClick={handleShareWithoutImage}
              className="mt-2 text-xs underline hover:text-red-300"
            >
              Share without image
            </button>
          </div>
        )}
        
        {/* Share title */}
        <div className="mb-3 text-center">
          <p className="text-blue-300 font-medium">Share your success on social media!</p>
        </div>
        
        {/* Share buttons - redesigned to be more prominent */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={handleTweetShare}
            className="flex flex-col items-center justify-center bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white p-4 rounded-lg transition-all hover:scale-105 shadow-lg"
            disabled={isLoading}
          >
            <Image src="/twitter.png" alt="X (Twitter)" width={32} height={32} className="mb-2 rounded-full bg-white p-1" />
            <span className="text-sm font-medium">Share on X</span>
            <span className="text-xs text-blue-200 mt-1">Twitter</span>
          </button>
          
          <button
            onClick={handleTelegramShare}
            className="flex flex-col items-center justify-center bg-gradient-to-r from-blue-500 to-blue-400 hover:from-blue-600 hover:to-blue-500 text-white p-4 rounded-lg transition-all hover:scale-105 shadow-lg"
            disabled={isLoading}
          >
            <Image src="/telegram.png" alt="Telegram" width={32} height={32} className="mb-2 rounded-full" />
            <span className="text-sm font-medium">Share on</span>
            <span className="text-xs text-blue-200 mt-1">Telegram</span>
          </button>
        </div>
        
        {/* Copy link button as a small secondary option */}
        {shareUrl && (
          <div className="mt-4 text-center">
            <button 
              onClick={handleCopyShareLink}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors underline"
            >
              {copySuccess ? 'Link copied!' : 'Copy share link'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 