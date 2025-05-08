'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// This component uses the params but is wrapped in Suspense by the parent
function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
    
    // Track page view with Google Analytics
    window.gtag('config', 'G-KNZ740QZ04', {
      page_path: url,
    });
  }, [pathname, searchParams]);

  return null;
}

// The main component that gets imported doesn't directly use searchParams
export default function GoogleAnalytics() {
  return <AnalyticsTracker />;
} 