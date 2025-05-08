"use client";

import { DynamicWidget } from "@dynamic-labs/sdk-react-core";
import { useEffect } from "react";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { trackPlinkoEvent, ANALYTICS_EVENTS } from "../utils/analytics";

export default function WalletConnectButton() {
  const { primaryWallet } = useDynamicContext();
  
  // Track wallet connection/disconnection
  useEffect(() => {
    if (primaryWallet) {
      // Track wallet connection
      trackPlinkoEvent(ANALYTICS_EVENTS.CONNECT_WALLET, {
        wallet_address: primaryWallet.address,
        wallet_type: primaryWallet.connector?.name || 'unknown',
      });
    }
  }, [primaryWallet]);

  const CustomButton = () => (
    <div className="flex items-center justify-center w-full h-full">
      <span>Connect Wallet</span>
    </div>
  );
  
  return (
    <DynamicWidget 
      buttonClassName="bg-gradient-to-r from-purple-600 via-pink-500 to-blue-600 hover:from-purple-500 hover:via-pink-400 hover:to-blue-500 text-white py-1.5 px-4 rounded-md transition-all hover:scale-105 shadow-sm text-sm font-medium"
      buttonContainerClassName="inline-block"
      innerButtonComponent={<CustomButton />}
    />
  );
} 