'use client'

import { useState, useEffect, FormEvent } from 'react'
import { FaTwitter, FaTelegram, FaCopy, FaShare, FaUsers, FaGift, FaCoins, FaRocket, FaMoneyBillWave, FaFire } from 'react-icons/fa'
import { useSocial } from "../context/SocialContext"
import SocialConnectPortal from '../components/social/SocialConnectPortal'
import { useDynamicContext } from "@dynamic-labs/sdk-react-core"
import Header from '../components/Header'
import Footer from '../components/Footer'
import Image from 'next/image'

// API URL for server requests
const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333').replace(/\/api\/?$/, '');

// Helper function to generate a local referral code when API is not available
const generateLocalReferralCode = (username: string): string => {
  // First try using the username directly
  if (username && username.length >= 3) {
    return username.toUpperCase();
  }
  
  // If username is too short or empty, use the original logic with prefixes and random chars
  const prefix = username.substring(0, 5).toUpperCase();
  const random1 = Math.random().toString(36).substring(2, 6);
  const random2 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${random1}-${random2}`;
};

// Cache for social connection results to avoid duplicate API calls
const socialConnectionCache = new Map<string, string | null>();

// Save social connection to the API
const saveSocialConnection = async (
  socialData: { username: string; displayName: string; avatar: string; provider: 'telegram' | 'x' },
  walletAddress: string = ''
): Promise<string | null> => {
  try {
    console.log(`Saving social connection for ${socialData.provider} with wallet: ${walletAddress || 'none'}`);
    console.log(`Will attempt to use username ${socialData.username.toUpperCase()} as referral code if available`);
    
    // Ensure we have all required fields and use fallbacks
    const displayName = socialData.displayName || socialData.username || '';
    const username = socialData.username || '';
    const provider = socialData.provider || '';
    
    if (!provider || !username) {
      console.error('Missing required provider or username fields');
      return null;
    }

    // Check cache first to avoid duplicate API calls
    const cacheKey = `${provider}:${username}:${walletAddress}`;
    if (socialConnectionCache.has(cacheKey)) {
      console.log('Using cached referral code');
      return socialConnectionCache.get(cacheKey) || null;
    }

    const apiUrl = `${API_URL}/api/social/connect`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress,
        provider,
        providerId: '',
        username,
        displayName,
        avatarUrl: socialData.avatar || ''
      })
    });
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      console.error(`Failed to save social connection: ${response.status}`);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      throw new Error('Failed to save social connection');
    }
    
    const data = await response.json();
    console.log('Social connection saved successfully:', data);
    const referralCode = data?.data?.referralCode || null;
    console.log('Generated referral code:', referralCode);
    
    // Cache the result
    socialConnectionCache.set(cacheKey, referralCode);
    
    return referralCode;
  } catch (error) {
    console.error('Error saving social connection:', error);
    return null;
  }
};

// Generate referral code from API or fallback to local generation
const generateReferralCode = async (
  socialData: { username: string; displayName: string; avatar: string; provider: 'telegram' | 'x' }[],
  walletAddress: string = ''
): Promise<string> => {
  if (!socialData || socialData.length === 0) {
    return '';
  }

  const lastSocialData = socialData[socialData.length - 1];
  console.log('Generating referral code for user:', lastSocialData.username);
  
  try {
    // Try to save via API first and get a code - wallet address is optional
    const savedCode = await saveSocialConnection(lastSocialData, walletAddress);
    console.log('API referral code result:', savedCode);
    
    // If API call succeeded and we got a code, use it
    if (savedCode) {
      return savedCode;
    }
    
    // If API failed or didn't return a code, generate a local one as fallback
    const localCode = generateLocalReferralCode(lastSocialData.username);
    console.log('Using locally generated code:', localCode);
    return localCode;
  } catch (error) {
    console.error('Error generating referral code:', error);
    
    // Generate local code if there's an error
    const localCode = generateLocalReferralCode(lastSocialData.username);
    console.log('Fallback local referral code generated after error:', localCode);
    return localCode;
  }
};


// Fetch referral data for a wallet
const fetchReferralData = async (walletAddress: string) => {
  try {
    const response = await fetch(`${API_URL}/api/referrals/${walletAddress}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch referral data');
    }
    
    const data = await response.json();
    
    if (data.status === 'success') {
      return {
        code: data.data.referralCode,
        username: data.data.username,
        referredUsers: data.data.referrals.map((ref: any) => ref.referred_wallet),
        rewards: data.data.availableRewards,
        referralStats: data.data.referralStats || {
          avgReferralPayout: 0,
          totalHouseProfit: 0,
          payoutPotential: 0,
          referralRate: 0.20
        }
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching referral data:', error);
    return null;
  }
};

