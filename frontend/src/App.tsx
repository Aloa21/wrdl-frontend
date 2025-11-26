import { useState, useEffect, useCallback } from 'react'
import {
  useAccount,
  useConnect,
  useDisconnect,
  useBalance,
  useWriteContract,
  useReadContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
  useChainId,
} from 'wagmi'
import { formatEther, type Address } from 'viem'
import { WORDLE_ROYALE_ADDRESS, WORDLE_ROYALE_ABI, WORDLE_TOKEN_ADDRESS, WORDLE_TOKEN_ABI } from './abi'
import { monad } from './wagmi'
import * as api from './api'
import './App.css'

type LetterState = 'correct' | 'present' | 'absent' | 'empty' | 'active'

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫']
]

function App() {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const chainId = useChainId()
  const { data: balance } = useBalance({ address })

  // Game config state
  const [resolverAddress, setResolverAddress] = useState<Address | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [guessResults, setGuessResults] = useState<api.GuessResult[]>([])
  const [logs, setLogs] = useState<{ msg: string; type: string }[]>([])

  // Game state
  const [gamePhase, setGamePhase] = useState<'lobby' | 'playing' | 'finished'>('lobby')
  const [targetWord, setTargetWord] = useState('')
  const [guesses, setGuesses] = useState<string[]>([])
  const [currentGuess, setCurrentGuess] = useState('')
  const [gameWon, setGameWon] = useState(false)
  const [playingGameId, setPlayingGameId] = useState<bigint | null>(null)
  const [keyboardState, setKeyboardState] = useState<Record<string, LetterState>>({})
  const [shakeRow, setShakeRow] = useState(false)
  const [victoryRow, setVictoryRow] = useState<number | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)

  // Fetch resolver address from backend
  useEffect(() => {
    api.getResolver()
      .then(resolver => setResolverAddress(resolver as Address))
      .catch(err => {
        console.error('Failed to get resolver:', err)
      })
  }, [])

  // Contract reads - using resolver address directly
  const { data: currentGameId, refetch: refetchGameId } = useReadContract({
    address: WORDLE_ROYALE_ADDRESS,
    abi: WORDLE_ROYALE_ABI,
    functionName: 'getCurrentGameId',
    args: resolverAddress ? [resolverAddress] : undefined,
    query: { enabled: !!resolverAddress },
  })

  const { data: isResolved, refetch: refetchIsResolved } = useReadContract({
    address: WORDLE_ROYALE_ADDRESS,
    abi: WORDLE_ROYALE_ABI,
    functionName: 'isGameResolved',
    args: resolverAddress && playingGameId !== null ? [resolverAddress, playingGameId] : undefined,
    query: { enabled: !!resolverAddress && playingGameId !== null },
  })

  // Player stats
  const { data: playerStats, refetch: refetchStats } = useReadContract({
    address: WORDLE_ROYALE_ADDRESS,
    abi: WORDLE_ROYALE_ABI,
    functionName: 'getPlayerStats',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  // Streak multiplier
  const { data: streakMultiplier } = useReadContract({
    address: WORDLE_ROYALE_ADDRESS,
    abi: WORDLE_ROYALE_ABI,
    functionName: 'getStreakMultiplier',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  // Token balance
  const { data: tokenBalance, refetch: refetchTokenBalance } = useReadContract({
    address: WORDLE_TOKEN_ADDRESS,
    abi: WORDLE_TOKEN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  // Prize pool
  const { data: prizePool } = useReadContract({
    address: WORDLE_ROYALE_ADDRESS,
    abi: WORDLE_ROYALE_ABI,
    functionName: 'getPrizePool',
    query: { enabled: isConnected },
  })

  // Weekly leaderboard
  const { data: leaderboardData } = useReadContract({
    address: WORDLE_ROYALE_ADDRESS,
    abi: WORDLE_ROYALE_ABI,
    functionName: 'getWeeklyLeaderboard',
    query: { enabled: isConnected },
  })

  // Contract writes
  const { writeContract: joinGame, data: joinTxHash, isPending: isJoining } = useWriteContract()
  const { isLoading: isJoinConfirming, isSuccess: isJoinConfirmed } = useWaitForTransactionReceipt({ hash: joinTxHash })

  const { writeContract: resolveGame, data: resolveTxHash, isPending: isResolving } = useWriteContract()
  const { isLoading: isResolveConfirming, isSuccess: isResolveConfirmed } = useWaitForTransactionReceipt({ hash: resolveTxHash })

  const addLog = useCallback((msg: string, type: string = '') => {
    setLogs((prev) => [{ msg: `${new Date().toLocaleTimeString()} - ${msg}`, type }, ...prev.slice(0, 19)])
  }, [])

  // Handle join confirmation
  useEffect(() => {
    if (isJoinConfirmed && currentGameId !== undefined && address && resolverAddress) {
      addLog('Game registered on-chain!', 'success')
      // The game ID we joined is the one before the current (since it increments after join)
      const gameWeJoined = currentGameId > 0n ? currentGameId - 1n : 0n
      setPlayingGameId(gameWeJoined)
      refetchGameId()

      // Start game session with backend
      api.startGame(address, gameWeJoined)
        .then((session) => {
          setSessionId(session.sessionId)
          setSessionToken(session.token)
          setGuesses([])
          setGuessResults([])
          setCurrentGuess('')
          setGameWon(false)
          setKeyboardState({})
          setGamePhase('playing')
          addLog(`Game started! Guess the ${session.wordLength}-letter word`, 'success')
        })
        .catch((err) => {
          addLog(`Failed to start game: ${err.message}`, 'error')
        })
    }
  }, [isJoinConfirmed, currentGameId, addLog, refetchGameId, address, resolverAddress])

  // Handle resolve confirmation
  useEffect(() => {
    if (isResolveConfirmed) {
      addLog('Game resolved! WRDLE rewards sent!', 'success')
      setGamePhase('lobby')
      setPlayingGameId(null)
      refetchGameId()
      refetchStats()
      refetchTokenBalance()
      refetchIsResolved()
    }
  }, [isResolveConfirmed, addLog, refetchGameId, refetchStats, refetchTokenBalance, refetchIsResolved])

  const handleJoin = () => {
    if (!resolverAddress) return addLog('Resolver not loaded yet', 'error')
    addLog('Joining free game...')
    joinGame({
      address: WORDLE_ROYALE_ADDRESS,
      abi: WORDLE_ROYALE_ABI,
      functionName: 'join',
      args: [resolverAddress],
    })
  }

  const handleConnect = () => {
    const injected = connectors.find((c) => c.id === 'injected')
    if (injected) connect({ connector: injected })
  }

  // Get letter state from backend results
  const getLetterStateFromResults = (guessIndex: number, letterIndex: number): LetterState => {
    if (guessIndex < guessResults.length) {
      return guessResults[guessIndex].result[letterIndex]
    }
    return 'empty'
  }

  const submitGuess = useCallback(async () => {
    if (currentGuess.length !== 5) {
      setShakeRow(true)
      setTimeout(() => setShakeRow(false), 500)
      addLog('Word must be 5 letters', 'error')
      return
    }

    if (!sessionId || !sessionToken) {
      addLog('No active game session', 'error')
      return
    }

    const guess = currentGuess.toUpperCase()

    try {
      const result = await api.submitGuess(sessionId, guess, sessionToken)

      // Clear guess only on successful submission
      setCurrentGuess('')

      // Update guesses and results
      setGuesses(prev => [...prev, result.guess])
      setGuessResults(prev => [...prev, result])

      // Update keyboard state based on result
      const newKeyboardState = { ...keyboardState }
      result.guess.split('').forEach((letter, i) => {
        const state = result.result[i]
        if (!newKeyboardState[letter] ||
            (newKeyboardState[letter] === 'absent' && state !== 'absent') ||
            (newKeyboardState[letter] === 'present' && state === 'correct')) {
          newKeyboardState[letter] = state
        }
      })
      setKeyboardState(newKeyboardState)

      if (result.isCorrect) {
        setGameWon(true)
        setTargetWord(result.word || '')
        setVictoryRow(result.guessNumber - 1)
        setShowConfetti(true)
        addLog(`Correct! You won in ${result.guessNumber} ${result.guessNumber === 1 ? 'try' : 'tries'}!`, 'success')
        // Delay showing the finished screen to let the animation play
        setTimeout(() => {
          setGamePhase('finished')
          setVictoryRow(null)
          setShowConfetti(false)
        }, 2000)
      } else if (result.isGameOver) {
        setTargetWord(result.word || '')
        setGamePhase('finished')
        addLog(`Game over! The word was ${result.word}`, 'error')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit guess'
      // If word is not in the list, shake but keep the current guess
      if (errorMessage.includes('Not in word list')) {
        setShakeRow(true)
        setTimeout(() => setShakeRow(false), 500)
        addLog('Not in word list', 'error')
      } else {
        addLog(errorMessage, 'error')
      }
    }
  }, [currentGuess, sessionId, sessionToken, addLog, keyboardState])

  // Keyboard input handler
  const handleKeyPress = useCallback((key: string) => {
    if (gamePhase !== 'playing') return

    if (key === 'ENTER') {
      submitGuess()
    } else if (key === '⌫' || key === 'BACKSPACE') {
      setCurrentGuess(prev => prev.slice(0, -1))
    } else if (key.length === 1 && /[A-Z]/i.test(key) && currentGuess.length < 5) {
      setCurrentGuess(prev => (prev + key.toUpperCase()).slice(0, 5))
    }
  }, [gamePhase, currentGuess, submitGuess])

  // Physical keyboard listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      handleKeyPress(e.key.toUpperCase())
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleKeyPress])

  const handleResolve = async () => {
    if (!resolverAddress || playingGameId === null || !address || !sessionId || !sessionToken) return

    try {
      addLog('Requesting signature from server...')

      // Get signature from backend
      const claimResult = await api.claimSignature(sessionId, sessionToken)

      addLog('Claiming WRDLE rewards...')
      resolveGame({
        address: WORDLE_ROYALE_ADDRESS,
        abi: WORDLE_ROYALE_ABI,
        functionName: 'resolve',
        args: [
          resolverAddress,
          playingGameId,
          address,
          claimResult.guessCount,
          claimResult.signature as `0x${string}`
        ],
      })
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      addLog(`Error: ${errorMessage}`, 'error')
    }
  }

  const isWrongNetwork = isConnected && chainId !== monad.id

  // Render Wordle Grid
  const renderGrid = () => {
    const rows = []
    for (let i = 0; i < 6; i++) {
      const guess = guesses[i] || ''
      const isCurrentRow = i === guesses.length
      const isVictoryRow = victoryRow === i
      const tiles = []

      for (let j = 0; j < 5; j++) {
        let letter = ''
        let state: LetterState = 'empty'

        if (i < guesses.length) {
          letter = guess[j] || ''
          state = getLetterStateFromResults(i, j)
        } else if (isCurrentRow) {
          letter = currentGuess[j] || ''
          state = letter ? 'active' : 'empty'
        }

        tiles.push(
          <div
            key={j}
            className={`wordle-tile ${state} ${isCurrentRow && shakeRow ? 'shake' : ''} ${isVictoryRow ? 'victory' : ''}`}
            style={{ animationDelay: i < guesses.length ? `${j * 0.1}s` : '0s' }}
          >
            {letter}
          </div>
        )
      }

      rows.push(
        <div key={i} className={`wordle-row ${isVictoryRow ? 'victory-row' : ''}`}>
          {tiles}
        </div>
      )
    }
    return rows
  }

  // Render Virtual Keyboard
  const renderKeyboard = () => {
    return (
      <div className="keyboard">
        {KEYBOARD_ROWS.map((row, i) => (
          <div key={i} className="keyboard-row">
            {row.map((key) => (
              <button
                key={key}
                className={`key ${key.length > 1 ? 'wide' : ''} ${keyboardState[key] || ''}`}
                onClick={() => handleKeyPress(key)}
              >
                {key}
              </button>
            ))}
          </div>
        ))}
      </div>
    )
  }

  // Generate confetti particles
  const renderConfetti = () => {
    if (!showConfetti) return null
    const particles = []
    for (let i = 0; i < 50; i++) {
      const left = Math.random() * 100
      const delay = Math.random() * 0.5
      const size = Math.random() * 8 + 6
      particles.push(
        <div
          key={i}
          className="confetti"
          style={{
            left: `${left}%`,
            animationDelay: `${delay}s`,
            width: `${size}px`,
            height: `${size}px`,
          }}
        />
      )
    }
    return <div className="confetti-container">{particles}</div>
  }

  return (
    <div className="container">
      {renderConfetti()}
      <header>
        <div className="logo">
          <div className="logo-icon">W</div>
          <h1>WORDLE ROYALE</h1>
        </div>
        <p className="subtitle">Play Free. Guess Words. Earn WRDLE.</p>
        <span className="network-badge">Monad Mainnet</span>
      </header>

      {!isConnected ? (
        <div className="card connect-screen">
          <div className="connect-icon">🎮</div>
          <h2 className="connect-title" style={{ justifyContent: 'center' }}>Connect to Play</h2>
          <p className="connect-desc">
            Connect your wallet to play Wordle Royale for free!
            Win WRDLE token prizes with every victory.
          </p>
          <button className="btn" onClick={handleConnect}>
            Connect Wallet
          </button>
        </div>
      ) : (
        <>
          {isWrongNetwork && (
            <div className="card" style={{ borderColor: 'var(--warning)' }}>
              <h2 style={{ color: 'var(--warning)' }}>Wrong Network</h2>
              <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
                Please switch to Monad Mainnet to continue
              </p>
              <button className="btn" onClick={() => switchChain({ chainId: monad.id })}>
                Switch to Monad
              </button>
            </div>
          )}

          {/* Wallet & Stats Card */}
          <div className="card">
            <div className="wallet-info">
              <span className="address">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
              <span className="balance">
                {balance ? parseFloat(formatEther(balance.value)).toFixed(4) : '0'} MON
              </span>
              <span className="balance wrdle-balance">
                {tokenBalance ? parseFloat(formatEther(tokenBalance)).toFixed(0) : '0'} WRDLE
              </span>
              <button className="btn btn-secondary" onClick={() => disconnect()}>
                Disconnect
              </button>
            </div>

            {/* Player Stats */}
            <div className="game-status" style={{ marginTop: '16px' }}>
              <div className="stat-box">
                <div className="value">{playerStats ? playerStats[0].toString() : '0'}</div>
                <div className="label">Wins</div>
              </div>
              <div className="stat-box">
                <div className="value">{playerStats ? playerStats[1].toString() : '0'}</div>
                <div className="label">Games</div>
              </div>
              <div className="stat-box">
                <div className="value">{playerStats ? playerStats[2].toString() : '0'}</div>
                <div className="label">Streak</div>
              </div>
              <div className="stat-box">
                <div className="value">{playerStats ? playerStats[3].toString() : '0'}</div>
                <div className="label">Best</div>
              </div>
              <div className="stat-box highlight">
                <div className="value">{streakMultiplier ? `${(Number(streakMultiplier) / 10000).toFixed(1)}x` : '1x'}</div>
                <div className="label">Multiplier</div>
              </div>
            </div>
          </div>

          {/* PLAYING */}
          {gamePhase === 'playing' && (
            <div className="card">
              <div className="prize-display">
                <div className="prize-amount">
                  10+ WRDLE
                </div>
                <div className="prize-label">Win Reward</div>
                <div style={{ marginTop: '8px', fontSize: '0.9rem', color: 'var(--accent)' }}>
                  + streak multipliers & achievement bonuses
                </div>
              </div>

              <div className="wordle-container">
                {renderGrid()}
              </div>

              {renderKeyboard()}
            </div>
          )}

          {/* FINISHED */}
          {gamePhase === 'finished' && (
            <div className="card" style={{ textAlign: 'center' }}>
              <div className="result-icon">{gameWon ? '🏆' : '😔'}</div>
              <h2 className={`result-title ${gameWon ? 'win' : 'lose'}`} style={{ justifyContent: 'center' }}>
                {gameWon ? 'Victory!' : 'Game Over'}
              </h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>
                The word was: <strong style={{ color: 'var(--accent)' }}>{targetWord}</strong>
              </p>

              {gameWon && (
                <div className="prize-display">
                  <div className="prize-amount">
                    10+ WRDLE
                  </div>
                  <div className="prize-label">Your Reward</div>
                  <div style={{ marginTop: '8px', fontSize: '0.9rem', color: 'var(--accent)' }}>
                    {guesses.length === 1 ? '+ 100 WRDLE perfect game bonus!' : '+ streak & achievement bonuses'}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px' }}>
                {gameWon && !isResolved && (
                  <button
                    className="btn btn-success"
                    onClick={handleResolve}
                    disabled={isResolving || isResolveConfirming}
                  >
                    {isResolving || isResolveConfirming ? 'Claiming...' : 'Claim WRDLE Rewards'}
                  </button>
                )}
                {isResolved && (
                  <p style={{ color: 'var(--accent)', fontWeight: '600' }}>WRDLE Rewards claimed!</p>
                )}
                <button
                  className="btn btn-secondary"
                  onClick={() => { setGamePhase('lobby'); setPlayingGameId(null); }}
                >
                  Play Again
                </button>
              </div>
            </div>
          )}

          {/* LOBBY */}
          {gamePhase === 'lobby' && (
            <div className="desktop-grid">
              {/* Play Section */}
              <div className="card play-card">
                <h2>Play Wordle Royale</h2>

                <div className="play-hero">
                  <div className="play-icon">🎮</div>
                  <p>Guess the 5-letter word in 6 tries or less!</p>
                </div>

                <button
                  className="btn btn-success play-btn"
                  onClick={handleJoin}
                  disabled={isJoining || isJoinConfirming || !resolverAddress}
                >
                  {isJoining || isJoinConfirming ? 'Starting...' : 'Play Now - FREE!'}
                </button>

                <div className="color-guide">
                  <div className="guide-item">
                    <span className="guide-tile correct">A</span>
                    <span>Correct spot</span>
                  </div>
                  <div className="guide-item">
                    <span className="guide-tile present">B</span>
                    <span>Wrong spot</span>
                  </div>
                  <div className="guide-item">
                    <span className="guide-tile absent">C</span>
                    <span>Not in word</span>
                  </div>
                </div>
              </div>

              {/* Rewards & How to Earn */}
              <div className="card rewards-card">
                <h2>WRDLE Rewards</h2>

                <div className="rewards-compact">
                  <div className="reward-item main">
                    <span className="reward-label">Base Win Reward</span>
                    <span className="reward-amount">10 WRDLE</span>
                  </div>
                  <div className="reward-item bonus">
                    <span className="reward-label">Perfect Game (1 guess)</span>
                    <span className="reward-amount">+100 WRDLE</span>
                  </div>
                  <div className="reward-item bonus">
                    <span className="reward-label">First Win Ever</span>
                    <span className="reward-amount">+50 WRDLE</span>
                  </div>
                  <div className="reward-item bonus">
                    <span className="reward-label">Milestones (10/50/100)</span>
                    <span className="reward-amount">+100/500/1K</span>
                  </div>
                </div>

                <div className="streak-compact">
                  <h3>Streak Multipliers</h3>
                  <div className="streak-pills">
                    <span className="streak-pill">1d: 1x</span>
                    <span className="streak-pill">2d: 1.2x</span>
                    <span className="streak-pill">3d: 1.5x</span>
                    <span className="streak-pill">5d: 2x</span>
                    <span className="streak-pill highlight">7d+: 3x</span>
                  </div>
                </div>

                {prizePool !== undefined && (
                  <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-elevated)', borderRadius: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Prize Pool</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--accent)' }}>
                      {parseFloat(formatEther(prizePool)).toFixed(0)} WRDLE
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Leaderboard - Full width */}
          {gamePhase === 'lobby' && (
            <div className="card">
              <h2>Weekly Leaderboard</h2>
              {leaderboardData && leaderboardData[0].length > 0 ? (
                <>
                  <div className="leaderboard">
                    {leaderboardData[0]
                      .map((player, i) => ({ player, wins: leaderboardData[1][i] }))
                      .sort((a, b) => Number(b.wins) - Number(a.wins))
                      .slice(0, 10)
                      .map((entry, rank) => (
                        <div
                          key={rank}
                          className={`leaderboard-row ${entry.player === address ? 'you' : ''}`}
                        >
                          <span className="rank">
                            {rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `#${rank + 1}`}
                          </span>
                          <span className="player-address">
                            {entry.player.slice(0, 6)}...{entry.player.slice(-4)}
                            {entry.player === address && ' (You)'}
                          </span>
                          <span className="wins">{entry.wins.toString()} wins</span>
                        </div>
                      ))}
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '12px', textAlign: 'center' }}>
                    Top 10 players share bonus WRDLE rewards weekly
                  </p>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🏆</div>
                  <p>No winners yet this week!</p>
                  <p style={{ fontSize: '0.85rem', marginTop: '8px' }}>Be the first to claim a spot</p>
                </div>
              )}
            </div>
          )}

          {/* Activity Log */}
          <div className="card">
            <h2>Activity</h2>
            <div className="log">
              {logs.length > 0 ? (
                logs.map((log, i) => (
                  <div key={i} className={`log-entry ${log.type}`}>{log.msg}</div>
                ))
              ) : (
                <div className="log-entry">Ready to play...</div>
              )}
            </div>
          </div>
        </>
      )}

      <div className="contract-info">
        Game: <a href={`https://monadscan.com/address/${WORDLE_ROYALE_ADDRESS}`} target="_blank" rel="noopener noreferrer">
          {WORDLE_ROYALE_ADDRESS.slice(0, 10)}...
        </a>
        {' | '}
        Token: <a href={`https://monadscan.com/address/${WORDLE_TOKEN_ADDRESS}`} target="_blank" rel="noopener noreferrer">
          {WORDLE_TOKEN_ADDRESS.slice(0, 10)}...
        </a>
      </div>
    </div>
  )
}

export default App
