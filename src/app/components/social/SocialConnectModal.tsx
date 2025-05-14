import React, { useEffect, useState } from 'react';
import { useDynamicContext, useExternalAuth, useSocialAccounts } from '@dynamic-labs/sdk-react-core';
import { FaXmark, FaTelegram, FaX } from 'react-icons/fa6';
import { useSocial } from '../../context/SocialContext';
import { ProviderEnum } from '@dynamic-labs/sdk-api-core';
import Image from 'next/image';

interface SocialConnectModalProps {
  onClose: () => void;
}

interface SocialProvider {
  id: 'telegram' | 'x';
  name: string;
  icon: string;
  providerEnum: ProviderEnum;
  description: string;
}

const SOCIAL_PROVIDERS: SocialProvider[] = [
  {
    id: 'telegram',
    name: 'Telegram',
    icon: 'telegram',
    providerEnum: ProviderEnum.Telegram,
    description: 'Connect your Telegram account for instant messaging updates'
  },
  {
    id: 'x',
    name: 'X',
    icon: 'x',
    providerEnum: ProviderEnum.Twitter,
    description: 'Connect your X account for social verification'
  }
];

const SocialConnectModal: React.FC<SocialConnectModalProps> = ({ onClose }) => {
  const { 
    handleLogOut, 
    setShowAuthFlow,
    handleUnlinkWallet,
    primaryWallet,
    user
  } = useDynamicContext();
  const { signInWithSocialAccount, getLinkedAccountInformation, isLinked } = useSocialAccounts();
  const { socialData, setSocialData, connectedSocial, setHasSocialConnected, generateReferralCode } = useSocial();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'connect' | 'referral'>(socialData.length > 0 ? 'referral' : 'connect');

  // Initial check for connected accounts
  useEffect(() => {
    let isMounted = true;

    const checkConnections = async () => {
      // Skip if we're already loading
      if (isLoading) return;

      setIsLoading(true);
      try {
        const connectedAccounts: {
          username: string;
          displayName: string;
          avatar: string;
          bio: string;
          provider: 'telegram' | 'x';
        }[] = [];
        
        for (const provider of SOCIAL_PROVIDERS) {
          if (!isMounted) break;
          
          const isProviderLinked = await isLinked(provider.providerEnum);
          if (isProviderLinked && isMounted) {
            const accountInfo = await getLinkedAccountInformation(provider.providerEnum);
            if (accountInfo && isMounted) {
              connectedAccounts.push({
                username: accountInfo.username || '',
                displayName: accountInfo.displayName || '',
                avatar: accountInfo.avatar || '',
                bio: '',
                provider: provider.id
              });
            }
          }
        }
        if (connectedAccounts.length > 0) {
          setSocialData(connectedAccounts);
          setHasSocialConnected(true);
          
          // Removed the generateReferralCode call here to prevent infinite loop
        }
      } catch (error) {
        console.error('Error checking connections:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    checkConnections();

    return () => {
      isMounted = false;
    };
  }, [isLoading, setSocialData, setHasSocialConnected, isLinked, getLinkedAccountInformation, user]);

  const getProviderIcon = (icon: string) => {
    const socialAccount = socialData.find(social => social.provider === icon);
    if (socialAccount?.avatar) {
      return (
        <div className="relative w-6 h-6 rounded-full overflow-hidden">
          <Image
            src={socialAccount.avatar}
            alt={`${socialAccount.username || 'User'}'s avatar`}
            fill
            className="object-cover"
          />
        </div>
      );
    }

    switch (icon) {
      case 'telegram':
        return <FaTelegram className="w-6 h-6 text-[#229ED9]" />;
      case 'x':
        return <FaX className="w-6 h-6 text-white" />;
      default:
        return null;
    }
  };
  
  const handleConnect = async (provider: SocialProvider) => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      await signInWithSocialAccount(provider.providerEnum);
      
      // Wait a bit for the connection to be established
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const accountInfo = await getLinkedAccountInformation(provider.providerEnum);
      if (accountInfo) {
        const newSocialAccount = {
          username: accountInfo.username || '',
          displayName: accountInfo.displayName || '',
          avatar: accountInfo.avatar || '',
          bio: '',
          provider: provider.id
        };
        
        setSocialData(prev => [...prev, newSocialAccount]);
        setHasSocialConnected(true);
        
        // Removed the generateReferralCode call here to prevent infinite loop
      }
    } catch (error) {
      console.error(`Failed to connect to ${provider.id}:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async (provider: SocialProvider) => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      await handleUnlinkWallet(provider.id);
      setSocialData(prev => prev.filter(social => social.provider !== provider.id));
      if (socialData.length <= 1) {
        setHasSocialConnected(false);
      }
    } catch (error) {
      console.error('Failed to disconnect:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getProviderStatus = (providerId: string) => {
    return socialData.some(social => social.provider === providerId);
  };

  const getConnectedCount = () => {
    return socialData.length;
  };

  // Prevent modal from closing if we're in the middle of connecting
  const handleClose = () => {
    // No longer trying to generate a referral code here
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div 
        className="absolute inset-0 bg-black/75 backdrop-blur-sm" 
        onClick={handleClose} 
      />
      
      <div className="relative w-full max-w-md glass-card rounded-2xl p-6">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
        >
          <FaXmark className="w-6 h-6" />
        </button>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">
            Connect Social Accounts
          </h2>
        </div>

        <div className="space-y-4">
          {SOCIAL_PROVIDERS.map((provider) => {
            const isConnected = getProviderStatus(provider.id);
            const socialAccount = socialData.find(social => social.provider === provider.id);

            return (
              <div 
                key={provider.id}
                className={`p-4 border ${isConnected ? 'border-green-500/20' : 'border-white/10'} rounded-xl bg-black/30 hover:bg-black/40 transition-colors`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`relative w-10 h-10 rounded-full overflow-hidden ${isConnected ? 'bg-green-500/10' : 'bg-white/5'} flex items-center justify-center`}>
                      {getProviderIcon(provider.icon)}
                    </div>
                    <div>
                      <h3 className="text-white font-medium flex items-center gap-2">
                        {provider.name}
                        {isConnected && socialAccount?.username && (
                          <span className="text-sm text-green-400">
                            @{socialAccount.username}
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-white/60">
                        {isConnected && socialAccount
                          ? `Connected${socialAccount.displayName ? ` as ${socialAccount.displayName}` : ''}`
                          : provider.description}
                      </p>
                    </div>
                  </div>
                  <div>
                    {isConnected ? (
                      <button
                        onClick={() => handleDisconnect(provider)}
                        className="px-3 py-1.5 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30 transition-colors text-sm"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnect(provider)}
                        className="px-3 py-1.5 bg-banana text-prim rounded-lg hover:bg-opacity-90 transition-colors text-sm font-medium"
                      >
                        Connect
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex justify-between items-center">
          <p className="text-sm text-white/60">
            {getConnectedCount()} account{getConnectedCount() !== 1 ? 's' : ''} connected
          </p>
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default SocialConnectModal;