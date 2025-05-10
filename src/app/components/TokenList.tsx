"use client";

import { useState } from "react";
import Image from "next/image";
import { SolanaLogo } from './PlinkoIncinerator';

interface TokenListProps {
  eligibleTokens: TokenAccount[];
  selectedTokens: TokenAccount[];
  tokenSearch: string;
  onTokenSearchChange: (value: string) => void;
  onToggleTokenSelection: (pubkey: string) => void;
  onToggleAllTokens: (selected: boolean) => void;
  solToUsd: number | null;
  feePercentage: number;
}

interface TokenAccount {
  pubkey: string;
  mint: string;
  owner: string;
  amount: number;
  decimals: number;
  uiAmount: number;
  symbol?: string;
  name?: string;
  logoUrl?: string;
  isSelected?: boolean;
  isEligible?: boolean;
  isProcessed?: boolean;
  potentialValue?: number;
  valueUsd?: number;
}

export default function TokenList({
  eligibleTokens,
  selectedTokens,
  tokenSearch,
  onTokenSearchChange,
  onToggleTokenSelection,
  onToggleAllTokens,
  solToUsd,
  feePercentage
}: TokenListProps) {
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  const filteredTokens = eligibleTokens.filter(token => {
    const searchLower = tokenSearch.toLowerCase();
    return (
      token.name?.toLowerCase().includes(searchLower) ||
      token.symbol?.toLowerCase().includes(searchLower) ||
      token.mint.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="mt-4 max-h-96 overflow-y-auto p-4 bg-gray-950 bg-opacity-95 rounded-lg border border-gray-800/50 shadow-xl">
      <div className="mb-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h3 className="text-lg font-bold text-white">Eligible Tokens</h3>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="bg-gray-900 rounded-full px-3 py-1 text-xs text-gray-200">
            {selectedTokens.length}/{eligibleTokens.length} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => onToggleAllTokens(true)}
              className="text-xs px-2 py-1 bg-purple-900/60 hover:bg-purple-800/70 border border-purple-600/50 rounded text-white transition-all"
            >
              Select All
            </button>
            <button
              onClick={() => onToggleAllTokens(false)}
              className="text-xs px-2 py-1 bg-gray-900/60 hover:bg-gray-800/70 border border-gray-600/50 rounded text-white transition-all"
            >
              Deselect All
            </button>
          </div>
        </div>
      </div>
      
      <div className="mb-4 p-3 bg-gray-900/80 rounded-md border border-blue-800/50">
        <div className="flex items-start">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-blue-200 mb-1">Empty token accounts take up space in your wallet.</p>
            <p className="text-gray-300">Burn them to get {(0.00203928 * (1 - feePercentage)).toFixed(8)} SOL each (after {(feePercentage * 100).toFixed(2)}% fee).</p>
          </div>
        </div>
      </div>
      
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            value={tokenSearch}
            onChange={(e) => onTokenSearchChange(e.target.value)}
            placeholder="Search tokens..."
            className="w-full bg-gray-900 border border-gray-700 rounded-md py-2 pl-10 pr-4 text-sm focus:border-purple-500 focus:outline-none"
          />
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-5 w-5 absolute left-3 top-2.5 text-gray-400" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
            />
          </svg>
          {tokenSearch && (
            <button 
              onClick={() => onTokenSearchChange('')}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-white"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-5 w-5" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M6 18L18 6M6 6l12 12" 
                />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {filteredTokens.map((token) => {
          const isSelected = selectedTokens.some(t => t.pubkey === token.pubkey);
          const accountClosureValue = 0.00203928; // Value from closing the account
          const tokenValueInSol = token.valueUsd && solToUsd ? token.valueUsd / solToUsd : 0;
          const netAccountClosureSol = accountClosureValue * (1 - feePercentage);
          const netAccountClosureUsd = (accountClosureValue * (solToUsd || 0)) * (1 - feePercentage);
          const totalSol = (tokenValueInSol + accountClosureValue) * (1 - feePercentage);
          const totalUsd = ((token.valueUsd || 0) + (accountClosureValue * (solToUsd || 0))) * (1 - feePercentage);
          
          return (
            <div
              key={token.pubkey}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                isSelected ? 'border-purple-500 bg-purple-900/20' : 'border-gray-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleTokenSelection(token.pubkey)}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
                <div className="flex items-center gap-2">
                  {token.logoUrl ? (
                    <Image
                      src={token.logoUrl}
                      alt={token.symbol || 'Token'}
                      width={24}
                      height={24}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center">
                      <span className="text-xs text-gray-400">
                        {token.symbol?.slice(0, 2) || '??'}
                      </span>
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">
                        {token.symbol || 'Unknown Token'}
                      </span>
                      <button
                        onClick={() => handleCopyAddress(token.mint)}
                        className="text-gray-400 hover:text-white transition-colors"
                        title="Copy token address"
                      >
                        {copiedAddress === token.mint ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                            <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <div className="text-xs text-gray-400">
                      {token.mint.slice(0, 6)}...{token.mint.slice(-4)}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm text-gray-300">
                    Token Value: ${token.valueUsd?.toFixed(2) || '0.00'}
                  </div>
                  <div className="text-sm text-purple-400">
                    + {netAccountClosureSol.toFixed(8)} <SolanaLogo className="ml-1" />
                    {solToUsd && (
                      <span className="text-gray-400 ml-1">
                        (${netAccountClosureUsd.toFixed(2)})
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-medium text-white">
                    Total: {totalSol.toFixed(6)} <SolanaLogo className="ml-1" />
                    {solToUsd && (
                      <span className="text-gray-400 ml-1">
                        (${totalUsd.toFixed(2)})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {eligibleTokens.length > 6 && (
        <div className="mt-4 text-center">
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('close-token-list'))}
            className="text-xs text-gray-400 hover:text-white"
          >
            Close Token List
          </button>
        </div>
      )}
    </div>
  );
} 