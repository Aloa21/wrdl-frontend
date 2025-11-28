import { MOBILE_WALLETS, type WalletDeepLink } from './walletDeepLinks';

interface MobileWalletSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWallet: (walletId: string) => void;
  wallets?: WalletDeepLink[];
}

export const MobileWalletSelector = ({
  isOpen,
  onClose,
  onSelectWallet,
  wallets = MOBILE_WALLETS,
}: MobileWalletSelectorProps) => {
  if (!isOpen) return null;

  return (
    <div className="mobile-wallet-overlay" onClick={onClose}>
      <div className="mobile-wallet-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mobile-wallet-header">
          <h3>Choose Your Wallet</h3>
          <button className="mobile-wallet-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
        <p className="mobile-wallet-subtitle">Select the wallet app installed on your device</p>

        <div className="mobile-wallet-grid">
          {wallets.map((wallet) => (
            <button
              key={wallet.id}
              className="mobile-wallet-option"
              onClick={() => {
                onSelectWallet(wallet.id);
                onClose();
              }}
            >
              {wallet.logo && (
                <img
                  src={wallet.logo}
                  alt={wallet.name}
                  className="mobile-wallet-logo"
                />
              )}
              <span className="mobile-wallet-name">{wallet.name}</span>
            </button>
          ))}
        </div>

        <p className="mobile-wallet-footer">
          Don't have a wallet?{' '}
          <a
            href="https://metamask.io/download/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Get MetaMask
          </a>
        </p>
      </div>
    </div>
  );
};
