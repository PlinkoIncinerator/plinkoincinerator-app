"use client";

import { useState } from "react";
import Image from "next/image";
import { SolanaLogo } from './PlinkoIncinerator';

interface TokenListProps {
  eligibleTokens: TokenAccount[];
  selectedTokens: TokenAccount[];
  processedTokens?: TokenAccount[];
  frozenTokens?: TokenAccount[];
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
  hasSwapRoutes?: boolean;
  isFrozen?: boolean;
}

export default function TokenList({
  eligibleTokens,
  selectedTokens,
  processedTokens = [],
  frozenTokens = [],
  tokenSearch,
  onTokenSearchChange,
  onToggleTokenSelection,
  onToggleAllTokens,
  solToUsd,
  feePercentage
}: TokenListProps) {
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'eligible' | 'locked'>('eligible');


  console.log("eligibleTokens", eligibleTokens)
  console.log("processedTokens", processedTokens)
  console.log("selectedTokens", selectedTokens)
  console.log("frozenTokens", frozenTokens)
  console.log("tokenSearch", tokenSearch)
  
  
  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  // Filter tokens based on search query
  const searchLower = tokenSearch.toLowerCase();
  const filterBySearch = (token: TokenAccount) => {
    return (
      token.name?.toLowerCase().includes(searchLower) ||
      token.symbol?.toLowerCase().includes(searchLower) ||
      token.mint.toLowerCase().includes(searchLower)
    );
  };

  // Get eligible tokens filtered by search
  const filteredEligibleTokens = eligibleTokens.filter(filterBySearch);
  
  // Get processed tokens filtered by search
  const filteredProcessedTokens = processedTokens.filter(filterBySearch);
  
  // Use the frozenTokens prop directly instead of deriving it
  const filteredFrozenTokens = frozenTokens.filter(filterBySearch);
  
  console.log("filteredFrozenTokens", filteredFrozenTokens)
  console.log("filteredEligibleTokens", filteredEligibleTokens)
  console.log("filteredProcessedTokens", filteredProcessedTokens)
  
  // Make sure we're not showing duplicates - only include non-frozen tokens in display tokens by default
  const displayEligibleTokens = filteredEligibleTokens.filter(token => !token.isFrozen);
  const displayProcessedTokens = filteredProcessedTokens.filter(token => !token.isFrozen);
  
  // Display tokens based on current active tab
  const displayTokens = activeTab === 'eligible' 
    ? [...displayEligibleTokens, ...displayProcessedTokens]
    : filteredFrozenTokens;

  return (
    <div className="mt-4 max-h-[600px] sm:max-h-[650px] md:max-h-[700px] overflow-y-auto p-3 sm:p-4 bg-gray-950 bg-opacity-95 rounded-lg border border-gray-800/50 shadow-xl">
      <div className="mb-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-3">
        <h3 className="text-lg font-bold text-white">Token List</h3>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="bg-gray-900 rounded-full px-2 py-0.5 text-xs text-gray-200">
            {selectedTokens.length}/{eligibleTokens.length} selected
          </span>
          
          <div className="flex gap-1 sm:gap-2">
            <button
              onClick={() => onToggleAllTokens(true)}
              className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-1 bg-purple-900/60 hover:bg-purple-800/70 border border-purple-600/50 rounded text-white transition-all"
            >
              Select All
            </button>
            <button
              onClick={() => onToggleAllTokens(false)}
              className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-1 bg-gray-900/60 hover:bg-gray-800/70 border border-gray-600/50 rounded text-white transition-all"
            >
              Deselect All
            </button>
          </div>
        </div>
      </div>
      
      {/* Tabs & Stats Bar */}
      <div className="mb-3">
        <div className="flex border-b border-gray-700">
          <button
            className={`flex-1 py-1.5 text-center text-xs font-medium border-b-2 ${
              activeTab === 'eligible'
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
            } transition-all`}
            onClick={() => setActiveTab('eligible')}
          >
            Eligible ({eligibleTokens.length})
          </button>
          
          {frozenTokens.length > 0 && (
            <button
              className={`flex-1 py-1.5 text-center text-xs font-medium border-b-2 ${
                activeTab === 'locked'
                  ? 'border-red-500 text-red-300'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
              } transition-all`}
              onClick={() => setActiveTab('locked')}
            >
              Locked ({frozenTokens.length})
            </button>
          )}
          
          <button 
            onClick={() => setShowHelpModal(true)}
            className="p-1.5 h-full text-blue-400 hover:text-blue-300 transition-colors flex items-center justify-center"
            title="Learn more about token types"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        
        {/* Stats summary */}
        <div className="bg-gray-900/50 p-2 text-xs rounded-b border-x border-b border-gray-800/30 flex items-center justify-between">
          {activeTab === 'eligible' ? (
            <>
              <div>
                <span className="text-purple-300 font-medium">{eligibleTokens.length}</span> 
                <span className="text-gray-400 ml-1">eligible</span>
              </div>
              <div>
                <span className="text-blue-300 font-medium">{selectedTokens.length}</span>
                <span className="text-gray-400 ml-1">selected</span>
              </div>
            </>
          ) : (
            <div>
              <span className="text-red-300 font-medium">{frozenTokens.length}</span>
              <span className="text-gray-400 ml-1">tokens locked by creators</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Help Modal */}
      {showHelpModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={(e) => {
            // Close when clicking the backdrop
            if (e.target === e.currentTarget) {
              setShowHelpModal(false);
            }
          }}
        >
          <div className="bg-gray-900 p-5 rounded-lg border border-purple-800/30 max-w-md w-full max-h-[80vh] overflow-y-auto shadow-lg">
            <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                Understanding Your Tokens
              </h3>
              <button 
                onClick={() => setShowHelpModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="p-3 bg-purple-900/20 rounded border border-purple-800/40">
                <h4 className="font-medium text-purple-300 mb-1">Eligible Tokens ({eligibleTokens.length})</h4>
                <p className="text-sm text-gray-300">
                  These tokens can be incinerated to claim SOL. Each token will give you approximately {(0.00203928 * (1 - feePercentage)).toFixed(6)} <SolanaLogo className="inline ml-1" /> SOL from the account closure.
                </p>
                <p className="text-sm text-gray-300 mt-2">
                  <span className="text-amber-400">Note:</span> Some tokens may show a value but have "No Liquidity". 
                  For these tokens, you'll only receive the account closure value, not the token value.
                </p>
              </div>
              
              {frozenTokens.length > 0 && (
                <div className="p-3 bg-red-900/20 rounded border border-red-800/40">
                  <h4 className="font-medium text-red-300 mb-1">Locked Tokens ({frozenTokens.length})</h4>
                  <p className="text-sm text-gray-300">
                    Sorry, these tokens can't be burned right now because they've been locked by their creator.
                  </p>
                  <p className="text-sm text-gray-300 mt-2">
                    Think of it like this: The developer who created these tokens hit a "pause button" 
                    that prevents anyone from moving or burning them. Only they can "unpause" the tokens. 
                    Nothing is wrong with your wallet – these tokens are just temporarily locked by their creator.
                  </p>
                </div>
              )}
              
              <div className="p-3 bg-blue-900/20 rounded border border-blue-800/40">
                <h4 className="font-medium text-blue-300 mb-1">Selected Tokens ({selectedTokens.length})</h4>
                <p className="text-sm text-gray-300">
                  These are the tokens you've chosen to incinerate. Click on eligible tokens to select or deselect them.
                </p>
                <p className="text-sm text-blue-300 mt-2">
                  Total value: {
                    // Only include token value for tokens with swap routes
                    selectedTokens.reduce((total, token) => {
                      const accountClosureValue = 0.00203928 * (1 - feePercentage);
                      const tokenValueInSol = token.hasSwapRoutes && token.valueUsd && solToUsd
                        ? (token.valueUsd / solToUsd) * (1 - feePercentage)
                        : 0;
                      return total + accountClosureValue + tokenValueInSol;
                    }, 0).toFixed(6)
                  } <SolanaLogo className="inline ml-1" />
                  {solToUsd && (
                    <span className="text-gray-400 ml-1">
                      (${(selectedTokens.reduce((total, token) => {
                        const accountClosureUsd = 0.00203928 * solToUsd * (1 - feePercentage);
                        const tokenValueUsd = token.hasSwapRoutes && token.valueUsd
                          ? token.valueUsd * (1 - feePercentage)
                          : 0;
                        return total + accountClosureUsd + tokenValueUsd;
                      }, 0)).toFixed(2)})
                    </span>
                  )}
                </p>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowHelpModal(false)}
                className="bg-purple-700 hover:bg-purple-600 text-white px-4 py-2 rounded"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="mb-3">
        <div className="relative">
          <input
            type="text"
            value={tokenSearch}
            onChange={(e) => onTokenSearchChange(e.target.value)}
            placeholder="Search tokens..."
            className="w-full bg-gray-900 border border-gray-700 rounded-md py-1.5 pl-8 pr-4 text-xs focus:border-purple-500 focus:outline-none"
          />
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-4 w-4 absolute left-2 top-2 text-gray-400" 
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
              className="absolute right-2 top-2 text-gray-400 hover:text-white"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-4 w-4" 
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
      
      {/* Show a specific message based on the active tab */}
      {activeTab === 'locked' && (
        <div className="mb-3 p-1.5 bg-red-900/20 rounded-md border border-red-800/30 text-[10px] sm:text-xs text-gray-300">
          These tokens are locked by their creators and cannot be incinerated at this time.
        </div>
      )}
      
      <div className="space-y-1.5 max-h-[450px] sm:max-h-[500px] overflow-y-auto pr-1">
        {displayTokens.length > 0 ? (
          displayTokens.map((token) => {
            const isSelected = selectedTokens.some(t => t.pubkey === token.pubkey);
            const isProcessed = token.isProcessed;
            const isFrozen = token.isFrozen;
            
            const accountClosureValue = 0.00203928; // Value from closing the account
            const tokenValueInSol = token.valueUsd && solToUsd ? token.valueUsd / solToUsd : 0;
            const netAccountClosureSol = accountClosureValue * (1 - feePercentage);
            const netAccountClosureUsd = (accountClosureValue * (solToUsd || 0)) * (1 - feePercentage);
            const totalSol = (tokenValueInSol + accountClosureValue) * (1 - feePercentage);
            const totalUsd = ((token.valueUsd || 0) + (accountClosureValue * (solToUsd || 0))) * (1 - feePercentage);

            return (
              <div
                key={token.pubkey}
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded-lg border ${
                  isProcessed ? 'border-green-500 bg-green-900/10' : 
                  isFrozen ? 'border-red-500 bg-red-900/10' :
                  isSelected ? 'border-purple-500 bg-purple-900/20' : 'border-gray-700'
                } ${!(isProcessed || isFrozen) ? 'cursor-pointer hover:bg-gray-800/50' : ''}`}
                onClick={(e) => {
                  // Only toggle if not processed or frozen and not clicking on copy button
                  if (!(isProcessed || isFrozen) && !(e.target as HTMLElement).closest('button')) {
                    onToggleTokenSelection(token.pubkey);
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  {!isFrozen && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleTokenSelection(token.pubkey)}
                      disabled={isProcessed || isFrozen}
                      className={`w-3.5 h-3.5 rounded focus:ring-purple-500 ${(isProcessed || isFrozen) ? 'opacity-50 cursor-not-allowed' : 'text-purple-600'}`}
                    />
                  )}
                  {isProcessed && (
                    <span className="text-xs bg-green-800 text-green-200 px-1.5 py-0.5 rounded-md text-[10px]">
                      Processed
                    </span>
                  )}
                  {token.isFrozen && (
                    <span className="text-xs bg-red-800 text-red-200 px-1.5 py-0.5 rounded-md ml-1 text-[10px]">
                      Locked
                    </span>
                  )}
                  
                  <div className="flex items-center gap-2">
                    {token.logoUrl ? (
                      <Image
                        src={token.logoUrl}
                        alt={token.symbol || 'Token'}
                        width={20}
                        height={20}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-5 h-5 bg-gray-700 rounded-full flex items-center justify-center">
                        <span className="text-[10px] text-gray-400">
                          {token.symbol?.slice(0, 2) || '??'}
                        </span>
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-white text-sm">
                          {token.symbol || 'Unknown Token'}
                        </span>
                        {token.isFrozen && (
                          <span className="ml-1 text-[10px] text-red-400 bg-red-900/30 px-1 py-0.5 rounded" title="This token is locked by its creator and can't be moved or burned right now.">
                            Cannot Burn
                          </span>
                        )}
                        <button
                          onClick={() => handleCopyAddress(token.mint)}
                          className="text-gray-400 hover:text-white transition-colors"
                          title="Copy token address"
                        >
                          {copiedAddress === token.mint ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                              <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                            </svg>
                          )}
                        </button>
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {token.mint.slice(0, 6)}...{token.mint.slice(-4)}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mt-1 sm:mt-0">
                  <div className="text-right text-xs">
                    <div className="text-gray-300">
                      ${token.valueUsd?.toFixed(2) || '0.00'}
                      {(token.valueUsd ?? 0) > 0 && !token.hasSwapRoutes && (
                        <span className="ml-1 text-[10px] text-amber-400 bg-amber-900/30 px-1 py-0.5 rounded">
                          No Liq.
                        </span>
                      )}
                    </div>
                    
                    {!isFrozen && (
                      <>
                        <div className="text-purple-400">
                          +{netAccountClosureSol.toFixed(6)} <SolanaLogo className="inline" width={10} height={8} />
                        </div>
                        <div className="font-medium text-white">
                          {
                            // Only include token value if it has swap routes
                            (token.hasSwapRoutes ? totalSol : netAccountClosureSol).toFixed(6)
                          } <SolanaLogo className="inline" width={10} height={8} />
                        </div>
                      </>
                    )}
                    
                    {(token.valueUsd ?? 0) > 0 && !token.hasSwapRoutes && (
                      <div className="text-[10px] text-amber-400">
                        Only account value counted
                      </div>
                    )}
                    
                    {token.isFrozen && (
                      <div className="text-[10px] text-red-400 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Creator locked
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex justify-center items-center py-8">
            <p className="text-gray-400">
              {tokenSearch 
                ? "No tokens match your search" 
                : activeTab === 'eligible' 
                  ? "No eligible tokens found in your wallet" 
                  : "No locked tokens found in your wallet"}
            </p>
          </div>
        )}
      </div>
      
      {displayTokens.length === 0 && (
        <div className="flex justify-center items-center py-8">
          <p className="text-gray-400">No tokens match your search</p>
        </div>
      )}
      
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