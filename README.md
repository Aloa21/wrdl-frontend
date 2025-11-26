# Wordle Royale

A decentralized Wordle game on Monad blockchain where players stake MON to play and win WMON prizes + WRDLE token rewards.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           WORDLE ROYALE                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────────────┐  │
│  │   Frontend   │◄────►│   Backend    │      │   Smart Contracts    │  │
│  │   (React)    │      │  (Express)   │      │      (Solidity)      │  │
│  └──────┬───────┘      └──────┬───────┘      └──────────┬───────────┘  │
│         │                     │                         │               │
│         │  1. Join Game       │                         │               │
│         ├─────────────────────┼────────────────────────►│               │
│         │                     │                         │               │
│         │  2. Start Session   │                         │               │
│         ├────────────────────►│                         │               │
│         │◄────────────────────┤ (sessionId + token)     │               │
│         │                     │                         │               │
│         │  3. Submit Guesses  │                         │               │
│         ├────────────────────►│                         │               │
│         │◄────────────────────┤ (results)               │               │
│         │                     │                         │               │
│         │  4. Claim Signature │                         │               │
│         ├────────────────────►│                         │               │
│         │◄────────────────────┤ (EIP-712 signature)     │               │
│         │                     │                         │               │
│         │  5. Resolve Game    │                         │               │
│         ├─────────────────────┼────────────────────────►│               │
│         │                     │                         │               │
└─────────┴─────────────────────┴─────────────────────────┴───────────────┘
```

## How It Works

### Game Flow

1. **Player Joins Game (On-Chain)**
   - Player connects wallet and pays entry fee in MON
   - Smart contract wraps MON to WMON and adds to prize pool
   - Contract emits `PlayerJoined` event

2. **Backend Creates Session**
   - Frontend calls `/api/game/start` with player address and gameId
   - Backend generates random word using `SERVER_SECRET + gameId + player + timestamp`
   - Returns `sessionId` and `token` for authentication

3. **Player Guesses Words**
   - Each guess sent to `/api/game/guess` with session token
   - Backend validates guess and returns colored results:
     - `correct` (green) - Right letter, right position
     - `present` (yellow) - Right letter, wrong position
     - `absent` (gray) - Letter not in word
   - Player has 6 attempts to guess the 5-letter word

4. **Winning Player Claims Reward**
   - If player wins, frontend requests signature from `/api/game/claim`
   - Backend verifies win and signs EIP-712 typed data message
   - Signature authorizes the payout amount

5. **Resolve Game (On-Chain)**
   - Player submits signature to smart contract
   - Contract verifies resolver signature
   - Winner receives WMON prize pool + WRDLE token rewards

### Reward System

| Reward Type | Amount | Description |
|-------------|--------|-------------|
| Base Reward | 10 WRDLE | Every win |
| Perfect Game | +100 WRDLE | Win in 1 guess |
| First Win | +50 WRDLE | First ever win |
| 10 Wins | +100 WRDLE | Milestone bonus |
| 50 Wins | +500 WRDLE | Milestone bonus |
| 100 Wins | +1000 WRDLE | Milestone bonus |

**Streak Multipliers:**
| Streak | Multiplier |
|--------|------------|
| Day 2 | 1.5x |
| Day 3 | 2.0x |
| Day 7+ | 3.0x |

### Security Model

#### Why Backend Validation?

Without a backend, word selection would be on-chain or in the frontend:
- **On-chain words**: Visible to anyone reading contract storage
- **Frontend words**: Visible in browser dev tools

The backend keeps words secret and validates games legitimately.

#### Security Features

| Feature | Protection |
|---------|------------|
| Session Tokens | Prevents session hijacking - only session creator can submit guesses |
| Random Word Selection | Uses `SHA256(SERVER_SECRET + gameId + player + timestamp)` - unpredictable |
| Rate Limiting | 30 requests/minute per IP - prevents brute force |
| CORS Restriction | Only allowed origins can call API |
| Input Validation | All inputs validated (addresses, guesses, session IDs) |
| Server-Side Payout | Backend calculates payout from config - client can't inflate |
| Double Claim Prevention | Each session can only claim once |
| EIP-712 Signatures | Typed data signing prevents replay attacks |

#### Trust Model

```
┌─────────────────────────────────────────────────────────┐
│                    TRUST BOUNDARIES                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  TRUSTLESS (Blockchain)         TRUSTED (Backend)        │
│  ├── Entry fee payment          ├── Word selection       │
│  ├── Prize pool custody         ├── Guess validation     │
│  ├── Signature verification     ├── Win determination    │
│  ├── WRDLE token minting        └── Result signing       │
│  └── Payout distribution                                 │
│                                                          │
│  Players trust that the backend:                         │
│  1. Selects words fairly (randomly)                      │
│  2. Validates guesses honestly                           │
│  3. Only signs legitimate wins                           │
│                                                          │
│  The resolver private key is the "oracle" for the game   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Smart Contracts

### WordleRoyaleV2 (0x08D588347746D86384Ba5F2aa5636ef08c9F971f)

Main game contract handling:
- Player joins with MON (wrapped to WMON)
- Prize pool management
- EIP-712 signature verification
- WRDLE token reward distribution
- Streak and milestone tracking

### WordleToken (0xa1d2c0ea74dc49588078D234B68d5Ca527f91c67)

ERC20 reward token (WRDLE):
- Max supply: 100,000,000 WRDLE
- Minter role assigned to game contract
- Rewards distributed on game resolution

### Key Functions

