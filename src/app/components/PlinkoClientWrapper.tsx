'use client';

import React, { useState, useEffect, createContext, useRef, useCallback } from 'react';
import PlinkoGameClient from './plinko/PlinkoGameClient';
import GlobalMobileControls from './GlobalMobileControls';
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { PlinkoService } from '../utils/plinkoService';
import { useSearchParams, useRouter } from 'next/navigation';

// Define the context interface
interface PlinkoControlsContextType {
  walletAddress: string;
  onPlay: (options: any) => void;
  disabled: boolean;
  currentBalance: number;
  isTestMode: boolean;
  testBalance: number;
  isPlayTriggered: boolean;
  plinkoService: PlinkoService | null;
}

// Create a Context for Plinko Game Controls
export const PlinkoControlsContext = createContext<PlinkoControlsContextType>({
  walletAddress: '',
  onPlay: (options: any) => {},
  disabled: true,
  currentBalance: 0,
  isTestMode: false,
  testBalance: 10,
  isPlayTriggered: false,
  plinkoService: null,
});

interface PlinkoClientWrapperProps {
  initialBalance?: number;
}

function PlinkoClientWrapper({ initialBalance = 1000 }: PlinkoClientWrapperProps) {
  const { primaryWallet } = useDynamicContext();
  const walletAddress = primaryWallet?.address || '';
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Add a state to track play trigger for debugging
  const [isPlayTriggered, setIsPlayTriggered] = useState(false);
  
  // Get the plinkoService instance directly
  const [plinkoService] = useState(() => {
    // Use the singleton from plinkoService to ensure consistency
    try {
      const { getPlinkoService } = require('../utils/plinkoService');
      return getPlinkoService();
    } catch (error) {
      console.error('Error getting plinkoService instance:', error);
      return null;
    }
  });
  
  // Handle referral code from URL
  useEffect(() => {
    // Check for referral code in URL parameters (using 'code' parameter)
    const referralCode = searchParams.get('code');
    if (referralCode) {
      localStorage.setItem('referralCode', referralCode);
      console.log(`Detected referral code: ${referralCode}`);
      
      // Only redirect if we're on a URL with query parameters to clean the URL
      if (window.location.search) {
        router.push('/');
      }
    }
  }, [searchParams, router]);
  
  // Use ref for controls state to avoid re-renders
  const controlsRef = useRef<PlinkoControlsContextType>({
    walletAddress: '',
    onPlay: (options: any) => {
      console.log('Default onPlay called - this should be replaced by PlinkoGameClient');
    },
    disabled: true,
    currentBalance: 0,
    isTestMode: false,
    testBalance: 10,
    isPlayTriggered: false,
    plinkoService: plinkoService,
  });
  
  // State only used for context updates, not for tracking real-time values
  const [plinkoControls, setPlinkoControls] = useState<PlinkoControlsContextType>(controlsRef.current);
  
  // Listen for balance updates from plinkoService
  useEffect(() => {
    if (!plinkoService) return;
    
    console.log('PlinkoClientWrapper: Setting up balance update listener');
    
    const handleBalanceUpdate = (newBalance: number) => {
      console.log('PlinkoClientWrapper: Balance update received:', newBalance);
      
      // Don't update test mode balance
      if (controlsRef.current.isTestMode) {
        console.log('PlinkoClientWrapper: Ignoring balance update in test mode');
        return;
      }
      
      // Update the ref
      const prevBalance = controlsRef.current.currentBalance;
      controlsRef.current = {
        ...controlsRef.current,
        currentBalance: newBalance
      };
      
      // Force update state to propagate change to all components
      setPlinkoControls({
        ...controlsRef.current
      });
      
      console.log('PlinkoClientWrapper: Balance updated from', prevBalance, 'to', newBalance);
    };
    
    // Register balance update listener
    plinkoService.addBalanceUpdateListener(handleBalanceUpdate);
    
    // Cleanup on unmount
    return () => {
      plinkoService.removeBalanceUpdateListener(handleBalanceUpdate);
    };
  }, [plinkoService]);
  
  // Use effect with proper dependencies
  useEffect(() => {
    if (walletAddress !== controlsRef.current.walletAddress) {
      controlsRef.current = {
        ...controlsRef.current,
        walletAddress
      };
      // Only update state when wallet address actually changes
      setPlinkoControls({...controlsRef.current});
    }
  }, [walletAddress]);
  
  // Stable callback that doesn't change on re-renders
  const registerPlinkoControls = useCallback((controls: any, forceUpdate = false) => {
    // Add debug logs
    console.log('PlinkoClientWrapper: Registering controls from PlinkoGameClient', {
      ...controls,
      onPlay: 'function',
      forceUpdate
    });
    
    // Create a wrapper for the onPlay function that also sets the trigger state
    const wrappedOnPlay = (options: any) => {
      console.log('PlinkoClientWrapper: onPlay called with options:', options);
      setIsPlayTriggered(true);
      
      // Reset the trigger state after a short delay
      setTimeout(() => {
        setIsPlayTriggered(false);
      }, 100);
      
      // Call the actual onPlay from controls
      controls.onPlay(options);
    };
    
    // Update the ref but don't trigger a re-render unless necessary
    const prevControls = controlsRef.current;
    
    // Deep equality check for important values only
    const hasImportantChanges = 
      prevControls.walletAddress !== controls.walletAddress ||
      // Compare balance values with a small epsilon for floating point precision
      Math.abs(prevControls.currentBalance - controls.currentBalance) > 0.000001 ||
      prevControls.isTestMode !== controls.isTestMode ||
      prevControls.testBalance !== controls.testBalance ||
      prevControls.disabled !== controls.disabled;
    
    // Always update the ref with the wrapped onPlay,
    // but preserve our plinkoService instance
    controlsRef.current = {
      ...controls,
      onPlay: wrappedOnPlay,
      isPlayTriggered,
      // Keep our stable reference to plinkoService
      plinkoService: plinkoService || controls.plinkoService || null
    };
    
    // Only update state (causing re-render) if important values changed or forceUpdate is true
    if (hasImportantChanges || forceUpdate) {
      console.log('PlinkoClientWrapper: Important changes detected, updating controls state', {
        prevIsTestMode: prevControls.isTestMode,
        newIsTestMode: controls.isTestMode,
        prevBalance: prevControls.currentBalance,
        newBalance: controls.currentBalance
      });
      
      // Trigger an immediate update with the new state
      setPlinkoControls({
        ...controls,
        onPlay: wrappedOnPlay,
        isPlayTriggered,
        // Keep our stable reference to plinkoService
        plinkoService: plinkoService || controls.plinkoService || null
      });
      
      // Force a slight delay then update again to ensure changes propagate correctly
      if (prevControls.isTestMode !== controls.isTestMode) {
        setTimeout(() => {
          console.log('PlinkoClientWrapper: Forcing delayed update after test mode change');
          setPlinkoControls(current => ({
            ...current,
            isTestMode: controls.isTestMode,
            testBalance: controls.testBalance,
            currentBalance: controls.currentBalance
          }));
        }, 50);
      }
    }
  }, [isPlayTriggered, plinkoService]); // Include plinkoService in dependencies
  
  return (
    <PlinkoControlsContext.Provider value={plinkoControls}>
      <div className="plinko-client-wrapper md:bg-black md:bg-opacity-40 md:backdrop-blur-sm md:rounded-xl md:p-6 md:border md:border-purple-900 md:shadow-2xl">
        <PlinkoGameClient 
          initialBalance={initialBalance} 
          onRegisterControls={registerPlinkoControls}
        />
      </div>
      
      {/* Global Mobile Controls */}
      <GlobalMobileControls 
        walletAddress={plinkoControls.walletAddress}
        onPlay={plinkoControls.onPlay}
        disabled={plinkoControls.disabled}
        currentBalance={plinkoControls.currentBalance}
        isTestMode={plinkoControls.isTestMode}
        testBalance={plinkoControls.testBalance}
        plinkoService={plinkoService}
      />
    </PlinkoControlsContext.Provider>
  );
}

// Use memo to prevent unnecessary re-renders
export default React.memo(PlinkoClientWrapper); 