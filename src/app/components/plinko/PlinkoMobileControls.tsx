'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { formatAmount, getWalletTransactions, BalanceSummary } from '../../utils/walletService';

interface PlinkoMobileControlsProps {
  walletAddress: string;
  onPlay: (options: any) => void;
  disabled: boolean;
  currentBalance?: number;
  isTestMode?: boolean;
  testBalance?: number;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

const SolanaLogo = ({ width = 16, height = 14, className = "" }) => {
  return (
    <Image 
      src="/solana-logo.svg" 
      alt="Solana" 
      width={width} 
      height={height}
      className={`inline-block ${className}`}
    />
  );
};

const SliderStyles = () => (
  <style jsx global>{`
    .slider-input {
      -webkit-appearance: none;
      appearance: none;
      height: 8px;
      border-radius: 5px;
      background: #374151;
      outline: none;
      cursor: pointer;
      touch-action: manipulation;
    }
    
    .slider-input::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 24px;
      height: 24px;
      background: #a855f7;
      cursor: pointer;
      border-radius: 50%;
      border: 2px solid #1f2937;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }
    
    .slider-input::-moz-range-thumb {
      width: 24px;
      height: 24px;
      background: #a855f7;
      cursor: pointer;
      border-radius: 50%;
      border: 2px solid #1f2937;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }
    
    /* iOS specific fixes */
    @supports (-webkit-touch-callout: none) {
      .slider-input {
        padding: 0 10px;
      }
      .slider-input::-webkit-slider-thumb {
        width: 28px;
        height: 28px;
      }
    }
  `}</style>
);

export default function PlinkoMobileControls({
  walletAddress,
  onPlay,
  disabled,
  currentBalance = 0,
  isTestMode = false,
  testBalance = 10,
  isExpanded = false,
  onToggleExpand = () => {}
}: PlinkoMobileControlsProps) {
  // Add debug logs to see what props we're getting
  console.log('PlinkoMobileControls RENDER:', { 
    isTestMode, 
    testBalance, 
    currentBalance, 
    walletAddress,
    renderTime: new Date().toISOString()
  });

  const minBetAmount = 0.0001;
  const [betAmount, setBetAmount] = useState<number>(minBetAmount);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'bet' | 'info'>('bet');
  
  // Add state for fetching balance from backend (like in PlinkoControls)
  const [balance, setBalance] = useState<BalanceSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  
  // Add ref to track prop changes
  const prevPropsRef = useRef({isTestMode, testBalance, currentBalance});
  
  // Force update when props change drastically
  useEffect(() => {
    const prevProps = prevPropsRef.current;
    
    // If test mode changed or balance changed dramatically, force update
    if (prevProps.isTestMode !== isTestMode) {
      console.log('MobileControls: Test mode changed from', prevProps.isTestMode, 'to', isTestMode);
      
      // Update previous props
      prevPropsRef.current = {isTestMode, testBalance, currentBalance};
      
      // When test mode changes, immediately update the balance
      if (isTestMode) {
        console.log('MobileControls: Setting test balance to:', testBalance);
        setBalance({
          currentBalance: testBalance,
          totalDeposits: 0,
          totalWithdrawals: 0,
          totalGameWins: 0,
          totalGameLosses: 0,
          pendingDeposits: 0,
          pendingWithdrawals: 0
        });
        
        // Set initial bet amount based on test balance
        const initialBet = Math.max(testBalance * 0.1, minBetAmount);
        setBetAmount(Math.min(initialBet, testBalance));
      } else {
        // In real mode, use the currentBalance prop
        console.log('MobileControls: Setting real balance to:', currentBalance);
        setBalance({
          currentBalance: currentBalance,
          totalDeposits: 0,
          totalWithdrawals: 0,
          totalGameWins: 0,
          totalGameLosses: 0,
          pendingDeposits: 0,
          pendingWithdrawals: 0
        });
        
        // Set initial bet amount based on current balance
        const initialBet = Math.max(currentBalance * 0.1, minBetAmount);
        setBetAmount(Math.min(initialBet, currentBalance));
      }
    }
  }, [isTestMode, testBalance, currentBalance, minBetAmount]);
  
  // Fetch full wallet data from backend only when wallet address changes
  useEffect(() => {
    if (isTestMode) { // Use isTestMode directly instead of localTestMode
      // For test mode, we'll handle balance separately
      setLoading(false);
      return;
    }

    if (!walletAddress) {
      setError('No wallet connected');
      setLoading(false);
      return;
    }

    const fetchWalletData = async () => {
      try {
        setLoading(true);
        const response = await getWalletTransactions(walletAddress);
        setBalance(response.data.balance);
        setError(null);
      } catch (err) {
        console.error('Error fetching wallet data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch wallet data');
      } finally {
        setLoading(false);
      }
    };

    fetchWalletData();
  }, [walletAddress, isTestMode]); // Change localTestMode to isTestMode
  
  // Update the maxBetAmount calculation to use isTestMode directly
  const maxBetAmount = isTestMode 
    ? testBalance  // In test mode, use testBalance directly
    : (balance?.currentBalance || minBetAmount);

  console.log('Effective max bet amount:', maxBetAmount);

  // Add direct balance calculation to use in the UI - this ensures balance works in both modes
  const displayBalance = isTestMode 
    ? testBalance 
    : (balance?.currentBalance || currentBalance || 0);

  // Check if balance is insufficient for minimum bet - only in real mode
  const isBalanceInsufficient = !isTestMode && displayBalance < minBetAmount;

  console.log('Display balance:', displayBalance);

  // Move the betSteps generation to be recalculated whenever maxBetAmount changes
  // Create a useEffect to regenerate betSteps when maxBetAmount changes
  const [betSteps, setBetSteps] = useState<number[]>([0.01, 0.05, 0.1, 0.25, 0.5]);

  // Generate bet steps when maxBetAmount changes
  useEffect(() => {
    console.log('Generating bet steps for maxBetAmount:', maxBetAmount);
    
    // Start with standard steps that are at or below the maxBetAmount
    const standardSteps = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 7.5, 10].filter(step => step <= maxBetAmount);
    
    // If max balance is greater than our predefined steps, add it as the last step
    if (maxBetAmount > (standardSteps.length > 0 ? standardSteps[standardSteps.length - 1] : 0)) {
      standardSteps.push(maxBetAmount);
    }
    
    // If max balance is less than our smallest step, use appropriate smaller steps
    if (standardSteps.length === 0 || standardSteps[0] > minBetAmount * 10) {
      const smallSteps = [0.001, 0.005, 0.01, 0.025, 0.05].filter(step => step <= maxBetAmount);
      if (smallSteps.length > 0) {
        standardSteps.unshift(...smallSteps);
      } else {
        standardSteps.push(minBetAmount, maxBetAmount);
      }
    }
    
    // Ensure we always have at least the minBetAmount and current maxBetAmount
    if (standardSteps.length === 0) {
      standardSteps.push(minBetAmount, maxBetAmount);
    }
    
    // Deduplicate and sort steps
    const uniqueSteps = [...new Set(standardSteps)].sort((a, b) => a - b);
    console.log('Generated bet steps:', uniqueSteps);
    
    // Update the betSteps state
    setBetSteps(uniqueSteps);
    
    // If current betAmount is greater than maxBetAmount, adjust it down
    if (betAmount > maxBetAmount) {
      console.log('Adjusting bet amount from', betAmount, 'to max', maxBetAmount);
      setBetAmount(maxBetAmount);
    }
  }, [maxBetAmount, minBetAmount, betAmount]);
  
