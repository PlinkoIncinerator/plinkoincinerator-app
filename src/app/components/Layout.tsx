import { useState, useEffect } from 'react';
import Head from 'next/head';
import '../styles/animations.css';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

export default function Layout({ children, title = 'Plinko Incinerator' }: LayoutProps) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <Head>
        <title>{title}</title>
        <meta name="description" content="Burn tokens in Plinko style" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <div className="relative z-10">
        <header className="py-4 px-6 border-b border-gray-800 shine-border">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full flame-animation mr-3">
                <div className="w-full h-full flex items-center justify-center">
                  <span className="degen-text text-2xl">🔥</span>
                </div>
              </div>
              <h1 className="text-2xl font-bold degen-text">Plinko Incinerator</h1>
            </div>
            <nav>
              <ul className="flex space-x-6">
                <li className="glow-pulse px-4 py-2">Home</li>
                <li className="px-4 py-2">History</li>
                <li className="px-4 py-2">About</li>
              </ul>
            </nav>
          </div>
        </header>

        <main className="max-w-7xl mx-auto py-8 px-6">
          {mounted && children}
        </main>

        <footer className="border-t border-gray-800 py-6 px-6 shine-border">
          <div className="max-w-7xl mx-auto text-center text-gray-400">
            <p>© {new Date().getFullYear()} Plinko Incinerator. All rights reserved.</p>
            <p className="mt-2 text-sm">Burn responsibly. Not financial advice.</p>
          </div>
        </footer>
      </div>
      
      {/* Background effects */}
      <div className="fixed top-0 left-0 w-full h-full bg-black opacity-50 z-0">
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay"></div>
        <div className="absolute bottom-0 w-full h-40 bg-gradient-to-t from-red-900/30 to-transparent"></div>
      </div>
    </div>
  );
} 