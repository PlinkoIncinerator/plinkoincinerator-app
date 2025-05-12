'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import PlinkoMobileControls from './plinko/PlinkoMobileControls';
import { usePathname } from 'next/navigation';
import { PlinkoService } from '../utils/plinkoService';

interface GlobalMobileControlsProps {
  walletAddress: string;
  onPlay: (options: any) => void;
  disabled: boolean;
  currentBalance: number;
  isTestMode: boolean;
  testBalance: number;
  plinkoService?: PlinkoService | null;
}

export default function GlobalMobileControls({
  walletAddress,
  onPlay,
  disabled,
  currentBalance,
  isTestMode,
  testBalance,
  plinkoService
}: GlobalMobileControlsProps) {
  const [expandedControls, setExpandedControls] = useState<boolean>(false);
  const [isMobileView, setIsMobileView] = useState<boolean>(false);
  const [isGameVisible, setIsGameVisible] = useState<boolean>(false);
  const pathname = usePathname();
  
  // Store props in refs to avoid unnecessary re-renders
  const propsRef = useRef({
    walletAddress,
    onPlay,
    disabled,
    currentBalance,
    isTestMode,
    testBalance,
    plinkoService
  });
  
  // Add debug counter to track onPlay calls
  const playCountRef = useRef(0);
  
  // Add state to track the balance internally
  const [internalBalance, setInternalBalance] = useState<number>(currentBalance);
  
  // Listen for balance updates from plinkoService
  useEffect(() => {
    if (!plinkoService) return;
    
    // Create a balance update listener function
    const balanceUpdateListener = (newBalance: number) => {
      console.log("GlobalMobileControls: Balance update received:", newBalance);
      setInternalBalance(newBalance);
    };
    
    // Register the listener with the PlinkoService
    plinkoService.addBalanceUpdateListener(balanceUpdateListener);
    
    // Cleanup on unmount
    return () => {
      plinkoService.removeBalanceUpdateListener(balanceUpdateListener);
    };
  }, [plinkoService]);
  
  // Update internal balance when props change
  useEffect(() => {
    setInternalBalance(currentBalance);
  }, [currentBalance]);
  
  // Update ref when props change
  useEffect(() => {
    const previousIsTestMode = propsRef.current.isTestMode;
    
    propsRef.current = {
      walletAddress,
      onPlay,
      disabled,
      // Use internal balance that's kept updated instead of currentBalance from props
      currentBalance: isTestMode ? testBalance : internalBalance,
      isTestMode,
      testBalance,
      plinkoService
    };
    
  }, [walletAddress, onPlay, disabled, internalBalance, isTestMode, testBalance, plinkoService]);
  
  // Toggle expanded state using callback to avoid re-renders
  const toggleExpandControls = useCallback(() => {
    setExpandedControls(prev => !prev);
  }, []);
  
  // Add intersection observer to detect when game is visible
  useEffect(() => {
    if (typeof window === 'undefined' || !window.IntersectionObserver) return;
    
    // Function to check if game is in viewport
    const checkGameVisibility = () => {
      // More specific selector to target the plinko board
      const plinkoBoard = document.querySelector('.plinko-client-wrapper');
      if (!plinkoBoard) return;
      
      const observer = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          setIsGameVisible(entry.isIntersecting);
          console.log('PlinkoGame visibility:', entry.isIntersecting);
        },
        {
          root: null,
          rootMargin: '0px',
          threshold: 0.5 // Game is considered visible when 50% is in view (middle of board)
        }
      );
      
      observer.observe(plinkoBoard);
      
      return () => {
        observer.disconnect();
      };
    };
    
    // Small delay to ensure DOM is ready
    const timer = setTimeout(checkGameVisibility, 500);
    
    // Set up scrolling event as a fallback
    const handleScroll = () => {
      const plinkoBoard = document.querySelector('.plinko-client-wrapper');
      if (!plinkoBoard) return;
      
      const rect = plinkoBoard.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      // Consider the game visible when the middle of the board is in view
      const boardMiddle = rect.top + (rect.height / 2);
      const isMiddleVisible = boardMiddle >= 0 && boardMiddle <= windowHeight;
      
      setIsGameVisible(isMiddleVisible);
    };
    
    window.addEventListener('scroll', handleScroll);
    // Initial check
    handleScroll();
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);
  
  // Check for mobile view
  useEffect(() => {
    const checkMobileView = () => {
      if (typeof window !== 'undefined') {
        setIsMobileView(window.innerWidth < 768);
      }
    };
    
    checkMobileView();
    window.addEventListener('resize', checkMobileView);
    
    return () => {
      window.removeEventListener('resize', checkMobileView);
    };
  }, []);
  
  // Wrap onPlay function to keep reference stable and add debugging
  const handlePlay = useCallback((options: any) => {
    playCountRef.current += 1;
    const playCount = playCountRef.current;
    
    
    // Try using plinkoService directly if available
    if (propsRef.current.plinkoService && !options.isTestMode) {
      try {
        console.log(`GlobalMobileControls: Calling plinkoService.play directly (#${playCount})`);
        propsRef.current.plinkoService.play(options);
        console.log(`GlobalMobileControls: plinkoService.play called successfully (#${playCount})`);
        return;
      } catch (error) {
        console.error(`GlobalMobileControls: Error calling plinkoService.play directly (#${playCount})`, error);
        // Fall back to onPlay if direct call fails
      }
    }
    
    // Check if onPlay is a function
    if (typeof propsRef.current.onPlay !== 'function') {
      console.error('GlobalMobileControls: onPlay is not a function!');
      return;
    }
    
    try {
      // Call the actual onPlay function from props
      propsRef.current.onPlay(options);
      console.log(`GlobalMobileControls: onPlay called successfully (#${playCount})`);
    } catch (error) {
      console.error(`GlobalMobileControls: Error calling onPlay (#${playCount})`, error);
    }
  }, []);
  
  // Check if we're on the plinko game page
  const isPlinkoGamePage = pathname === '/' || pathname.includes('/plinko');
  
  // Only show on mobile, on plinko pages, and when game is visible
  if (!isMobileView || !isPlinkoGamePage || !isGameVisible) {
    return null;
  }
  
  return (
    <div className="fixed left-0 right-0 bottom-0 z-50 w-full shadow-2xl">
      <PlinkoMobileControls
        key={`mobile-controls-${propsRef.current.isTestMode}-${propsRef.current.testBalance}-${Date.now()}`}
        walletAddress={propsRef.current.walletAddress}
        onPlay={handlePlay}
        disabled={propsRef.current.disabled}
        currentBalance={propsRef.current.currentBalance}
        isTestMode={propsRef.current.isTestMode}
        testBalance={propsRef.current.testBalance}
        isExpanded={expandedControls}
        onToggleExpand={toggleExpandControls}
      />
    </div>
  );
} 