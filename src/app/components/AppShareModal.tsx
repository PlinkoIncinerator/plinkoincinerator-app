"use client";

import { useEffect, useState } from 'react';
import { useShareModal } from '../context/ShareModalContext';
import ShareModal from './ShareModal';
import dynamic from 'next/dynamic';

// Dynamically import the confetti component to prevent server-side rendering issues
const ConfettiExplosion = dynamic(
  () => import('react-confetti-explosion').then(mod => mod.default),
  { ssr: false }
);

export default function AppShareModal() {
  const { modalState, closeShareModal } = useShareModal();
  const [isExploding, setIsExploding] = useState(false);
  
  // Start the confetti explosion when the modal opens from a withdrawal
  useEffect(() => {
    if (modalState.isOpen && modalState.isWithdraw) {
      setIsExploding(true);
      // Reset explosion after some time to allow it to play again if modal reopens
      const timer = setTimeout(() => {
        setIsExploding(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [modalState.isOpen, modalState.isWithdraw]);
  
  const confettiProps = {
    force: 0.8,
    duration: 3000,
    particleCount: 250,
    width: 1600,
    colors: ['#FF5757', '#5768FF', '#57CAFF', '#9057FF', '#FF57D5', '#FFD557', '#57FF8D'],
  };
  
  return (
    <>
      {isExploding && modalState.isOpen && modalState.isWithdraw && (
        <div className="fixed top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[150]">
          <ConfettiExplosion {...confettiProps} />
        </div>
      )}
      <ShareModal 
        isOpen={modalState.isOpen}
        onClose={closeShareModal}
        recoveredSol={modalState.recoveredSol}
        walletAddress={modalState.walletAddress}
        tokensBurned={modalState.tokensBurned}
        isWithdraw={modalState.isWithdraw}
      />
    </>
  );
} 