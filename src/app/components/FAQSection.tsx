'use client';

import React, { useState } from 'react';
import Image from 'next/image';

// Solana Logo component
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

// FAQ Item component
interface FAQItemProps {
  question: React.ReactNode;
  children: React.ReactNode;
}

const FAQItem = ({ question, children }: FAQItemProps) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="bg-gray-800 bg-opacity-50 rounded-lg overflow-hidden transition-all duration-300 hover:bg-gray-800">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-5 text-left flex justify-between items-center"
      >
        <h3 className="text-xl font-bold text-pink-400">{question}</h3>
        <span className={`text-xl transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
          ⌄
        </span>
      </button>
      <div 
        className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="p-5 pt-0 text-gray-300">
          {children}
        </div>
      </div>
    </div>
  );
};

export default function FAQSection() {
  return (
    <section className="bg-gray-900 bg-opacity-80 py-12">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">Frequently Asked Questions</h2>
        
        <div className="grid gap-3 max-w-3xl mx-auto">
          <FAQItem question="WTF is a 'dust' account?">
            Empty token accounts in your Solana wallet that take up space on the blockchain. They're leftovers from airdrops, NFTs, or tokens you've sold. They're useless but occupy rent space.
          </FAQItem>
          
          <FAQItem question={<>How much <SolanaLogo width={14} height={12} /> do I get?</>}>
            You get about 0.00203928 <SolanaLogo width={14} height={12} /> per empty token account (after our 2.1% platform fee). When you incinerate tokens, you can choose to either withdraw directly to your wallet or gamble with Plinko for a chance to multiply your earnings.
          </FAQItem>
          
          <FAQItem question="What is 'SOL Recovered'?">
            &quot;SOL Recovered&quot; refers to the total amount of SOL that has been reclaimed from closing empty token accounts across all users. When you close empty token accounts, you recover the rent space deposit that was locked in these accounts, which is returned as SOL. This process frees up blockchain space and returns the locked value to users.
          </FAQItem>
          
          <FAQItem question="What are my options after burning tokens?">
            <p>You have two choices:</p>
            <ul className="mt-2 list-disc list-inside pl-2">
              <li><strong>Withdraw:</strong> Get your <SolanaLogo width={14} height={12} /> directly to your wallet (2.1% platform fee is deducted)</li>
              <li><strong>YOLO It:</strong> Send the full value to Plinko and try to multiply your earnings with multipliers up to 25x</li>
            </ul>
          </FAQItem>
          
          <FAQItem question="Is the Plinko game rigged?">
            No! Our Plinko game is provably fair - we use cryptographic verification you can check yourself. Same tech used by legit crypto casinos. The house edge is built into the multipliers, not by rigging outcomes.
          </FAQItem>

          <FAQItem question="What happens after I burn my empty accounts?">
            After burning your empty accounts, you'll receive <SolanaLogo width={14} height={12} /> tokens in proportion to the number of accounts closed. You can then either withdraw these tokens directly to your wallet or use them to play the Plinko game for a chance to multiply your earnings.
          </FAQItem>

          <FAQItem question="Is there a limit to how many accounts I can burn?">
            Nope! Burn as many empty accounts as you want. The more dust you clean, the more <SolanaLogo width={14} height={12} /> you earn to play with or withdraw.
          </FAQItem>

          <FAQItem question="What is the $PLINC token?">
            <p>$PLINC is our governance and utility token that powers the PlinkoIncinerator ecosystem. The token has already launched and is available for trading. Token holders enjoy:</p>
            <ul className="mt-2 list-disc list-inside pl-2">
              <li><strong>Reduced fees</strong> on token burns and Plinko games</li>
              <li><strong>Governance rights</strong> to vote on platform upgrades</li>
              <li><strong>Staking rewards</strong> for providing liquidity</li>
              <li><strong>Exclusive access</strong> to new features and games</li>
            </ul>
            <p className="mt-2">We've implemented a <strong className="text-green-400">buyback mechanism</strong> where a portion of platform fees goes toward purchasing and burning $PLINC tokens. This reduces the circulating supply over time - the more you play, the more tokens get burned!</p>
            <p className="mt-2 text-yellow-300 font-bold">Contract Address: 49Jy3P5J41zkcCgaveKXQfeUU3zNCHCSEEypkJTrpump</p>
          </FAQItem>
        </div>
      </div>
    </section>
  );
} 