// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {IWMON} from "./interfaces/IWMON.sol";

/// @title WordleRoyale - On-Chain Wordle Game with MON Stakes
/// @notice Players pay entry in MON, contract wraps to WMON, winners get WMON prizes
/// @dev Entry fee is paid in native MON, automatically wrapped to WMON for the prize pool
contract WordleRoyale is ReentrancyGuard, EIP712 {
    /// @notice WMON contract address on Monad Mainnet
    IWMON public constant WMON = IWMON(0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A);

    /// @notice Typehash for game resolution signatures
    bytes32 public constant RESOLVE_TYPEHASH = keccak256(
        "Resolve(address resolver,uint256 entryFee,uint256 capacity,uint256 gameId,address winner,uint256 payout)"
    );

    /// @notice Game configuration
    struct GameConfig {
        address resolver;    // Backend address that signs results
        uint256 entryFee;    // Entry fee in MON (wei)
        uint256 capacity;    // Max players per game
    }

    /// @notice Game instance data
    struct Game {
        uint256 playerCount;
        mapping(uint256 => address) players;
        mapping(address => bool) hasJoined;
        bool resolved;
        uint256 prizePool;   // Total WMON in prize pool
    }

    /// @notice Config hash => Game ID => Game data
    mapping(bytes32 => mapping(uint256 => Game)) public games;

    /// @notice Config hash => Current game ID
    mapping(bytes32 => uint256) public currentGameId;

    /// @notice Emitted when a player joins
    event PlayerJoined(
        bytes32 indexed configHash,
        uint256 indexed gameId,
        address indexed player,
        uint256 playerCount,
        uint256 prizePool
    );

    /// @notice Emitted when a game is resolved
    event GameResolved(
        bytes32 indexed configHash,
        uint256 indexed gameId,
        address indexed winner,
        uint256 payout
    );

    /// @notice Emitted when a new game starts
    event NewGame(bytes32 indexed configHash, uint256 indexed gameId);

    error InvalidCapacity();
    error InvalidEntryFee();
    error GameFull();
    error AlreadyJoined();
    error GameNotFull();
    error GameAlreadyResolved();
    error InvalidSignature();
    error WinnerNotInGame();
    error InvalidPayout();
    error WrapFailed();

    constructor() EIP712("WordleRoyale", "1") {}

    /// @notice Get the config hash for a game configuration
    function getConfigHash(GameConfig calldata config) public pure returns (bytes32) {
        return keccak256(abi.encode(config.resolver, config.entryFee, config.capacity));
    }

    /// @notice Join a game by paying MON entry fee
    /// @dev MON is automatically wrapped to WMON
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

        // Add player to game
        game.players[game.playerCount] = msg.sender;
        game.hasJoined[msg.sender] = true;
        game.playerCount++;
        game.prizePool += msg.value;

        emit PlayerJoined(configHash, gameId, msg.sender, game.playerCount, game.prizePool);

        // If game is full, start next game
        if (game.playerCount == config.capacity) {
            currentGameId[configHash]++;
            emit NewGame(configHash, currentGameId[configHash]);
        }
    }

    /// @notice Resolve a game and distribute WMON prize
    /// @param config The game configuration
    /// @param gameId The game ID to resolve
    /// @param winner The winning player address
    /// @param payout The payout amount in WMON
    /// @param signature The resolver's EIP-712 signature
    function resolve(
        GameConfig calldata config,
        uint256 gameId,
        address winner,
        uint256 payout,
        bytes calldata signature
    ) external nonReentrant {
        bytes32 configHash = getConfigHash(config);
        Game storage game = games[configHash][gameId];

        if (game.playerCount < config.capacity) revert GameNotFull();
        if (game.resolved) revert GameAlreadyResolved();
        if (!game.hasJoined[winner]) revert WinnerNotInGame();
        if (payout > game.prizePool) revert InvalidPayout();

        // Verify resolver signature
        bytes32 structHash = keccak256(abi.encode(
            RESOLVE_TYPEHASH,
            config.resolver,
            config.entryFee,
            config.capacity,
            gameId,
            winner,
            payout
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address recoveredSigner = ECDSA.recover(digest, signature);

        if (recoveredSigner != config.resolver) revert InvalidSignature();

        game.resolved = true;

        // Transfer WMON prize to winner
        if (payout > 0) {
            require(WMON.transfer(winner, payout), "WMON transfer failed");
        }

        emit GameResolved(configHash, gameId, winner, payout);
    }

    /// @notice Check if a player is in a specific game
    function isPlayerInGame(
        GameConfig calldata config,
        uint256 gameId,
        address player
    ) external view returns (bool) {
        bytes32 configHash = getConfigHash(config);
        return games[configHash][gameId].hasJoined[player];
    }

    /// @notice Get the current player count for a game
    function getPlayerCount(
        GameConfig calldata config,
        uint256 gameId
    ) external view returns (uint256) {
        bytes32 configHash = getConfigHash(config);
        return games[configHash][gameId].playerCount;
    }

    /// @notice Get the prize pool for a game
    function getPrizePool(
        GameConfig calldata config,
        uint256 gameId
    ) external view returns (uint256) {
        bytes32 configHash = getConfigHash(config);
        return games[configHash][gameId].prizePool;
    }

    /// @notice Get a player address by index
    function getPlayer(
        GameConfig calldata config,
        uint256 gameId,
        uint256 index
    ) external view returns (address) {
        bytes32 configHash = getConfigHash(config);
        return games[configHash][gameId].players[index];
    }

    /// @notice Check if a game has been resolved
    function isGameResolved(
        GameConfig calldata config,
        uint256 gameId
    ) external view returns (bool) {
        bytes32 configHash = getConfigHash(config);
        return games[configHash][gameId].resolved;
    }

    /// @notice Get the domain separator for EIP-712 signatures
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /// @notice Receive MON (needed for WMON unwrap if we add that feature)
    receive() external payable {}
}
