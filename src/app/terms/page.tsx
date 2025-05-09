'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';

export default function TermsAndConditions() {
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
          <h1 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">Terms and Conditions</h1>
          
          <div className="text-right mb-6 text-sm text-gray-400">
            Last Updated: {currentDate}
          </div>

          <div className="space-y-6 text-gray-300">
            <section>
              <h2 className="text-xl font-bold mb-3 text-pink-400">1. Introduction</h2>
              <p>Welcome to PlinkoIncinerator. These Terms and Conditions govern your use of the PlinkoIncinerator website and decentralized application (collectively, the &quot;Service&quot;). By accessing or using the Service, you agree to be bound by these Terms and Conditions. If you disagree with any part of these terms, you may not access the Service.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 text-pink-400">2. Important Disclaimers</h2>
              <div className="bg-red-900 bg-opacity-30 p-4 rounded-lg border border-red-800">
                <p className="font-bold text-red-300 mb-2">PLEASE READ CAREFULLY:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Not Financial Advice:</strong> PlinkoIncinerator is not a financial advisor, investment advisor, broker, or any other regulated financial entity. Nothing on our website constitutes financial advice. All financial actions and decisions are your responsibility.</li>
                  <li><strong>Gambling Warning:</strong> Our service includes gambling features. Gambling can be addictive and carries financial risk. Never gamble with funds you cannot afford to lose.</li>
                  <li><strong>Age Restriction:</strong> You must be at least 18 years old or the legal age for gambling in your jurisdiction (whichever is higher) to use our Service.</li>
                  <li><strong>No Guaranteed Returns:</strong> Cryptocurrency and gambling values can fluctuate. Past performance is not indicative of future results. We do not guarantee any earnings or profits.</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 text-pink-400">3. Eligibility</h2>
              <p>To access or use our Service, you must be:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>At least 18 years old or the legal age for gambling in your jurisdiction, whichever is higher</li>
                <li>Legally permitted to use blockchain technology and cryptocurrency in your jurisdiction</li>
                <li>Not a resident of a jurisdiction where online gambling is prohibited</li>
                <li>Not accessing the Service from a restricted territory including but not limited to the United States, China, North Korea, Iran, Syria, Cuba, or any other jurisdiction where our Service is illegal</li>
                <li>Acting on your own behalf, not on behalf of any other person or entity</li>
              </ul>
              <p className="mt-2">By using our Service, you represent and warrant that you meet all eligibility requirements.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 text-pink-400">4. Service Description</h2>
              <p>PlinkoIncinerator provides the following services:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Token account closure: Identifying and closing empty or low-value token accounts on the Solana blockchain</li>
                <li>SOL recovery: Returning locked SOL from closed token accounts to users</li>
                <li>Plinko gambling: Allowing users to wager recovered SOL in a provably fair Plinko game</li>
                <li>$PLINC token: Providing utility and governance functions through our native token</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 text-pink-400">5. Account Connection and Security</h2>
              <p>To use our Service, you must connect your Solana wallet. You are responsible for maintaining the security of your wallet and private keys. We will never ask for your seed phrase or private keys.</p>
              <p className="mt-2">You are responsible for all activities that occur in connection with your wallet. If you suspect unauthorized access to your wallet, you should immediately take steps to secure it.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 text-pink-400">6. Fees and Payments</h2>
              <p>PlinkoIncinerator charges a platform fee for its services. The current fee structure is as follows:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>2.1% platform fee on recovered SOL from token account closures</li>
                <li>House edge built into Plinko game payouts</li>
              </ul>
              <p className="mt-2">We reserve the right to change our fee structure at any time. Any changes will be effective immediately upon posting to the Service.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 text-pink-400">7. Gambling Rules and Payouts</h2>
              <p>Our Plinko gambling game operates with the following conditions:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>All game outcomes are determined by provably fair mechanisms on the Solana blockchain</li>
                <li>Maximum payout is 25x your wager</li>
                <li>Minimum and maximum bets may apply</li>
                <li>All transactions are final and cannot be reversed once confirmed on the blockchain</li>
              </ul>
              <p className="mt-2">We reserve the right to limit, restrict, or ban any user from gambling activities if we suspect abuse, fraud, or violation of these terms.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 text-pink-400">8. $PLINC Token</h2>
              <p>The $PLINC token is the native utility token of our platform. By purchasing, holding, or using $PLINC tokens, you acknowledge that:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>$PLINC is not an investment product, security, or financial instrument</li>
                <li>Token value may fluctuate and could potentially lose all value</li>
                <li>No guarantees are made regarding future token value or utility</li>
                <li>The buyback mechanism does not guarantee price appreciation</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 text-pink-400">9. Prohibited Activities</h2>
              <p>You agree not to engage in any of the following activities:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Using the Service for any illegal purpose or in violation of any local, state, national, or international law</li>
                <li>Exploiting bugs, vulnerabilities, or loopholes in the Service</li>
                <li>Engaging in fraudulent activities or misrepresenting information</li>
                <li>Using proxy services, VPNs, or other methods to disguise your location if you are in a restricted territory</li>
                <li>Creating multiple accounts to claim bonuses or circumvent restrictions</li>
                <li>Engaging in money laundering or financing terrorism</li>
                <li>Utilizing automated systems, bots, scripts, or other methods to interact with the Service</li>
              </ul>
              <p className="mt-2">We reserve the right to terminate or restrict your access to the Service for any violation of these prohibitions.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 text-pink-400">10. Intellectual Property</h2>
              <p>All content, features, and functionality of the Service, including but not limited to text, graphics, logos, icons, images, audio clips, digital downloads, data compilations, and software, are the exclusive property of PlinkoIncinerator or its licensors and are protected by international copyright, trademark, and other intellectual property laws.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 text-pink-400">11. Limitation of Liability</h2>
              <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, PLINKOINCINERATOR AND ITS AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Your access to or use of or inability to access or use the Service</li>
                <li>Any conduct or content of any third party on the Service</li>
                <li>Any content obtained from the Service</li>
                <li>Unauthorized access, use, or alteration of your transmissions or content</li>
                <li>Blockchain network failures or delays</li>
                <li>Wallet connection issues or failures</li>
                <li>Any gambling losses incurred while using the Service</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 text-pink-400">12. Indemnification</h2>
              <p>You agree to defend, indemnify, and hold harmless PlinkoIncinerator, its affiliates, licensors, and service providers, and their respective officers, directors, employees, contractors, agents, licensors, suppliers, successors, and assigns from and against any claims, liabilities, damages, judgments, awards, losses, costs, expenses, or fees (including reasonable attorneys&apos; fees) arising out of or relating to your violation of these Terms or your use of the Service.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 text-pink-400">13. Modifications to Terms</h2>
              <p>We reserve the right to modify or replace these Terms at any time. The most current version will always be posted on our website. By continuing to access or use our Service after any revisions become effective, you agree to be bound by the revised terms.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 text-pink-400">14. Governing Law</h2>
              <p>These Terms shall be governed and construed in accordance with the laws of the Cayman Islands, without regard to its conflict of law provisions.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-3 text-pink-400">15. Contact Us</h2>
              <p>If you have any questions about these Terms, please contact us at:</p>
              <p className="mt-2">Email: terms@plinkoincinerator.com</p>
              <p>Telegram: @plinkoincinerator</p>
            </section>

            <div className="border-t border-purple-800 pt-6 mt-8">
              <p className="text-center text-gray-400 text-sm">By using PlinkoIncinerator, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.</p>
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
            <Link href="/terms" className="text-gray-500 hover:text-purple-400 transition-colors font-bold">
              Terms & Conditions
            </Link>
            <Link href="/privacy" className="text-gray-500 hover:text-purple-400 transition-colors">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
} 