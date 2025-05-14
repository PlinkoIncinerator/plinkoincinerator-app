'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import WalletConnectButton from './WalletConnectButton';

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="border-b border-gray-800 bg-black bg-opacity-70 backdrop-blur-md sticky top-0 z-10">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center">
          <Link href="/" className="flex items-center group">
            <Image 
              src="/logo_no_bg.png" 
              alt="PlinkoIncinerator Logo" 
              width={40} 
              height={40}
              className="mr-2 transition-transform group-hover:scale-110"
            />
            <div className="hidden sm:block text-2xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent">
              PlinkoIncinerator
            </div>
          </Link>
          <div className="ml-2 hidden sm:flex items-center space-x-2">
            <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full animate-pulse">DEGEN</span>
            <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">BETA</span>
          </div>
        </div>
        
        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-6">
          <nav className="flex items-center space-x-6 mr-4">
            <Link href="/roadmap" className="text-gray-300 hover:text-white transition-colors">
              Roadmap
            </Link>
            <Link href="/referrals" className="text-gray-300 hover:text-white transition-colors flex items-center">
              <span>Referrals</span>
              <span className="ml-1.5 text-xs bg-green-600 text-white px-1.5 py-0.5 rounded-full">Earn</span>
            </Link>
            <a 
              href="https://t.me/plinkoincinerator" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-gray-300 hover:text-white transition-colors flex items-center"
            >
              <Image src="/telegram.png" alt="Telegram" width={16} height={16} className="mr-1 rounded-full" />
              <span>Community</span>
            </a>
            <a
              href="https://twitter.com/plinkcinerator"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-300 hover:text-white transition-colors flex items-center"
            >
              <Image src="/twitter.png" alt="X (Twitter)" width={16} height={16} className="mr-1 rounded-full" />
              <span>Twitter</span>
            </a>
          </nav>
          <WalletConnectButton />
        </div>
        
        {/* Mobile Menu Button */}
        <div className="md:hidden flex items-center">
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-white p-2 focus:outline-none focus:ring-2 focus:ring-purple-500 rounded-lg"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>
      
      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden px-4 py-3 bg-gray-900 border-b border-gray-800 animate-fadeIn">
          <nav className="flex flex-col space-y-3">
            <Link 
              href="/" 
              className="text-gray-300 hover:text-white transition-colors py-2 px-3 rounded-lg hover:bg-gray-800"
              onClick={() => setMobileMenuOpen(false)}
            >
              Home
            </Link>
            <Link 
              href="/roadmap" 
              className="text-gray-300 hover:text-white transition-colors py-2 px-3 rounded-lg hover:bg-gray-800"
              onClick={() => setMobileMenuOpen(false)}
            >
              Roadmap
            </Link>
            <Link 
              href="/referrals" 
              className="text-gray-300 hover:text-white transition-colors py-2 px-3 rounded-lg hover:bg-gray-800 flex items-center"
              onClick={() => setMobileMenuOpen(false)}
            >
              <span>Referrals</span>
              <span className="ml-2 text-xs bg-green-600 text-white px-1.5 py-0.5 rounded-full">Earn</span>
            </Link>
            <a 
              href="https://t.me/plinkoincinerator" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-gray-300 hover:text-white transition-colors py-2 px-3 rounded-lg hover:bg-gray-800 flex items-center"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Image src="/telegram.png" alt="Telegram" width={20} height={20} className="mr-2 rounded-full" />
              <span>Telegram</span>
            </a>
            <a 
              href="https://twitter.com/plinkcinerator" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-gray-300 hover:text-white transition-colors py-2 px-3 rounded-lg hover:bg-gray-800 flex items-center"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Image src="/twitter.png" alt="X (Twitter)" width={20} height={20} className="mr-2 rounded-full" />
              <span>Twitter</span>
            </a>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header; 