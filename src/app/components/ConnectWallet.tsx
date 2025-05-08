"use client";

import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useState } from "react";

export function ConnectWallet() {
  const { 
    handleLogOut, 
    setShowAuthFlow,
    primaryWallet,
  } = useDynamicContext();
  
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      setShowAuthFlow(true);
    } catch (error) {
      console.error("Error logging in:", error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await handleLogOut();
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  if (primaryWallet) {
    // Show connected wallet address (truncated)
    const address = primaryWallet.address || "";
    const displayAddress = address 
      ? `${address.substring(0, 4)}...${address.substring(address.length - 4)}`
      : "CONNECTED";

    return (
      <div className="relative group">
        <button className="retro-button flex items-center gap-2">
          <span>{displayAddress}</span>
          <span className="text-xs">▼</span>
        </button>
        
        {/* Dropdown Menu */}
        <div className="absolute right-0 mt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 retro-panel">
          <div className="p-2 border-b border-gray-700">
            <p className="text-xs uppercase tracking-wider opacity-70">Wallet</p>
            <p className="font-mono text-sm">{displayAddress}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-accent-red hover:bg-gray-800 text-sm uppercase tracking-wider"
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleLogin}
      disabled={isLoggingIn}
      className="retro-button"
    >
      {isLoggingIn ? (
        <div className="flex items-center">
          <div className="retro-spinner"></div>
          <span>CONNECTING...</span>
        </div>
      ) : (
        <span>CONNECT WALLET</span>
      )}
    </button>
  );
} 