'use client';

import React from 'react';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

export default function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return (
    <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded mb-4" role="alert">
      <h2 className="text-lg font-bold mb-2">Something went wrong</h2>
      <p className="text-sm mb-2">{error.message}</p>
      <button
        className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded text-sm"
        onClick={resetErrorBoundary}
      >
        Try again
      </button>
    </div>
  );
} 