'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';

export default function PrivacyPolicy() {
  const [currentDate] = useState(new Date().toLocaleDateString());

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-black bg-opacity-70 backdrop-blur-md sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center">
            <Image 
              src="/logo_no_bg.png" 
              alt="PlinkoIncinerator Logo" 
              width={40} 
              height={40}
              className="mr-2"
            />
            <div className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent">
              PlinkoIncinerator
            </div>
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="bg-black bg-opacity-50 backdrop-blur-sm rounded-xl p-8 border border-purple-900 shadow-2xl">
          <h1 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">Privacy Policy</h1>
          
          <div className="text-right mb-6 text-sm text-gray-400">
            Last Updated: {currentDate}
          </div>

          <div className="space-y-6 text-gray-300">
            <section>
              <h2 className="text-xl font-bold mb-3 text-pink-400">1. Introduction</h2>
              <p>Welcome to PlinkoIncinerator ("we", "our", or "us"). We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you about how we look after your personal data when you visit our website and tell you about your privacy rights and how the law protects you.</p>
              <p className="mt-2">This privacy policy applies to all users of PlinkoIncinerator, a decentralized application (dApp) built on the Solana blockchain.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 text-pink-400">2. Important Information</h2>
              <p><strong>Not Financial Advice:</strong> PlinkoIncinerator is not a financial advisor, investment advisor, or broker. The information provided on this website is for general informational and entertainment purposes only and does not constitute financial advice.</p>
              <p className="mt-2"><strong>Age Restriction:</strong> PlinkoIncinerator's services are only available to individuals who are at least 18 years old or the legal age for gambling in their jurisdiction, whichever is higher. By using our services, you represent and warrant that you meet these age requirements.</p>
              <p className="mt-2"><strong>Gambling Warning:</strong> Gambling involves risk and should be conducted responsibly. You should never gamble with funds that you cannot afford to lose.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 text-pink-400">3. Information We Collect</h2>
              <p>When you connect your wallet to PlinkoIncinerator, we collect and process the following information:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Wallet addresses</li>
                <li>Transaction data on the Solana blockchain</li>
                <li>Game play data (including bets, outcomes, and winnings)</li>
                <li>Device information and IP addresses</li>
                <li>Usage data and website interaction</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 text-pink-400">4. How We Use Your Information</h2>
              <p>We use your information for the following purposes:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>To provide and maintain our service</li>
                <li>To process transactions on the blockchain</li>
                <li>To verify the eligibility of accounts for token burning</li>
                <li>To operate the Plinko game and process winnings</li>
                <li>To detect and prevent fraud and other prohibited activities</li>
                <li>To comply with legal obligations</li>
                <li>To improve our services and develop new features</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 text-pink-400">5. Blockchain Transactions</h2>
              <p>Please be aware that all transactions on the Solana blockchain are public and permanently recorded. This includes your wallet address and details of your interactions with PlinkoIncinerator. We have no ability to alter, delete, or modify blockchain data.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 text-pink-400">6. Cookies and Tracking</h2>
              <p>We use cookies and similar tracking technologies to track activity on our website and store certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 text-pink-400">7. Third-Party Disclosure</h2>
              <p>We may share your information with:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Service providers who perform services on our behalf</li>
                <li>Legal and regulatory authorities when required by law</li>
                <li>Analytics providers to help us improve our service</li>
              </ul>
              <p className="mt-2">We do not sell or rent your personal information to third parties.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 text-pink-400">8. Data Security</h2>
              <p>We implement appropriate security measures to protect your personal information. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 text-pink-400">9. Your Legal Rights</h2>
              <p>Depending on your location, you may have certain rights regarding your personal data, including:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>The right to access and receive a copy of your personal data</li>
                <li>The right to rectification of inaccurate data</li>
                <li>The right to erasure (the "right to be forgotten")</li>
                <li>The right to restrict processing</li>
                <li>The right to data portability</li>
                <li>The right to object to processing</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 text-pink-400">10. Changes to the Privacy Policy</h2>
              <p>We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date at the top of this Privacy Policy.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 text-pink-400">11. Contact Us</h2>
              <p>If you have any questions about this Privacy Policy, please contact us at:</p>
              <p className="mt-2">Email: privacy@plinkoincinerator.com</p>
              <p>Telegram: @plinkoincinerator</p>
            </section>

            <div className="border-t border-purple-800 pt-6 mt-8">
              <p className="text-center text-gray-400 text-sm">By using PlinkoIncinerator, you acknowledge that you have read and understood this Privacy Policy and agree to be bound by its terms.</p>
            </div>
          </div>
        </div>
        
        <div className="text-center mt-8">
          <Link href="/" className="text-purple-400 hover:text-purple-300 transition-colors">
            Return to Home
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 text-center text-sm text-gray-500">
        <div className="container mx-auto px-4">
          <div className="flex justify-center space-x-6">
            <Link href="/" className="text-gray-500 hover:text-purple-400 transition-colors">
              Home
            </Link>
            <Link href="/terms" className="text-gray-500 hover:text-purple-400 transition-colors">
              Terms & Conditions
            </Link>
            <Link href="/privacy" className="text-gray-500 hover:text-purple-400 transition-colors font-bold">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
} 