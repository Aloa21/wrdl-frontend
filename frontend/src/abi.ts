// WordleRoyaleFree - Free-to-Play with WRDLE prizes
export const WORDLE_ROYALE_ADDRESS = '0x6FBB86d5940B11E23056a66a948d97289Bd320eB' as const

// WRDLE Token
export const WORDLE_TOKEN_ADDRESS = '0xfE569A198cadA6E7b3B7C51a59b0A0C3b4157777' as const

export const WORDLE_ROYALE_ABI = [
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'resolver', type: 'address' },
      { indexed: true, name: 'gameId', type: 'uint256' },
      { indexed: true, name: 'player', type: 'address' },
    ],
    name: 'GameStarted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'resolver', type: 'address' },
      { indexed: true, name: 'gameId', type: 'uint256' },
      { indexed: true, name: 'winner', type: 'address' },
      { indexed: false, name: 'prize', type: 'uint256' },
      { indexed: false, name: 'guessCount', type: 'uint8' },
    ],
    name: 'GameResolved',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'funder', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    name: 'PrizePoolFunded',
    type: 'event',
  },
  // View functions
  {
    inputs: [],
    name: 'basePrize',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'perfectGameBonus',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'firstWinBonus',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'resolver', type: 'address' }],
    name: 'currentGameId',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'resolver', type: 'address' }],
    name: 'getCurrentGameId',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'player', type: 'address' }],
    name: 'getPlayerStats',
    outputs: [
      { name: 'wins', type: 'uint256' },
      { name: 'gamesPlayed', type: 'uint256' },
      { name: 'currentStreak', type: 'uint256' },
      { name: 'bestStreak', type: 'uint256' },
      { name: 'hasFirstWin', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'player', type: 'address' }],
    name: 'getStreakMultiplier',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'player', type: 'address' },
      { name: 'guessCount', type: 'uint8' },
    ],
    name: 'getExpectedPrize',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getWeeklyLeaderboard',
    outputs: [
      { name: 'players', type: 'address[]' },
      { name: 'wins', type: 'uint256[]' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getPrizePool',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'resolver', type: 'address' },
      { name: 'gameId', type: 'uint256' },
    ],
    name: 'isGameResolved',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'resolver', type: 'address' },
      { name: 'gameId', type: 'uint256' },
      { name: 'player', type: 'address' },
    ],
    name: 'isPlayerInGame',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Write functions
  {
    inputs: [{ name: 'resolver', type: 'address' }],
    name: 'join',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'resolver', type: 'address' },
      { name: 'gameId', type: 'uint256' },
      { name: 'winner', type: 'address' },
      { name: 'guessCount', type: 'uint8' },
      { name: 'signature', type: 'bytes' },
    ],
    name: 'resolve',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'fundPrizePool',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

export const WORDLE_TOKEN_ABI = [
  {
    inputs: [],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const
