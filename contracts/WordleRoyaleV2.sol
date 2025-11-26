// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IWMON} from "./interfaces/IWMON.sol";

/// @title IWordleToken - Interface for the reward token
interface IWordleToken {
    function mint(address to, uint256 amount) external;
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title WordleRoyaleV2 - Wordle Game with Hybrid Token Rewards
/// @notice Players pay MON entry, win WMON prize + WRDLE token rewards
/// @dev Implements: Base rewards + Daily streaks + Achievements + Leaderboard tracking
contract WordleRoyaleV2 is ReentrancyGuard, EIP712, Ownable {

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════════

    IWMON public constant WMON = IWMON(0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A);

    bytes32 public constant RESOLVE_TYPEHASH = keccak256(
        "Resolve(address resolver,uint256 entryFee,uint256 capacity,uint256 gameId,address winner,uint256 payout,uint8 guessCount)"
    );

    // Reward amounts (in wei, 18 decimals)
    uint256 public constant BASE_REWARD = 10 * 10**18;           // 10 WRDLE per win
    uint256 public constant PERFECT_GAME_BONUS = 100 * 10**18;   // 100 WRDLE for 1-guess win
    uint256 public constant FIRST_WIN_BONUS = 50 * 10**18;       // 50 WRDLE first win ever
    uint256 public constant TEN_WINS_BONUS = 200 * 10**18;       // 200 WRDLE at 10 wins
    uint256 public constant FIFTY_WINS_BONUS = 1000 * 10**18;    // 1000 WRDLE at 50 wins
    uint256 public constant HUNDRED_WINS_BONUS = 5000 * 10**18;  // 5000 WRDLE at 100 wins

    // Streak multipliers (basis points, 10000 = 1x)
    uint256 public constant STREAK_DAY_2 = 15000;  // 1.5x
    uint256 public constant STREAK_DAY_3 = 20000;  // 2x
    uint256 public constant STREAK_DAY_7 = 30000;  // 3x (max)

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════════

    IWordleToken public rewardToken;

    struct GameConfig {
        address resolver;
        uint256 entryFee;
        uint256 capacity;
    }

    struct Game {
        uint256 playerCount;
        mapping(uint256 => address) players;
        mapping(address => bool) hasJoined;
        bool resolved;
        uint256 prizePool;
    }

    struct PlayerStats {
        uint256 totalWins;
        uint256 totalGames;
        uint256 currentStreak;
        uint256 lastWinDay;
        uint256 weeklyWins;
        uint256 weekStartTimestamp;
        bool claimedFirstWin;
        bool claimed10Wins;
        bool claimed50Wins;
        bool claimed100Wins;
    }

    // Config hash => Game ID => Game data
    mapping(bytes32 => mapping(uint256 => Game)) public games;
    mapping(bytes32 => uint256) public currentGameId;

    // Player statistics
    mapping(address => PlayerStats) public playerStats;

    // Weekly leaderboard
    uint256 public currentWeekStart;
    address[] public weeklyPlayers;
    mapping(address => bool) public isInWeeklyLeaderboard;

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event PlayerJoined(
        bytes32 indexed configHash,
        uint256 indexed gameId,
        address indexed player,
        uint256 playerCount,
        uint256 prizePool
    );

    event GameResolved(
        bytes32 indexed configHash,
        uint256 indexed gameId,
        address indexed winner,
        uint256 wmonPayout,
        uint256 tokenReward
    );

    event NewGame(bytes32 indexed configHash, uint256 indexed gameId);

    event StreakUpdated(address indexed player, uint256 newStreak);
    event AchievementUnlocked(address indexed player, string achievement, uint256 reward);

    // ═══════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    error InvalidCapacity();
    error InvalidEntryFee();
    error GameFull();
    error AlreadyJoined();
    error GameNotFull();
    error GameAlreadyResolved();
    error InvalidSignature();
    error WinnerNotInGame();
    error InvalidPayout();
    error TokenNotSet();

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    constructor(address _rewardToken) EIP712("WordleRoyaleV2", "1") Ownable(msg.sender) {
        rewardToken = IWordleToken(_rewardToken);
        currentWeekStart = _getWeekStart(block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // GAME FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    function getConfigHash(GameConfig calldata config) public pure returns (bytes32) {
        return keccak256(abi.encode(config.resolver, config.entryFee, config.capacity));
    }

    /// @notice Join a game by paying MON entry fee
    function join(GameConfig calldata config) external payable nonReentrant {
        if (config.capacity < 1) revert InvalidCapacity();
        if (config.entryFee == 0) revert InvalidEntryFee();
        if (msg.value != config.entryFee) revert InvalidEntryFee();

        bytes32 configHash = getConfigHash(config);
        uint256 gameId = currentGameId[configHash];
        Game storage game = games[configHash][gameId];

        if (game.playerCount >= config.capacity) revert GameFull();
        if (game.hasJoined[msg.sender]) revert AlreadyJoined();

        // Wrap MON to WMON
        WMON.deposit{value: msg.value}();

        // Add player
        game.players[game.playerCount] = msg.sender;
        game.hasJoined[msg.sender] = true;
        game.playerCount++;
        game.prizePool += msg.value;

        // Track games played
        playerStats[msg.sender].totalGames++;

        emit PlayerJoined(configHash, gameId, msg.sender, game.playerCount, game.prizePool);

        if (game.playerCount == config.capacity) {
            currentGameId[configHash]++;
            emit NewGame(configHash, currentGameId[configHash]);
        }
    }

    /// @notice Resolve game and distribute rewards
    /// @param guessCount Number of guesses the winner used (1-6)
    function resolve(
        GameConfig calldata config,
        uint256 gameId,
        address winner,
        uint256 payout,
        uint8 guessCount,
        bytes calldata signature
    ) external nonReentrant {
        bytes32 configHash = getConfigHash(config);
        Game storage game = games[configHash][gameId];

        if (game.playerCount < config.capacity) revert GameNotFull();
        if (game.resolved) revert GameAlreadyResolved();
        if (!game.hasJoined[winner]) revert WinnerNotInGame();
        if (payout > game.prizePool) revert InvalidPayout();

        // Verify signature
        bytes32 structHash = keccak256(abi.encode(
            RESOLVE_TYPEHASH,
            config.resolver,
            config.entryFee,
            config.capacity,
            gameId,
            winner,
            payout,
            guessCount
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address recoveredSigner = ECDSA.recover(digest, signature);

        if (recoveredSigner != config.resolver) revert InvalidSignature();

        game.resolved = true;

        // Transfer WMON prize
        if (payout > 0) {
            require(WMON.transfer(winner, payout), "WMON transfer failed");
        }

        // Calculate and distribute token rewards
        uint256 tokenReward = _calculateAndDistributeRewards(winner, guessCount);

        emit GameResolved(configHash, gameId, winner, payout, tokenReward);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // REWARD CALCULATION
    // ═══════════════════════════════════════════════════════════════════════════

    function _calculateAndDistributeRewards(address winner, uint8 guessCount) internal returns (uint256) {
        PlayerStats storage stats = playerStats[winner];
        uint256 totalReward = 0;
        uint256 today = block.timestamp / 1 days;

        // 1. BASE REWARD
        uint256 baseReward = BASE_REWARD;

        // 2. STREAK CALCULATION
        if (stats.lastWinDay == today - 1) {
            // Consecutive day - increase streak
            stats.currentStreak++;
        } else if (stats.lastWinDay != today) {
            // Streak broken (or first win today)
            stats.currentStreak = 1;
        }
        // If lastWinDay == today, keep current streak (multiple wins same day)

        stats.lastWinDay = today;
        emit StreakUpdated(winner, stats.currentStreak);

        // Apply streak multiplier
        uint256 multiplier = 10000; // 1x base
        if (stats.currentStreak >= 7) {
            multiplier = STREAK_DAY_7; // 3x
        } else if (stats.currentStreak >= 3) {
            multiplier = STREAK_DAY_3; // 2x
        } else if (stats.currentStreak >= 2) {
            multiplier = STREAK_DAY_2; // 1.5x
        }

        baseReward = (baseReward * multiplier) / 10000;
        totalReward += baseReward;

        // 3. PERFECT GAME BONUS (1 guess)
        if (guessCount == 1) {
            totalReward += PERFECT_GAME_BONUS;
            emit AchievementUnlocked(winner, "PERFECT_GAME", PERFECT_GAME_BONUS);
        }

        // 4. UPDATE WIN COUNT
        stats.totalWins++;

        // 5. ACHIEVEMENT BONUSES
        if (!stats.claimedFirstWin && stats.totalWins >= 1) {
            stats.claimedFirstWin = true;
            totalReward += FIRST_WIN_BONUS;
            emit AchievementUnlocked(winner, "FIRST_WIN", FIRST_WIN_BONUS);
        }

        if (!stats.claimed10Wins && stats.totalWins >= 10) {
            stats.claimed10Wins = true;
            totalReward += TEN_WINS_BONUS;
            emit AchievementUnlocked(winner, "10_WINS", TEN_WINS_BONUS);
        }

        if (!stats.claimed50Wins && stats.totalWins >= 50) {
            stats.claimed50Wins = true;
            totalReward += FIFTY_WINS_BONUS;
            emit AchievementUnlocked(winner, "50_WINS", FIFTY_WINS_BONUS);
        }

        if (!stats.claimed100Wins && stats.totalWins >= 100) {
            stats.claimed100Wins = true;
            totalReward += HUNDRED_WINS_BONUS;
            emit AchievementUnlocked(winner, "100_WINS", HUNDRED_WINS_BONUS);
        }

        // 6. WEEKLY LEADERBOARD TRACKING
        _updateWeeklyLeaderboard(winner);

        // 7. MINT REWARDS
        if (totalReward > 0) {
            rewardToken.mint(winner, totalReward);
        }

        return totalReward;
    }

    function _updateWeeklyLeaderboard(address player) internal {
        uint256 weekStart = _getWeekStart(block.timestamp);

        // Reset if new week
        if (weekStart > currentWeekStart) {
            // Clear previous week's data
            for (uint256 i = 0; i < weeklyPlayers.length; i++) {
                isInWeeklyLeaderboard[weeklyPlayers[i]] = false;
                playerStats[weeklyPlayers[i]].weeklyWins = 0;
            }
            delete weeklyPlayers;
            currentWeekStart = weekStart;
        }

        // Add to leaderboard if not already
        if (!isInWeeklyLeaderboard[player]) {
            isInWeeklyLeaderboard[player] = true;
            weeklyPlayers.push(player);
            playerStats[player].weekStartTimestamp = weekStart;
        }

        playerStats[player].weeklyWins++;
    }

    function _getWeekStart(uint256 timestamp) internal pure returns (uint256) {
        // Get Monday 00:00 UTC
        return (timestamp / 1 weeks) * 1 weeks;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    function getPlayerStats(address player) external view returns (
        uint256 totalWins,
        uint256 totalGames,
        uint256 currentStreak,
        uint256 weeklyWins,
        bool claimedFirstWin,
        bool claimed10Wins,
        bool claimed50Wins,
        bool claimed100Wins
    ) {
        PlayerStats storage stats = playerStats[player];
        return (
            stats.totalWins,
            stats.totalGames,
            stats.currentStreak,
            stats.weeklyWins,
            stats.claimedFirstWin,
            stats.claimed10Wins,
            stats.claimed50Wins,
            stats.claimed100Wins
        );
    }

    function getWeeklyLeaderboard() external view returns (address[] memory players, uint256[] memory wins) {
        players = weeklyPlayers;
        wins = new uint256[](players.length);
        for (uint256 i = 0; i < players.length; i++) {
            wins[i] = playerStats[players[i]].weeklyWins;
        }
    }

    function getStreakMultiplier(address player) external view returns (uint256) {
        uint256 streak = playerStats[player].currentStreak;
        uint256 today = block.timestamp / 1 days;

        // Check if streak is still valid
        if (playerStats[player].lastWinDay < today - 1) {
            return 10000; // Reset to 1x
        }

        if (streak >= 7) return STREAK_DAY_7;
        if (streak >= 3) return STREAK_DAY_3;
        if (streak >= 2) return STREAK_DAY_2;
        return 10000;
    }

    function isPlayerInGame(GameConfig calldata config, uint256 gameId, address player) external view returns (bool) {
        bytes32 configHash = getConfigHash(config);
        return games[configHash][gameId].hasJoined[player];
    }

    function getPlayerCount(GameConfig calldata config, uint256 gameId) external view returns (uint256) {
        bytes32 configHash = getConfigHash(config);
        return games[configHash][gameId].playerCount;
    }

    function getPrizePool(GameConfig calldata config, uint256 gameId) external view returns (uint256) {
        bytes32 configHash = getConfigHash(config);
        return games[configHash][gameId].prizePool;
    }

    function getPlayer(GameConfig calldata config, uint256 gameId, uint256 index) external view returns (address) {
        bytes32 configHash = getConfigHash(config);
        return games[configHash][gameId].players[index];
    }

    function isGameResolved(GameConfig calldata config, uint256 gameId) external view returns (bool) {
        bytes32 configHash = getConfigHash(config);
        return games[configHash][gameId].resolved;
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    function setRewardToken(address _token) external onlyOwner {
        rewardToken = IWordleToken(_token);
    }

    receive() external payable {}
}
