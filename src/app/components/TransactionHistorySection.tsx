"use client";

import { useState } from "react";
import TransactionHistory from "./TransactionHistory";

interface TransactionHistorySectionProps {
  walletAddress: string;
}

export default function TransactionHistorySection({ walletAddress }: TransactionHistorySectionProps) {
  const [showTransactions, setShowTransactions] = useState<boolean>(false);

  return (
    <>
      {/* Toggle button for transaction history */}
      <div className="flex justify-between items-center mb-4">
        {!showTransactions ? (
          <button
            onClick={() => setShowTransactions(true)}
            className="text-sm text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1.5 group"
          >
            <span>Show Transactions</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 transform group-hover:translate-y-0.5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
        ) : (
          <div className="flex justify-between items-center w-full">
            <h2 className="text-xl font-bold text-white">Your Activity</h2>
            <button
              onClick={() => setShowTransactions(false)}
              className="text-sm text-gray-400 hover:text-gray-300 transition-colors flex items-center gap-1.5 group"
            >
              <span>Hide</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 transform group-hover:-translate-y-0.5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 15l-6-6-6 6"/>
              </svg>
            </button>
          </div>
        )}
      </div>
      
      {/* Transaction History Component */}
      {showTransactions && (
        <TransactionHistory walletAddress={walletAddress} />
      )}
    </>
  );
} 