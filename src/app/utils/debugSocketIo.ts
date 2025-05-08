/**
 * Enable socket.io debugging by adding a global debug parameter
 * Call this early in your application to enable debug logs for all socket.io operations
 */
export function enableSocketIoDebug() {
  if (typeof window !== 'undefined') {
    // Add socket.io-client debug parameter to localStorage
    localStorage.setItem('debug', 'socket.io-client:*');
    
    // Also expose a global function to get socket health
    (window as any).checkSocketHealth = (socket: any) => {
      if (!socket) {
        console.error('No socket provided or socket not found');
        return {
          status: 'No socket instance available'
        };
      }
      
      const health = {
        connected: socket.connected,
        id: socket.id,
        disconnected: socket.disconnected,
        engine: {
          transport: socket.io?.engine?.transport?.name,
          readyState: socket.io?.engine?.readyState,
          protocol: socket.io?.engine?.protocol,
          upgrading: socket.io?.engine?.upgrading,
          upgrades: socket.io?.engine?.upgrades,
          pingInterval: socket.io?.engine?.pingInterval,
          pingTimeout: socket.io?.engine?.pingTimeout
        },
        manager: {
          reconnection: socket.io?.opts?.reconnection,
          reconnectionAttempts: socket.io?.opts?.reconnectionAttempts,
          reconnectionDelay: socket.io?.opts?.reconnectionDelay,
          reconnectionDelayMax: socket.io?.opts?.reconnectionDelayMax,
          timeout: socket.io?.opts?.timeout,
          autoConnect: socket.io?.opts?.autoConnect,
          path: socket.io?.opts?.path,
          transports: socket.io?.opts?.transports
        }
      };
      
      console.log('Socket Health Report:', health);
      return health;
    };
    
    // Add a function to fix common socket issues
    (window as any).fixSocketConnection = (socket: any) => {
      if (!socket) {
        console.error('No socket provided');
        return;
      }
      
      console.log('Attempting to fix socket connection...');
      
      // Force disconnect and reconnect
      socket.disconnect();
      
      // Wait a bit before reconnecting
      setTimeout(() => {
        // Try with polling first
        console.log('Reconnecting with polling transport...');
        socket.io.opts.transports = ['polling', 'websocket'];
        socket.connect();
        
        // Check connection after a few seconds
        setTimeout(() => {
          if (socket.connected) {
            console.log('Successfully reconnected!');
          } else {
            console.log('Still not connected, trying websocket-only...');
            socket.disconnect();
            
            // Try with websocket only
            setTimeout(() => {
              socket.io.opts.transports = ['websocket'];
              socket.connect();
              
              // Final check
              setTimeout(() => {
                console.log('Connection status:', socket.connected ? 'Connected!' : 'Failed to connect');
              }, 3000);
            }, 1000);
          }
        }, 3000);
      }, 1000);
    };
    
    console.log('Socket.IO debugging enabled. Use window.checkSocketHealth(socket) to inspect a socket.');
  }
}

/**
 * Get detailed connection errors from a socket connection error
 */
export function getDetailedConnectionError(error: any): string {
  let errorMessage = 'Unknown connection error';
  
  try {
    if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && error.message) {
      errorMessage = error.message;
      
      // Extract additional information for specific errors
      if (error.message.includes('xhr poll error')) {
        errorMessage = 'XHR Poll Error: Cannot establish polling connection. This may be due to network issues or CORS configuration.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Connection Timeout: Server did not respond in time. Check server status or network latency.';
      } else if (error.message.includes('websocket error')) {
        errorMessage = 'WebSocket Error: Cannot establish WebSocket connection. Server might not support WebSockets or they are blocked.';
      }
      
      // Include error data if available
      if (error.data) {
        errorMessage += ` Details: ${JSON.stringify(error.data)}`;
      }
      
      // Include transport info if available
      if (error.transport) {
        errorMessage += ` Transport: ${error.transport}`;
      }
    }
  } catch (e) {
    // Fallback if error parsing fails
    errorMessage = `Error parsing failed: ${String(error)}`;
  }
  
  return errorMessage;
} 