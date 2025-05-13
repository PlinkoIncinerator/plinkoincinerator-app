import PlinkoIncinerator from './components/PlinkoIncinerator';
import ClientMetricsWrapper from './components/ClientMetricsWrapper';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import Header from './components/Header';
import Footer from './components/Footer';
import PlinkoClientWrapper from './components/PlinkoClientWrapper';
import WalletConnectButton from './components/WalletConnectButton';
import TokenBanner from './components/TokenBanner';
import LiveStatsWrapper from './components/LiveStatsWrapper';
import { ShareModalProvider } from './context/ShareModalContext';
import AppShareModal from './components/AppShareModal';

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
  return (
    <a 
      href={href} 
      target="_blank" 
      rel="noopener noreferrer" 
      className="mx-6 flex flex-col items-center justify-center bg-gray-800 bg-opacity-50 p-5 rounded-lg hover:bg-opacity-80 transition-all transform hover:-translate-y-1 hover:shadow-lg border border-gray-700 min-w-[150px]"
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

// FAQ Dropdown Component - convert to client component
import FAQSection from './components/FAQSection';

// Social Icon component
interface SocialIconProps {
  href: string;
  icon: string | React.ReactNode;
  label: string;
}

const SocialIcon = ({ href, icon, label }: SocialIconProps) => {
  return (
    <a 
      href={href} 
      target="_blank" 
      rel="noopener noreferrer" 
      className="flex items-center text-gray-400 hover:text-purple-400 transition-colors"
      aria-label={label}
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
  // Set some default values for the SSR render
  const randomTag = "BURN YOUR DUST, YOLO THE REST!";
  
  return (
    <ShareModalProvider>
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
          {/* Header */}
          <TokenBanner />
          <Header />
          
          {/* Main content */}
          <main className="container mx-auto md:px-4 px-0 py-12">
            {/* Hero Section */}
            <div className="mb-12 text-center max-w-3xl mx-auto px-4">
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
                  <div className="text-2xl font-bold text-green-400">0.00203928 <SolanaLogo width={16} height={14} /></div>
                  <div className="text-xs text-gray-400">PER EMPTY ACCOUNT</div>
                </div>
                <div className="bg-gray-800 bg-opacity-70 p-3 rounded-lg text-center min-w-32 relative overflow-hidden group hover:bg-gray-700 transition-all">
                  <div className="absolute inset-0 bg-purple-500 opacity-5 group-hover:opacity-10 transition-opacity"></div>
                  <div className="text-2xl font-bold text-purple-400">25x</div>
                  <div className="text-xs text-gray-400">MAX PLINKO MULTIPLIER</div>
                </div>
              </div>
              
              {/* Live Stats Counter */}
              <LiveStatsWrapper refreshInterval={30000} />
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
            <div className="bg-black bg-opacity-40 backdrop-blur-sm rounded-xl p-6 border border-purple-900 shadow-2xl mb-10 mx-4">
              <PlinkoIncinerator />
            </div>
            
            {/* Plinko Game Component - Use the client wrapper instead */}
            <PlinkoClientWrapper initialBalance={1000} />

            {/* Features Section */}
            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 px-4 md:px-0">
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
            <div className="mt-16 bg-black bg-opacity-40 backdrop-blur-sm rounded-xl p-6 border border-purple-900 shadow-2xl mx-4 md:mx-0">
              <h2 className="text-2xl font-bold mb-6 text-center bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent flex items-center justify-center">
                <span className="mr-2">📊</span> Live Plinko Stats <span className="animate-pulse ml-2">●</span>
              </h2>
              <ClientMetricsWrapper refreshInterval={60000} />
            </div>
          </main>
          
          {/* FAQ Section */}
          <FAQSection />
          
          {/* Social and Partners sections */}
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
                <div className="flex overflow-x-auto py-4 carousel-container">
                  <div className="flex">
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
                  </div>
                </div>
              </div>
              
              <p className="text-gray-300 text-sm mt-5 max-w-lg mx-auto">$PLINC token is now listed on these major platforms. Click any logo to view our token details.</p>
            </div>
          </section>
          
          {/* Footer */}
          <Footer />
          
          {/* Global ShareModal */}
          <AppShareModal />
        </div>
      </>
    </ShareModalProvider>
  );
} 