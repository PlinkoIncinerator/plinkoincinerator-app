'use client';

import PlinkoIncinerator from './components/PlinkoIncinerator';
import PlinkoGameClient from './components/plinko/PlinkoGameClient';
import WalletConnectButton from './components/WalletConnectButton';
import PlinkoMetrics from './components/plinko/PlinkoMetrics';
import Head from 'next/head';
import Image from 'next/image';
import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { trackPlinkoEvent, ANALYTICS_EVENTS } from './utils/analytics';
import Header from './components/Header';
import Footer from './components/Footer';

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

// Partner Logo component
interface PartnerLogoProps {
  src: string;
  alt: string;
  href: string;
}

const PartnerLogo = ({ src, alt, href }: PartnerLogoProps) => {
  const handleClick = () => {
    trackPlinkoEvent(ANALYTICS_EVENTS.CLICK_SOCIAL, {
      platform: alt,
      url: href
    });
  };

  return (
    <a 
      href={href} 
      target="_blank" 
      rel="noopener noreferrer" 
      className="mx-6 flex flex-col items-center justify-center bg-gray-800 bg-opacity-50 p-5 rounded-lg hover:bg-opacity-80 transition-all transform hover:-translate-y-1 hover:shadow-lg border border-gray-700 min-w-[150px]"
      onClick={handleClick}
      aria-label={alt}
    >
      <Image
        src={src}
        alt={alt}
        width={120}
        height={60}
        className="h-12 w-auto object-contain brightness-110 drop-shadow-[0_0_2px_rgba(255,255,255,0.5)]"
      />
      <span className="mt-2 text-sm font-medium text-gray-300">{alt}</span>
    </a>
  );
};

// FAQ Dropdown Component
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

// Social Icon component
interface SocialIconProps {
  href: string;
  icon: string | React.ReactNode;
  label: string;
}

const SocialIcon = ({ href, icon, label }: SocialIconProps) => {
  const handleClick = () => {
    trackPlinkoEvent(ANALYTICS_EVENTS.CLICK_SOCIAL, {
      platform: label,
      url: href
    });
  };

  return (
    <a 
      href={href} 
      target="_blank" 
      rel="noopener noreferrer" 
      className="flex items-center text-gray-400 hover:text-purple-400 transition-colors"
      aria-label={label}
      onClick={handleClick}
    >
      {typeof icon === 'string' ? (
        <span className="text-xl mr-2">{icon}</span>
      ) : (
        <span className="mr-2">{icon}</span>
      )}
      <span>{label}</span>
    </a>
  );
};