```solidity
// Join a game by paying entry fee
function join(GameConfig calldata config) external payable;

// Resolve game with backend signature
function resolve(
    GameConfig calldata config,
    uint256 gameId,
    address winner,
    uint256 payout,
    uint8 guessCount,
    bytes calldata signature
) external;

// View functions
function getPrizePool(GameConfig calldata config, uint256 gameId) external view returns (uint256);
function isPlayerInGame(GameConfig calldata config, uint256 gameId, address player) external view returns (bool);
function getPlayerStats(address player) external view returns (uint256 wins, uint256 gamesPlayed, uint256 currentStreak, uint256 bestStreak, bool hasFirstWin);
```

## Project Structure

```
MonadGioco/
├── contracts/                 # Solidity smart contracts
│   ├── WordleRoyaleV2.sol    # Main game contract
│   └── WordleToken.sol       # WRDLE ERC20 token
│
├── backend/                   # Express.js server
│   ├── server.js             # API endpoints & game logic
│   ├── package.json
│   ├── .env                  # RESOLVER_PRIVATE_KEY, SERVER_SECRET
│   └── .env.example
│
├── frontend/                  # React + Vite app
│   ├── src/
│   │   ├── App.tsx           # Main game UI
│   │   ├── App.css           # Styling
│   │   ├── api.ts            # Backend API client
│   │   ├── abi.ts            # Contract ABIs
│   │   └── wagmi.ts          # Wallet config
│   ├── package.json
│   └── .env                  # VITE_API_URL (optional)
│
├── test/                      # Contract tests
├── hardhat.config.js
└── README.md
```

## API Reference

### GET /api/resolver
Returns the resolver wallet address.

**Response:**
```json
{
  "resolver": "0xeF9956b8Cd517a21e0C32260da8ef29745DAfeeb"
}
```

### POST /api/game/start
Start a new game session.

**Request:**
```json
{
  "player": "0x...",
  "gameId": "5",
  "configHash": "0x..."
}
```

**Response:**
```json
{
  "sessionId": "0x79ddb4e8af69996fd69f13e798b6fcb7",
  "token": "a1b2c3d4...",
  "wordLength": 5,
  "maxGuesses": 6
}
```

### POST /api/game/guess
Submit a guess.

**Request:**
```json
{
  "sessionId": "0x...",
  "guess": "MONAD",
  "token": "a1b2c3d4..."
}
```

**Response:**
```json
{
  "guess": "MONAD",
  "result": ["correct", "absent", "present", "absent", "absent"],
  "guessNumber": 1,
  "isCorrect": false,
  "isGameOver": false,
  "won": false
}
```

### POST /api/game/claim
Get signature for winning game.

**Request:**
```json
{
  "sessionId": "0x...",
  "config": {
    "resolver": "0x...",
    "entryFee": "10000000000000000",
    "capacity": "1"
  },
  "token": "a1b2c3d4..."
}
```

**Response:**
```json
{
  "signature": "0xda0a6b81410332be85...",
  "winner": "0x...",
  "guessCount": 3,
  "gameId": "5",
  "payout": "10000000000000000"
}
```

## Setup & Installation

### Prerequisites
- Node.js 18+
- MetaMask or compatible wallet
- MON on Monad Mainnet

### Backend Setup

```bash
cd backend
npm install

# Create .env file
cp .env.example .env

# Edit .env with your values:
# RESOLVER_PRIVATE_KEY=0x...  (wallet that signs game results)
# SERVER_SECRET=...           (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
# PORT=3001

# Start server
npm run dev
```

### Frontend Setup

```bash
cd frontend
npm install

# Optional: Create .env for custom API URL
echo "VITE_API_URL=http://localhost:3001" > .env

# Start dev server
npm run dev
```

### Contract Deployment (if needed)

```bash
# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Deploy (update hardhat.config.js with your settings)
npx hardhat run scripts/deploy.js --network monad
```

## Configuration

### Game Config Structure

```typescript
type GameConfig = {
  resolver: address    // Backend wallet that signs results
  entryFee: uint256   // Entry fee in wei (e.g., 0.01 MON)
  capacity: uint256   // Players per game (1 for single player)
}
```

### Environment Variables

**Backend (.env):**
```
RESOLVER_PRIVATE_KEY=0x...   # Signs game results
SERVER_SECRET=...            # For word randomization
PORT=3001                    # API port
NODE_ENV=development         # development or production
```

**Frontend (.env):**
```
VITE_API_URL=http://localhost:3001   # Backend URL
```

## Network Information

| Property | Value |
|----------|-------|
| Network | Monad Mainnet |
| Chain ID | 143 |
| RPC URL | https://rpc.monad.xyz |
| Block Explorer | https://monadscan.com |
| Game Contract | 0x08D588347746D86384Ba5F2aa5636ef08c9F971f |
| Token Contract | 0xa1d2c0ea74dc49588078D234B68d5Ca527f91c67 |
| WMON Contract | 0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A |

## Word List

The game uses a curated list of 5-letter words stored server-side. Current test list:
- MONAD, BLOCK, CHAIN, TOKEN, STAKE
- CRAFT, SMART, PROOF, VALID, NODES

For production, expand to 400+ words for variety.

## Testing

### Run Security Tests
```bash
cd backend
node test-security.js
```

### Run E2E Test (uses real MON)
```bash
cd backend
node test-e2e.js
```

## Production Checklist

- [ ] Generate new `RESOLVER_PRIVATE_KEY` (current one is exposed)
- [ ] Generate permanent `SERVER_SECRET`
- [ ] Expand word list to 400+ words
- [ ] Update `ALLOWED_ORIGINS` in server.js for production domain
- [ ] Set `NODE_ENV=production`
- [ ] Use Redis/PostgreSQL for session storage (instead of in-memory Map)
- [ ] Add HTTPS termination
- [ ] Set up monitoring and logging
- [ ] Fund resolver wallet with MON for gas (if needed)

## License

MIT
