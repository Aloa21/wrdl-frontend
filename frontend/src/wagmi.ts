import { http, createConfig } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'

// WalletConnect Project ID - Get yours at https://cloud.walletconnect.com/
const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID_HERE'

// Define Monad Mainnet chain
export const monad = {
  id: 143,
  name: 'Monad Mainnet',
  nativeCurrency: {
    decimals: 18,
    name: 'MON',
    symbol: 'MON',
  },
  rpcUrls: {
    default: { http: ['https://rpc.monad.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Monadscan', url: 'https://monadscan.com' },
  },
} as const

export const config = createConfig({
  chains: [monad],
  connectors: [
    // Injected connector for desktop browser wallets (MetaMask, Rabby, etc.)
    injected({
      shimDisconnect: false,
    }),
    // WalletConnect v2 for mobile wallets
    walletConnect({
      projectId: WALLETCONNECT_PROJECT_ID,
      metadata: {
        name: 'WRDL - Wordle on Monad',
        description: 'Play Wordle on Monad blockchain',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://wrdl.fun',
        icons: [typeof window !== 'undefined' ? `${window.location.origin}/wrdl-icon.svg` : 'https://wrdl.fun/wrdl-icon.svg'],
      },
      showQrModal: false, // We handle deep linking ourselves
    }),
  ],
  transports: {
    [monad.id]: http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
