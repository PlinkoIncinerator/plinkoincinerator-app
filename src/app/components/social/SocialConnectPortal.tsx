'use client'

import React from 'react';
import ModalPortal from '../ModalPortal';
import SocialConnectModal from './SocialConnectModal';

interface SocialConnectPortalProps {
  onClose: () => void;
}

const SocialConnectPortal: React.FC<SocialConnectPortalProps> = ({ onClose }) => {
  return (
    <ModalPortal>
      <SocialConnectModal onClose={onClose} />
    </ModalPortal>
  );
};

export default SocialConnectPortal; 