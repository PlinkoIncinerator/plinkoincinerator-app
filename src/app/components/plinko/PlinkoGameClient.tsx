'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import PlinkoBoard from './PlinkoBoard';
import PlinkoControls, { PlayOptions } from './PlinkoControls';
import PlinkoMobileControls from './PlinkoMobileControls';
import PlinkoResult from './PlinkoResult';
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { isSolanaWallet } from '@dynamic-labs/solana';
import { 
  PlinkoService, 
  GameState, 
  GameResult, 
  DEFAULT_MULTIPLIERS,
  getPlinkoService
} from '../../utils/plinkoService';
import { formatAmount } from '../../utils/walletService';
import { trackPlinkoEvent, ANALYTICS_EVENTS } from '../../utils/analytics';
import { enableSocketIoDebug, getDetailedConnectionError } from '../../utils/debugSocketIo';

interface PlinkoGameClientProps {
  initialBalance?: number;
  onRegisterControls?: (controls: any, forceUpdate?: boolean) => void;
}

export default function PlinkoGameClient({ initialBalance, onRegisterControls }: PlinkoGameClientProps) {
  // Use singleton instead of creating a new instance
  const [plinkoService] = useState(() => getPlinkoService());
  const { primaryWallet } = useDynamicContext();
  const walletAddress = primaryWallet?.address || '';
  
  // Add state to track if browser is available (client-side)
  const [isBrowser, setIsBrowser] = useState(false);
  
  // Game state
  const [gameState, setGameState] = useState<GameState>({
    clientSeed: '',
    hashedServerSeed: '',
    balance: 0,
    isPlaying: false,
    gameHistory: []
  });
  
  // All other state variables
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
  const [testBalance, setTestBalance] = useState<number>(initialBalance || 10);
  const [currentDisplayBalance, setCurrentDisplayBalance] = useState<number>(0);
  const [isMobileView, setIsMobileView] = useState<boolean>(false);
  
  // Reconnection mechanism variables
  const [reconnectAttempts, setReconnectAttempts] = useState<number>(0);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionStatusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxReconnectAttempts = 10;
  
  // Pagination for game history
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;
  
  // Add state to track sticky tabs visibility
  const [showMobileControls, setShowMobileControls] = useState<boolean>(true);
  const lastScrollPosition = useRef<number>(0);
  
  // Add state to track if the result should be shown as a popup
  const [showPopupResult, setShowPopupResult] = useState<boolean>(false);
  
  // Add state to track if the mobile controls are expanded
  const [expandedControls, setExpandedControls] = useState<boolean>(false);
  
  // Add ref to store previous controls state
  const prevControlsRef = useRef<any>(null);
  
  // Check for mobile view on component mount and window resize
  useEffect(() => {
    setIsBrowser(true);
    
    // Check for mobile view if in browser
    const checkMobileView = () => {
      if (typeof window !== 'undefined') {
        setIsMobileView(window.innerWidth < 768);
      }
    };
    
    // Handle scroll to hide/show mobile controls
    const handleScroll = () => {
      if (typeof window !== 'undefined') {
        const currentScrollPos = window.scrollY;
        const isScrollingDown = currentScrollPos > lastScrollPosition.current;
        
        // Show controls when scrolling up or at the top, hide when scrolling down
        setShowMobileControls(!isScrollingDown || currentScrollPos < 50);
        lastScrollPosition.current = currentScrollPos;
      }
    };
    
    // Only run if window exists
    if (typeof window !== 'undefined') {
      // Initial check
      checkMobileView();
      
      // Add resize listener
      window.addEventListener('resize', checkMobileView);
      
      // Add scroll listener for mobile controls
      window.addEventListener('scroll', handleScroll);
      
      // Cleanup
      return () => {
        window.removeEventListener('resize', checkMobileView);
        window.removeEventListener('scroll', handleScroll);
      };
    }
  }, []);
  
  // Call the enableSocketIoDebug function early in the component
  useEffect(() => {
    // Only run if in browser
    if (!isBrowser) return;
    
    // Enable Socket.IO debugging in development
    if (process.env.NODE_ENV !== 'production') {
      enableSocketIoDebug();
    }
  }, [isBrowser]);
  
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
  
  // Connect to the server on mount
  useEffect(() => {
    // Skip if not in browser
    if (!isBrowser) return;
    
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
        
        setIsReconnecting(false);
        console.log('Auto-reconnect disabled. Please use the Reconnect button if needed.');
      }
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
  }, [isBrowser]); // Only depend on isBrowser
  
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
    console.log('Balance update received from server:', data.balance);
    
    // Update both game state and current display balance
    setGameState(prev => ({
      ...prev,
      balance: data.balance
    }));
    
    // Update display balance directly to ensure mobile controls get the updated value
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
    
    // Show popup result after receiving game result
    setShowPopupResult(true);
    setTimeout(() => {
      setShowPopupResult(false);
    }, 2000); // Show for 2 seconds for better visibility
    
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
  
  // Handle manual reconnect
  const handleManualReconnect = useCallback(() => {
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
  }, [isReconnecting, plinkoService, setDebouncedConnectionStatus]);
  
  // Rate limit the play function to prevent overwhelming the server
  const throttledPlay = useCallback(() => {
    if (!lastOptions) {
      console.error('No options available for play request');
      return;
    }
    
    if (!plinkoService) {
      console.error('No plinkoService available');
      return;
    }
    
    if (!isConnected) {
      console.error('Not connected to server');
      // Try to reconnect
      handleManualReconnect();
      return;
    }
    
    try {
      // Check if we're currently reconnecting - if so, wait
      if (isReconnecting) {
        console.log('Waiting for reconnection to complete before playing');
        return;
      }
      
      // Make sure we're sending a valid bet amount
      if (lastOptions.betAmount <= 0) {
        console.error('Invalid bet amount', lastOptions.betAmount);
        setError('Bet amount must be greater than 0');
        return;
      }
      
      const playId = Date.now();
      console.log(`PlinkoGameClient: Sending play request (ID: ${playId})`, lastOptions);
      
      try {
        plinkoService.play({
          ...lastOptions,
          // Don't specify rows, let the backend use its default of 16
        });
        console.log(`PlinkoGameClient: Play request sent successfully (ID: ${playId})`);
      } catch (playError) {
        console.error(`PlinkoGameClient: Error in plinkoService.play (ID: ${playId})`, playError);
        
        // Try to reconnect and retry the play request
        console.log(`PlinkoGameClient: Attempting to reconnect and retry (ID: ${playId})`);
        plinkoService.reconnect()
          .then(() => {
            console.log(`PlinkoGameClient: Reconnected, retrying play (ID: ${playId})`);
            plinkoService.play(lastOptions);
          })
          .catch(reconnectError => {
            console.error(`PlinkoGameClient: Reconnect failed (ID: ${playId})`, reconnectError);
            setError('Failed to connect to game server. Please refresh the page.');
          });
      }
    } catch (error) {
      console.error('Error playing game:', error);
      setError('Failed to play game.');
    }
  }, [plinkoService, lastOptions, isConnected, isReconnecting, handleManualReconnect]);
  
  // Handle play button click - memoized to prevent changes on every render
  const handlePlay = useCallback((options: PlayOptions) => {
    console.log('Play button clicked with options:', options);
    
    // Add more detailed debug info
    console.log('Socket connection state:', {
      isSocketNull: !plinkoService,
      isSocketConnected: plinkoService?.isConnected() || false,
      isComponentConnected: isConnected
    });
    
    // Track play attempt
    trackPlinkoEvent('plinko_play_attempt', {
      bet_amount: options.betAmount,
      risk_mode: options.riskMode,
      is_auto: options.isAuto,
      is_test_mode: options.isTestMode || false,
      connected: isConnected,
    });

    console.log("lets go")
    
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
    

    console.log('isTestMode', options.isTestMode)
    // For test mode, simulate ball drop without contacting server
    if (options.isTestMode) {
      console.log('Running test mode game...');
      
      // Save last options for potential re-use
      setLastOptions(options);
      
      // Update testBalance with the play
      const updatedBalance = testBalance - options.betAmount;
      setTestBalance(updatedBalance);
      
      // Get the multipliers for the risk mode
      const multipliers = plinkoService.getMultipliers(options.riskMode);
      
      // Randomize a path through the plinko board
      const path: number[] = [];
      let position = 8; // Start in the middle of 16 pins
      
      // Generate random path (this is just for visualization)
      for (let i = 0; i < 16; i++) {
        const direction = Math.random() > 0.5 ? 1 : -1;
        position += direction;
        
        // Keep position within bounds
        position = Math.max(0, Math.min(position, i + 1));
        path.push(position);
      }
      
      // Calculate landing bin (position of the last path item)
      const binIndex = path[path.length - 1];
      
      // Get multiplier for that bin
      const multiplier = multipliers[binIndex];
      
      // Calculate win amount
      const winAmount = options.betAmount * multiplier;
      
      // Update test balance
      const finalBalance = updatedBalance + winAmount;
      setTestBalance(finalBalance);
      
      // Add some randomness to the path to make it less predictable
      const randomPath = path.map((pos, idx) => {
        if (idx === 0) return pos; // Keep first position
        
        // Add small random variation
        const variation = Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0;
        let newPos = pos + variation;
        
        // Keep within bounds based on row number
        newPos = Math.max(0, Math.min(newPos, idx + 1));
        return newPos;
      });
      
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
        balance: finalBalance, // Use updated balance for consistency
        timestamp: Date.now(),
        riskMode: options.riskMode,
        rows: 16,
        isTestMode: true // Mark this as a test game
      };
      
      // Set the current path to animate the ball
      setCurrentPath(randomPath);
      setLatestResult(result);
  
      // Show popup result (non-blocking)
      if (result) {
        setShowPopupResult(true);
        setTimeout(() => {
          setShowPopupResult(false);
        }, 2000); // Same duration as real games for consistency
      }
      
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
      
      return;
    }
    

    console.log('isConnected', isConnected, 'plinkoService exists:', !!plinkoService)
    // Ensure the game state is updated by refreshing it before playing
    if (isConnected && plinkoService) {
      try {
        // Set a flag to show we're about to play
        setGameState(prev => ({
          ...prev,
          isPlaying: true
        }));
        
        console.log('About to refresh game state before playing...');
        // Refresh the game state to ensure balance is current
        plinkoService.refreshGameState()
          .then(() => {
            // Send play request to server
            console.log('Game state refreshed, sending play request...');
            throttledPlay();
            console.log('Play request sent to server');
            
            // If this is auto mode, set pending balls
            if (options.isAuto) {
              setPendingBalls(prev => prev + 5); // Queue 5 balls for auto mode
            }
          })
          .catch(err => {
            console.error('Error refreshing game state before play:', err);
            // Try to play anyway
            console.log('Error refreshing game state, sending play request anyway...');
            throttledPlay();
          });
      } catch (error) {
        console.error('Failed to play:', error);
        // Try to play directly as a fallback
        console.log('Exception caught, trying direct play as fallback...');
        throttledPlay();
      }
    } else {
      console.log('Not connected or service missing, cannot play');
    }
  }, [
    isConnected, 
    initialBalance, 
    gameState.multipliers,
    gameState.clientSeed,
    plinkoService, 
    throttledPlay, 
    handleManualReconnect,
    testBalance,
    currentMultipliers,
    setCurrentPage
  ]);
  
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
  
  // Add a function to handle test mode toggle
  const handleTestModeToggle = () => {
    const newTestMode = !isTestMode;
    console.log('PlinkoGameClient: Test mode toggle from', isTestMode, 'to', newTestMode);
    
    // Set state first to ensure immediate UI update
    setIsTestMode(newTestMode);
    
    // Reset test balance when enabling test mode
    if (newTestMode) {
      setTestBalance(initialBalance || 10);
    }
    
    // Create immediate controls for the parent component
    const immediateControls = {
      walletAddress,
      onPlay: handlePlay,
      disabled: !isConnected,
      currentBalance: newTestMode ? (initialBalance || 10) : (currentDisplayBalance || gameState.balance || 0),
      isTestMode: newTestMode,
      testBalance: newTestMode ? (initialBalance || 10) : testBalance,
      plinkoService
    };
    
    // Force update to the parent component immediately to ensure GlobalMobileControls gets updated
    if (onRegisterControls) {
      console.log('PlinkoGameClient: Forcing immediate update of controls for test mode change:', newTestMode);
      onRegisterControls(immediateControls, true); // Pass true for forceUpdate 
      prevControlsRef.current = immediateControls;
    }
    
    // Update display balance to reflect the mode change
    setCurrentDisplayBalance(newTestMode ? (initialBalance || 10) : (gameState.balance || 0));
    
    // Notify the server about test mode change
    setTimeout(() => {
      handlePlay({
        betAmount: 0,
        riskMode: 'medium',
        rows: 16,
        isAuto: false,
        isTestMode: newTestMode
      });
      
      // Track the event
      trackPlinkoEvent('toggle_test_mode', {
        enabled: newTestMode
      });
    }, 0);
  };
  
  // Function to show popup result
  const showResultPopup = () => {
    if (latestResult) {
      setShowPopupResult(true);
      // Hide after just 1 second for faster gameplay
      setTimeout(() => {
        setShowPopupResult(false);
      }, 1000);
    }
  };
  
  // Function to toggle the expanded state of mobile controls
  const toggleExpandControls = () => {
    setExpandedControls(prev => !prev);
  };
  
  // Register controls with parent component (if available)
  useEffect(() => {
    if (!onRegisterControls) return;
    
    // Create a stable controls object that doesn't change on every render
    const stableControls = {
      walletAddress,
      onPlay: handlePlay,
      disabled: !isConnected,
      // Use currentDisplayBalance for real mode to ensure latest balance is used
      currentBalance: isTestMode ? testBalance : (currentDisplayBalance || gameState.balance || 0),
      isTestMode,
      testBalance,
      // Expose the plinkoService instance for direct access
      plinkoService
    };
    
    console.log('Registering controls with:', {
      balance: gameState.balance,
      currentDisplayBalance,
      isTestMode,
      testBalance,
      effectiveBalance: stableControls.currentBalance
    });
    
    // Only call onRegisterControls if the important values changed
    const prevControls = prevControlsRef.current;
    
    if (!prevControls || 
        prevControls.walletAddress !== stableControls.walletAddress ||
        prevControls.disabled !== stableControls.disabled ||
        prevControls.currentBalance !== stableControls.currentBalance ||
        prevControls.isTestMode !== stableControls.isTestMode ||
        prevControls.testBalance !== stableControls.testBalance) {
      
      // Update the ref with the new controls
      prevControlsRef.current = stableControls;
      
      // Call the callback with the new controls
      onRegisterControls(stableControls);
    }
  }, [
    onRegisterControls, 
    walletAddress, 
    handlePlay, 
    isConnected, 
    gameState.balance,
    currentDisplayBalance,
    isTestMode, 
    testBalance,
    plinkoService
  ]);
  
  // If not in browser yet, render minimal UI to prevent hydration errors
  if (!isBrowser) {
    return <div className="w-full h-full bg-gray-900 rounded-lg animate-pulse"></div>;
  }
  
  return (
    <div className={`flex flex-col w-full h-full overflow-hidden ${isMobileView ? 'px-0 py-0' : 'gap-6'}`}>
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
            <span className="text-sm">
              {connectionStatus === 'connecting' 
                ? 'Connecting...' 
                : 'Disconnected. Reconnection required.'}
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
            {isReconnecting ? 'Reconnecting...' : 'Reconnect'}
          </button>
        </div>
      )}
      
      {/* Pop-up Result display - positioned at the top instead of center to be less intrusive */}
      {showPopupResult && latestResult && (
        <div className="fixed top-1/4 inset-x-0 z-50 flex justify-center pointer-events-none">
          <div className={`relative bg-gray-900 bg-opacity-90 border-2 ${
            latestResult.finalMultiplier > 1 ? 'border-green-500 shadow-green-500/50' : 
            latestResult.finalMultiplier === 1 ? 'border-yellow-500 shadow-yellow-500/50' : 
            'border-red-500 shadow-red-500/50'
          } p-4 rounded-lg shadow-xl transition-all duration-200 animate-bounce-in scale-110`}>
            <div className="flex items-center gap-4">
              <div className={`text-3xl font-bold ${
                latestResult.finalMultiplier > 1 ? 'text-green-500' : 
                latestResult.finalMultiplier === 1 ? 'text-yellow-500' : 
                'text-red-500'
              }`}>
                {latestResult.finalMultiplier}x
              </div>
              
              <div className="flex-1 text-center">
                <div className="text-sm text-gray-400 mb-1">Win Amount</div>
                <div className={`text-xl font-bold ${
                  latestResult.finalMultiplier > 1 ? 'text-green-500' : 
                  latestResult.finalMultiplier === 1 ? 'text-yellow-500' : 
                  'text-red-500'
                }`}>
                  {formatAmount(latestResult.winAmount)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Main Game Area */}
      <div className={`flex flex-col ${isMobileView ? 'w-full h-full' : 'md:flex-row'} gap-6`}>
        {/* Only show desktop controls on larger screens */}
        {!isMobileView && (
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
        )}
        
        {/* The game board always displayed */}
        <div className={`flex-1 ${isMobileView ? 'min-h-[calc(100vh-120px)] mx-0 px-0 w-full mt-0' : 'h-[600px]'} relative z-10`}>
          {/* Mobile Test Mode Toggle */}
          {isMobileView && (
            <div className="absolute top-2 left-2 z-30">
              <button 
                onClick={handleTestModeToggle}
                className={`flex items-center px-2 py-1 rounded-full ${isTestMode ? 'bg-purple-600' : 'bg-gray-700'} text-xs transition-colors duration-200`}
              >
                <span className={`inline-block h-3 w-3 rounded-full mr-1.5 ${isTestMode ? 'bg-white' : 'bg-gray-500'}`}></span>
                Test Mode
              </button>
            </div>
          )}
          
          <div className={isMobileView ? 'h-full w-full overflow-hidden' : ''}>
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
      </div>
      
      {/* Recent Games - Mobile */}
      {isMobileView && gameState.gameHistory.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-3 mt-auto mb-20 mx-3 overflow-hidden">
          <h3 className="text-base font-semibold mb-2 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            Recent Games
          </h3>
          
          <div className="overflow-x-auto">
            <div className="grid grid-cols-1 gap-2">
              {gameState.gameHistory.slice(0, 5).reverse().map((game, index) => {
                const profit = game.winAmount - game.betAmount;
                const isWin = profit >= 0;
                
                return (
                  <div key={index} className={`bg-gray-900 p-2 rounded-lg flex justify-between items-center ${isWin ? 'border-l-2 border-green-500' : 'border-l-2 border-red-500'}`}>
                    <div className="flex items-center">
                      <div className="font-bold text-sm">{game.finalMultiplier}x</div>
                      <div className={`ml-2 text-xs ${isWin ? 'text-green-500' : 'text-red-500'}`}>
                        {isWin ? '+' : ''}{formatAmount(profit)}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {formatAmount(game.betAmount)} → {formatAmount(game.winAmount)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      
      {/* Game History Table - Desktop Only */}
      {!isMobileView && gameState.gameHistory.length > 0 && (
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