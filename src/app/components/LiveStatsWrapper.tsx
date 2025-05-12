'use client';

import React from 'react';
import LiveStatsCounter from './LiveStatsCounter';

interface LiveStatsWrapperProps {
  refreshInterval?: number;
}

export default function LiveStatsWrapper({ refreshInterval = 30000 }: LiveStatsWrapperProps) {
  return <LiveStatsCounter refreshInterval={refreshInterval} />;
} 