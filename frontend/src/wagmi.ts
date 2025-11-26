import { http, createConfig } from 'wagmi'
import { injected } from 'wagmi/connectors'

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
    injected(),
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