export default function Home() {
  const [randomTag, setRandomTag] = useState('');
  const [showTokenBanner, setShowTokenBanner] = useState(true);
  const [totalBallsDropped, setTotalBallsDropped] = useState<number | null>(null);
  const [totalSolBurned, setTotalSolBurned] = useState<number | null>(null);
  const [isMetricsLoading, setIsMetricsLoading] = useState(true);
  const carouselRef = useRef<HTMLDivElement>(null);
  
  // Random degen taglines, memoized to avoid dependency array issues
  const taglines = useMemo(() => [
    "BURN YOUR DUST, YOLO THE REST!",
    "INCINERATE TRASH, WIN CASH!",
    "TORCH YOUR TOKENS, LAMBO SOON™",
    "PAPER WALLETS? BURN &apos;EM! 🔥",
    "FROM DUST TO DIAMOND HANDS! 💎",
    "BURN NOW, MOON LATER! 🚀"
  ], []);
  
  useEffect(() => {
    setRandomTag(taglines[Math.floor(Math.random() * taglines.length)]);
  }, [taglines]);
  
  // Track token signup banner interaction
  const handleTokenBannerClose = () => {
    setShowTokenBanner(false);
    trackPlinkoEvent(ANALYTICS_EVENTS.TOKEN_SIGNUP, {
      action: 'banner_dismissed'
    });
  };
  
  // Track social media clicks
  const trackSocialClick = (platform: string) => {
    trackPlinkoEvent(ANALYTICS_EVENTS.CLICK_SOCIAL, {
      platform: platform
    });
  };
  
  // Handle metrics loaded from the PlinkoMetrics component
  const handleMetricsLoaded = (metrics: any) => {
    if (metrics) {
      setTotalBallsDropped(metrics.totalBallsDropped);
      setTotalSolBurned(metrics.totalSolBurned);
      setIsMetricsLoading(false);
    }
  };
  
  return (
    <>
      <Head>
        <title>PlinkoIncinerator BETA | Incinerate Empty Solana Tokens & Win Big</title>
        <meta name="description" content="Clean your Solana wallet by burning empty token accounts & YOLO your earnings on Plinko. Get paid to clean your wallet!" />
        <meta name="keywords" content="solana, token burn, plinko, crypto gambling, nft burn, degen, solana dapp, PLINC token" />
        <meta property="og:title" content="PlinkoIncinerator BETA | Burn Token Trash, Win SOL Cash" />
        <meta property="og:description" content="🔥 Turn your empty Solana token accounts into SOL, then multiply it with Plinko! Degen-approved!" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="PlinkoIncinerator BETA | Burn & Earn" />
        <meta name="twitter:description" content="Burn empty Solana tokens, get SOL, play Plinko, lambo soon 🚀" />
      </Head>
      
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-black text-white">
        {/* Token Launch Banner */}
        {showTokenBanner && (
          <div className="bg-gradient-to-r from-purple-600 to-indigo-500 text-white py-3 relative">
            <div className="container mx-auto px-4 text-center">
              <p className="font-bold mb-2">
                <span className="animate-pulse">🚀</span> $PLINC Token is LIVE! <span className="animate-pulse">🚀</span>
              </p>
              <div className="flex items-center justify-center space-x-2 max-w-lg mx-auto bg-black bg-opacity-20 rounded-lg p-2">
                <span className="text-sm font-mono truncate">49Jy3P5J41zkcCgaveKXQfeUU3zNCHCSEEypkJTrpump</span>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText("49Jy3P5J41zkcCgaveKXQfeUU3zNCHCSEEypkJTrpump");
                    // Optional: Add some visual feedback when copied
                    const btn = document.getElementById('copy-btn');
                    if (btn) {
                      const originalText = btn.innerText;
                      btn.innerText = 'Copied!';
                      setTimeout(() => {
                        btn.innerText = originalText;
                      }, 1500);
                    }
                  }}
                  id="copy-btn"
                  className="bg-indigo-700 hover:bg-indigo-800 text-white text-xs py-1 px-2 rounded-md transition-colors"
                >
                  Copy CA
                </button>
              </div>
              <button 
                onClick={handleTokenBannerClose}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-200"
                aria-label="Close banner"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        
        {/* Header */}
        <Header />
        
        {/* Main content */}
        <main className="container mx-auto px-4 py-12">
          {/* Hero Section */}
          <div className="mb-12 text-center max-w-3xl mx-auto">
            <div className="flex justify-center mb-6">
              <Image 
                src="/logo_no_bg.png" 
                alt="PlinkoIncinerator Logo" 
                width={120} 
                height={120}
                className="animate-pulse"
              />
            </div>
            
            <h1 className="text-4xl md:text-6xl font-extrabold mb-6">
              <span className="bg-gradient-to-r from-orange-400 via-pink-500 to-purple-600 bg-clip-text text-transparent">
                BURN YOUR DUST, 
              </span>
              <br />
              <span className="bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
                GAMBLE THE REST
              </span>
            </h1>
            
            <div className="bg-black bg-opacity-50 p-4 rounded-xl mb-8 transform rotate-1">
              <p className="text-xl md:text-2xl font-bold text-yellow-300">
                {randomTag}
              </p>
            </div>
            
            <p className="text-gray-300 text-lg mb-8 max-w-2xl mx-auto">
              Your wallet is full of empty token accounts? 
              <span className="text-pink-400 font-bold"> BURN THEM</span>. 
              Get <SolanaLogo width={18} height={16} /> back. 
              <span className="text-green-400 font-bold"> GAMBLE IT</span>. 
            </p>

            <div className="flex justify-center gap-4 mb-10">
              <div className="bg-gray-800 bg-opacity-70 p-3 rounded-lg text-center min-w-32 relative overflow-hidden group hover:bg-gray-700 transition-all">
                <div className="absolute inset-0 bg-green-500 opacity-5 group-hover:opacity-10 transition-opacity"></div>
                <div className="text-2xl font-bold text-green-400">{isMetricsLoading ? "..." : (0.00203928).toFixed(8)} <SolanaLogo width={16} height={14} /></div>
                <div className="text-xs text-gray-400">PER EMPTY ACCOUNT</div>
              </div>
              <div className="bg-gray-800 bg-opacity-70 p-3 rounded-lg text-center min-w-32 relative overflow-hidden group hover:bg-gray-700 transition-all">
                <div className="absolute inset-0 bg-purple-500 opacity-5 group-hover:opacity-10 transition-opacity"></div>
                <div className="text-2xl font-bold text-purple-400">25x</div>
                <div className="text-xs text-gray-400">MAX PLINKO MULTIPLIER</div>
              </div>
            </div>
            
            {/* Live Stats */}
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              <div className="bg-black bg-opacity-50 px-4 py-2 rounded-full flex items-center group hover:bg-opacity-70 transition-all">
                <span className="inline-block h-2 w-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
                <span className="text-blue-300 font-medium mr-1">Balls Dropped:</span>
                <span className="text-white font-bold">
                  {isMetricsLoading ? (
                    <span className="inline-block w-12 h-5 bg-gray-700 animate-pulse rounded"></span>
                  ) : (
                    totalBallsDropped?.toLocaleString() || '0'
                  )}
                </span>
              </div>
              
              <div className="bg-black bg-opacity-50 px-4 py-2 rounded-full flex items-center group hover:bg-opacity-70 transition-all">
                <span className="inline-block h-2 w-2 bg-purple-500 rounded-full mr-2 animate-pulse"></span>
                <span className="text-purple-300 font-medium mr-1">SOL Recovered:</span>
                <span className="text-white font-bold flex items-center">
                  {isMetricsLoading ? (
                    <span className="inline-block w-16 h-5 bg-gray-700 animate-pulse rounded"></span>
                  ) : (
                    <>
                      {totalSolBurned?.toFixed(2) || '0'} <SolanaLogo width={12} height={10} className="ml-1" />
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>
          
          {/* Mobile Wallet Connect Button */}
          <div className="md:hidden flex flex-col items-center justify-center mb-8">
            <div className="bg-gradient-to-r from-purple-600 via-pink-500 to-blue-600 p-[2px] rounded-xl animate-pulse hover:animate-none">
              <div className="bg-gray-900 rounded-xl p-4">
                <WalletConnectButton />
              </div>
            </div>
            <p className="text-gray-400 text-sm mt-4">Connect your wallet to start burning tokens</p>
          </div>
          
          {/* Incinerator Component */}
          <div className="bg-black bg-opacity-40 backdrop-blur-sm rounded-xl p-6 border border-purple-900 shadow-2xl mb-10">
            <PlinkoIncinerator />
          </div>
          
          {/* Plinko Game Component */}
          <div className="bg-black bg-opacity-40 backdrop-blur-sm rounded-xl p-6 border border-purple-900 shadow-2xl">
            <PlinkoGameClient initialBalance={1000} />
          </div>

          {/* Features Section */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-900 bg-opacity-60 rounded-lg p-5 border-t-2 border-pink-500">
              <div className="text-pink-500 text-4xl mb-3">🔥</div>
              <h3 className="text-xl font-bold mb-2">Recover Empty Accounts</h3>
              <p className="text-gray-400">Close useless empty token accounts and get paid in <SolanaLogo width={12} height={10} />. Clean up your wallet while making money!</p>
            </div>
            
            <div className="bg-gray-900 bg-opacity-60 rounded-lg p-5 border-t-2 border-green-500">
              <div className="text-green-500 text-4xl mb-3">🎮</div>
              <h3 className="text-xl font-bold mb-2">Gamble Your Earnings</h3>
              <p className="text-gray-400">Why cash out when you can 25x your money? Provably fair Plinko with true degen energy.</p>
            </div>
            
            <div className="bg-gray-900 bg-opacity-60 rounded-lg p-5 border-t-2 border-blue-500">
              <div className="text-blue-500 text-4xl mb-3">🛡️</div>
              <h3 className="text-xl font-bold mb-2">100% On-Chain</h3>
              <p className="text-gray-400">Fully transparent process. Your tokens are recovered on-chain, your <SolanaLogo width={12} height={10} /> is real, your gains (or losses) are yours.</p>
            </div>
          </div>
          
          {/* Game Metrics Section - Moved below Features Section */}
          <div className="mt-16 bg-black bg-opacity-40 backdrop-blur-sm rounded-xl p-6 border border-purple-900 shadow-2xl">
            <h2 className="text-2xl font-bold mb-6 text-center bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent flex items-center justify-center">
              <span className="mr-2">📊</span> Live Plinko Stats <span className="animate-pulse ml-2">●</span>
            </h2>
            <PlinkoMetrics onMetricsLoaded={handleMetricsLoaded} />
          </div>
        </main>
        
        {/* FAQ Section */}
        <section className="bg-gray-900 bg-opacity-80 py-12">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">Frequently Asked Questions</h2>
            
            <div className="grid gap-3 max-w-3xl mx-auto">
              <FAQItem question="WTF is a &apos;dust&apos; account?">
                Empty token accounts in your Solana wallet that take up space on the blockchain. They&apos;re leftovers from airdrops, NFTs, or tokens you&apos;ve sold. They&apos;re useless but occupy rent space.
              </FAQItem>
              
              <FAQItem question={<>How much <SolanaLogo width={14} height={12} /> do I get?</>}>
                You get about 0.00203928 <SolanaLogo width={14} height={12} /> per empty token account (after our 2.1% platform fee). When you incinerate tokens, you can choose to either withdraw directly to your wallet or gamble with Plinko for a chance to multiply your earnings.
              </FAQItem>
              
              <FAQItem question="What is &apos;SOL Recovered&apos;?">
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
                After burning your empty accounts, you&apos;ll receive <SolanaLogo width={14} height={12} /> tokens in proportion to the number of accounts closed. You can then either withdraw these tokens directly to your wallet or use them to play the Plinko game for a chance to multiply your earnings.
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
                <p className="mt-2">We&apos;ve implemented a <strong className="text-green-400">buyback mechanism</strong> where a portion of platform fees goes toward purchasing and burning $PLINC tokens. This reduces the circulating supply over time - the more you play, the more tokens get burned!</p>
                <p className="mt-2 text-yellow-300 font-bold">Contract Address: 49Jy3P5J41zkcCgaveKXQfeUU3zNCHCSEEypkJTrpump</p>
              </FAQItem>
            </div>
          </div>
        </section>
        
        {/* Social Proof Section */}
        <section className="py-12 bg-black bg-opacity-50">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-2xl font-bold mb-8 bg-gradient-to-r from-pink-400 to-yellow-400 bg-clip-text text-transparent">Join Our Community</h2>
            
            <div className="flex flex-wrap justify-center gap-6 max-w-2xl mx-auto mb-8">
              <div className="bg-gray-800 bg-opacity-50 p-4 rounded-lg border border-purple-800 w-full md:w-auto flex-1 min-w-[200px] hover:bg-gray-800 hover:bg-opacity-60 transition-all transform hover:-translate-y-1">
                <div className="flex justify-center mb-3">
                  <Image src="/twitter.png" alt="X (Twitter)" width={40} height={40} className="rounded-full" />
                </div>
                <h3 className="font-bold text-xl mb-1">Twitter</h3>
                <p className="text-gray-400 mb-3">Get the latest updates and token announcements</p>
                <a 
                  href="https://twitter.com/plinkcinerator" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full transition-colors"
                  onClick={() => trackPlinkoEvent(ANALYTICS_EVENTS.CLICK_SOCIAL, { platform: 'Twitter' })}
                >
                  Follow Us
                </a>
              </div>
              
              <div className="bg-gray-800 bg-opacity-50 p-4 rounded-lg border border-purple-800 w-full md:w-auto flex-1 min-w-[200px] hover:bg-gray-800 hover:bg-opacity-60 transition-all transform hover:-translate-y-1">
                <div className="flex justify-center mb-3">
                  <Image src="/telegram.png" alt="Telegram" width={40} height={40} className="rounded-full" />
                </div>
                <h3 className="font-bold text-xl mb-1">Telegram</h3>
                <p className="text-gray-400 mb-3">Chat with the team and community</p>
                <a 
                  href="https://t.me/plinkoincinerator" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-block bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-full transition-colors"
                  onClick={() => trackPlinkoEvent(ANALYTICS_EVENTS.CLICK_SOCIAL, { platform: 'Telegram' })}
                >
                  Join Server
                </a>
              </div>
              
              <div className="bg-gray-800 bg-opacity-50 p-4 rounded-lg border border-purple-800 w-full md:w-auto flex-1 min-w-[200px] hover:bg-gray-800 hover:bg-opacity-60 transition-all transform hover:-translate-y-1">
                <div className="flex justify-center mb-3">
                  <div className="text-3xl">📰</div>
                </div>
                <h3 className="font-bold text-xl mb-1">Newsletter</h3>
                <p className="text-gray-400 mb-3">Subscribe for early token access</p>
                <a 
                  href="https://plinkoincinerator.substack.com" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-block bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-full transition-colors"
                  onClick={() => trackPlinkoEvent(ANALYTICS_EVENTS.CLICK_SOCIAL, { platform: 'Newsletter' })}
                >
                  Subscribe
                </a>
              </div>
            </div>
          </div>
        </section>
        
        {/* Partner Logos Section */}
        <section className="py-12 bg-transparent">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-8 bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent flex items-center justify-center">
              <span className="mr-3 text-4xl">🌟</span> 
              FEATURED ON 
              <span className="ml-3 text-4xl">🌟</span>
            </h2>
            
            <div className="relative overflow-hidden py-6">
              <div className="flex overflow-hidden py-4 carousel-container">
                <div className="animate-marquee flex">
                  <PartnerLogo 
                    src="/coinmarketcap.png" 
                    alt="CoinMarketCap" 
                    href="https://coinmarketcap.com/currencies/plinkoincinerator/"
                  />
                  <PartnerLogo 
                    src="/coingecko.png" 
                    alt="CoinGecko" 
                    href="https://www.coingecko.com/en/coins/plinkoincinerator"
                  />
                  <PartnerLogo 
                    src="/dexscreener.png" 
                    alt="DexScreener" 
                    href="https://dexscreener.com/solana/49Jy3P5J41zkcCgaveKXQfeUU3zNCHCSEEypkJTrpump"
                  />
                  <PartnerLogo 
                    src="/dextools.png" 
                    alt="DexTools" 
                    href="https://www.dextools.io/app/en/solana/pair-explorer/49Jy3P5J41zkcCgaveKXQfeUU3zNCHCSEEypkJTrpump"
                  />
                  <PartnerLogo 
                    src="/moontok.png" 
                    alt="MoonTok" 
                    href="https://moontok.io/token/solana/49Jy3P5J41zkcCgaveKXQfeUU3zNCHCSEEypkJTrpump"
                  />
                  <PartnerLogo 
                    src="/pumpfun.png" 
                    alt="Pump.fun" 
                    href="https://pump.fun/token/49Jy3P5J41zkcCgaveKXQfeUU3zNCHCSEEypkJTrpump"
                  />
                  
                  {/* Duplicate logos for continuous scrolling effect */}
                  <PartnerLogo 
                    src="/coinmarketcap.png" 
                    alt="CoinMarketCap" 
                    href="https://coinmarketcap.com/currencies/plinkoincinerator/"
                  />
                  <PartnerLogo 
                    src="/coingecko.png" 
                    alt="CoinGecko" 
                    href="https://www.coingecko.com/en/coins/plinkoincinerator"
                  />
                  <PartnerLogo 
                    src="/dexscreener.png" 
                    alt="DexScreener" 
                    href="https://dexscreener.com/solana/49Jy3P5J41zkcCgaveKXQfeUU3zNCHCSEEypkJTrpump"
                  />
                  <PartnerLogo 
                    src="/dextools.png" 
                    alt="DexTools" 
                    href="https://www.dextools.io/app/en/solana/pair-explorer/49Jy3P5J41zkcCgaveKXQfeUU3zNCHCSEEypkJTrpump"
                  />
                  <PartnerLogo 
                    src="/moontok.png" 
                    alt="MoonTok" 
                    href="https://moontok.io/token/solana/49Jy3P5J41zkcCgaveKXQfeUU3zNCHCSEEypkJTrpump"
                  />
                  <PartnerLogo 
                    src="/pumpfun.png"
                    alt="Pump.fun" 
                    href="https://pump.fun/token/49Jy3P5J41zkcCgaveKXQfeUU3zNCHCSEEypkJTrpump"
                  />
                </div>
              </div>
              
              {/* Gradient overlays for effect */}
              <div className="absolute top-0 bottom-0 left-0 w-16 bg-gradient-to-r from-transparent to-transparent pointer-events-none"></div>
              <div className="absolute top-0 bottom-0 right-0 w-16 bg-gradient-to-l from-transparent to-transparent pointer-events-none"></div>
            </div>
            
            <p className="text-gray-300 text-sm mt-5 max-w-lg mx-auto">$PLINC token is now listed on these major platforms. Click any logo to view our token details.</p>
          </div>
        </section>
        
        {/* Footer */}
        <Footer />
      </div>
    </>
  );
} 