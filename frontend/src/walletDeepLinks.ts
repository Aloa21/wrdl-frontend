/**
 * Mobile Wallet Deep Links
 *
 * Utility to open mobile wallet apps directly via deep links
 * instead of showing QR codes. Improves UX on mobile.
 */

export interface WalletDeepLink {
  id: string;
  name: string;
  deepLink: (uri: string) => string;
  logo?: string;
}

/**
 * List of supported mobile wallets with their deep links
 */
export const MOBILE_WALLETS: WalletDeepLink[] = [
  {
    id: 'metamask',
    name: 'MetaMask',
    logo: '/icons/wallets/metamask.svg',
    deepLink: (uri: string) => {
      // MetaMask mobile deep link format
      return `https://metamask.app.link/wc?uri=${encodeURIComponent(uri)}`;
    },
  },
  {
    id: 'trust',
    name: 'Trust Wallet',
    logo: '/icons/wallets/trust.svg',
    deepLink: (uri: string) => {
      // Trust Wallet deep link format
      return `https://link.trustwallet.com/wc?uri=${encodeURIComponent(uri)}`;
    },
  },
  {
    id: 'phantom',
    name: 'Phantom',
    logo: '/icons/wallets/phantom.svg',
    deepLink: (uri: string) => {
      // Phantom wallet deep link format (supports multi-chain including EVM)
      return `https://phantom.app/ul/v1/browse/${encodeURIComponent(`wc:${uri}`)}?cluster=mainnet-beta`;
    },
  },
  {
    id: 'rabby',
    name: 'Rabby',
    logo: '/icons/wallets/rabby.svg',
    deepLink: (uri: string) => {
      // Rabby mobile deep link format
      return `https://rabby.io/wc?uri=${encodeURIComponent(uri)}`;
    },
  },
  {
    id: 'rainbow',
    name: 'Rainbow',
    logo: '/icons/wallets/rainbow.svg',
    deepLink: (uri: string) => {
      // Rainbow wallet deep link format
      return `https://rnbwapp.com/wc?uri=${encodeURIComponent(uri)}`;
    },
  },
  {
    id: 'coinbase',
    name: 'Coinbase',
    logo: '/icons/wallets/coinbase.svg',
    deepLink: (uri: string) => {
      // Coinbase Wallet deep link format
      return `https://go.cb-w.com/wc?uri=${encodeURIComponent(uri)}`;
    },
  },
];

/**
 * Detect if device is mobile
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

/**
 * Get mobile OS
 */
export function getMobileOS(): 'ios' | 'android' | 'unknown' {
  if (typeof window === 'undefined') return 'unknown';

  const userAgent = navigator.userAgent.toLowerCase();

  if (/iphone|ipad|ipod/.test(userAgent)) {
    return 'ios';
  }

  if (/android/.test(userAgent)) {
    return 'android';
  }

  return 'unknown';
}

/**
 * Open wallet via deep link
 */
export function openWalletDeepLink(walletId: string, wcUri: string): boolean {
  console.log(`🔍 openWalletDeepLink called with walletId: "${walletId}"`);
  console.log(`🔍 WC URI received:`, wcUri);

  const wallet = MOBILE_WALLETS.find(w => w.id === walletId);

  if (!wallet) {
    console.error(`❌ Wallet ${walletId} not found in supported wallets list`);
    console.log(`📋 Available wallets:`, MOBILE_WALLETS.map(w => w.id));
    return false;
  }

  console.log(`✅ Wallet found: ${wallet.name}`);

  try {
    const deepLinkUrl = wallet.deepLink(wcUri);
    console.log(`🔗 Deep link generated for ${wallet.name}:`, deepLinkUrl);
    console.log(`📏 Deep link length: ${deepLinkUrl.length} characters`);

    // Open deep link
    console.log(`🚀 Calling window.location.href with deep link...`);

    // Use location.href for better mobile compatibility
    window.location.href = deepLinkUrl;

    return true;
  } catch (error) {
    console.error(`❌ Error opening deep link for ${wallet.name}:`, error);
    return false;
  }
}

/**
 * Get preferred mobile wallet from localStorage
 */
export function getPreferredMobileWallet(): WalletDeepLink | null {
  if (typeof window === 'undefined') return null;

  // 1. Check for saved preference
  const savedPreference = localStorage.getItem('preferredMobileWallet');
  if (savedPreference) {
    const wallet = MOBILE_WALLETS.find(w => w.id === savedPreference);
    if (wallet) {
      console.log(`📱 Preferred wallet found in localStorage: ${wallet.name}`);
      return wallet;
    }
  }

  // 2. Detection based on user agent (some wallets modify the user agent)
  const userAgent = navigator.userAgent.toLowerCase();

  if (userAgent.includes('metamask')) {
    return MOBILE_WALLETS.find(w => w.id === 'metamask') || null;
  }

  if (userAgent.includes('rabby')) {
    return MOBILE_WALLETS.find(w => w.id === 'rabby') || null;
  }

  if (userAgent.includes('phantom')) {
    return MOBILE_WALLETS.find(w => w.id === 'phantom') || null;
  }

  if (userAgent.includes('trustwallet') || userAgent.includes('trust')) {
    return MOBILE_WALLETS.find(w => w.id === 'trust') || null;
  }

  // 3. Default: null (show selection list)
  return null;
}

/**
 * Save preferred wallet for future connections
 */
export function savePreferredMobileWallet(walletId: string): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem('preferredMobileWallet', walletId);
    console.log(`💾 Preferred wallet saved: ${walletId}`);
  } catch (error) {
    console.warn('⚠️ Could not save wallet preference:', error);
  }
}

/**
 * Clear preferred wallet
 */
export function clearPreferredMobileWallet(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem('preferredMobileWallet');
    console.log(`🗑️ Preferred wallet cleared`);
  } catch (error) {
    console.warn('⚠️ Could not clear wallet preference:', error);
  }
}
