'use client';

import React from 'react';
import PlinkoMetrics from './plinko/PlinkoMetrics';

interface ClientMetricsWrapperProps {
  refreshInterval?: number;
}

export default function ClientMetricsWrapper({ refreshInterval = 60000 }: ClientMetricsWrapperProps) {
  return <PlinkoMetrics refreshInterval={refreshInterval} />;
} 