'use client';

type EventParams = {
  action: string;
  category: string;
  label?: string;
  value?: number;
  [key: string]: string | number | boolean | undefined;
}

/**
 * A utility hook for tracking events in Google Analytics 4
 */
export const useGoogleAnalytics = () => {
  // This function is used to track page views
  const pageView = (url: string) => {
    window.gtag('config', 'G-KNZ740QZ04', {
      page_path: url,
    });
  };

  // This function is used to track custom events
  const event = ({ action, category, label, value, ...rest }: EventParams) => {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
      ...rest,
    });
  };

  return {
    pageView,
    event,
  };
};

// Define type for event data
type EventData = Record<string, string | number | boolean | undefined>;

// Track specific events for the Plinko game
export const trackPlinkoEvent = (eventName: string, data: EventData = {}) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, { ...data });
  }
};

// Define common event types for consistency
export const ANALYTICS_EVENTS = {
  BURN_TOKENS: 'burn_tokens',
  PLAY_PLINKO: 'play_plinko',
  WITHDRAW_SOL: 'withdraw_sol',
  CONNECT_WALLET: 'connect_wallet',
  CHANGE_RISK: 'change_risk_level',
  CLICK_SOCIAL: 'click_social',
  TOKEN_SIGNUP: 'token_launch_signup',
};

// Add TypeScript declaration for window.gtag
declare global {
  interface Window {
    gtag: (
      command: string,
      actionOrTarget: string,
      params?: Record<string, unknown>
    ) => void;
    dataLayer: unknown[];
  }
} 