"use client";

import React, { createContext, useState, useContext, ReactNode } from 'react';

interface ShareModalState {
  isOpen: boolean;
  recoveredSol: number;
  walletAddress: string;
  tokensBurned: number;
  isWithdraw: boolean;
}

interface ShareModalContextProps {
  modalState: ShareModalState;
  openShareModal: (recoveredSol: number, walletAddress: string, tokensBurned: number, isWithdraw: boolean) => void;
  closeShareModal: () => void;
}

const defaultState: ShareModalState = {
  isOpen: false,
  recoveredSol: 0,
  walletAddress: '',
  tokensBurned: 0,
  isWithdraw: false
};

const ShareModalContext = createContext<ShareModalContextProps | undefined>(undefined);

export function ShareModalProvider({ children }: { children: ReactNode }) {
  const [modalState, setModalState] = useState<ShareModalState>(defaultState);

  const openShareModal = (recoveredSol: number, walletAddress: string, tokensBurned: number, isWithdraw: boolean) => {
    setModalState({
      isOpen: true,
      recoveredSol,
      walletAddress,
      tokensBurned,
      isWithdraw
    });
  };

  const closeShareModal = () => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  };

  return (
    <ShareModalContext.Provider value={{ modalState, openShareModal, closeShareModal }}>
      {children}
    </ShareModalContext.Provider>
  );
}

export function useShareModal() {
  const context = useContext(ShareModalContext);
  if (context === undefined) {
    throw new Error('useShareModal must be used within a ShareModalProvider');
  }
  return context;
} 