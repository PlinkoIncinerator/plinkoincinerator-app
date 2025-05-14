"use client"
// SocialContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";

interface SocialData {
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  fid?: number;
  provider: 'telegram' | 'x';
}

interface Referral {
  code: string;
  referredUsers: string[];
  rewards: number;
}

interface SocialContextType {
  socialData: SocialData[];
  setSocialData: React.Dispatch<React.SetStateAction<SocialData[]>>;
  hasSocialConnected: boolean;
  setHasSocialConnected: (value: boolean) => void;
  connectedSocial: { provider: 'telegram' | 'x' | null; isConnected: boolean };
}

const SocialContext = createContext<SocialContextType | undefined>(undefined);

export const ALLOWED_SOCIAL_PROVIDERS = ['farcaster', 'telegram', 'x'] as const;

export const SocialProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [connectedSocial, setConnectedSocial] = useState({
    provider: null as 'telegram' | 'x' | null,
    isConnected: false
  });
  const [socialData, setSocialData] = useState<SocialData[]>([]);
  const { user } = useDynamicContext();

  useEffect(() => {
    // Check for both Telegram and X credentials
    console.log('useEffect triggered for user credentials check');

    const telegramCred = user?.verifiedCredentials?.find(
      cred => cred.oauthProvider === 'telegram'
    );

    const xCred = user?.verifiedCredentials?.find(
      cred => cred.oauthProvider === 'twitter'
    );

    const newSocialData: SocialData[] = [];

    if (telegramCred) {
      console.log('Found Telegram credentials:', telegramCred.oauthUsername);
      newSocialData.push({
        username: telegramCred.oauthUsername || '',
        displayName: telegramCred.oauthDisplayName || '',
        avatar: telegramCred.oauthAccountPhotos?.[0] || '',
        bio: '',
        provider: 'telegram'
      });
    }

    if (xCred) {
      console.log('Found X credentials:', xCred.oauthUsername);
      newSocialData.push({
        username: xCred.oauthUsername || '',
        displayName: xCred.oauthDisplayName || '',
        avatar: xCred.oauthAccountPhotos?.[0] || '',
        bio: '',
        provider: 'x'
      });
    }

    // Update socialData state
    setSocialData(newSocialData);

    if (newSocialData.length > 0) {
      console.log('Social data found, updating connected state');
      setConnectedSocial({
        provider: newSocialData[0].provider,
        isConnected: true
      });
    } else {
      console.log('No social data found, resetting state');
      setSocialData([]);
      setConnectedSocial({
        provider: null,
        isConnected: false
      });
    }
  }, [user]);

  return (
    <SocialContext.Provider value={{ 
      socialData, 
      setSocialData, 
      hasSocialConnected: socialData.length > 0, 
      setHasSocialConnected: (value) => setConnectedSocial(prev => ({ ...prev, isConnected: value })),
      connectedSocial
    }}>
      {children}
    </SocialContext.Provider>
  );
};

export const useSocial = () => {
  const context = useContext(SocialContext);
  if (context === undefined) {
    throw new Error('useSocial must be used within a SocialProvider');
  }
  return context;
};