  // Format the current bet amount for display - ensure exactly 4 decimal places
  const formattedBetAmount = betAmount.toFixed(4);
  
  // Prevent button spamming with a small throttle
  const [isButtonCooling, setIsButtonCooling] = useState<boolean>(false);
  
  // Find the closest step in our predefined steps
  const findClosestStep = (value: number) => {
    return betSteps.reduce((prev, curr) => 
      Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
    );
  };
  
  // Get the current step index for the slider
  const getCurrentStepIndex = () => {
    const closestStep = findClosestStep(betAmount);
    return betSteps.indexOf(closestStep);
  };
  
  // Handle touch events for slider - simplify to just prevent default
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLInputElement>) => {
    console.log('Touch start on slider');
    // Only prevent default, don't stop propagation as that can sometimes break mobile input
    e.preventDefault();
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLInputElement>) => {
    e.preventDefault();
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLInputElement>) => {
    e.preventDefault();
  }, []);
  
  // Handle bet amount changes from slider - make more robust
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const index = parseInt(e.target.value);
      if (index >= 0 && index < betSteps.length) {
        const newBetAmount = betSteps[index];
        console.log('PlinkoMobileControls: Slider value changed to step:', index, 'amount:', newBetAmount);
        setBetAmount(newBetAmount);
        setError(null);
      }
    } catch (error) {
      console.error('Error handling slider change:', error);
    }
  };

  // Add a direct click handler for step buttons that's more reliable on mobile
  const handleStepClick = (step: number) => {
    console.log('Step clicked:', step);
    setBetAmount(step);
    setError(null);
  };
  
  // Handle bet amount changes from input - updated with balance checks
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    console.log('PlinkoMobileControls: Input value changed to:', value);
    
    if (!isNaN(value) && value > 0) {
      // For test mode, ensure the bet doesn't exceed test balance
      if (isTestMode && value > testBalance) {
        setError('Bet amount exceeds test balance');
        setBetAmount(testBalance);
        return;
      }
      
      // For real mode, ensure the bet doesn't exceed balance
      if (!isTestMode && balance && value > balance.currentBalance) {
        setError('Bet amount exceeds balance');
        setBetAmount(balance.currentBalance);
        return;
      }
      
      setError(null);
      setBetAmount(value);
    }
  };
  
  // Handle preset percentage buttons
  const handlePercentage = (percentage: number) => {
    // Use balance state instead of props
    const maxAmount = isTestMode ? testBalance : (balance?.currentBalance || minBetAmount);
    const amount = maxAmount * (percentage / 100);
    setBetAmount(Math.max(Math.min(amount, maxAmount), minBetAmount));
    setError(null);
  };
  
  // Handle play button click with throttling - updated with balance checks
  const handlePlay = () => {
    if (isButtonCooling) return; // Prevent rapid clicks
    
    // Add a unique play ID for debugging
    const playId = Date.now();
    
    console.log(`PlinkoMobileControls: handlePlay called (ID: ${playId})`, { 
      betAmount, 
      isTestMode, // Use isTestMode directly
      displayBalance,
      testBalance,
      walletAddress,
      onPlayFunction: typeof onPlay
    });
    
    // Check if balance is insufficient for minimum bet - only in real mode
    if (!isTestMode && isBalanceInsufficient) {
      console.log(`PlinkoMobileControls: Balance check failed (ID: ${playId}) - insufficient balance`);
      setError('Insufficient balance. Please deposit more funds.');
      return;
    }
    
    // Check balance against displayBalance
    if (!isTestMode && betAmount > displayBalance) {
      console.log(`PlinkoMobileControls: Balance check failed (ID: ${playId}) - bet exceeds balance`);
      setError('Bet amount exceeds balance');
      return;
    }
    
    // For test mode, ensure bet amount doesn't exceed test balance
    if (isTestMode && betAmount > testBalance) {
      console.log(`PlinkoMobileControls: Balance check failed (ID: ${playId}) - bet exceeds test balance`);
      setError('Bet amount exceeds test balance');
      return;
    }
    
    try {
      // Make sure we're passing the correct betAmount and isTestMode values
      const playOptions = {
        betAmount,
        riskMode: 'medium',
        rows: 16,
        isAuto: false,
        isTestMode: isTestMode // Use isTestMode directly
      };
      
      console.log(`PlinkoMobileControls: Calling onPlay (ID: ${playId})`, playOptions);
      onPlay(playOptions);
      console.log(`PlinkoMobileControls: onPlay called successfully (ID: ${playId})`);
    } catch (error) {
      console.error(`PlinkoMobileControls: Error calling onPlay (ID: ${playId})`, error);
    }
    
    // Set a very brief cooling period for the button (50ms)
    setIsButtonCooling(true);
    setTimeout(() => {
      setIsButtonCooling(false);
    }, 50);
    
    // Auto-collapse if delegated to parent
    if (onToggleExpand && isExpanded) {
      onToggleExpand();
    }
  };
  
  // Update the handleSliderTrackClick function to work with our new approach
  const handleSliderTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Early return if disabled
    if (disabled) return;
    
    const sliderTrack = e.currentTarget;
    const rect = sliderTrack.getBoundingClientRect();
    
    // Use clientX for mouse and touches
    const clientX = e.clientX;
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    
    if (betSteps.length === 0) {
      console.log('No valid bet steps available');
      return;
    }
    
    // Calculate index and ensure it's within bounds
    const index = Math.min(Math.floor(percentage * betSteps.length), betSteps.length - 1);
    
    if (index >= 0 && index < betSteps.length) {
      const newBetAmount = betSteps[index];
      console.log('Direct slider track click:', { 
        percentage, 
        index, 
        value: newBetAmount,
        maxSteps: betSteps.length
      });
      
      setBetAmount(newBetAmount);
      setError(null);
    }
  };
  
  // Add indicator component for slider
  const SliderIndicators = ({ steps, currentIndex }: { steps: number[], currentIndex: number }) => {
    // Only show indicators for a reasonable number of steps
    if (steps.length > 10) {
      // For many steps, show just a few key indicators
      const indicatorIndices = [0, Math.floor(steps.length / 4), Math.floor(steps.length / 2), 
                              Math.floor(3 * steps.length / 4), steps.length - 1];
      
      return (
        <div className="flex justify-between w-full mt-1 px-1">
          {indicatorIndices.map(i => (
            <div 
              key={i} 
              className={`w-1 h-2 rounded-full ${currentIndex === i ? 'bg-purple-500' : 'bg-gray-500'}`}
            />
          ))}
        </div>
      );
    }
    
    // For fewer steps, show all indicators
    return (
      <div className="flex justify-between w-full mt-1 px-1">
        {steps.map((_, i) => (
          <div 
            key={i} 
            className={`w-1 h-2 rounded-full ${currentIndex === i ? 'bg-purple-500' : 'bg-gray-500'}`}
          />
        ))}
      </div>
    );
  };
  
  return (
    <div className="w-full bg-gradient-to-b from-gray-900 to-gray-950 text-white shadow-2xl border-t border-gray-700 rounded-t-xl">
      <SliderStyles />
      {/* Drag handle for expanding/collapsing */}
      <div 
        className="w-full flex justify-center items-center h-8 cursor-pointer" 
        onClick={onToggleExpand}
      >
        <div className="w-16 h-1.5 bg-gray-500 rounded-full"></div>
      </div>
      
      {/* Collapsed view - only shows the play button and balance */}
      {!isExpanded && (
        <div className="flex items-center justify-between p-4 pb-6">
          <div className="flex flex-col">
            <div className="text-xs text-gray-400">Balance</div>
            <div className={`font-bold ${isBalanceInsufficient ? 'text-red-400' : 'text-green-400'} flex items-center`}>
              {formatAmount(displayBalance)}
              <SolanaLogo width={14} height={12} className="ml-1" />
              {isBalanceInsufficient && (
                <span className="ml-2 text-xs text-red-400">(Insufficient)</span>
              )}
            </div>
          </div>
          
          <div className="flex-1 mx-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-gray-400">Bet</span>
              <span className="text-xs font-medium flex items-center">
                {formattedBetAmount} <SolanaLogo width={8} height={7} className="ml-1" />
              </span>
            </div>
            <div className="relative w-full" onClick={handleSliderTrackClick}>
              <input
                type="range"
                min="0"
                max={betSteps.length - 1}
                step="1"
                value={getCurrentStepIndex()}
                onChange={handleSliderChange}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  appearance: 'none',
                  width: '100%',
                  height: '8px',
                  borderRadius: '5px',
                  background: '#374151',
                  outline: 'none',
                  padding: '0'
                }}
                className="slider-input w-full h-2 bg-gray-700 rounded-full cursor-pointer"
                disabled={disabled}
              />
              <SliderIndicators steps={betSteps} currentIndex={getCurrentStepIndex()} />
            </div>
          </div>
          
          <button
            onClick={handlePlay}
            disabled={disabled || betAmount <= 0 || 
              betAmount > displayBalance || 
              (!isTestMode && displayBalance < minBetAmount)}
            className={`bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 
              disabled:from-gray-700 disabled:to-gray-700 disabled:opacity-50 py-3 px-5 rounded-lg font-bold
              ${isButtonCooling ? 'opacity-80 scale-95' : ''} 
              transition-all duration-100 active:scale-95`}
          >
            Drop
          </button>
        </div>
      )}
      
      {/* Expanded view with tabs */}
      {isExpanded && (
        <>
          {/* Tabs */}
          <div className="flex border-t border-b border-gray-800">
            <button
              className={`flex-1 py-3 text-center ${activeTab === 'bet' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-400'}`}
              onClick={() => setActiveTab('bet')}
            >
              Bet
            </button>
            <button
              className={`flex-1 py-3 text-center ${activeTab === 'info' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-400'}`}
              onClick={() => setActiveTab('info')}
            >
              Info
            </button>
          </div>
          
          {/* Content */}
          <div className="p-4 pb-8">
            {activeTab === 'bet' ? (
              <>
                {/* Balance display */}
                <div className="flex justify-between items-center bg-gray-800 p-3 rounded-lg mb-4">
                  <div className="text-sm text-gray-400">Balance</div>
                  <div className={`flex flex-col items-end`}>
                    <div className={`text-xl font-bold ${isBalanceInsufficient ? 'text-red-400' : 'text-green-400'} flex items-center`}>
                      {formatAmount(displayBalance)}
                      <SolanaLogo width={18} height={16} className="ml-1" />
                    </div>
                    {isBalanceInsufficient && (
                      <div className="text-xs text-red-400 mt-1">Insufficient balance for betting</div>
                    )}
                  </div>
                </div>
                
                {/* Bet amount with slider */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm text-gray-400">Bet Amount</label>
                    <div className="bg-gray-800 px-3 py-1 rounded-lg text-sm font-medium flex items-center">
                      {formattedBetAmount} <SolanaLogo width={12} height={10} className="ml-1" />
                    </div>
                  </div>
                  
                  <div className="relative w-full mb-2" onClick={handleSliderTrackClick}>
                    <input
                      type="range"
                      min="0"
                      max={betSteps.length - 1}
                      step="1"
                      value={getCurrentStepIndex()}
                      onChange={handleSliderChange}
                      onTouchStart={handleTouchStart}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                      style={{
                        WebkitAppearance: 'none',
                        MozAppearance: 'none',
                        appearance: 'none',
                        width: '100%',
                        height: '8px',
                        borderRadius: '5px',
                        background: '#374151',
                        outline: 'none',
                        padding: '0'
                      }}
                      className="slider-input w-full h-2 bg-gray-700 rounded-full cursor-pointer"
                      disabled={disabled}
                    />
                    <SliderIndicators steps={betSteps} currentIndex={getCurrentStepIndex()} />
                  </div>
                  
                  {/* Display discrete bet steps below slider */}
                  <div className="flex justify-between text-xs text-gray-400 mb-4 overflow-x-auto pb-2">
                    {betSteps.length <= 6 ? 
                      // Show all steps if we have 6 or fewer
                      betSteps.map((step, index) => (
                        <button
                          key={index}
                          onClick={() => handleStepClick(step)}
                          className={`px-2 py-1 rounded-md transition-colors whitespace-nowrap ${
                            Math.abs(betAmount - step) < 0.0001 
                              ? 'bg-purple-800 text-white font-medium' 
                              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                          }`}
                        >
                          {step.toFixed(step < 0.01 ? 4 : step < 1 ? 2 : 1)}
                        </button>
                      ))
                      :
                      // Show just some key steps if we have more than 6
                      [0, Math.floor(betSteps.length / 4), Math.floor(betSteps.length / 2), betSteps.length - 1].map((stepIndex) => {
                        const step = betSteps[stepIndex];
                        return (
                          <button
                            key={stepIndex}
                            onClick={() => handleStepClick(step)}
                            className={`px-2 py-1 rounded-md transition-colors whitespace-nowrap ${
                              Math.abs(betAmount - step) < 0.0001 
                                ? 'bg-purple-800 text-white font-medium' 
                                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                            }`}
                          >
                            {step.toFixed(step < 0.01 ? 4 : step < 1 ? 2 : 1)}
                          </button>
                        );
                      })
                    }
                  </div>
                  
                  {/* Percentage buttons for quick bet setting */}
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    <button 
                      onClick={() => handlePercentage(10)}
                      className="bg-gray-700 hover:bg-gray-600 py-2 rounded text-sm"
                      disabled={disabled}
                    >
                      10%
                    </button>
                    <button 
                      onClick={() => handlePercentage(25)}
                      className="bg-gray-700 hover:bg-gray-600 py-2 rounded text-sm"
                      disabled={disabled}
                    >
                      25%
                    </button>
                    <button 
                      onClick={() => handlePercentage(50)}
                      className="bg-gray-700 hover:bg-gray-600 py-2 rounded text-sm"
                      disabled={disabled}
                    >
                      50%
                    </button>
                    <button 
                      onClick={() => handlePercentage(100)}
                      className="bg-gray-700 hover:bg-gray-600 py-2 rounded text-sm"
                      disabled={disabled}
                    >
                      Max
                    </button>
                  </div>
                </div>
                
                {error && (
                  <div className="bg-red-900 text-red-200 p-2 rounded text-sm mb-4">
                    {error}
                  </div>
                )}
                
                {/* Action Button */}
                <button
                  onClick={handlePlay}
                  disabled={disabled || betAmount <= 0 || 
                    betAmount > displayBalance || 
                    (!isTestMode && displayBalance < minBetAmount)}
                  className={`w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 
                    disabled:from-gray-700 disabled:to-gray-700 disabled:opacity-50 py-4 rounded-lg font-bold text-center text-lg
                    ${isButtonCooling ? 'opacity-80 scale-95' : ''} 
                    transition-all duration-100 active:scale-95`}
                >
                  Drop Ball
                </button>
              </>
            ) : (
              // Info tab content
              <div className="space-y-4">
                <div className="bg-gray-800 p-3 rounded-lg">
                  <h3 className="font-bold text-purple-400 mb-2">How to Play</h3>
                  <p className="text-sm text-gray-300">Set your bet amount using the slider or quick options, then tap "Drop Ball". The ball will drop through pegs and land in a multiplier bucket, determining your win.</p>
                </div>
                
                {isTestMode && (
                  <div className="bg-purple-900 p-3 rounded-lg">
                    <h3 className="font-bold text-yellow-400 mb-2">Test Mode Active</h3>
                    <p className="text-sm text-gray-300">You're playing with test tokens. Wins and losses don't affect your real balance. Perfect for learning the game!</p>
                  </div>
                )}
                
                <div className="bg-gray-800 p-3 rounded-lg">
                  <h3 className="font-bold text-blue-400 mb-2">Multipliers</h3>
                  <p className="text-sm text-gray-300">Different buckets have different multipliers. The center buckets have lower multipliers (1x), while edge buckets can go up to 25x!</p>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
} 