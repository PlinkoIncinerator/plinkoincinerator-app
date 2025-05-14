'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { FaTwitter, FaTelegram, FaApple, FaGooglePlay, FaGlobe } from 'react-icons/fa'
import { useSocial } from "../context/SocialContext"
import SocialConnectPortal from './social/SocialConnectPortal'
import { SiHiveBlockchain } from 'react-icons/si'
import { useDynamicContext } from "@dynamic-labs/sdk-react-core"

export default function Navbar() {
  const [isIos, setIsIos] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)
  const [showSocialModal, setShowSocialModal] = useState(false)
  const { socialData, connectedSocial, referral } = useSocial()
  const { primaryWallet } = useDynamicContext()

  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
    if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
      setIsIos(true)
    } else if (/android/i.test(userAgent)) {
      setIsAndroid(true)
    }
  }, [])

  const getSocialIcon = (provider: string, userData: any) => {
    if (userData?.avatar) {
      return (
        <div className="relative w-4 h-4 rounded-full overflow-hidden">
          <Image
            src={userData.avatar}
            alt={`${userData.username}'s avatar`}
            fill
            className="object-cover"
          />
        </div>
      );
    }

    switch (provider) {
      case 'telegram':
        return <FaTelegram className="w-4 h-4 text-[#229ED9]" />;
      case 'farcaster':
        return <SiHiveBlockchain className="w-4 h-4 text-purple-500" />;
      case 'x':
        return <FaTwitter className="w-4 h-4 text-white" />;
      default:
        return <FaGlobe className="w-4 h-4" />;
    }
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-40 bg-black/20 backdrop-blur-lg border-b border-white/10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="relative w-10 h-10 transition-transform hover:scale-110">
              <Image
                src="/logo_no_bg.png"
                alt="PlinkoIncinerator"
                width={40}
                height={40}
                className="object-contain rounded-full"
              />
            </Link>

            {/* Navigation Links */}
            <div className="hidden md:flex items-center space-x-8">
              <Link
                href="/referrals"
                className="text-white hover:text-purple-400 transition-colors flex items-center"
              >
                <span className="mr-1">🔗</span> Referrals
                {referral && (
                  <span className="ml-1 bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded-full">{referral.referredUsers.length}</span>
                )}
              </Link>
              <Link
                href="/token"
                className="text-white hover:text-purple-400 transition-colors"
              >
                Token
              </Link>
              <Link
                href="/roadmap"
                className="text-white hover:text-purple-400 transition-colors"
              >
                Roadmap
              </Link>
              <a
                href="https://plinkoincinerator.substack.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:text-purple-400 transition-colors"
              >
                Blog
              </a>
            </div>

            {/* Social Connections */}
            <div className="flex items-center gap-2">
              {Array.isArray(socialData) && socialData.length > 0 ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 px-3 py-1.5 bg-white/10 rounded-lg text-white">
                    {socialData.map((social, index) => (
                      <div key={social.provider} className="flex items-center">
                        {index > 0 && <span className="mx-1">•</span>}
                        <div className="flex items-center gap-2">
                          {getSocialIcon(social.provider, social)}
                          <span className="text-sm font-medium">
                            {social.username}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowSocialModal(true)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
                  >
                    <FaGlobe className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSocialModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <FaGlobe className="w-4 h-4" />
                  <span>Connect Socials</span>
                </button>
              )}
            </div>

            {/* Social Media Links */}
            <div className="flex items-center space-x-4">
              <a
                href="https://t.me/plinkoincinerator"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center space-x-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
              >
                <FaTelegram className="w-5 h-5 text-[#229ED9]" />
                <span className="hidden lg:inline">Community</span>
              </a>
              
              <a
                href="https://twitter.com/plinkcinerator"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center space-x-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
              >
                <FaTwitter className="w-5 h-5" />
                <span className="hidden lg:inline">Twitter</span>
              </a>
            </div>
          </div>
        </div>
      </nav>

      {showSocialModal && (
        <SocialConnectPortal onClose={() => setShowSocialModal(false)} />
      )}
    </>
  )
} 