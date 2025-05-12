'use client';

import { useState, useEffect } from 'react';
import { trackPlinkoEvent, ANALYTICS_EVENTS } from '../utils/analytics';

export default function TokenBanner() {
  const [showTokenBanner, setShowTokenBanner] = useState(true);
  
  // Check local storage on component mount to see if user has previously closed the banner
  useEffect(() => {
    const bannerDismissed = localStorage.getItem('tokenBannerDismissed');
    if (bannerDismissed === 'true') {
      setShowTokenBanner(false);
    }
  }, []);

  // Track token signup banner interaction
  const handleTokenBannerClose = () => {
    setShowTokenBanner(false);
    localStorage.setItem('tokenBannerDismissed', 'true');
    trackPlinkoEvent(ANALYTICS_EVENTS.TOKEN_SIGNUP, {
      action: 'banner_dismissed'
    });
  };

  if (!showTokenBanner) return null;

  return (
    <div className="bg-gradient-to-r from-purple-600 to-indigo-500 text-white py-3 relative">
      <div className="container mx-auto px-4 text-center">
        <p className="font-bold mb-2">
          <span className="animate-pulse">🚀</span> $PLINC Token is LIVE! <span className="animate-pulse">🚀</span>
        </p>
        <div className="flex items-center justify-center space-x-2 max-w-lg mx-auto bg-black bg-opacity-20 rounded-lg p-2">
          <span className="text-sm font-mono truncate">49Jy3P5J41zkcCgaveKXQfeUU3zNCHCSEEypkJTrpump</span>
          <button 
            onClick={() => {
              navigator.clipboard.writeText("49Jy3P5J41zkcCgaveKXQfeUU3zNCHCSEEypkJTrpump");
              // Track the copy action
              trackPlinkoEvent(ANALYTICS_EVENTS.TOKEN_SIGNUP, {
                action: 'contract_address_copied'
              });
              // Add visual feedback when copied
              const btn = document.getElementById('copy-btn');
              if (btn) {
                const originalText = btn.innerText;
                btn.innerText = 'Copied!';
                setTimeout(() => {
                  btn.innerText = originalText;
                }, 1500);
              }
            }}
            id="copy-btn"
            className="bg-indigo-700 hover:bg-indigo-800 text-white text-xs py-1 px-2 rounded-md transition-colors"
          >
            Copy CA
          </button>
        </div>
        <button 
          onClick={handleTokenBannerClose}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-200"
          aria-label="Close banner"
        >
          ✕
        </button>
      </div>
    </div>
  );
} 