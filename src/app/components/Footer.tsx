'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { trackPlinkoEvent, ANALYTICS_EVENTS } from '../utils/analytics';

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

const Footer = () => {
  return (
    <footer className="border-t border-gray-800 py-8 text-center text-sm text-gray-500 bg-black bg-opacity-70">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-center mb-4">
          <Image 
            src="/logo_no_bg.png" 
            alt="PlinkoIncinerator Logo" 
            width={50} 
            height={50}
            className="mb-3"
          />
          <div className="flex items-center">
            <div className="px-3 py-1 bg-purple-900 bg-opacity-50 rounded-full text-xs font-bold text-purple-300 mr-2">BETA</div>
            <p className="font-bold text-gray-400">PlinkoIncinerator: Where Solana Dust Goes to Die and Gains Go to Moon 🚀</p>
          </div>
        </div>
        <p className="mb-6">This is an experimental beta application. Plinko responsibly. Don&apos;t gamble what you can&apos;t afford to lose.</p>
        
        <div className="flex flex-wrap justify-center gap-6 mb-6">
          <SocialIcon 
            href="https://twitter.com/plinkcinerator" 
            icon={<Image src="/twitter.png" alt="X (Twitter)" width={20} height={20} />} 
            label="Twitter" 
          />
          <SocialIcon 
            href="https://t.me/plinkoincinerator" 
            icon={<Image src="/telegram.png" alt="Telegram" width={20} height={20} />} 
            label="Telegram" 
          />
        </div>
        
        <div className="flex justify-center space-x-6 flex-wrap">
          <Link href="/" className="text-gray-500 hover:text-purple-400 transition-colors py-1">
            Home
          </Link>
          <Link href="/roadmap" className="text-gray-500 hover:text-purple-400 transition-colors py-1">
            Roadmap
          </Link>
          <a href="https://solana.com" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-purple-400 transition-colors py-1">
            Powered by Solana
          </a>
          <Link href="/terms" className="text-gray-500 hover:text-purple-400 transition-colors py-1">
            Terms & Conditions
          </Link>
          <Link href="/privacy" className="text-gray-500 hover:text-purple-400 transition-colors py-1">
            Privacy Policy
          </Link>
        </div>
        
        <div className="mt-4 text-gray-600 text-xs">
          © {new Date().getFullYear()} PlinkoIncinerator. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer; 