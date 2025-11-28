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
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/MetaMask_Fox.svg/512px-MetaMask_Fox.svg.png',
    deepLink: (uri: string) => {
      return `https://metamask.app.link/wc?uri=${encodeURIComponent(uri)}`;
    },
  },
  {
    id: 'rabby',
    name: 'Rabby',
    logo: 'https://raw.githubusercontent.com/RabbyHub/Rabby/develop/src/ui/assets/dashboard/rabby.svg',
    deepLink: (uri: string) => {
      return `https://rabby.io/wc?uri=${encodeURIComponent(uri)}`;
    },
  },
  {
    id: 'trust',
    name: 'Trust Wallet',
    logo: 'https://avatars.githubusercontent.com/u/32179889?s=200&v=4',
    deepLink: (uri: string) => {
      return `https://link.trustwallet.com/wc?uri=${encodeURIComponent(uri)}`;
    },
  },
  {
    id: 'phantom',
    name: 'Phantom',
    logo: 'https://avatars.githubusercontent.com/u/78782331?s=200&v=4',
    deepLink: (uri: string) => {
      return `https://phantom.app/ul/v1/browse/${encodeURIComponent(`wc:${uri}`)}?cluster=mainnet-beta`;
    },
  },
  {
    id: 'rainbow',
    name: 'Rainbow',
    logo: 'https://avatars.githubusercontent.com/u/48327834?s=200&v=4',
    deepLink: (uri: string) => {
      return `https://rnbwapp.com/wc?uri=${encodeURIComponent(uri)}`;
    },
  },
  {
    id: 'coinbase',
    name: 'Coinbase',
    logo: 'https://avatars.githubusercontent.com/u/18060234?s=200&v=4',
    deepLink: (uri: string) => {
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
 * Open wallet via deep link
 */
export function openWalletDeepLink(walletId: string, wcUri: string): boolean {
  const wallet = MOBILE_WALLETS.find(w => w.id === walletId);

  if (!wallet) {
    console.error(`Wallet ${walletId} not found`);
    return false;
  }

  try {
    const deepLinkUrl = wallet.deepLink(wcUri);
    console.log(`Opening ${wallet.name} with deep link...`);
    window.open(deepLinkUrl, '_blank');
    return true;
  } catch (error) {
    console.error(`Error opening deep link for ${wallet.name}:`, error);
    return false;
  }
}

/**
 * Get preferred mobile wallet from localStorage
 */
export function getPreferredMobileWallet(): WalletDeepLink | null {
  if (typeof window === 'undefined') return null;

  const savedPreference = localStorage.getItem('preferredMobileWallet');
  if (savedPreference) {
    const wallet = MOBILE_WALLETS.find(w => w.id === savedPreference);
    if (wallet) return wallet;
  }

  // Detection based on user agent
  const userAgent = navigator.userAgent.toLowerCase();

  if (userAgent.includes('metamask')) {
    return MOBILE_WALLETS.find(w => w.id === 'metamask') || null;
  }
  if (userAgent.includes('rabby')) {
    return MOBILE_WALLETS.find(w => w.id === 'rabby') || null;
  }
  if (userAgent.includes('trustwallet') || userAgent.includes('trust')) {
    return MOBILE_WALLETS.find(w => w.id === 'trust') || null;
  }

  return null;
}

/**
 * Save preferred wallet
 */
export function savePreferredMobileWallet(walletId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('preferredMobileWallet', walletId);
  } catch (error) {
    console.warn('Could not save wallet preference:', error);
  }
}
