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
  
  // Update ref when props change
  useEffect(() => {
    const previousIsTestMode = propsRef.current.isTestMode;
    
    propsRef.current = {
      walletAddress,
      onPlay,
      disabled,
      currentBalance,
      isTestMode,
      testBalance,
      plinkoService
    };
    
    console.log('GlobalMobileControls: Props updated', {
      walletAddress: walletAddress.substring(0, 8) + '...',
      disabled,
      currentBalance,
      isTestMode,
      testBalance,
      onPlay: typeof onPlay === 'function' ? 'function' : 'not a function',
      hasPlinkoService: !!plinkoService,
      testModeChanged: previousIsTestMode !== isTestMode,
      time: new Date().toISOString()
    });
  }, [walletAddress, onPlay, disabled, currentBalance, isTestMode, testBalance, plinkoService]);
  
  // Toggle expanded state using callback to avoid re-renders
  const toggleExpandControls = useCallback(() => {
    setExpandedControls(prev => !prev);
  }, []);
  
  // Add intersection observer to detect when game is visible
  useEffect(() => {
    if (typeof window === 'undefined' || !window.IntersectionObserver) return;
    
    // Function to check if game is in viewport
    const checkGameVisibility = () => {
      const gameElement = document.querySelector('.plinko-client-wrapper');
      if (!gameElement) return;
      
      const observer = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          setIsGameVisible(entry.isIntersecting);
          console.log('PlinkoGame visibility:', entry.isIntersecting);
        },
        {
          root: null,
          rootMargin: '0px',
          threshold: 0.2 // Game is considered visible when 20% is in view
        }
      );
      
      observer.observe(gameElement);
      
      return () => {
        observer.disconnect();
      };
    };
    
    // Small delay to ensure DOM is ready
    const timer = setTimeout(checkGameVisibility, 500);
    
    // Set up scrolling event as a fallback
    const handleScroll = () => {
      const gameElement = document.querySelector('.plinko-client-wrapper');
      if (!gameElement) return;
      
      const rect = gameElement.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      // Game is considered visible when at least part of it is in the viewport
      const isVisible = 
        (rect.top >= 0 && rect.top <= windowHeight) || 
        (rect.bottom >= 0 && rect.bottom <= windowHeight) ||
        (rect.top < 0 && rect.bottom > windowHeight);
      
      setIsGameVisible(isVisible);
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
    
    console.log(`GlobalMobileControls: handlePlay called (#${playCount})`, {
      options,
      disabled: propsRef.current.disabled,
      currentBalance: propsRef.current.currentBalance,
      isTestMode: propsRef.current.isTestMode,
      hasPlinkoService: !!propsRef.current.plinkoService
    });
    
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