// Fetch referral data by social profile
const fetchReferralDataBySocial = async (provider: string, username: string) => {
  try {
    const response = await fetch(`${API_URL}/api/referrals/social/${provider}/${username}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch referral data by social profile');
    }
    
    const data = await response.json();
    
    if (data.status === 'success') {
      return {
        code: data.data.referralCode,
        username: data.data.username,
        referredUsers: data.data.referrals.map((ref: any) => ref.referred_wallet),
        rewards: data.data.availableRewards,
        referralStats: data.data.referralStats || {
          avgReferralPayout: 0,
          totalHouseProfit: 0,
          payoutPotential: 0,
          referralRate: 0.20
        }
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching referral data by social:', error);
    return null;
  }
};

// Claim rewards for referrals
const claimReferralReward = async (amount: number, walletAddress: string): Promise<boolean> => {
  if (!walletAddress) {
    console.error('No wallet connected');
    return false;
  }
  
  try {
    const response = await fetch(`${API_URL}/api/referrals/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress,
        amount
      })
    });
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    return data.status === 'success';
  } catch (error) {
    console.error('Error claiming referral rewards:', error);
    return false;
  }
};

// Update wallet address for existing social connection
const updateWalletForSocial = async (
  socialData: { username: string; provider: 'telegram' | 'x' },
  walletAddress: string
): Promise<string | null> => {
  try {
    console.log(`Updating wallet address for ${socialData.provider} user ${socialData.username}`);
    console.log(`Attempting to use username ${socialData.username.toUpperCase()} as referral code if available`);
    
    const response = await fetch(`${API_URL}/api/social/update-wallet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress,
        provider: socialData.provider,
        username: socialData.username
      })
    });
    
    if (!response.ok) {
      console.error(`Failed to update wallet address: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    console.log('Wallet address updated successfully:', data);
    console.log('Generated referral code:', data?.data?.referralCode);
    return data?.data?.referralCode || null;
  } catch (error) {
    console.error('Error updating wallet address:', error);
    return null;
  }
};

export default function ReferralsPage() {
  const [showSocialModal, setShowSocialModal] = useState(false)
  const [referralCode, setReferralCode] = useState<string>('')
  const [referralLink, setReferralLink] = useState<string>('')
  const [referredUsers, setReferredUsers] = useState<string[]>([])
  const [availableRewards, setAvailableRewards] = useState(0)
  const [claimAmount, setClaimAmount] = useState(0)
  const [applyCode, setApplyCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [applying, setApplying] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [applyStatus, setApplyStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [isGenerating, setIsGenerating] = useState(false)
  const [referralStats, setReferralStats] = useState<{
    avgReferralPayout: number;
    totalHouseProfit: number;
    payoutPotential: number;
    referralRate: number;
  }>({
    avgReferralPayout: 0,
    totalHouseProfit: 0,
    payoutPotential: 0,
    referralRate: 0.20
  })
  const [referral, setReferral] = useState<{
    code: string; 
    username?: string;
    referredUsers: string[]; 
    rewards: number;
    referralStats?: {
      avgReferralPayout: number;
      totalHouseProfit: number;
      payoutPotential: number;
      referralRate: number;
    };
  } | null>(null)
  
  const { socialData } = useSocial()
  const { primaryWallet, user } = useDynamicContext()
  const walletAddress = user?.verifiedCredentials?.[0]?.address || '';



  // Fetch referral data - first try by social account, then by wallet as backup
  useEffect(() => {
    const fetchData = async () => {

      console.log('socialData', socialData);
      console.log('walletAddress', walletAddress);
      // If we have social data and wallet address, try to fetch by social first
      if (socialData.length > 0) {
        const lastSocial = socialData[socialData.length - 1];

        console.log('lastSocial', lastSocial);
        console.log('lastSocial.provider', lastSocial.provider);
        const referralData = await fetchReferralDataBySocial(
          lastSocial.provider, 
          lastSocial.username
        );
        
        if (referralData && referralData.code) {
          console.log('Fetched referral data by social account:', referralData);
          setReferral(referralData);
          return;
        }
      }
      
      // Fallback to wallet if available
      if (walletAddress) {
        try {
          const walletData = await fetchReferralData(walletAddress);
          if (walletData) {
            console.log('Fetched referral data by wallet:', walletData);
            setReferral(walletData);
          }
        } catch (err) {
          console.error('Error fetching referral data by wallet:', err);
        }
      }
    };
    
    fetchData();
  }, [socialData, walletAddress]);

  // Update wallet address for social connection when wallet connects
  useEffect(() => {
    const updateWallet = async () => {
      if (socialData.length > 0 && walletAddress && referralCode && !referral && !isGenerating) {
        console.log('Wallet connected after social account, updating social connection with wallet address');
        
        try {
          // Update the social connection with the wallet address
          const code = await updateWalletForSocial(socialData[socialData.length - 1], walletAddress);
          if (code) {
            console.log('Updated referral code:', code);
            // Refresh referral data
            const data = await fetchReferralDataBySocial(
              socialData[socialData.length - 1].provider,
              socialData[socialData.length - 1].username
            );
            if (data) {
              setReferral(data);
            }
          }
        } catch (err) {
          console.error('Error updating wallet address for social connection:', err);
        }
      }
    };
    
    updateWallet();
  }, [socialData, walletAddress, referralCode, referral, isGenerating]);

  // Generate/fetch referral code when component mounts or social connections change
  useEffect(() => {
    console.log('Referrals page - checking prerequisites for referral code generation');
    console.log('Social data length:', socialData.length);
    
    const generateCode = async () => {
      console.log('socialData', socialData);
      console.log('walletAddress', walletAddress);
      console.log('isGenerating', isGenerating);
      console.log('referralCode', referralCode);

      // Only check if we have social data, are not already generating, and don't already have a code
      if (socialData.length > 0 && !isGenerating && !referralCode) {
        setIsGenerating(true);
        try {
          console.log('Generating referral code for social account:', socialData[0].username);
          // Generate code without requiring wallet address
          const newCode = await generateReferralCode(socialData, walletAddress || '');
          if (newCode) {
            setReferralCode(newCode);
            
            // Only try to fetch referral data using social profile if wallet is connected
            if (walletAddress) {
              const lastSocial = socialData[socialData.length - 1];
              try {
                const data = await fetchReferralDataBySocial(
                  lastSocial.provider,
                  lastSocial.username
                );
                
                if (data) {
                  setReferral(data);
                }
              } catch (socialErr) {
                console.error('Error fetching referral data by social after code generation:', socialErr);
                
                // Fallback to wallet data
                const walletData = await fetchReferralData(walletAddress);
                if (walletData) {
                  setReferral(walletData);
                }
              }
            }
          }
        } catch (err) {
          console.error('Error generating referral code:', err);
        } finally {
          setIsGenerating(false);
        }
      }
    };
    
    generateCode();
  }, [socialData, walletAddress, isGenerating, referralCode]);

  // Update UI when referral data changes
  useEffect(() => {
    if (referral) {
      console.log('Referral data updated:', referral);
      setReferralCode(referral.code);
      setReferredUsers(referral.referredUsers);
      setAvailableRewards(referral.rewards);
      
      // Update referral stats if available
      if (referral.referralStats) {
        setReferralStats(referral.referralStats);
      }
      
      // Create shareable link with the referral code
      if (referral.code) {
        const baseUrl = window.location.origin;
        setReferralLink(`${baseUrl}/?code=${referral.code}`);
      }
    } else {
      // If no referral data but we have a referral code (locally generated), create the shareable link
      if (referralCode) {
        console.log('Using locally generated referral code:', referralCode);
        const baseUrl = window.location.origin;
        setReferralLink(`${baseUrl}/?code=${referralCode}`);
      } else {
        setReferredUsers([]);
        setAvailableRewards(0);
      }
    }
  }, [referral, referralCode]);

  const copyReferralLink = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };


  const handleClaimRewards = async () => {
    if (claimAmount <= 0 || claimAmount > availableRewards || claiming || !walletAddress) return;
    
    setClaiming(true);
    
    try {
      const result = await claimReferralReward(claimAmount, walletAddress);
      if (result) {
        // Update UI after successful claim
        setAvailableRewards(prev => prev - claimAmount);
        setClaimAmount(0);
        
        // Refresh referral data - only try social if the user is logged in
        if (socialData.length > 0 && walletAddress) {
          const lastSocial = socialData[socialData.length - 1];
          try {
            const data = await fetchReferralDataBySocial(
              lastSocial.provider,
              lastSocial.username
            );
            if (data) {
              setReferral(data);
              return;
            }
          } catch (err) {
            console.error('Error fetching referral data by social after claim:', err);
          }
        }
        
        // Fallback to wallet address
        const data = await fetchReferralData(walletAddress);
        if (data) {
          setReferral(data);
        }
      }
    } catch (error) {
      console.error('Error claiming rewards:', error);
    } finally {
      setClaiming(false);
    }
  };

  const shareToTwitter = () => {
    if (!referralCode) return;
    
    const text = `Check out PlinkoIncinerator! Recover your SOL dust with super cheap fees and play to win more, if you want.`;
    const url = referralLink;
    const hashtags = 'Solana,SolDust,Crypto';
    
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&hashtags=${hashtags}`,
      '_blank'
    );
  };

  const shareToTelegram = () => {
    if (!referralCode) return;
    
    const usernameText = referral?.username ? ` (@${referral.username})` : '';
    const text = `Check out PlinkoIncinerator! Recover your SOL dust with super cheap fees and play to win more, if you want.`;
    const url = referralLink;
    
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      '_blank'
    );
  };

  const shareReferral = async () => {
    if (!referralCode) return;
    
    try {
      const text = `Check out PlinkoIncinerator! Recover your SOL dust with super cheap fees and play to win more, if you want.`;
      
      if (navigator.share) {
        await navigator.share({
          title: 'Recover your SOL dust with PlinkoIncinerator',
          text: text,
          url: referralLink
        });
      } else {
        // Fallback for browsers that don't support the Web Share API
        copyReferralLink();
      }
    } catch (error) {
      console.error('Error sharing:', error);
      // Fallback to copying the link
      copyReferralLink();
    }
  };

  // Manual application of referral code
  const handleApplyReferralCode = async () => {
    if (!applyCode || !walletAddress) return;
    
    setApplying(true);
    
    try {
      const response = await fetch(`${API_URL}/api/referrals/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress,
          referralCode: applyCode
        })
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setApplyStatus('success');
        // Refresh referral data after applying code
        const walletData = await fetchReferralData(walletAddress);
        if (walletData) {
          setReferral(walletData);
        }
      } else {
        setApplyStatus('error');
      }
    } catch (error) {
      console.error('Error applying referral code:', error);
      setApplyStatus('error');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-black text-white">
      <Header />
      
      <main className="container mx-auto px-4 py-24">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-center mb-6">
            <Image 
              src="/logo_no_bg.png" 
              alt="PlinkoIncinerator Logo" 
              width={100} 
              height={100}
              className="animate-pulse"
            />
          </div>
        
          <h1 className="text-3xl md:text-5xl font-bold mb-4 text-center">
            <span className="bg-gradient-to-r from-orange-400 via-pink-500 to-purple-600 bg-clip-text text-transparent">
              SHILL TO FRIENDS,
            </span>
            <br />
            <span className="bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
              EARN WHILE YOU SLEEP
            </span>
          </h1>
          
          <div className="bg-black bg-opacity-50 p-4 rounded-xl mb-8 transform rotate-1">
            <p className="text-xl md:text-2xl font-bold text-yellow-300 text-center">
              🤑 YOUR REFERRAL LINK = PASSIVE INCOME 🤑
            </p>
          </div>
          
          <div className="bg-gradient-to-r from-green-900/30 to-blue-900/30 p-4 rounded-lg border border-green-500/30 mb-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-center md:text-left">
                <h3 className="text-xl font-bold text-white mb-1">Super Low Fees - More Winnings</h3>
                <p className="text-gray-300">PlinkoIncinerator lets you recover SOL dust with minimal fees. Share your code and earn rewards!</p>
              </div>
              <div className="bg-black/30 px-4 py-2 rounded-lg text-center">
                <p className="text-sm text-gray-400">Fee Rate</p>
                <p className="text-xl font-bold text-green-400">Only 2.1%</p>
              </div>
            </div>
          </div>
          
          <p className="text-gray-300 text-center mb-12 max-w-2xl mx-auto">
            Got SOL dust in your wallet? <span className="text-pink-400 font-bold">Recover it</span> with our super <span className="text-amber-400 font-bold">low 2.1% fee</span> and play for bigger rewards!
          </p>
          
          {/* Social Connect Status */}
          <div className="bg-black bg-opacity-50 backdrop-blur-sm rounded-xl p-6 border border-purple-900 shadow-xl mb-10">
            <div className="flex items-center gap-3 mb-4">
              <FaRocket className="text-pink-500 w-6 h-6" />
              <h2 className="text-2xl font-bold bg-gradient-to-r from-pink-400 to-purple-600 bg-clip-text text-transparent">Step 1: Connect Your Socials</h2>
            </div>
            <p className="text-gray-400 mb-6">
              Your X/Twitter or Telegram account is your ticket to the referral program. No KYC, just vibes.
            </p>
            
            {socialData.length > 0 ? (
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                {socialData.map((social, index) => (
                  <div key={index} className="flex-1 bg-gray-800 bg-opacity-50 p-4 rounded-lg border border-gray-700 transform hover:scale-105 transition-transform">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {social.provider === 'x' ? (
                          <FaTwitter className="text-white w-6 h-6" />
                        ) : (
                          <FaTelegram className="text-[#229ED9] w-6 h-6" />
                        )}
                        <div>
                          <span className="text-white font-medium">{social.provider === 'x' ? 'X (Twitter)' : 'Telegram'}</span>
                          <p className="text-sm text-gray-400">@{social.username}</p>
                        </div>
                      </div>
                      
                      <div className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm">
                        Connected
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex justify-center mb-6">
                <button
                  onClick={() => setShowSocialModal(true)}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-lg text-white font-medium transition-colors flex items-center gap-2 animate-pulse hover:animate-none"
                >
                  <span>🔥 Connect Social Account</span>
                </button>
              </div>
            )}
            
            {socialData.length === 0 && (
              <div className="bg-yellow-500/20 p-4 rounded-lg">
                <p className="text-yellow-300 text-sm">
                  <span className="font-bold">PRO TIP:</span> Connect at least one social account to generate your referral code.
                </p>
              </div>
            )}
          </div>
          
          {/* Referral Code Section - Only shown when social accounts are connected */}
          {socialData.length > 0 && (
            <div className="bg-black bg-opacity-50 backdrop-blur-sm rounded-xl p-6 border border-purple-900 shadow-xl mb-10">
              <div className="flex items-center gap-3 mb-4">
                <FaMoneyBillWave className="text-green-500 w-6 h-6" />
                <h2 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">Step 2: Your Money Printer</h2>
              </div>
              
              {referral?.username && (
                <div className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 p-4 rounded-lg border border-blue-700/30 mb-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-500/20 p-2 rounded-full">
                        <FaTwitter className="text-blue-400 w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm">Referral Account</p>
                        <h3 className="text-xl font-bold text-white">@{referral.username}</h3>
                      </div>
                    </div>
                    
                    <div className="flex flex-col md:items-end">
                      <p className="text-gray-400 text-sm">Total Earnings</p>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold text-green-400">{availableRewards.toFixed(6)} SOL</h3>
                        <span className="text-xs text-green-400 bg-green-900/30 px-2 py-1 rounded">
                          {referredUsers.length} referrals
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <p className="text-gray-400 mb-6">
                This is your 24/7 passive income machine. Share this link EVERYWHERE. Each click could be SOL in your pocket.
              </p>
              
              <div className="flex flex-col gap-4 mb-6">
                {referral?.username && (
                  <div className="bg-gradient-to-r from-purple-900/70 to-indigo-900/70 p-4 rounded-lg border border-purple-500/50 shadow-lg">
                    <div className="flex items-center gap-3">
                      <div className="bg-indigo-500/20 p-2 rounded-full">
                        <FaUsers className="text-indigo-400 w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-gray-400 text-sm">Your Referral Identity</span>
                        <p className="text-xl font-bold text-white">@{referral.username}</p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="relative">
                  <div className="bg-black/70 border-2 border-green-400 rounded-lg p-4 overflow-x-auto whitespace-nowrap animate-pulse">
                    <span className="font-mono text-white">{referralLink || 'Generating your money printer...'}</span>
                  </div>
                  
                  <div className="absolute right-3 top-3 flex gap-2">
                    <button
                      onClick={copyReferralLink}
                      disabled={!referralLink}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                      title="Copy referral link"
                    >
                      <FaCopy className="w-4 h-4" />
                      {copied && (
                        <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black px-2 py-1 rounded text-xs">
                          Copied!
                        </span>
                      )}
                    </button>
                  </div>
                </div>
                
                <div className="bg-green-900/20 p-3 rounded-lg border border-green-800/30">
                  <div className="flex items-center gap-2 mb-2">
                    <FaMoneyBillWave className="text-green-400 w-4 h-4" />
                    <p className="text-green-300 font-medium">Why Use PlinkoIncinerator</p>
                  </div>
                  <p className="text-sm text-gray-300">
                    PlinkoIncinerator helps you recover SOL dust with just <span className="text-green-400 font-bold">2.1% fees</span> - much cheaper than most exchanges! Share your code with friends who have dust in their wallets and <span className="text-green-300">both of you benefit</span>.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    onClick={shareReferral}
                    disabled={!referralLink}
                    className="px-4 py-3 bg-gradient-to-br from-purple-800 to-purple-900 hover:from-purple-700 hover:to-purple-800 rounded-lg text-white transition-colors flex items-center justify-center gap-2 transform hover:scale-105"
                  >
                    <FaShare className="w-4 h-4" />
                    <span>Share</span>
                  </button>
                  
                  <button
                    onClick={shareToTwitter}
                    disabled={!referralLink}
                    className="px-4 py-3 bg-gradient-to-br from-blue-800 to-[#1DA1F2] hover:from-blue-700 hover:to-[#1DA1F2] rounded-lg text-white transition-colors flex items-center justify-center gap-2 transform hover:scale-105"
                  >
                    <FaTwitter className="w-4 h-4" />
                    <span>Share on X/Twitter</span>
                  </button>
                  
                  <button
                    onClick={shareToTelegram}
                    disabled={!referralLink}
                    className="px-4 py-3 bg-gradient-to-br from-[#0088cc] to-[#229ED9] hover:from-[#0077bb] hover:to-[#229ED9] rounded-lg text-white transition-colors flex items-center justify-center gap-2 transform hover:scale-105"
                  >
                    <FaTelegram className="w-4 h-4" />
                    <span>Share on Telegram</span>
                  </button>
                </div>
              </div>
              
              {/* Add Referral Code Application UI */}
              {user?.verifiedCredentials?.[0]?.address && !referral && (
                <div className="mt-6 bg-indigo-900/20 p-4 rounded-lg border border-indigo-800/50">
                  <h3 className="text-lg font-bold mb-3 text-indigo-300">Got a Referral Code?</h3>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={applyCode}
                      onChange={(e) => setApplyCode(e.target.value)}
                      placeholder="Enter referral code (optional)"
                      className="flex-1 bg-black/50 border border-indigo-700/50 rounded p-2 text-white"
                    />
                    <button
                      onClick={handleApplyReferralCode}
                      disabled={!applyCode || applying}
                      className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed rounded text-white transition-colors"
                    >
                      {applying ? 'Applying...' : 'Apply Code'}
                    </button>
                  </div>
                  {applyStatus === 'success' && (
                    <p className="mt-2 text-green-400 text-sm">Referral code applied successfully!</p>
                  )}
                  {applyStatus === 'error' && (
                    <p className="mt-2 text-red-400 text-sm">Failed to apply referral code. It may be invalid or already used.</p>
                  )}
                </div>
              )}
              
              {user?.verifiedCredentials?.[0]?.address && (
                <>
                  {availableRewards > 0 && (
                    <div className="bg-gradient-to-r from-green-900/60 to-emerald-900/60 p-3 rounded-lg border border-green-500/50 mb-4 animate-pulse">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FaGift className="text-green-400 w-5 h-5" />
                          <div>
                            <p className="text-green-300 font-bold">Rewards Available!</p>
                            <p className="text-xs text-green-400">You have {availableRewards.toFixed(6)} SOL ready to claim</p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setClaimAmount(availableRewards);
                            // Scroll to claim section
                            document.querySelector('.claim-section')?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm font-bold"
                        >
                          Claim Now
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-800 transform hover:scale-105 transition-transform">
                      <div className="flex items-center gap-3 mb-2">
                        <FaUsers className="text-purple-400 w-5 h-5" />
                        <h3 className="font-medium">Your Degenerates</h3>
                      </div>
                      <p className="text-2xl font-bold">{referredUsers.length}</p>
                    </div>
                    
                    <div className="bg-blue-900/30 rounded-lg p-4 border border-blue-800 transform hover:scale-105 transition-transform">
                      <div className="flex items-center gap-3 mb-2">
                        <FaGift className="text-blue-400 w-5 h-5" />
                        <h3 className="font-medium">SOL Bag</h3>
                      </div>
                      <p className="text-2xl font-bold">{availableRewards} SOL</p>
                    </div>
                    
                    <div className="bg-green-900/30 rounded-lg p-4 border border-green-800 transform hover:scale-105 transition-transform claim-section">
                      <div className="flex items-center gap-3 mb-2">
                        <FaCoins className="text-green-400 w-5 h-5" />
                        <h3 className="font-medium">Claim Your Bag</h3>
                      </div>
                      <div className="flex flex-col space-y-3">
                        <div className="flex items-center justify-between bg-black/30 p-2 rounded">
                          <span className="text-sm text-gray-300">Available to claim:</span>
                          <span className="font-bold text-green-400">{availableRewards.toFixed(6)} SOL</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max={availableRewards}
                            step="0.001"
                            value={claimAmount}
                            onChange={(e) => setClaimAmount(Number(e.target.value))}
                            className="w-full bg-black/50 border border-gray-700 rounded p-2 text-white"
                            placeholder="Amount to claim"
                          />
                          <button
                            onClick={() => setClaimAmount(availableRewards)}
                            disabled={availableRewards <= 0}
                            className="px-2 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded text-white text-sm transition-colors"
                          >
                            MAX
                          </button>
                        </div>
                        <button
                          onClick={handleClaimRewards}
                          disabled={claimAmount <= 0 || claimAmount > availableRewards || claiming}
                          className={`w-full py-2 rounded text-white text-sm font-bold transition-colors ${
                            claiming || claimAmount <= 0 || claimAmount > availableRewards 
                              ? 'bg-gray-700 cursor-not-allowed' 
                              : 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 animate-pulse hover:animate-none'
                          }`}
                        >
                          {claiming ? 'Processing...' : '🤑 Claim Rewards'}
                        </button>
                        {availableRewards <= 0 && (
                          <p className="text-xs text-gray-400 text-center mt-1">
                            You'll earn rewards when people use your referral code
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Referral Stats Section */}
                  <div className="bg-gradient-to-r from-black/60 to-indigo-900/30 p-4 rounded-lg mb-6 border border-indigo-700/40">
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <div className="flex items-center gap-2">
                        <div className="bg-indigo-900/50 p-2 rounded-full">
                          <FaMoneyBillWave className="text-indigo-400 w-4 h-4" />
                        </div>
                        <h3 className="font-bold text-indigo-300">REFERRAL PERFORMANCE</h3>
                      </div>
                      
                      {referral?.username && (
                        <div className="bg-indigo-500/20 px-3 py-1 rounded-full flex items-center gap-1">
                          <span className="text-xs text-indigo-300">@{referral.username}</span>
                        </div>
                      )}
                    </div>

                    {/* Earnings explainer card */}
                    <div className="bg-indigo-900/20 p-3 rounded-lg mb-4 border border-indigo-700/30">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1 bg-indigo-900/40 rounded-full">
                          <FaGift className="text-indigo-300 w-3 h-3" />
                        </div>
                        <h4 className="font-semibold text-sm text-indigo-200">WHY RECOVER SOL DUST</h4>
                      </div>
                      
                      <p className="text-gray-300 text-sm mb-2">
                        PlinkoIncinerator lets you recover small SOL amounts with just <span className="font-bold text-white">2.1% fees</span> - far cheaper than most exchanges!
                      </p>
                      
                      <div className="flex items-center gap-2 p-2 bg-indigo-950/50 rounded-md">
                        <div className="text-center flex-shrink-0 bg-indigo-900/40 p-2 rounded-md">
                          <p className="text-xs text-indigo-300">Fee Rate</p>
                          <p className="text-lg font-bold text-white">2.1%</p>
                        </div>
                        <div className="text-xs text-gray-400">
                          Most exchanges charge 5-10% or have minimum fees that make recovering dust impossible. We keep it simple and affordable!
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-black/30 p-3 rounded-lg">
                        <p className="text-gray-400 text-sm mb-1">House Profit from Referrals</p>
                        <p className="text-xl font-bold">{referralStats.totalHouseProfit.toFixed(6)} SOL</p>
                      </div>
                      
                      <div className="bg-black/30 p-3 rounded-lg">
                        <p className="text-gray-400 text-sm mb-1">Your Potential Rewards (20%)</p>
                        <p className="text-xl font-bold">{referralStats.payoutPotential.toFixed(6)} SOL</p>
                      </div>
                    </div>
                    
                    <div className="mt-4 bg-green-900/20 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <FaCoins className="text-green-400 w-4 h-4" />
                        <h4 className="font-semibold text-green-300">AVERAGE EARNINGS PER REFERRAL</h4>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 bg-black/20 p-3 rounded-md text-center">
                          <p className="text-sm text-gray-400 mb-1">Avg. Earnings Per User</p>
                          <p className="text-xl font-bold text-green-400">{referralStats.avgReferralPayout.toFixed(6)} SOL</p>
                          <p className="text-xs text-gray-500 mt-1">For each user you refer</p>
                        </div>
                        
                        <div className="flex-1 bg-black/20 p-3 rounded-md text-center">
                          <p className="text-sm text-gray-400 mb-1">If You Refer 10 Users</p>
                          <p className="text-xl font-bold text-amber-400">{(referralStats.avgReferralPayout * 10).toFixed(6)} SOL</p>
                          <p className="text-xs text-gray-500 mt-1">Potential earnings with 10 referrals</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 flex items-center gap-2">
                      <FaFire className="text-orange-400 w-4 h-4" />
                      <p className="text-sm text-gray-300">
                        The more people use your code, the bigger your earnings. Keep sharing!
                      </p>
                    </div>
                  </div>
                  
                  {/* Added: Referred Users List */}
                  {referredUsers.length > 0 && (
                    <div className="bg-black/30 p-4 rounded-lg mb-6 border border-purple-800/40">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-purple-300">Your Referred Users</h3>
                        
                        {referral?.username && (
                          <div className="flex items-center gap-2">
                            <div className="bg-purple-900/40 px-3 py-1 rounded-full text-sm text-purple-300">
                              via @{referral.username}
                            </div>
                            <div className="bg-green-900/40 px-3 py-1 rounded-full text-sm text-green-300">
                              {referredUsers.length} referred
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="max-h-60 overflow-y-auto pr-2">
                        {referredUsers.map((user, index) => (
                          <div key={index} className="flex items-center justify-between mb-2 p-2 bg-gray-800/30 rounded">
                            <div className="text-sm font-mono">{user.substring(0, 6)}...{user.substring(user.length - 4)}</div>
                            <div className="text-xs text-gray-400">Active Referral</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              
              <p className="text-sm text-gray-400">
                {user?.verifiedCredentials?.[0]?.address ? 
                  "Each degen that uses your code earns you 20% of house profits. Passive income on full blast! 💰" :
                  "Connect your wallet to start stacking SOL with zero effort!"}
              </p>
            </div>
          )}
          
        </div>
      </main>
      
      <Footer />
      
      {showSocialModal && (
        <SocialConnectPortal onClose={() => setShowSocialModal(false)} />
      )}
    </div>
  )
} 