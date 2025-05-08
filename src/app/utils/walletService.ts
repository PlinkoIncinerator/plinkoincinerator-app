import { API_BASE_URL } from '../config/constants';

export interface Transaction {
  id: number;
  wallet_address: string;
  signature: string;
  amount: number;
  type: 'deposit' | 'withdrawal' | 'game_win' | 'game_bet';
  timestamp: string;
  status: 'pending' | 'completed' | 'failed';
  description?: string;
}

export interface BalanceSummary {
  totalDeposits: number;
  totalWithdrawals: number;
  totalGameWins: number;
  totalGameLosses: number;
  currentBalance: number;
  pendingDeposits?: number;
  pendingWithdrawals?: number;
}

export interface TransactionResponse {
  status: string;
  data: {
    transactions: Transaction[];
    balance: BalanceSummary;
  };
}

export interface WithdrawalResponse {
  status: string;
  message: string;
  signature?: string;
  balance?: number;
}

/**
 * Fetch transaction history and balance for a wallet
 */
export async function getWalletTransactions(walletAddress: string): Promise<TransactionResponse> {
  if (!walletAddress) {
    throw new Error('Wallet address is required');
  }


  console.log('API_BASE_URL', API_BASE_URL);
  try {
    const response = await fetch(`${API_BASE_URL}/api/transactions/${walletAddress}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to fetch transactions');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }
}

/**
 * Process a withdr awal to the user's wallet
 */
export async function processWithdrawal(walletAddress: string, amount: number, directWithdraw: boolean = false): Promise<WithdrawalResponse> {
  if (!walletAddress) {
    throw new Error('Wallet address is required');
  }

  if (!amount || amount <= 0) {
    throw new Error('Valid withdrawal amount is required');
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/withdraw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress,
        amount,
        directWithdraw
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to process withdrawal');
    }
    
    return data;
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    throw error;
  }
}

/**
 * Format transaction amount with SOL symbol
 */
export function formatAmount(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '0.00000 SOL';
  }
  return `${Number(amount).toFixed(5)} SOL`;
}

/**
 * Format transaction date
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Get CSS class for transaction type
 */
export function getTransactionTypeClass(type: string): string {
  switch (type) {
    case 'deposit':
      return 'text-green-500';
    case 'withdrawal':
      return 'text-red-500';
    case 'game_win':
      return 'text-green-400';
    case 'game_bet':
      return 'text-yellow-500';
    default:
      return 'text-gray-400';
  }
}

/**
 * Get human readable transaction type
 */
export function getTransactionTypeLabel(type: string): string {
  switch (type) {
    case 'deposit':
      return 'Deposit';
    case 'withdrawal':
      return 'Withdrawal';
    case 'game_win':
      return 'Game Win';
    case 'game_bet':
      return 'Game Bet';
    default:
      return type;
  }
} 