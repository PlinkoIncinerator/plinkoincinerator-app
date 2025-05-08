'use client';

import { API_BASE_URL } from '../config/constants';

/**
 * API configuration utilities for Socket.IO and API endpoints
 */

interface SocketConfig {
  url: string;
  options: {
    path: string;
    addTrailingSlash: boolean;
    transports?: string[];
    reconnection?: boolean;
    reconnectionAttempts?: number;
    reconnectionDelay?: number;
    reconnectionDelayMax?: number;
    timeout?: number;
    forceNew?: boolean;
    multiplex?: boolean;
    pingInterval?: number;
    pingTimeout?: number;
    autoConnect?: boolean;
    withCredentials?: boolean;
    upgrade?: boolean;
    rememberUpgrade?: boolean;
  };
}

/**
 * Get Socket.IO configuration for client connection
 */
export function getSocketIoConfig() {
  // Connect to the same domain, but use the /api/socket/io path
  return {
    url: API_BASE_URL,
    options: {
      path: '/api/socket/io/',  // Match server exactly - with trailing slash
      addTrailingSlash: true,   // Keep true to match server configuration
      transports: ['websocket'], // Exact match to server transport
      reconnection: true,       // Enable reconnection
      reconnectionAttempts: 10, // Try to reconnect 10 times
      reconnectionDelay: 1000,  // Start with 1s delay
      reconnectionDelayMax: 5000, // Max 5s delay between retries
      timeout: 30000,           // Connection timeout
      withCredentials: true,    // Allow credentials/cookies
      autoConnect: true,        // Auto-connect on creation
      forceNew: false,          // Re-use existing connection if available
      }
  };
}
