/**
 * Application-wide constants
 */

// Base URL for API requests
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Default network (for wallet connections)
export const DEFAULT_NETWORK = 'mainnet-beta';

// Feature flags
export const FEATURES = {
  DEPOSITS_ENABLED: true,
  WITHDRAWALS_ENABLED: true,
  TEST_MODE_ENABLED: true
};

// Solana Network
export const SOLANA_NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'mainnet-beta'; 