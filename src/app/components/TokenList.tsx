"use client";

import { useState } from "react";
import Image from "next/image";

interface TokenListProps {
  eligibleTokens: TokenAccount[];
  selectedTokens: TokenAccount[];
  tokenSearch: string;
  onTokenSearchChange: (value: string) => void;
  onToggleTokenSelection: (pubkey: string) => void;
  onToggleAllTokens: (selected: boolean) => void;
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
}

export default function TokenList({
  eligibleTokens,
  selectedTokens,
  tokenSearch,
  onTokenSearchChange,
  onToggleTokenSelection,
  onToggleAllTokens
}: TokenListProps) {
  // Hint component for token selection
  const TokenSelectionHint = () => (
    <div className="mt-3 mb-2 p-2 bg-blue-900 bg-opacity-20 rounded-md text-xs text-blue-200 border border-blue-800">
      <div className="flex items-start">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-blue-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0114 0z" />
        </svg>
        <span>Click on a token card or checkbox to select/deselect it for incineration</span>
      </div>
    </div>
  );

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
            <p className="text-gray-300">Burn them to get {(0.00203928 * 0.85).toFixed(8)} SOL each (after 15% fee).</p>
          </div>
        </div>
      </div>
      
      <TokenSelectionHint />
      
      {eligibleTokens.length > 5 && (
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
      )}
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {eligibleTokens
          .filter(token => 
            tokenSearch === '' || 
            token.name?.toLowerCase().includes(tokenSearch.toLowerCase()) || 
            token.symbol?.toLowerCase().includes(tokenSearch.toLowerCase())
          )
          .map((token, index) => (
            <div 
              key={token.pubkey} 
              className={`bg-gray-900/60 rounded-lg p-3 border transition-all ${token.isSelected ? 'border-purple-500/50' : 'border-gray-700/50 hover:border-gray-500/50'}`}
            >
              <div className="flex items-center mb-2">
                <div 
                  className="flex-shrink-0 w-6 h-6 mr-2"
                  onClick={() => onToggleTokenSelection(token.pubkey)}
                >
                  <div className={`w-5 h-5 rounded border ${token.isSelected ? 'bg-purple-600/60 border-purple-400/50' : 'border-gray-500/50'} flex items-center justify-center cursor-pointer`}>
                    {token.isSelected && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 w-8 h-8 mr-3 bg-gray-800 rounded-full flex items-center justify-center">
                  {token.logoUrl ? (
                    <Image 
                      src={token.logoUrl} 
                      alt={token.symbol || "Token"} 
                      className="w-7 h-7 rounded-full"
                      width={28}
                      height={28}
                      onError={(e) => {
                        e.currentTarget.dataset.error = "true";
                        const nextSibling = e.currentTarget.nextSibling as HTMLElement;
                        if (nextSibling) nextSibling.style.display = 'block';
                      }}
                      style={{objectFit: "cover"}}
                    />
                  ) : null}
                  <span 
                    className="text-xs font-bold text-white" 
                    style={{display: token.logoUrl ? 'none' : 'block'}}
                  >
                    {token.symbol?.substring(0, 2) || "??"}
                  </span>
                </div>
                <div 
                  className="cursor-pointer flex-grow"
                  onClick={() => onToggleTokenSelection(token.pubkey)}
                >
                  <div className="font-medium text-white truncate max-w-[180px]" title={token.name}>
                    {token.name}
                  </div>
                  <div className="text-xs text-gray-300 flex items-center">
                    <span className="mr-1">{token.symbol}</span>
                    <span className="inline-flex items-center justify-center bg-purple-900/40 rounded-sm px-1">
                      <span className="mr-1 w-2 h-2 rounded-full bg-green-500"></span>
                      <span className="text-[10px]">Empty</span>
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-700/50">
                <div className="text-xs text-gray-400">Token account</div>
                <div className="text-right">
                  <div className="text-sm font-bold text-green-400">0.00203928 SOL</div>
                  <div className="text-[10px] text-gray-500 font-mono">
                    {token.pubkey.substring(0, 6)}...{token.pubkey.substring(token.pubkey.length - 4)}
                  </div>
                </div>
              </div>
            </div>
          ))}
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