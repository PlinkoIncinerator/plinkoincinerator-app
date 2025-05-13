"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

// Define the props interface
interface RedirectClientProps {
  shareInfo: {
    recoveredSol: string;
    tokenCount: number;
    hasTokenValue: boolean;
  };
}

export default function RedirectClient({ shareInfo }: RedirectClientProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const { recoveredSol, tokenCount, hasTokenValue } = shareInfo;

  // Function to handle redirection
  const handleRedirect = () => {
    setRedirecting(true);
    window.location.href = "https://plinkoincinerator.com";
  };

  // Function to handle modal close
  const handleCloseModal = () => {
    setShowModal(false);
    handleRedirect();
  };

  // Automatically redirect after a delay if the user hasn't interacted
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (showModal) {
        handleRedirect();
      }
    }, 1000); // 10 seconds delay for automatic redirect

    return () => clearTimeout(timeout);
  }, [showModal]);

  if (!showModal) {
    return null;
  }

  return (
    // Backdrop with extremely high z-index to ensure it's above all elements
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[99999]"
      onClick={handleCloseModal} // Close when clicking outside
      style={{ position: 'fixed', zIndex: 2147483647 }} // Maximum possible z-index value
    >
      {/* Modal content */}
      <div 
        className="bg-gray-900 rounded-xl p-6 max-w-md w-full mx-4 border border-purple-700 shadow-2xl animate-fadeIn"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on the modal itself
      >
        {/* Close button */}
        <div className="flex justify-end">
          <button 
            onClick={handleCloseModal}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <Image 
            src="/logo_no_bg.png" 
            alt="PlinkoIncinerator Logo" 
            width={80} 
            height={80}
            className="animate-pulse"
          />
        </div>
        
        {/* Achievement Display */}
        <div className="bg-gradient-to-br from-purple-900 via-black to-pink-900 p-4 rounded-xl border border-purple-600 mb-4">
          <div className="text-center">
            <h3 className="text-lg font-bold text-white mb-2">🔥 Token Incineration 🔥</h3>
            <p className="text-sm text-gray-300 mb-1">Recovered</p>
            <p className="text-2xl font-bold text-green-400 mb-1">
              {recoveredSol} SOL
            </p>
            <p className="text-sm text-gray-300">
              by incinerating {tokenCount} dust {tokenCount === 1 ? "token" : "tokens"}
            </p>
            {hasTokenValue && (
              <div className="mt-2 text-xs text-blue-300 bg-blue-900/30 rounded-lg p-1.5">
                <span className="font-medium">Includes token value!</span> Some tokens had extra value that was recovered.
              </div>
            )}
          </div>
        </div>
        
        {/* Title */}
        <h2 className="text-xl font-bold text-center text-purple-300 mb-4">
          Welcome to PlinkoIncinerator!
        </h2>
        
        {/* Message */}
        <p className="text-gray-300 mb-6 text-center">
          You're viewing a shared result. Want to recover SOL from your own dust tokens?
        </p>
        
        {/* CTA Button */}
        <div className="flex justify-center">
          <button
            onClick={handleCloseModal}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-2.5 px-6 rounded-lg transition-all shadow-lg hover:shadow-xl hover:scale-105 font-medium"
            disabled={redirecting}
          >
            {redirecting ? (
              <div className="flex items-center">
                <span className="mr-2">Redirecting</span>
                <div className="animate-spin h-4 w-4 border-2 border-t-transparent border-white rounded-full"></div>
              </div>
            ) : (
              "Try PlinkoIncinerator Now"
            )}
          </button>
        </div>
        
        {/* Footer text */}
        <p className="text-gray-500 text-xs text-center mt-4">
          Click outside this popup or the button above to continue
        </p>
      </div>
    </div>
  );
} 