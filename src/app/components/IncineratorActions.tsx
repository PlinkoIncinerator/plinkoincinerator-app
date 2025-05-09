"use client";

import { useState } from "react";
import Image from "next/image";
import { trackPlinkoEvent } from "../utils/analytics";

// Create a reusable component for the Solana logo
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

interface IncineratorActionsProps {
  eligibleTokens: number;
  selectedTokens: number;
  totalPotentialValue: number;
  potentialSol: number;
  maxAccountsPerBatch: number;
  needsBatching: boolean;
  onWithdraw: () => void;
  onGamble: () => void;
  onCancel: () => void;
}

export default function IncineratorActions({
  eligibleTokens,
  selectedTokens,
  totalPotentialValue,
  potentialSol,
  maxAccountsPerBatch,
  needsBatching,
  onWithdraw,
  onGamble,
  onCancel
}: IncineratorActionsProps) {
  return (
    <div className="bg-gray-900/80 p-6 rounded-lg border border-gray-700/50 shadow-xl">
      <h3 className="text-lg font-bold text-white mb-4 text-center">Choose Your Action</h3>

      <div className="flex flex-col gap-4">
        <button
          onClick={() => {
            trackPlinkoEvent('select_withdraw_option', {
              potential_value: potentialSol,
            });
            onWithdraw();
          }}
          className="w-full p-4 bg-green-900/60 border-2 border-green-600/50 rounded-lg hover:bg-green-800/70 hover:border-green-500 transition-all"
        >
          <div className="text-center">
            <div className="text-xl font-bold text-white mb-2">WITHDRAW</div>
            <div className="text-2xl font-bold text-green-400 mb-1 flex items-center justify-center gap-1">
              {potentialSol.toFixed(6)} <SolanaLogo width={20} height={18} />
            </div>
            <div className="text-sm text-gray-200">Send SOL directly to your wallet</div>
            {needsBatching && (
              <div className="text-xs text-yellow-300 mt-2 flex items-center justify-center gap-1">
                First batch: {Math.min(selectedTokens, maxAccountsPerBatch) * 0.00203928 * 0.85} <SolanaLogo width={14} height={12} />
              </div>
            )}
          </div>
        </button>
        
        <div className="flex items-center justify-center">
          <div className="h-px bg-gray-800 flex-grow"></div>
          <span className="px-4 text-gray-400 font-medium">OR</span>
          <div className="h-px bg-gray-800 flex-grow"></div>
        </div>
        
        <button
          onClick={() => {
            trackPlinkoEvent('select_gamble_option', {
              potential_value: totalPotentialValue,
            });
            onGamble();
          }}
          className="w-full p-4 bg-blue-900/60 border-2 border-blue-600/50 rounded-lg hover:bg-blue-800/70 hover:border-blue-500 transition-all"
        >
          <div className="text-center">
            <div className="text-xl font-bold text-white mb-2">YOLO IT 🔥</div>
            <div className="text-2xl font-bold text-blue-400 mb-1 flex items-center justify-center gap-1">
              {totalPotentialValue.toFixed(6)} <SolanaLogo width={20} height={18} />
            </div>
            <div className="text-sm text-gray-200">Try your luck with Plinko</div>
            {needsBatching && (
              <div className="text-xs text-yellow-300 mt-2 flex items-center justify-center gap-1">
                First batch: {Math.min(eligibleTokens, maxAccountsPerBatch) * 0.00203928} <SolanaLogo width={14} height={12} />
              </div>
            )}
          </div>
        </button>
      </div>

      {needsBatching && (
        <div className="mt-4 p-3 bg-gray-900/80 rounded-md border border-yellow-700/50">
          <div className="flex items-start">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-yellow-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm text-yellow-200 mb-1">Processing in Batches</p>
              <p className="text-xs text-gray-300">
                You have {eligibleTokens} accounts but only {maxAccountsPerBatch} can be processed per transaction.
                After the first batch completes, you can return to process the remaining {eligibleTokens - maxAccountsPerBatch} accounts.
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className="mt-6 text-center">
        <button 
          onClick={onCancel}
          className="text-sm text-gray-300 hover:text-white transition-colors px-4 py-2 rounded-md hover:bg-gray-800/50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
} 