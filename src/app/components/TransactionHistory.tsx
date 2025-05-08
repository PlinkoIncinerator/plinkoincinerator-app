'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { 
  getWalletTransactions, 
  getTransactionTypeClass, 
  getTransactionTypeLabel, 
  formatAmount, 
  formatDate,
  Transaction,
  BalanceSummary 
} from '../utils/walletService';

interface TransactionHistoryProps {
  walletAddress: string;
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

export default function TransactionHistory({ walletAddress }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balance, setBalance] = useState<BalanceSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'deposits' | 'withdrawals' | 'games'>('all');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (!walletAddress) {
      setError('No wallet connected');
      setLoading(false);
      return;
    }

    const fetchTransactions = async () => {
      try {
        setLoading(true);
        const response = await getWalletTransactions(walletAddress);
        setTransactions(response.data.transactions);
        setBalance(response.data.balance);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [walletAddress]);
  
  // Reset to first page when tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  const filteredTransactions = transactions.filter(tx => {
    switch (activeTab) {
      case 'deposits':
        return tx.type === 'deposit';
      case 'withdrawals':
        return tx.type === 'withdrawal';
      case 'games':
        return tx.type === 'game_bet' || tx.type === 'game_win';
      default:
        return true;
    }
  });
  
  // Calculate pagination values
  const totalTransactions = filteredTransactions.length;
  const totalPages = Math.ceil(totalTransactions / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className="bg-gray-900 bg-opacity-80 rounded-lg p-6 mb-8">
      <h2 className="text-2xl font-bold text-white mb-6">Wallet Transactions</h2>
      
      {loading ? (
        <div className="text-center py-6">
          <div className="inline-block w-6 h-6 border-2 border-t-purple-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400 mt-2">Loading transactions...</p>
        </div>
      ) : error ? (
        <div className="text-center py-6">
          <p className="text-red-400">{error}</p>
        </div>
      ) : (
        <>
          {/* Balance Summary Section */}
          {balance && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm text-gray-400 mb-1">Current Balance</h3>
                <div className="text-xl font-bold text-green-400 flex items-center">
                  {formatAmount(balance.currentBalance)}
                  <SolanaLogo width={18} height={16} className="ml-1" />
                </div>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm text-gray-400 mb-1">Total Deposits</h3>
                <div className="text-lg font-bold text-green-500">
                  {formatAmount(balance.totalDeposits)}
                </div>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm text-gray-400 mb-1">Total Withdrawals</h3>
                <div className="text-lg font-bold text-red-500">
                  {formatAmount(balance.totalWithdrawals)}
                </div>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm text-gray-400 mb-1">Net Game Profit</h3>
                <div className={`text-lg font-bold ${(balance.totalGameWins - balance.totalGameLosses) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatAmount(balance.totalGameWins - balance.totalGameLosses)}
                </div>
              </div>
            </div>
          )}
          
          {/* Transaction Filter Tabs */}
          <div className="flex border-b border-gray-700 mb-4">
            <button 
              className={`px-4 py-2 font-medium ${activeTab === 'all' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-400'}`}
              onClick={() => setActiveTab('all')}
            >
              All
            </button>
            <button 
              className={`px-4 py-2 font-medium ${activeTab === 'deposits' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-400'}`}
              onClick={() => setActiveTab('deposits')}
            >
              Deposits
            </button>
            <button 
              className={`px-4 py-2 font-medium ${activeTab === 'withdrawals' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-400'}`}
              onClick={() => setActiveTab('withdrawals')}
            >
              Withdrawals
            </button>
            <button 
              className={`px-4 py-2 font-medium ${activeTab === 'games' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-400'}`}
              onClick={() => setActiveTab('games')}
            >
              Game Activity
            </button>
          </div>
          
          {/* Transaction List */}
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400">No transactions found</p>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-2">
                <div className="text-sm text-gray-400">
                  {totalTransactions} transaction{totalTransactions !== 1 ? 's' : ''} found
                </div>
                <div className="text-sm text-gray-400">
                  Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalTransactions)} - {Math.min(currentPage * itemsPerPage, totalTransactions)} of {totalTransactions}
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {paginatedTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-800">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`${getTransactionTypeClass(tx.type)} font-medium`}>
                            {getTransactionTypeLabel(tx.type)}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className={`font-medium ${tx.type === 'withdrawal' || tx.type === 'game_bet' ? 'text-red-400' : 'text-green-400'}`}>
                              {tx.type === 'withdrawal' || tx.type === 'game_bet' ? '-' : '+'}{formatAmount(tx.amount)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 hidden md:table-cell">
                          {formatDate(tx.timestamp)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            tx.status === 'completed' ? 'bg-green-900 text-green-300' : 
                            tx.status === 'pending' ? 'bg-yellow-900 text-yellow-300' : 
                            'bg-red-900 text-red-300'
                          }`}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 truncate max-w-xs">
                          {tx.description || 'No description'}
                        </td>
                      </tr>
                    ))}
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
            </>
          )}
        </>
      )}
    </div>
  );
} 