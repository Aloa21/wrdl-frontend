// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IWMON - Wrapped MON Interface
/// @notice Interface for the WMON contract on Monad
interface IWMON {
    /// @notice Deposit MON and receive WMON
    function deposit() external payable;

    /// @notice Withdraw MON by burning WMON
    /// @param amount The amount of WMON to burn
    function withdraw(uint256 amount) external;

    /// @notice Get the balance of an account
    function balanceOf(address account) external view returns (uint256);

    /// @notice Transfer WMON to another address
    function transfer(address to, uint256 amount) external returns (bool);

    /// @notice Approve spender to use tokens
    function approve(address spender, uint256 amount) external returns (bool);
}
