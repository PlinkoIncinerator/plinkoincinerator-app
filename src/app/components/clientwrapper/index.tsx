// ClientWrapper.tsx
"use client";

import React, { useEffect } from 'react';
import { AuthProvider } from "../../context/AuthContext";
import { DynamicContextProvider, useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { SolanaWalletConnectors } from "@dynamic-labs/solana";
import { Config } from "../../config/solana";
import { PublicKey } from "@solana/web3.js";
import { SocialProvider } from "../../context/SocialContext";



export const dynamicConfig = {
  environmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID || '',
  walletConnectors: [SolanaWalletConnectors],
};

function WalletHandler({ children }: { children: React.ReactNode }) {
  const { primaryWallet } = useDynamicContext();

  useEffect(() => {
    if (primaryWallet && primaryWallet.address) {
      try {
        // Update the Config with the connected wallet's public key
        Config.solWallet.publicKey = new PublicKey(primaryWallet.address);
        console.log("Wallet connected:", primaryWallet.address);
        
        // Connect wallet to socket if available
        const socket = (window as any).plinkoSocket;
        if (socket) {
          socket.emit('wallet:connect', {
            walletAddress: primaryWallet.address
          });
        }
      } catch (error) {
        console.error("Error setting wallet public key:", error);
      }
    } else {
      // Reset the public key when wallet is disconnected
      Config.solWallet.publicKey = null;
    }
  }, [primaryWallet]);

  return <>{children}</>;
}

export default function ClientWrapper({
  children,
}: {
  children: React.ReactNode;
}) {

  
  return (
    <DynamicContextProvider
      settings={dynamicConfig}
    >
      <AuthProvider>
        <SocialProvider>
          <WalletHandler>
            {children}
          </WalletHandler>
        </SocialProvider>
      </AuthProvider>
    </DynamicContextProvider>
  );
}
