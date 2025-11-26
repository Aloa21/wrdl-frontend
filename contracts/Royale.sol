// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ISignatureTransfer} from "./interfaces/ISignatureTransfer.sol";

/// @title Royale - Battle Royale Game Contract for Monad
/// @notice A battle royale gaming system where N players compete with ERC-20 token stakes
/// @dev Players join games by staking tokens, and winners are determined by a backend resolver
contract Royale is ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;

    /// @notice Permit2 contract address on Monad Mainnet
    ISignatureTransfer public constant PERMIT2 = ISignatureTransfer(0x000000000022D473030F116dDEE9F6B43aC78BA3);

    /// @notice Typehash for game resolution signatures
    bytes32 public constant RESOLVE_TYPEHASH = keccak256(
        "Resolve(address resolver,address token,uint256 amount,uint256 capacity,uint256 gameId,address winner,uint256 payout)"
    );

    /// @notice Structure representing a game lobby
    struct Lobby {
        address resolver;   // Backend resolver address that signs off on winners
        address token;      // ERC20 token used for stakes
        uint256 amount;     // Stake amount per player
        uint256 capacity;   // Maximum number of players
    }

    /// @notice Structure representing a game instance
    struct Game {
        uint256 playerCount;           // Current number of players
        mapping(uint256 => address) players;  // Player addresses by index
        mapping(address => bool) hasJoined;   // Track if address has joined
        bool resolved;                 // Whether game has been resolved
    }

    /// @notice Mapping from lobby hash to game ID to game data
    mapping(bytes32 => mapping(uint256 => Game)) public games;

    /// @notice Mapping from lobby hash to current game ID
    mapping(bytes32 => uint256) public currentGameId;

    /// @notice Emitted when a player joins a game
    event PlayerJoined(
        bytes32 indexed lobbyHash,
        uint256 indexed gameId,
        address indexed player,
        uint256 playerCount
    );

    /// @notice Emitted when a game is resolved
    event GameResolved(
        bytes32 indexed lobbyHash,
        uint256 indexed gameId,
        address indexed winner,
        uint256 payout
    );

    /// @notice Emitted when a new game starts
    event NewGame(
        bytes32 indexed lobbyHash,
        uint256 indexed gameId
    );

    error InvalidCapacity();
    error GameFull();
    error AlreadyJoined();
    error GameNotFull();
    error GameAlreadyResolved();
    error InvalidSignature();
    error WinnerNotInGame();
    error InvalidPayout();

    constructor() EIP712("Royale", "1") {}

    /// @notice Computes the lobby hash from lobby parameters
    /// @param lobby The lobby parameters
    /// @return The keccak256 hash of the lobby
    function getLobbyHash(Lobby calldata lobby) public pure returns (bytes32) {
        return keccak256(abi.encode(lobby.resolver, lobby.token, lobby.amount, lobby.capacity));
    }

    /// @notice Join a game using standard ERC20 approval
    /// @param lobby The lobby parameters
    function join(Lobby calldata lobby) external nonReentrant {
        _join(lobby, msg.sender);
        IERC20(lobby.token).safeTransferFrom(msg.sender, address(this), lobby.amount);
    }

    /// @notice Join a game using Permit2 signature
    /// @param lobby The lobby parameters
    /// @param permit The permit data
    /// @param signature The signature for the permit
    function joinWithPermit(
        Lobby calldata lobby,
        ISignatureTransfer.PermitTransferFrom calldata permit,
        bytes calldata signature
    ) external nonReentrant {
        _join(lobby, msg.sender);

        PERMIT2.permitTransferFrom(
            permit,
            ISignatureTransfer.SignatureTransferDetails({
                to: address(this),
                requestedAmount: lobby.amount
            }),
            msg.sender,
            signature
        );
    }

    /// @notice Internal function to handle player joining
    /// @param lobby The lobby parameters
    /// @param player The player address
    function _join(Lobby calldata lobby, address player) internal {
        if (lobby.capacity < 2) revert InvalidCapacity();

        bytes32 lobbyHash = getLobbyHash(lobby);
        uint256 gameId = currentGameId[lobbyHash];
        Game storage game = games[lobbyHash][gameId];

        if (game.playerCount >= lobby.capacity) revert GameFull();
        if (game.hasJoined[player]) revert AlreadyJoined();

        game.players[game.playerCount] = player;
        game.hasJoined[player] = true;
        game.playerCount++;

        emit PlayerJoined(lobbyHash, gameId, player, game.playerCount);

        // If game is full, increment to next game
        if (game.playerCount == lobby.capacity) {
            currentGameId[lobbyHash]++;
            emit NewGame(lobbyHash, currentGameId[lobbyHash]);
        }
    }

    /// @notice Resolve a completed game and distribute winnings
    /// @param lobby The lobby parameters
    /// @param gameId The game ID to resolve
    /// @param winner The winning player address
    /// @param payout The payout amount for the winner
    /// @param signature The resolver's signature
    function resolve(
        Lobby calldata lobby,
        uint256 gameId,
        address winner,
        uint256 payout,
        bytes calldata signature
    ) external nonReentrant {
        bytes32 lobbyHash = getLobbyHash(lobby);
        Game storage game = games[lobbyHash][gameId];

        if (game.playerCount < lobby.capacity) revert GameNotFull();
        if (game.resolved) revert GameAlreadyResolved();
        if (!game.hasJoined[winner]) revert WinnerNotInGame();

        // Maximum payout is the total pot
        uint256 totalPot = lobby.amount * lobby.capacity;
        if (payout > totalPot) revert InvalidPayout();

        // Verify resolver signature
        bytes32 structHash = keccak256(abi.encode(
            RESOLVE_TYPEHASH,
            lobby.resolver,
            lobby.token,
            lobby.amount,
            lobby.capacity,
            gameId,
            winner,
            payout
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address recoveredSigner = ECDSA.recover(digest, signature);

        if (recoveredSigner != lobby.resolver) revert InvalidSignature();

        game.resolved = true;

        // Transfer payout to winner
        if (payout > 0) {
            IERC20(lobby.token).safeTransfer(winner, payout);
        }

        emit GameResolved(lobbyHash, gameId, winner, payout);
    }

    /// @notice Check if a player is in a specific game
    /// @param lobby The lobby parameters
    /// @param gameId The game ID
    /// @param player The player address to check
    /// @return True if player is in the game
    function isPlayerInGame(
        Lobby calldata lobby,
        uint256 gameId,
        address player
    ) external view returns (bool) {
        bytes32 lobbyHash = getLobbyHash(lobby);
        return games[lobbyHash][gameId].hasJoined[player];
    }

    /// @notice Get the current player count for a game
    /// @param lobby The lobby parameters
    /// @param gameId The game ID
    /// @return The number of players in the game
    function getPlayerCount(
        Lobby calldata lobby,
        uint256 gameId
    ) external view returns (uint256) {
        bytes32 lobbyHash = getLobbyHash(lobby);
        return games[lobbyHash][gameId].playerCount;
    }

    /// @notice Get a player address by index
    /// @param lobby The lobby parameters
    /// @param gameId The game ID
    /// @param index The player index
    /// @return The player address
    function getPlayer(
        Lobby calldata lobby,
        uint256 gameId,
        uint256 index
    ) external view returns (address) {
        bytes32 lobbyHash = getLobbyHash(lobby);
        return games[lobbyHash][gameId].players[index];
    }

    /// @notice Check if a game has been resolved
    /// @param lobby The lobby parameters
    /// @param gameId The game ID
    /// @return True if the game has been resolved
    function isGameResolved(
        Lobby calldata lobby,
        uint256 gameId
    ) external view returns (bool) {
        bytes32 lobbyHash = getLobbyHash(lobby);
        return games[lobbyHash][gameId].resolved;
    }

    /// @notice Get the domain separator for EIP-712 signatures
    /// @return The domain separator
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
