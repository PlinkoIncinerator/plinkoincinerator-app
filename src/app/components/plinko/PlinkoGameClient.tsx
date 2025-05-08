'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import PlinkoBoard from './PlinkoBoard';
import PlinkoControls, { PlayOptions } from './PlinkoControls';
import PlinkoResult from './PlinkoResult';
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { isSolanaWallet } from '@dynamic-labs/solana';
import { 
  PlinkoService, 
  GameState, 
  GameResult, 
  DEFAULT_MULTIPLIERS 
} from '../../utils/plinkoService';
import { formatAmount } from '../../utils/walletService';
import { trackPlinkoEvent, ANALYTICS_EVENTS } from '../../utils/analytics';
import { enableSocketIoDebug, getDetailedConnectionError } from '../../utils/debugSocketIo';

interface PlinkoGameClientProps {
  initialBalance?: number;
}

export default function PlinkoGameClient({ initialBalance }: PlinkoGameClientProps) {
  const [plinkoService] = useState(() => new PlinkoService());
  const { primaryWallet } = useDynamicContext();
  const walletAddress = primaryWallet?.address || '';
  const [gameState, setGameState] = useState<GameState>({
    clientSeed: '',
    hashedServerSeed: '',
    balance: 0,
    isPlaying: false,
    gameHistory: []
  });
  const [latestResult, setLatestResult] = useState<GameResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [currentPath, setCurrentPath] = useState<number[]>([]);
  const [currentMultipliers, setCurrentMultipliers] = useState<number[]>(DEFAULT_MULTIPLIERS.medium);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastOptions, setLastOptions] = useState<PlayOptions | null>(null);
  const [pendingBalls, setPendingBalls] = useState<number>(0);
  const [ballId, setBallId] = useState<number>(0);
  const [isTestMode, setIsTestMode] = useState<boolean>(false);
  const [testBalance, setTestBalance] = useState<number>(initialBalance || 10); // Use initialBalance if provided
  const [currentDisplayBalance, setCurrentDisplayBalance] = useState<number>(0);
  
  // Reconnection mechanism variables
  const [reconnectAttempts, setReconnectAttempts] = useState<number>(0);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionStatusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxReconnectAttempts = 10;
  
  // Debounced connection status setter to avoid UI flickering
  const setDebouncedConnectionStatus = useCallback((status: 'connected' | 'connecting' | 'disconnected') => {
    // Clear any pending status change
    if (connectionStatusTimeoutRef.current) {
      clearTimeout(connectionStatusTimeoutRef.current);
    }
    
    console.log('Setting connection status:', status);
    // For immediate connected status, update right away
    if (status === 'connected') {
      setConnectionStatus(status);
      return;
    }
    
    // For disconnected or connecting status, wait a bit to avoid flickering
    connectionStatusTimeoutRef.current = setTimeout(() => {
      setConnectionStatus(status);
    }, 1500); // Wait 1.5 seconds before showing disconnected status
  }, []);
  
  // Pagination for game history
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;
  
  // Call the enableSocketIoDebug function early in the component
  useEffect(() => {
    // Enable Socket.IO debugging in development
    if (process.env.NODE_ENV !== 'production') {
      enableSocketIoDebug();
    }
  }, []);
  
  // Connect to the server on mount
  useEffect(() => {
    const connectToServer = async () => {
      try {
        setDebouncedConnectionStatus('connecting');
        setIsReconnecting(true);
        const initialState = await plinkoService.connect();
        console.log('Initial state:', initialState);
        console.log('Initial state multipliers:', initialState.multipliers);
        setGameState(initialState);
        
        // Update multipliers from server response
        if (initialState.multipliers) {
          setCurrentMultipliers(initialState.multipliers.medium);
        }
        
        setIsConnected(true);
        setDebouncedConnectionStatus('connected');
        setError(null);
        setReconnectAttempts(0);
        setIsReconnecting(false);
      } catch (error) {
        console.error('Failed to connect to server:', error);
        const detailedError = getDetailedConnectionError(error);
        console.error('Detailed connection error:', detailedError);
        
        // Only log error, don't display to user
        // if (!isReconnecting) {
        //   setError('Failed to connect to the Plinko server. Will retry automatically.');
        // }
        
        // setDebouncedConnectionStatus('disconnected');
        // setIsConnected(false);
        
        // Schedule reconnect with exponential backoff
        // AUTO-RECONNECT DISABLED - Causing too many disconnection cycles
        // scheduleReconnect();
        setIsReconnecting(false);
        console.log('Auto-reconnect disabled. Please use the Reconnect button if needed.');
      }
    };
    
    // Function to schedule reconnection with exponential backoff
    const scheduleReconnect = () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // Stop if we've reached max attempts
      if (reconnectAttempts >= maxReconnectAttempts) {
        console.error('Unable to connect to the Plinko server after multiple attempts. Please refresh the page.');
        setIsReconnecting(false);
        return;
      }
      
      // Calculate delay with exponential backoff (between 2-15 seconds)
      const delay = Math.min(Math.pow(1.5, reconnectAttempts) * 2000, 15000);
      console.log(`Scheduling reconnect attempt ${reconnectAttempts + 1} in ${delay}ms`);
      
      reconnectTimeoutRef.current = setTimeout(() => {
        setReconnectAttempts(prev => prev + 1);
        connectToServer();
      }, delay);
    };
    
    connectToServer();
    
    // Set up event listeners
    plinkoService.on('game:result', handleGameResult);
    plinkoService.on('game:error', handleGameError);
    plinkoService.on('game:new-seed', handleNewSeed);
    plinkoService.on('game:reveal-seed', handleRevealSeed);
    plinkoService.on('disconnect', handleDisconnect);
    plinkoService.on('reconnect', handleReconnect);
    plinkoService.on('connect', handleConnect);
    plinkoService.on('balance:update', handleBalanceUpdate);
    
    return () => {
      // Clean up
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (connectionStatusTimeoutRef.current) {
        clearTimeout(connectionStatusTimeoutRef.current);
      }
      
      plinkoService.off('game:result', handleGameResult);
      plinkoService.off('game:error', handleGameError);
      plinkoService.off('game:new-seed', handleNewSeed);
      plinkoService.off('game:reveal-seed', handleRevealSeed);
      plinkoService.off('disconnect', handleDisconnect);
      plinkoService.off('reconnect', handleReconnect);
      plinkoService.off('connect', handleConnect);
      plinkoService.off('balance:update', handleBalanceUpdate);
      plinkoService.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Connect wallet when it changes
  useEffect(() => {
    if (isConnected && walletAddress) {
      try {
        plinkoService.connectWallet(walletAddress);
        console.log('Wallet connected to server:', walletAddress);
      } catch (error) {
        console.error('Failed to connect wallet to server:', error);
        setError('Failed to connect wallet to the Plinko server.');
      }
    }
  }, [isConnected, walletAddress, plinkoService]);
  
  // Handle connection established
  const handleConnect = () => {
    console.log('Socket connection established');
    setIsConnected(true);
    setDebouncedConnectionStatus('connected');
    setError(null);
    setReconnectAttempts(0);
    setIsReconnecting(false);
  };
  
  // Handle reconnection
  const handleReconnect = () => {
    console.log('Socket reconnected');
    setIsConnected(true);
    setDebouncedConnectionStatus('connected');
    setError(null); // Clear any existing errors
    setReconnectAttempts(0); // Reset attempts on successful reconnection
    setIsReconnecting(false);
    
    // Clear any pending reconnect attempts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Re-sync game state when reconnected
    plinkoService.refreshGameState().then((updatedState) => {
      if (updatedState) {
        setGameState(updatedState);
        if (updatedState.multipliers) {
          setCurrentMultipliers(updatedState.multipliers.medium);
        }
      }
    }).catch(err => {
      console.error('Failed to refresh game state after reconnection:', err);
      // Don't set error for UI display
    });
  };
  
  // Handle balance update from server
  const handleBalanceUpdate = (data: { balance: number }) => {
    console.log('Balance update received:', data);
    
    // Update game state with the new balance
    setGameState(prev => ({
      ...prev,
      balance: data.balance
    }));
    
    // Update the display balance directly
    setCurrentDisplayBalance(data.balance);
  };
  
  // Handle game result
  const handleGameResult = (result: GameResult) => {
    console.log('Game result received from server:', result);
    
    // Track the game result
    trackPlinkoEvent(ANALYTICS_EVENTS.PLAY_PLINKO, {
      bet_amount: result.betAmount,
      multiplier: result.finalMultiplier,
      win_amount: result.winAmount,
      risk_mode: result.riskMode,
      is_test_mode: result.isTestMode || false,
      result: result.winAmount > result.betAmount ? 'win' : 'loss',
      profit: result.winAmount - result.betAmount,
    });
    
    // Only start the game animation AFTER we have the path data
    if (!result.path || result.path.length === 0) {
      console.error('Received game result with empty path data');
      setError('Invalid game result received - missing path data');
      return;
    }
    
    // First update path and result data and start a new ball
    setCurrentPath(result.path);
    setLatestResult(result);
    
    // Increment ball ID for next request
    setBallId(prevId => prevId + 1);
    
    // Decrement pendingBalls if we have any
    setPendingBalls(prevBalls => Math.max(0, prevBalls - 1));
    
    // Update game state and history
    setGameState(prev => ({
      ...prev,
      balance: result.balance,
      isPlaying: false,
      // Limit game history to last 100 entries for better performance
      gameHistory: [...prev.gameHistory.slice(-99), { ...result, timestamp: Date.now() }]
    }));
    
    // Update the display balance directly
    setCurrentDisplayBalance(result.balance);
    
    // Reset to first page when new game is played
    setCurrentPage(1);
    
    // Show result as a highlight
    setShowResult(false);
  };
  
  // Handle game error
  const handleGameError = (error: { message: string }) => {
    console.error('Game error:', error.message);
    // setError(error.message); // Don't display error to user
    setPendingBalls(0); // Clear any pending balls on error
  };
  
  // Handle new seed
  const handleNewSeed = (data: { hashedServerSeed?: string, clientSeed?: string }) => {
    setGameState(prev => ({
      ...prev,
      hashedServerSeed: data.hashedServerSeed || prev.hashedServerSeed,
      clientSeed: data.clientSeed || prev.clientSeed
    }));
  };
  
  // Handle reveal seed
  const handleRevealSeed = (data: { serverSeed: string }) => {
    setGameState(prev => ({
      ...prev,
      serverSeed: data.serverSeed
    }));
  };
  
  // Handle disconnect
  const handleDisconnect = (data: { reason?: string }) => {
    console.log('Socket disconnected with reason:', data.reason || 'unknown');
    setIsConnected(false);
    setDebouncedConnectionStatus('disconnected');
    
    // Only show error message for non-transport errors
    if (data.reason && !data.reason.includes('transport')) {
      console.error('Disconnected with error:', data.reason);
    } else {
      console.log('Temporarily disconnected from the Plinko server. Reconnecting...');
    }
    
    // Re-enable auto-reconnect with a small delay to avoid connection cycles
    setTimeout(() => {
      setIsReconnecting(true);
      
      // Calculate reconnect delay with a more gradual backoff
      const reconnectDelay = Math.min(Math.pow(1.3, reconnectAttempts) * 1000, 10000);
      console.log(`Auto-reconnect scheduled in ${reconnectDelay}ms`);
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      reconnectTimeoutRef.current = setTimeout(() => {
        // Increment reconnect attempts only when actually attempting to reconnect
        setReconnectAttempts(prev => {
          const newValue = prev + 1;
          console.log(`Reconnection attempt ${newValue} of ${maxReconnectAttempts}`);
          
          // Check if we've reached max attempts
          if (newValue >= maxReconnectAttempts) {
            console.error('Unable to connect to the Plinko server after multiple attempts. Please refresh the page.');
            setIsReconnecting(false);
            return prev; // Don't increment further
          }
          
          // Do the actual reconnection attempt
          plinkoService.reconnect().catch(error => {
            console.error('Reconnection failed:', error);
          });
          
          return newValue;
        });
      }, reconnectDelay);
    }, 1000);
  };
  
  // Rate limit the play function to prevent overwhelming the server
  const throttledPlay = useCallback(() => {
    if (!lastOptions || !isConnected) return;
    
    try {
      // Check if we're currently reconnecting - if so, wait
      if (isReconnecting) {
        console.log('Waiting for reconnection to complete before playing');
        return;
      }
      
      console.log('Sending play request with options:', lastOptions);
      plinkoService.play({
        ...lastOptions,
        // Don't specify rows, let the backend use its default of 16
      });
    } catch (error) {
      console.error('Error playing game:', error);
      setError('Failed to play game.');
    }
  }, [plinkoService, lastOptions, isConnected, isReconnecting]);
  
  // Handle play button click
  const handlePlay = (options: PlayOptions) => {
    console.log('Play button clicked with options:', options);
    
    // Track play attempt
    trackPlinkoEvent('plinko_play_attempt', {
      bet_amount: options.betAmount,
      risk_mode: options.riskMode,
      is_auto: options.isAuto,
      is_test_mode: options.isTestMode || false,
      connected: isConnected,
    });
    
    // Check if connected
    if (!isConnected) {
      console.error('Not connected to server, cannot play');
      // Try to reconnect automatically
      handleManualReconnect();
      return;
    }
    
    // Handle test balance reset if requested
    if (options.resetTestBalance) {
      setTestBalance(initialBalance || 10);
      return;
    }
    
    // Store the options for repeated use
    setLastOptions(options);
    
    // Update test mode status
    setIsTestMode(!!options.isTestMode);
    
    // Update multipliers based on risk mode
    if (gameState.multipliers) {
      setCurrentMultipliers(gameState.multipliers[options.riskMode]);
    } else {
      setCurrentMultipliers(DEFAULT_MULTIPLIERS[options.riskMode]);
    }
    
    // If test mode is enabled, simulate a game locally instead of sending to server
    if (options.isTestMode) {
      simulateTestGame(options);
      return;
    }
    
    // Ensure the game state is updated by refreshing it before playing
    if (isConnected && plinkoService) {
      try {
        // Set a flag to show we're about to play
        setGameState(prev => ({
          ...prev,
          isPlaying: true
        }));
        
        // Refresh the game state to ensure balance is current
        plinkoService.refreshGameState()
          .then(() => {
            // Send play request to server
            throttledPlay();
            
            // If this is auto mode, set pending balls
            if (options.isAuto) {
              setPendingBalls(prev => prev + 5); // Queue 5 balls for auto mode
            }
          })
          .catch(err => {
            console.error('Error refreshing game state before play:', err);
            // Try to play anyway
            throttledPlay();
          });
      } catch (error) {
        console.error('Failed to play:', error);
        // Try to play directly as a fallback
        throttledPlay();
      }
    } else {
      console.log('Not connected or service missing, cannot play');
    }
  };
  
  // Simulate a test game without spending balance
  const simulateTestGame = (options: PlayOptions) => {
    // Track test game
    trackPlinkoEvent('plinko_test_game', {
      bet_amount: options.betAmount,
      risk_mode: options.riskMode,
      test_balance: testBalance,
    });
    
    // Calculate updated test balance
    let updatedBalance = Math.max(0, testBalance - options.betAmount);
    
    // Generate a random path for the ball (16 steps with random directions)
    const randomPath = Array.from({ length: 16 }, () => Math.random() > 0.5 ? 1 : 0);
    
    // Calculate final position based on the path
    const finalPosition = randomPath.reduce((pos, dir) => pos + (dir === 1 ? 1 : -1), 0 as number);
    // Normalize to get the bin index (for 16 rows, we have 17 possible final positions)
    const normalizedPosition = finalPosition + 16;
    const binIndex = Math.floor(normalizedPosition * (17 / 33));
    
    // Get the multiplier for this position
    const multiplier = currentMultipliers[Math.min(Math.max(0, binIndex), 16)];
    
    // Calculate win amount
    const winAmount = options.betAmount * multiplier;
    
    // Add winnings to test balance
    updatedBalance += winAmount;
    
    // Update test balance state
    setTestBalance(updatedBalance);
    
    // Create a simulated result
    const result: GameResult = {
      clientSeed: gameState.clientSeed,
      serverSeed: 'test-mode-seed',
      hashedServerSeed: 'test-mode-hashed-seed',
      nonce: Math.floor(Math.random() * 10000),
      gameResult: binIndex,
      path: randomPath,
      finalMultiplier: multiplier,
      betAmount: options.betAmount,
      winAmount: winAmount,
      balance: updatedBalance, // Use updated balance for consistency
      timestamp: Date.now(),
      riskMode: options.riskMode,
      rows: 16,
      isTestMode: true // Mark this as a test game
    };
    
    // Set the current path to animate the ball
    setCurrentPath(randomPath);
    setLatestResult(result);
    
    // Increment ball ID
    setBallId(prevId => prevId + 1);
    
    // Update game history but mark it as a test game
    setGameState(prev => ({
      ...prev,
      isPlaying: false,
      gameHistory: [...prev.gameHistory.slice(-99), { 
        ...result, 
        timestamp: Date.now(),
      }]
    }));
    
    // Reset to first page of history
    setCurrentPage(1);
  };
  
  // Handle animation complete
  const handleAnimationComplete = () => {
    // Don't reset isPlaying here to allow multiple balls
    // We'll just update game history and track results
    
    // If we have pending balls, play the next one
    if (pendingBalls > 0 && lastOptions) {
      setTimeout(() => {
        plinkoService.play({
          ...lastOptions,
          // Don't specify rows, let the backend use its default of 16
        });
      }, 200); // Small delay between balls
    }
  };
  
  // Function to handle adding a new ball from the board
  const handleAddBall = (path: number[]) => {
    // Use throttled play to avoid overloading
    throttledPlay();
  };
  
  // Request a new server seed
  const handleNewServerSeed = () => {
    plinkoService.requestNewServerSeed();
  };
  
  // Update the client seed
  const handleNewClientSeed = (seed: string) => {
    plinkoService.updateClientSeed(seed);
  };
  
  // Handle manual reconnect
  const handleManualReconnect = () => {
    if (isReconnecting) return;
    
    // Clear any existing timers
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    setIsReconnecting(true);
    setDebouncedConnectionStatus('connecting');
    console.log('Attempting manual reconnection...'); // Log instead of setting error
    setReconnectAttempts(0); // Reset attempts counter for manual reconnect
    
    // Attempt to reconnect
    plinkoService.reconnect()
      .then(() => {
        console.log('Manual reconnection successful');
      })
      .catch(error => {
        console.error('Manual reconnection failed:', error);
        setIsReconnecting(false);
        setDebouncedConnectionStatus('disconnected');
      });
  };
  
  // Handle pagination for game history
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };
  
  // Calculate pagination values
  const totalGames = gameState.gameHistory.length;
  const totalPages = Math.ceil(totalGames / itemsPerPage);
  const paginatedHistory = gameState.gameHistory
    .slice()
    .reverse()
    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  
  // Handle risk mode change in UI
  const handleRiskModeChange = (riskMode: 'low' | 'medium' | 'high') => {
    // Track risk mode change
    trackPlinkoEvent(ANALYTICS_EVENTS.CHANGE_RISK, {
      new_risk_mode: riskMode,
    });
    
    // Update multipliers based on risk mode
    if (gameState.multipliers) {
      setCurrentMultipliers(gameState.multipliers[riskMode]);
    } else {
      setCurrentMultipliers(DEFAULT_MULTIPLIERS[riskMode]);
    }
  };
  
  return (
    <div className="flex flex-col w-full h-full gap-6">
      {/* Test Mode Indicator */}
      {isTestMode && (
        <div className="bg-purple-700 text-white p-3 rounded-lg text-center font-bold">
          🧪 TEST MODE ACTIVE - Bets won&apos;t affect your balance 🧪
        </div>
      )}
      
      {/* Connection Status Indicator */}
      {connectionStatus !== 'connected' && (
        <div className={`p-3 rounded-lg text-white flex items-center justify-between ${
          connectionStatus === 'connecting' ? 'bg-yellow-700' : 'bg-red-700'
        }`}>
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${
              connectionStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'
            }`}></div>
            <span>
              {connectionStatus === 'connecting' 
                ? 'Connecting to Plinko server...' 
                : 'Disconnected from Plinko server. Manual reconnection required.'}
            </span>
            {isReconnecting && <span className="ml-2 text-xs opacity-70">(Attempt {reconnectAttempts + 1})</span>}
          </div>
          
          <button 
            onClick={handleManualReconnect}
            disabled={isReconnecting}
            className={`px-4 py-1 rounded text-sm ${
              isReconnecting 
                ? 'bg-gray-700 cursor-not-allowed opacity-50' 
                : 'bg-white text-gray-900 hover:bg-gray-200'
            }`}
          >
            {isReconnecting ? 'Reconnecting...' : 'Reconnect Now'}
          </button>
        </div>
      )}
      
      {/* Main Game Area */}
      <div className="flex flex-col md:flex-row gap-6">
        <div className="md:w-80 bg-gray-800 rounded-xl p-4 shadow-lg h-fit">
          <PlinkoControls
            walletAddress={walletAddress}
            onPlay={handlePlay}
            disabled={!isConnected}
            onNewServerSeed={handleNewServerSeed}
            onNewClientSeed={handleNewClientSeed}
            clientSeed={gameState.clientSeed}
            hashedServerSeed={gameState.hashedServerSeed}
            currentBalance={isTestMode ? testBalance : (gameState.balance || 0)}
            isTestMode={isTestMode}
            testBalance={testBalance}
          />
        </div>
        
        <div className="flex-1 h-[600px]">
          {/* Enhanced last result display with animation */}
          {latestResult && (
            <div className={`mb-2 flex items-center justify-between bg-gray-800 rounded-lg p-3 text-white overflow-hidden transition-all duration-300 ${showResult ? 'shadow-lg shadow-purple-500/30 scale-105' : ''}`}>
              <div className="flex flex-col">
                <div className="text-sm text-gray-400">Bet Amount</div>
                <div className="font-bold">{formatAmount(latestResult.betAmount)}</div>
              </div>
              
              <div className="flex flex-col items-center">
                <div className="text-sm text-gray-400">Multiplier</div>
                <div className={`font-bold text-lg ${latestResult.finalMultiplier >= 1 ? 'text-green-500' : 'text-red-500'}`}>
                  {latestResult.finalMultiplier}x
                </div>
              </div>
              
              <div className="flex flex-col items-end">
                <div className="text-sm text-gray-400">Win Amount</div>
                <div className={`font-bold ${latestResult.winAmount > latestResult.betAmount ? 'text-green-500' : 'text-red-500'}`}>
                  {formatAmount(latestResult.winAmount)}
                </div>
              </div>
            </div>
          )}
          
          <PlinkoBoard
            path={currentPath}
            isPlaying={true}
            onAnimationComplete={handleAnimationComplete}
            multipliers={currentMultipliers}
            riskMode="medium"
            showPathInitially={false}
            onAddBall={handleAddBall}
            ballId={ballId}
          />
        </div>
      </div>
      
      {/* Enhanced Game History Table with Pagination */}
      {gameState.gameHistory.length > 0 && (
        <div className="mt-16 bg-gray-800 rounded-lg p-4 text-white overflow-hidden">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              Game History
            </h3>
            <div className="text-sm text-gray-400">
              Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalGames)} - {Math.min(currentPage * itemsPerPage, totalGames)} of {totalGames}
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full min-w-full">
              <thead className="border-b border-gray-700">
                <tr>
                  <th className="py-2 px-4 text-left">Time</th>
                  <th className="py-2 px-4 text-left">Bet Amount</th>
                  <th className="py-2 px-4 text-left">Risk</th>
                  <th className="py-2 px-4 text-left">Multiplier</th>
                  <th className="py-2 px-4 text-left">Win Amount</th>
                  <th className="py-2 px-4 text-left">Profit</th>
                  <th className="py-2 px-4 text-left">Status</th>
                  <th className="py-2 px-4 text-left">Mode</th>
                </tr>
              </thead>
              <tbody>
                {paginatedHistory.map((game, index) => {
                  const date = new Date(game.timestamp || Date.now());
                  const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  const profit = game.winAmount - game.betAmount;
                  const isWin = profit >= 0;
                  
                  return (
                    <tr key={index} className="border-b border-gray-700 hover:bg-gray-700">
                      <td className="py-2 px-4">{formattedTime}</td>
                      <td className="py-2 px-4">{formatAmount(game.betAmount)}</td>
                      <td className="py-2 px-4 capitalize">{game.riskMode}</td>
                      <td className="py-2 px-4">{game.finalMultiplier}x</td>
                      <td className="py-2 px-4">{formatAmount(game.winAmount)}</td>
                      <td className={`py-2 px-4 ${isWin ? 'text-green-500' : 'text-red-500'}`}>
                        {isWin ? '+' : ''}{formatAmount(profit).replace(' SOL', '')}
                      </td>
                      <td className="py-2 px-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${isWin ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                          {isWin ? 'WIN' : 'LOSS'}
                        </span>
                      </td>
                      <td className="py-2 px-4">
                        {game.isTestMode && (
                          <span className="px-2 py-1 text-xs rounded-full bg-blue-900 text-blue-300">
                            TEST
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-4">
              <div className="flex space-x-2">
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  &laquo;
                </button>
                <button
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  &lsaquo;
                </button>
                
                {/* Page Numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  // Show pages around the current page
                  let pageNum = currentPage;
                  if (totalPages <= 5) {
                    // If there are 5 or fewer pages, show all pages
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    // If we're at the beginning, show first 5 pages
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    // If we're at the end, show last 5 pages
                    pageNum = totalPages - 4 + i;
                  } else {
                    // Otherwise, show 2 pages before and after current page
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={i}
                      onClick={() => handlePageChange(pageNum)}
                      className={`px-3 py-1 rounded ${
                        currentPage === pageNum
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  &rsaquo;
                </button>
                <button
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  &raquo;
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 