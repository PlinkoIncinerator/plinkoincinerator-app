'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { formatAmount, getWalletTransactions, processWithdrawal, BalanceSummary } from '../../utils/walletService';

export interface PlinkoControlsProps {
  walletAddress: string;
  onPlay: (options: PlayOptions) => void;
  disabled: boolean;
  onNewServerSeed: () => void;
  onNewClientSeed: (seed: string) => void;
  clientSeed: string;
  hashedServerSeed: string;
  currentBalance?: number;
  isTestMode?: boolean;
  testBalance?: number;
}

export interface PlayOptions {
  betAmount: number;
  riskMode: 'medium'; // Fixed to medium risk as defined by the backend
  rows?: number; // Optional since the backend uses a fixed value of 16
  isAuto: boolean;
  isTestMode?: boolean; // Indicates if this was a test game (no real balance change)
  resetTestBalance?: boolean; // Flag to reset the test balance
}

const SolanaLogo = ({ width = 16, height = 14, className = "" }) => {
  return (
    <Image 
      src="/solana-logo.svg" 
      alt="SOL" 
      width={width} 
      height={height}
      className={`inline-block ${className}`}
    />
  );
};

export default function PlinkoControls({
  walletAddress,
  onPlay,
  disabled,
  onNewServerSeed,
  onNewClientSeed,
  clientSeed,
  hashedServerSeed,
  currentBalance = 0,
  isTestMode = false,
  testBalance = 10
}: PlinkoControlsProps) {
  const minBetAmount = 0.0001;
  const [betAmount, setBetAmount] = useState<number>(minBetAmount);
  const [showSeedOptions, setShowSeedOptions] = useState<boolean>(false);
  const [newClientSeed, setNewClientSeed] = useState<string>(clientSeed);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [withdrawalAmount, setWithdrawalAmount] = useState<number | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState<boolean>(false);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState<boolean>(false);
  const [localTestMode, setLocalTestMode] = useState<boolean>(isTestMode);
  
  // Add state for fetching balance from backend
  const [balance, setBalance] = useState<BalanceSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Update local test mode when prop changes
  useEffect(() => {
    setLocalTestMode(isTestMode);
  }, [isTestMode]);

  // Fetch full wallet data from backend only when wallet address changes
  useEffect(() => {
    if (localTestMode) {
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
  }, [walletAddress, localTestMode]);
  
  // Update balance when currentBalance prop changes
  useEffect(() => {
    console.log('PlinkoControls: Direct balance update received:', currentBalance);
    
    if (localTestMode) {
      // In test mode, use the test balance
      setBalance(prev => ({
        currentBalance: testBalance,
        totalDeposits: 0,
        totalWithdrawals: 0,
        totalGameWins: 0,
        totalGameLosses: 0,
        pendingDeposits: 0,
        pendingWithdrawals: 0
      }));
      
      // Set initial bet amount to half of test balance if greater than min
      const halfTestBalance = testBalance / 2;
      setBetAmount(halfTestBalance > minBetAmount ? halfTestBalance : minBetAmount);
    } else if (currentBalance > 0) {
      // In real mode with a valid balance, update only the currentBalance field
      setBalance(prev => {
        if (!prev) return {
          currentBalance,
          totalDeposits: 0,
          totalWithdrawals: 0,
          totalGameWins: 0,
          totalGameLosses: 0,
          pendingDeposits: 0,
          pendingWithdrawals: 0
        };
        
        return {
          ...prev,
          currentBalance
        };
      });
      
      // Set initial bet amount to half of current balance if greater than min
      const halfBalance = currentBalance / 2;
      setBetAmount(halfBalance > minBetAmount ? halfBalance : minBetAmount);
    }
  }, [currentBalance, localTestMode, testBalance]);
  
  // Calculate the max bet amount
  const maxBetAmount = balance?.currentBalance || minBetAmount;
  
  // Format the current bet amount for display
  const formattedBetAmount = formatAmount(betAmount).replace(' SOL', '');
  
  // Handle touch events for slider
  const handleTouchStart = (e: React.TouchEvent<HTMLInputElement>) => {
    // Prevent default to avoid scrolling while touching the slider
    e.preventDefault();
    e.stopPropagation();
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLInputElement>) => {
    // This keeps the event exclusive to the slider and prevents scrolling
    e.preventDefault();
    e.stopPropagation();
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  // Handle bet amount changes from slider
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
      setBetAmount(value);
      setError(null);
    }
  };
  
  // Handle bet amount changes from input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value > 0) {
      if (balance && value > balance.currentBalance && !localTestMode) {
        setError('Bet amount exceeds balance');
        setBetAmount(balance.currentBalance);
      } else {
        setError(null);
        setBetAmount(value);
      }
    }
  };
  
  // Handle preset percentage buttons
  const handlePercentage = (percentage: number) => {
    if (!balance && !localTestMode) return;
    
    const maxAmount = balance ? balance.currentBalance : maxBetAmount;
    const amount = maxAmount * (percentage / 100);
    setBetAmount(Math.max(Math.min(amount, maxBetAmount), minBetAmount));
    setError(null);
  };
  
  // Handle play button click
  const handlePlay = () => {
    // In test mode, we don't need to check the balance
    if (localTestMode) {
      onPlay({
        betAmount,
        riskMode: 'medium', // Fixed to medium risk
        rows: 16, // Fixed to 16 rows
        isAuto: false, // Auto mode removed
        isTestMode: true
      });
      return;
    }
    
    // For real mode, we need a balance check
    if (!balance) return;
    
    if (betAmount > balance.currentBalance) {
      setError('Bet amount exceeds balance');
      return;
    }
    
    onPlay({
      betAmount,
      riskMode: 'medium', // Fixed to medium risk
      rows: 16, // Fixed to 16 rows
      isAuto: false, // Auto mode removed
      isTestMode: false
    });
  };
  
  // Handle client seed update
  const handleClientSeedUpdate = () => {
    onNewClientSeed(newClientSeed);
    setShowSeedOptions(false);
  };
  
  // Handle withdrawal button click
  const handleWithdrawalClick = () => {
    if (!balance || balance.currentBalance <= 0) {
      setError('No balance available for withdrawal');
      return;
    }
    
    setWithdrawalAmount(balance.currentBalance);
    setShowWithdrawalModal(true);
  };
  
  // Handle withdrawal confirmation
  const handleWithdrawalConfirm = async () => {
    if (!walletAddress || !withdrawalAmount || withdrawalAmount <= 0) {
      setError('Invalid withdrawal amount');
      return;
    }
    
    try {
      setIsWithdrawing(true);
      setError(null);
      
      const result = await processWithdrawal(walletAddress, withdrawalAmount, false);
      
      setSuccessMessage(`Successfully withdrawn ${formatAmount(withdrawalAmount)} to your wallet!`);
      setShowWithdrawalModal(false);
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
      
    } catch (err) {
      console.error('Error processing withdrawal:', err);
      setError(err instanceof Error ? err.message : 'Failed to process withdrawal');
    } finally {
      setIsWithdrawing(false);
    }
  };
  
  // Handle withdrawal amount change
  const handleWithdrawalAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (isNaN(value) || value <= 0) {
      setWithdrawalAmount(null);
    } else if (balance && value > balance.currentBalance) {
      setWithdrawalAmount(balance.currentBalance);
    } else {
      setWithdrawalAmount(value);
    }
  };
  
  // Handle test mode toggle
  const handleTestModeToggle = () => {
    const newTestMode = !localTestMode;
    setLocalTestMode(newTestMode);
    
    // Notify parent component of test mode change
    if (newTestMode) {
      onPlay({
        betAmount: 0, // Dummy bet amount, won't be used
        riskMode: 'medium',
        rows: 16,
        isAuto: false,
        isTestMode: true
      });
    } else {
      onPlay({
        betAmount: 0, // Dummy bet amount, won't be used
        riskMode: 'medium',
        rows: 16,
        isAuto: false,
        isTestMode: false
      });
    }
  };
  
  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-4 bg-gray-800 rounded-lg text-white">
        <div className="text-center py-6">
          <div className="inline-block w-6 h-6 border-2 border-t-purple-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400 mt-2">Loading wallet data...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col gap-4 p-4 bg-gray-800 rounded-lg text-white">
      {/* Balance Display */}
      {balance && (
        <div className="flex justify-between items-center bg-gray-900 p-3 rounded-lg">
          <div className="text-sm text-gray-400">Your Balance</div>
          <div className="text-xl font-bold text-green-400 flex items-center">
            {formatAmount(balance.currentBalance)}
            <SolanaLogo width={18} height={16} className="ml-1" />
          </div>
        </div>
      )}
      
      {/* Test Mode Toggle */}
      <div className={`flex justify-between items-center ${localTestMode ? 'bg-purple-900' : 'bg-gray-900'} p-3 rounded-lg transition-colors duration-300`}>
        <div className="text-sm text-gray-400">Test Mode</div>
        <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
          <input
            type="checkbox"
            id="toggle"
            className="absolute w-0 h-0 opacity-0"
            checked={localTestMode}
            onChange={handleTestModeToggle}
          />
          <label
            htmlFor="toggle"
            className={`block h-6 overflow-hidden rounded-full cursor-pointer ${
              localTestMode ? 'bg-purple-600' : 'bg-gray-700'
            }`}
          >
            <span
              className={`absolute block w-4 h-4 rounded-full bg-white transform transition-transform duration-200 ${
                localTestMode ? 'translate-x-7' : 'translate-x-1'
              } top-1`}
            />
          </label>
        </div>
      </div>
      
      {/* Reset Balance Button (Test Mode Only) */}
      {localTestMode && (
        <button
          onClick={() => onPlay({ betAmount: 0, riskMode: 'medium', rows: 16, isAuto: false, isTestMode: true, resetTestBalance: true })}
          className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium"
        >
          Reset Test Balance to 10 SOL
        </button>
      )}
      
      {/* Error message */}
      {error && (
        <div className="bg-red-900 text-red-200 p-2 rounded text-sm">
          {error}
        </div>
      )}
      
      {/* Success message */}
      {successMessage && (
        <div className="bg-green-900 text-green-200 p-2 rounded text-sm">
          {successMessage}
        </div>
      )}
      
      {/* Bet Amount Slider */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <label className="text-sm text-gray-400">Bet Amount</label>
          <div className="bg-gray-900 px-2 py-1 rounded text-xs font-medium flex items-center">
            {formattedBetAmount} <SolanaLogo width={10} height={8} className="ml-1" />
          </div>
        </div>
        
        <input
          type="range"
          min={minBetAmount}
          max={maxBetAmount}
          step={minBetAmount}
          value={betAmount}
          onChange={handleSliderChange}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
          disabled={disabled}
        />
        
        <div className="flex justify-between text-xs text-gray-400">
          <span>{formatAmount(minBetAmount)}</span>
          <span>{formatAmount(maxBetAmount)}</span>
        </div>
        
        {/* Bet Amount Direct Input */}
        <div className="flex items-center mt-2">
          <div className="text-xs bg-gray-700 px-2 py-1 rounded-l">SOL</div>
          <input
            type="number"
            value={betAmount}
            onChange={handleInputChange}
            className="flex-1 bg-gray-700 py-2 px-3 text-white focus:outline-none"
            step={minBetAmount}
            min={minBetAmount}
            max={balance?.currentBalance}
            disabled={disabled}
          />
        </div>
        
        {/* Percentage shortcuts */}
        <div className="grid grid-cols-4 gap-2 mt-2">
          <button 
            onClick={() => handlePercentage(10)}
            className="bg-gray-700 hover:bg-gray-600 py-1 rounded text-sm"
            disabled={disabled}
          >
            10%
          </button>
          <button 
            onClick={() => handlePercentage(25)}
            className="bg-gray-700 hover:bg-gray-600 py-1 rounded text-sm"
            disabled={disabled}
          >
            25%
          </button>
          <button 
            onClick={() => handlePercentage(50)}
            className="bg-gray-700 hover:bg-gray-600 py-1 rounded text-sm"
            disabled={disabled}
          >
            50%
          </button>
          <button 
            onClick={() => handlePercentage(100)}
            className="bg-gray-700 hover:bg-gray-600 py-1 rounded text-sm"
            disabled={disabled}
          >
            Max
          </button>
        </div>
      </div>
      
      
      {/* Play and Withdraw Buttons */}
      <div className="grid grid-cols-1 gap-3">
        <button
          onClick={handlePlay}
          disabled={disabled || betAmount <= 0 || (!localTestMode && (!balance || betAmount > balance.currentBalance))}
          className="bg-green-500 hover:bg-green-600 disabled:bg-gray-700 disabled:opacity-50 py-3 rounded-lg font-medium text-center text-lg"
        >
          Drop Ball
        </button>
        
        <button
          onClick={handleWithdrawalClick}
          disabled={disabled || !balance || balance.currentBalance <= 0}
          className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:opacity-50 py-3 rounded-lg font-medium text-center"
        >
          Withdraw Funds
        </button>
      </div>
      
      {/* Fairness Section */}
      <div className="mt-2">
        <button
          onClick={() => setShowSeedOptions(!showSeedOptions)}
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          Provably Fair Options
        </button>
        
        {showSeedOptions && (
          <div className="mt-2 p-3 bg-gray-900 rounded-lg text-xs space-y-3">
            <div>
              <div className="text-gray-400 mb-1">Server Seed (hashed)</div>
              <div className="bg-gray-800 p-2 rounded break-all">
                {hashedServerSeed}
              </div>
            </div>
            
            <div>
              <div className="text-gray-400 mb-1">Client Seed</div>
              <input
                type="text"
                value={newClientSeed}
                onChange={(e) => setNewClientSeed(e.target.value)}
                className="w-full bg-gray-800 p-2 rounded text-white focus:outline-none"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={onNewServerSeed}
                className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded text-xs"
              >
                New Server Seed
              </button>
              <button
                onClick={handleClientSeedUpdate}
                className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded text-xs"
              >
                Update Client Seed
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Withdrawal Modal */}
      {showWithdrawalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Withdraw Funds</h3>
            
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">Withdrawal Amount</label>
              <div className="flex items-center">
                <input
                  type="number"
                  value={withdrawalAmount || ''}
                  onChange={handleWithdrawalAmountChange}
                  className="w-full bg-gray-700 p-2 rounded-l text-white focus:outline-none"
                  min={minBetAmount}
                  max={balance?.currentBalance}
                  step={minBetAmount}
                  disabled={isWithdrawing}
                />
                <div className="bg-gray-600 px-3 py-2 rounded-r">SOL</div>
              </div>
              
              {balance && (
                <div className="flex justify-between mt-2 text-xs text-gray-400">
                  <button 
                    onClick={() => setWithdrawalAmount(balance.currentBalance * 0.25)}
                    className="underline"
                    disabled={isWithdrawing}
                  >
                    25%
                  </button>
                  <button 
                    onClick={() => setWithdrawalAmount(balance.currentBalance * 0.5)}
                    className="underline"
                    disabled={isWithdrawing}
                  >
                    50%
                  </button>
                  <button 
                    onClick={() => setWithdrawalAmount(balance.currentBalance * 0.75)}
                    className="underline"
                    disabled={isWithdrawing}
                  >
                    75%
                  </button>
                  <button 
                    onClick={() => setWithdrawalAmount(balance.currentBalance)}
                    className="underline"
                    disabled={isWithdrawing}
                  >
                    Max
                  </button>
                </div>
              )}
            </div>
            
            <div className="bg-gray-900 p-3 rounded mb-4 text-sm">
              <p className="text-gray-400">Withdrawing to wallet:</p>
              <p className="font-mono text-xs break-all mt-1">{walletAddress}</p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowWithdrawalModal(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded font-medium"
                disabled={isWithdrawing}
              >
                Cancel
              </button>
              <button
                onClick={handleWithdrawalConfirm}
                disabled={isWithdrawing || !withdrawalAmount || withdrawalAmount <= 0}
                className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:opacity-50 py-2 rounded font-medium"
              >
                {isWithdrawing ? (
                  <span className="flex items-center justify-center">
                    <span className="w-4 h-4 border-2 border-t-white border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin mr-2"></span>
                    Processing...
                  </span>
                ) : (
                  'Confirm Withdrawal'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 