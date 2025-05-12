'use client';

import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import ErrorFallback from './ErrorFallback';

interface ErrorBoundaryWrapperProps {
  children: React.ReactNode;
}

export default function ErrorBoundaryWrapper({ children }: ErrorBoundaryWrapperProps) {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        // Reset the state of your app here
        console.log("Error boundary reset");
      }}
    >
      {children}
    </ErrorBoundary>
  );
} 