'use client';

import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function Roadmap() {
  const [activeTab, setActiveTab] = useState('business'); // 'business' or 'technical'

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-black text-white py-12 md:py-16">
        <Head>
          <title>PlinkoIncinerator Roadmap | Business & Tech Vision</title>
          <meta name="description" content="Our timeline for bringing next-level token burning and gaming to Solana." />
        </Head>
        
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-6xl font-extrabold mb-6 tracking-tight">
              <span className="bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
                Our Roadmap
              </span>
            </h1>
            <p className="text-lg md:text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed mb-10">
              Building the ultimate token burning platform with innovative gaming experiences. 
              Here's our vision for the future of PlinkoIncinerator.
            </p>
            
            {/* Roadmap Type Toggle */}
            <div className="flex justify-center mb-6">
              <div className="bg-gray-800 bg-opacity-50 rounded-full p-1.5 inline-flex">
                <button 
                  className={`px-6 py-2.5 rounded-full font-medium transition-all ${
                    activeTab === 'business' 
                      ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-lg' 
                      : 'text-gray-300 hover:text-white'
                  }`}
                  onClick={() => setActiveTab('business')}
                >
                  💼 Business
                </button>
                <button 
                  className={`px-6 py-2.5 rounded-full font-medium transition-all ${
                    activeTab === 'technical' 
                      ? 'bg-gradient-to-r from-blue-500 to-green-400 text-white shadow-lg' 
                      : 'text-gray-300 hover:text-white'
                  }`}
                  onClick={() => setActiveTab('technical')}
                >
                  ⚙️ Technical
                </button>
              </div>
            </div>
          </div>
          
          {/* Timeline Navigation */}
          <div className="flex justify-center mb-12 overflow-x-auto pb-4 hide-scrollbar gap-3 px-2">
            <a href="#q2-2025" className="px-5 py-2.5 bg-purple-800 bg-opacity-70 rounded-full hover:bg-opacity-90 transition-all whitespace-nowrap font-medium text-sm flex items-center gap-2 hover:transform hover:scale-105 border border-purple-500">
              <span className="h-2.5 w-2.5 rounded-full bg-pink-400 animate-pulse"></span>
              Q2 2025 - Current
            </a>
            <a href="#q3-2025-1" className="px-5 py-2.5 bg-gray-800 bg-opacity-50 rounded-full hover:bg-opacity-70 transition-all whitespace-nowrap font-medium text-sm flex items-center gap-2 hover:transform hover:scale-105">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-400"></span>
              Q3 2025 (Early)
            </a>
            <a href="#q3-2025-2" className="px-5 py-2.5 bg-gray-800 bg-opacity-50 rounded-full hover:bg-opacity-70 transition-all whitespace-nowrap font-medium text-sm flex items-center gap-2 hover:transform hover:scale-105">
              <span className="h-2.5 w-2.5 rounded-full bg-green-400"></span>
              Q3 2025 (Mid)
            </a>
            <a href="#q3-2025-3" className="px-5 py-2.5 bg-gray-800 bg-opacity-50 rounded-full hover:bg-opacity-70 transition-all whitespace-nowrap font-medium text-sm flex items-center gap-2 hover:transform hover:scale-105">
              <span className="h-2.5 w-2.5 rounded-full bg-purple-400"></span>
              Q3 2025 (Late)
            </a>
            <a href="#q4-2025-1" className="px-5 py-2.5 bg-gray-800 bg-opacity-50 rounded-full hover:bg-opacity-70 transition-all whitespace-nowrap font-medium text-sm flex items-center gap-2 hover:transform hover:scale-105">
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-400"></span>
              Q4 2025 (Early)
            </a>
            <a href="#q4-2025-2" className="px-5 py-2.5 bg-gray-800 bg-opacity-50 rounded-full hover:bg-opacity-70 transition-all whitespace-nowrap font-medium text-sm flex items-center gap-2 hover:transform hover:scale-105">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-400"></span>
              Q4 2025 (Late)
            </a>
          </div>
          
          {/* Business Roadmap Section */}
          <div className={`mb-20 transition-opacity duration-500 ${activeTab === 'business' ? 'opacity-100' : 'opacity-0 hidden'}`}>
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-pink-400 to-orange-400 bg-clip-text text-transparent inline-block tracking-tight">
                <span className="mr-2">💼</span> Business Roadmap
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto">Our strategy for growth, partnerships, and community building</p>
            </div>
            
            {/* Business Roadmap Timeline */}
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-1/2 transform -translate-x-1/2 top-0 bottom-0 w-1 bg-purple-700 opacity-50"></div>
              
              {/* Item 1 - Q2 2025 (Current) */}
              <div className="relative mb-16" id="q2-2025">
                <div className="absolute left-1/2 transform -translate-x-1/2 -top-3 w-6 h-6 rounded-full bg-pink-500 border-4 border-gray-900 z-10 shadow-lg pulse-glow-pink"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="md:text-right md:pr-8">
                    <div className="bg-gray-800 bg-opacity-50 rounded-lg p-5 border-l-4 md:border-l-0 md:border-r-4 border-pink-500 hover:bg-opacity-70 transition-all duration-300 shadow-lg transform hover:-translate-y-1">
                      <div className="flex justify-between items-center mb-3">
                        <span className="bg-pink-900 text-pink-200 text-xs py-1 px-3 rounded-full font-medium tracking-wide">Q2 2025 - Current</span>
                        <h3 className="text-xl font-bold text-pink-400">🌍 Community & Distribution</h3>
                      </div>
                      <p className="mb-3 leading-relaxed">Aggressive community growth and platform distribution strategy to maximize visibility.</p>
                      <ul className="mt-3 list-disc list-inside text-sm text-gray-300 space-y-1.5">
                        <li><span className="font-semibold text-pink-300">SEO Dominance:</span> Optimizing for token cleanup searches</li>
                        <li><span className="font-semibold text-pink-300">Reddit & X:</span> Targeted engagement in crypto communities</li>
                        <li><span className="font-semibold text-pink-300">Content Strategy:</span> Educational materials on token management</li>
                        <li><span className="font-semibold text-pink-300">Discord:</span> Server expansion with special roles and rewards</li>
                      </ul>
                    </div>
                  </div>
                  <div></div>
                </div>
              </div>
              
              {/* Item 2 - Q3 2025 (Early) */}
              <div className="relative mb-16" id="q3-2025-1">
                <div className="absolute left-1/2 transform -translate-x-1/2 -top-3 w-6 h-6 rounded-full bg-blue-500 border-4 border-gray-900 z-10 shadow-lg"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div></div>
                  <div className="md:pl-8">
                    <div className="bg-gray-800 bg-opacity-50 rounded-lg p-5 border-l-4 border-blue-500 hover:bg-opacity-70 transition-all duration-300 shadow-lg transform hover:-translate-y-1">
                      <div className="flex justify-between items-center mb-3">
                        <span className="bg-blue-900 text-blue-200 text-xs py-1 px-3 rounded-full font-medium tracking-wide">Q3 2025 (Early)</span>
                        <h3 className="text-xl font-bold text-blue-400">🤝 Top-Tier Partnerships</h3>
                      </div>
                      <p className="mb-3 leading-relaxed">Strategic partnerships with major Solana players and market visibility platforms.</p>
                      <ul className="mt-3 list-disc list-inside text-sm text-gray-300 space-y-1.5">
                        <li><span className="font-semibold text-blue-300">Wallet Integrations:</span> Phantom, Solflare, Backpack</li>
                        <li><span className="font-semibold text-blue-300">Market Listings:</span> CoinMarketCap, CoinGecko verified profiles</li>
                        <li><span className="font-semibold text-blue-300">Liquidity Partners:</span> Raydium, Jupiter Protocol</li>
                        <li><span className="font-semibold text-blue-300">Ecosystem Giants:</span> Collaboration with top Solana projects</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Item 3 - Q3 2025 (Mid) */}
              <div className="relative mb-16" id="q3-2025-2">
                <div className="absolute left-1/2 transform -translate-x-1/2 -top-3 w-6 h-6 rounded-full bg-green-500 border-4 border-gray-900 z-10 shadow-lg"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="md:text-right md:pr-8">
                    <div className="bg-gray-800 bg-opacity-50 rounded-lg p-5 border-l-4 md:border-l-0 md:border-r-4 border-green-500 hover:bg-opacity-70 transition-all duration-300 shadow-lg transform hover:-translate-y-1">
                      <div className="flex justify-between items-center mb-3">
                        <span className="bg-green-900 text-green-200 text-xs py-1 px-3 rounded-full font-medium tracking-wide">Q3 2025 (Mid)</span>
                        <h3 className="text-xl font-bold text-green-400">🎪 Events & Merchandise</h3>
                      </div>
                      <p className="mb-3 leading-relaxed">Physical presence at major Solana ecosystem events with exclusive merchandise for community members.</p>
                      <ul className="mt-3 list-disc list-inside text-sm text-gray-300 space-y-1.5">
                        <li><span className="font-semibold text-green-300">Solana Breakpoint:</span> Premier booth with live demonstrations</li>
                        <li><span className="font-semibold text-green-300">Regional Meetups:</span> Targeted events in crypto hubs</li>
                        <li><span className="font-semibold text-green-300">Limited Merch:</span> Exclusive apparel for top community contributors</li>
                        <li><span className="font-semibold text-green-300">Event Hackathons:</span> On-site competitions with valuable prizes</li>
                      </ul>
                    </div>
                  </div>
                  <div></div>
                </div>
              </div>
              
              {/* Item 4 - Q3 2025 (Late) */}
              <div className="relative mb-16" id="q3-2025-3">
                <div className="absolute left-1/2 transform -translate-x-1/2 -top-3 w-6 h-6 rounded-full bg-purple-500 border-4 border-gray-900 z-10 shadow-lg"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div></div>
                  <div className="md:pl-8">
                    <div className="bg-gray-800 bg-opacity-50 rounded-lg p-5 border-l-4 border-purple-500 hover:bg-opacity-70 transition-all duration-300 shadow-lg transform hover:-translate-y-1">
                      <div className="flex justify-between items-center mb-3">
                        <span className="bg-purple-900 text-purple-200 text-xs py-1 px-3 rounded-full font-medium tracking-wide">Q3 2025 (Late)</span>
                        <h3 className="text-xl font-bold text-purple-400">🌴 Bali Summit Retreat</h3>
                      </div>
                      <p className="mb-3 leading-relaxed">Exclusive tropical retreat bringing together the community, key partners, and industry leaders.</p>
                      <ul className="mt-3 list-disc list-inside text-sm text-gray-300 space-y-1.5">
                        <li>Luxury beachfront conference for top token holders and partners</li>
                        <li>Invite-only strategic planning sessions with key industry figures</li>
                        <li>Major product announcements and roadmap unveiling</li>
                        <li>High-value networking events with potential investors</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Item 5 - Q4 2025 (Early) */}
              <div className="relative mb-16" id="q4-2025-1">
                <div className="absolute left-1/2 transform -translate-x-1/2 -top-3 w-6 h-6 rounded-full bg-yellow-500 border-4 border-gray-900 z-10 shadow-lg"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="md:text-right md:pr-8">
                    <div className="bg-gray-800 bg-opacity-50 rounded-lg p-5 border-l-4 md:border-l-0 md:border-r-4 border-yellow-500 hover:bg-opacity-70 transition-all duration-300 shadow-lg transform hover:-translate-y-1">
                      <div className="flex justify-between items-center mb-3">
                        <span className="bg-yellow-900 text-yellow-200 text-xs py-1 px-3 rounded-full font-medium tracking-wide">Q4 2025 (Early)</span>
                        <h3 className="text-xl font-bold text-yellow-400">🌐 Global Expansion</h3>
                      </div>
                      <p className="mb-3 leading-relaxed">Taking PlinkoIncinerator worldwide with strategic marketing campaigns and localization.</p>
                      <ul className="mt-3 list-disc list-inside text-sm text-gray-300 space-y-1.5">
                        <li>Localization for 10+ languages</li>
                        <li>Regional ambassador program across major markets</li>
                        <li>Strategic partnerships with international exchanges</li>
                        <li>Institutional investment round to fuel growth</li>
                      </ul>
                    </div>
                  </div>
                  <div></div>
                </div>
              </div>
              
              {/* Item 6 - Q4 2025 (Late) */}
              <div className="relative mb-16" id="q4-2025-2">
                <div className="absolute left-1/2 transform -translate-x-1/2 -top-3 w-6 h-6 rounded-full bg-indigo-500 border-4 border-gray-900 z-10 shadow-lg pulse-glow-indigo"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div></div>
                  <div className="md:pl-8">
                    <div className="bg-gray-800 bg-opacity-50 rounded-lg p-5 border-l-4 border-indigo-500 hover:bg-opacity-70 transition-all duration-300 shadow-lg transform hover:-translate-y-1">
                      <div className="flex justify-between items-center mb-3">
                        <span className="bg-indigo-900 text-indigo-200 text-xs py-1 px-3 rounded-full font-medium tracking-wide">Q4 2025 (Late)</span>
                        <h3 className="text-xl font-bold text-indigo-400">🌙 ??? Moon Phase ???</h3>
                      </div>
                      <p className="mb-3 leading-relaxed">Secret phase with ambitious initiatives that will be revealed when the time is right...</p>
                      <div className="mt-3 bg-gray-900 bg-opacity-50 rounded-lg p-4 border border-indigo-900">
                        <div className="flex items-center justify-center space-x-2">
                          <span className="animate-ping h-2 w-2 rounded-full bg-indigo-400 opacity-75"></span>
                          <span className="animate-ping h-2 w-2 rounded-full bg-indigo-400 opacity-75 delay-75"></span>
                          <span className="animate-ping h-2 w-2 rounded-full bg-indigo-400 opacity-75 delay-150"></span>
                          <span className="animate-ping h-2 w-2 rounded-full bg-indigo-400 opacity-75 delay-300"></span>
                          <span className="animate-ping h-2 w-2 rounded-full bg-indigo-400 opacity-75 delay-500"></span>
                        </div>
                        <p className="text-center text-indigo-300 mt-3 italic">Stay tuned for the next phase of our journey...</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Technical Roadmap Section */}
          <div className={`mb-20 transition-opacity duration-500 ${activeTab === 'technical' ? 'opacity-100' : 'opacity-0 hidden'}`}>
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-blue-400 to-green-400 bg-clip-text text-transparent inline-block tracking-tight">
                <span className="mr-2">⚙️</span> Technical Roadmap
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto">Our development milestones for platform features and innovation</p>
            </div>
            
            {/* Technical Roadmap Timeline */}
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-1/2 transform -translate-x-1/2 top-0 bottom-0 w-1 bg-green-700 opacity-50"></div>
              
              {/* Item 1 - Current - LEFT */}
              <div className="relative mb-16">
                <div className="absolute left-1/2 transform -translate-x-1/2 -top-3 w-6 h-6 rounded-full bg-red-500 border-4 border-gray-900 z-10 shadow-lg pulse-glow-red"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="md:text-right md:pr-8">
                    <div className="bg-gray-800 bg-opacity-50 rounded-lg p-5 border-l-4 md:border-l-0 md:border-r-4 border-red-500 hover:bg-opacity-70 transition-all duration-300 shadow-lg transform hover:-translate-y-1">
                      <div className="flex justify-between items-center mb-3">
                        <span className="bg-red-900 text-red-200 text-xs py-1 px-3 rounded-full font-medium tracking-wide">Q2 2025 - Current</span>
                        <h3 className="text-xl font-bold text-red-400">🔥 Platform Optimization</h3>
                      </div>
                      <p className="mb-3 leading-relaxed">Enhanced usability, user feedback implementation, and advanced token burning features.</p>
                      <ul className="mt-3 list-disc list-inside text-sm text-gray-300 space-y-1.5">
                        <li><span className="font-semibold text-red-300">User Experience:</span> Streamlined interface based on community feedback</li>
                        <li><span className="font-semibold text-red-300">Feedback System:</span> Integrated platform for user suggestions and reports</li>
                        <li><span className="font-semibold text-red-300">Burn Mechanics:</span> Advanced options for token selection and threshold settings</li>
                        <li><span className="font-semibold text-red-300">Performance:</span> Speed and reliability improvements across all features</li>
                      </ul>
                    </div>
                  </div>
                  <div></div>
                </div>
              </div>
              
              {/* Item 2 - Q3 2025 (Early) - RIGHT */}
              <div className="relative mb-16">
                <div className="absolute left-1/2 transform -translate-x-1/2 -top-3 w-6 h-6 rounded-full bg-indigo-500 border-4 border-gray-900 z-10 shadow-lg"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div></div>
                  <div className="md:pl-8">
                    <div className="bg-gray-800 bg-opacity-50 rounded-lg p-5 border-l-4 border-indigo-500 hover:bg-opacity-70 transition-all duration-300 shadow-lg transform hover:-translate-y-1">
                      <div className="flex justify-between items-center mb-3">
                        <span className="bg-indigo-900 text-indigo-200 text-xs py-1 px-3 rounded-full font-medium tracking-wide">Q3 2025 (Early)</span>
                        <h3 className="text-xl font-bold text-indigo-400">🎮 Gaming Ecosystem</h3>
                      </div>
                      <p className="mb-3 leading-relaxed">Expanding our entertainment offerings with multiple new provably fair games.</p>
                      <ul className="mt-3 list-disc list-inside text-sm text-gray-300 space-y-1.5">
                        <li>Multiple new game formats with different skill/luck balances</li>
                        <li>Unified rewards and loyalty system across all games</li>
                        <li>Competitive tournaments with prize pools</li>
                        <li>Global leaderboards with seasonal rankings</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Item 3 - Q3 2025 (Mid) - LEFT */}
              <div className="relative mb-16">
                <div className="absolute left-1/2 transform -translate-x-1/2 -top-3 w-6 h-6 rounded-full bg-teal-500 border-4 border-gray-900 z-10 shadow-lg"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="md:text-right md:pr-8">
                    <div className="bg-gray-800 bg-opacity-50 rounded-lg p-5 border-l-4 md:border-l-0 md:border-r-4 border-teal-500 hover:bg-opacity-70 transition-all duration-300 shadow-lg transform hover:-translate-y-1">
                      <div className="flex justify-between items-center mb-3">
                        <span className="bg-teal-900 text-teal-200 text-xs py-1 px-3 rounded-full font-medium tracking-wide">Q3 2025 (Mid)</span>
                        <h3 className="text-xl font-bold text-teal-400">📱 Wallet Integration & Apps</h3>
                      </div>
                      <p className="mb-3 leading-relaxed">Native integration with major wallets and dedicated mobile applications for a seamless experience.</p>
                      <ul className="mt-3 list-disc list-inside text-sm text-gray-300 space-y-1.5">
                        <li><span className="font-semibold text-teal-300">Wallet Extensions:</span> Direct integration with major wallet providers</li>
                        <li><span className="font-semibold text-teal-300">Mobile Apps:</span> Native iOS and Android applications</li>
                        <li><span className="font-semibold text-teal-300">Push Notifications:</span> Real-time alerts for transactions and events</li>
                        <li><span className="font-semibold text-teal-300">One-Click Operations:</span> Streamlined processes for common actions</li>
                      </ul>
                    </div>
                  </div>
                  <div></div>
                </div>
              </div>
              
              {/* Item 4 - Q3 2025 (Late) - RIGHT */}
              <div className="relative mb-16">
                <div className="absolute left-1/2 transform -translate-x-1/2 -top-3 w-6 h-6 rounded-full bg-purple-500 border-4 border-gray-900 z-10 shadow-lg"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div></div>
                  <div className="md:pl-8">
                    <div className="bg-gray-800 bg-opacity-50 rounded-lg p-5 border-l-4 border-purple-500 hover:bg-opacity-70 transition-all duration-300 shadow-lg transform hover:-translate-y-1">
                      <div className="flex justify-between items-center mb-3">
                        <span className="bg-purple-900 text-purple-200 text-xs py-1 px-3 rounded-full font-medium tracking-wide">Q3 2025 (Late)</span>
                        <h3 className="text-xl font-bold text-purple-400">💰 $PLINC Staking Protocol</h3>
                      </div>
                      <p className="mb-3 leading-relaxed">Passive income for $PLINC holders through our innovative staking mechanism.</p>
                      <ul className="mt-3 list-disc list-inside text-sm text-gray-300 space-y-1.5">
                        <li><span className="font-semibold text-purple-300">Tiered Rewards:</span> Higher APY for longer lock periods</li>
                        <li><span className="font-semibold text-purple-300">Fee Sharing:</span> Earn a share of platform fees</li>
                        <li><span className="font-semibold text-purple-300">Governance Rights:</span> Voting power on protocol decisions</li>
                        <li><span className="font-semibold text-purple-300">Boosted Multipliers:</span> Enhanced game rewards for stakers</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Item 5 - Q4 2025 (Early) - LEFT */}
              <div className="relative mb-16">
                <div className="absolute left-1/2 transform -translate-x-1/2 -top-3 w-6 h-6 rounded-full bg-blue-500 border-4 border-gray-900 z-10 shadow-lg"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="md:text-right md:pr-8">
                    <div className="bg-gray-800 bg-opacity-50 rounded-lg p-5 border-l-4 md:border-l-0 md:border-r-4 border-blue-500 hover:bg-opacity-70 transition-all duration-300 shadow-lg transform hover:-translate-y-1">
                      <div className="flex justify-between items-center mb-3">
                        <span className="bg-blue-900 text-blue-200 text-xs py-1 px-3 rounded-full font-medium tracking-wide">Q4 2025 (Early)</span>
                        <h3 className="text-xl font-bold text-blue-400">🌉 Multichain Expansion</h3>
                      </div>
                      <p className="mb-3 leading-relaxed">Support for ETH, BNB, and more — burn and play with dust from across ecosystems.</p>
                      <ul className="mt-3 list-disc list-inside text-sm text-gray-300 space-y-1.5">
                        <li>Ethereum integration via wormhole bridge</li>
                        <li>BNB Chain support for token cleanup</li>
                        <li>Polygon and Avalanche integration</li>
                        <li>Cross-chain leaderboards and unified experience</li>
                      </ul>
                    </div>
                  </div>
                  <div></div>
                </div>
              </div>
              
              {/* Item 6 - Q4 2025 (Late) - RIGHT */}
              <div className="relative mb-16">
                <div className="absolute left-1/2 transform -translate-x-1/2 -top-3 w-6 h-6 rounded-full bg-green-500 border-4 border-gray-900 z-10 shadow-lg"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div></div>
                  <div className="md:pl-8">
                    <div className="bg-gray-800 bg-opacity-50 rounded-lg p-5 border-l-4 border-green-500 hover:bg-opacity-70 transition-all duration-300 shadow-lg transform hover:-translate-y-1">
                      <div className="flex justify-between items-center mb-3">
                        <span className="bg-green-900 text-green-200 text-xs py-1 px-3 rounded-full font-medium tracking-wide">Q4 2025 (Late)</span>
                        <h3 className="text-xl font-bold text-green-400">🚀 Developer API & Ecosystem</h3>
                      </div>
                      <p className="mb-3 leading-relaxed">Empowering developers to build on our platform with comprehensive tools and integration options.</p>
                      <ul className="mt-3 list-disc list-inside text-sm text-gray-300 space-y-1.5">
                        <li>Public API for third-party integrations</li>
                        <li>Developer documentation and resources</li>
                        <li>Community grants for innovative projects</li>
                        <li>Partnership program for complementary services</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Back to top button */}
          <div className="flex justify-center mt-16 mb-8">
            <a 
              href="#" 
              className="px-6 py-3 bg-purple-900 bg-opacity-50 rounded-full hover:bg-opacity-70 transition-all flex items-center gap-2"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              <span>Back to top</span>
            </a>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}