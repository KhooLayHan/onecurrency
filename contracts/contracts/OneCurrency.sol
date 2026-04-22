// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Pausable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/**
 * @title OneCurrency
 * @notice USD-pegged stablecoin for the OneCurrency platform.
 * @dev ERC20 token with the following features:
 *   - Role-based access control (Admin, Minter, Pauser, Blacklist, Seize)
 *   - Hard supply cap enforced on-chain
 *   - Compliance blacklist — blocks transfers to/from flagged accounts
 *   - Token seizure for regulatory freeze scenarios
 *   - Emergency pause circuit breaker
 *   - EIP-2612 gasless permit approvals
 */
contract OneCurrency is ERC20, ERC20Burnable, ERC20Pausable, ERC20Permit, AccessControl {

  // ─── Roles ─────────────────────────────────────────────────────────────────
  bytes32 public constant MINTER_ROLE    = keccak256("MINTER_ROLE");
  bytes32 public constant PAUSER_ROLE    = keccak256("PAUSER_ROLE");
  bytes32 public constant BLACKLIST_ROLE = keccak256("BLACKLIST_ROLE");
  bytes32 public constant SEIZE_ROLE     = keccak256("SEIZE_ROLE");

  // ─── Supply Cap ────────────────────────────────────────────────────────────
  /// @notice Absolute maximum number of tokens that can ever exist (in wei).
  uint256 public immutable MAX_SUPPLY;

  // ─── Blacklist ─────────────────────────────────────────────────────────────
  mapping(address => bool) private _blacklisted;

  // ─── Events ────────────────────────────────────────────────────────────────
  event AccountBlacklisted(address indexed account);
  event AccountUnblacklisted(address indexed account);

  /// @notice Emitted on every mint for easier off-chain indexing.
  event TokensMinted(
    address indexed minter,
    address indexed to,
    uint256 amount,
    uint256 newTotalSupply
  );

  /// @notice Emitted when a compliance officer seizes tokens from a blacklisted account.
  event TokensSeized(address indexed from, address indexed to, uint256 amount);

  // ─── Errors ────────────────────────────────────────────────────────────────
  error BlacklistedAccount(address account);
  error ExceedsMaxSupply(uint256 requested, uint256 available);
  error ZeroAddress();
  error ZeroAmount();

  // ─── Constructor ───────────────────────────────────────────────────────────
  /**
   * @param defaultAdmin Address that receives all roles initially.
   *        Should be a Gnosis Safe multisig in production.
   * @param maxSupply Hard cap in wei (e.g. 1_000_000 * 1e18 for 1 million tokens).
   */
  constructor(address defaultAdmin, uint256 maxSupply)
    ERC20("OneCurrency", "ONE")
    ERC20Permit("OneCurrency")
  {
    if (defaultAdmin == address(0)) revert ZeroAddress();
    if (maxSupply == 0) revert ZeroAmount();

    MAX_SUPPLY = maxSupply;

    _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    _grantRole(MINTER_ROLE,        defaultAdmin);
    _grantRole(PAUSER_ROLE,        defaultAdmin);
    _grantRole(BLACKLIST_ROLE,     defaultAdmin);
    _grantRole(SEIZE_ROLE,         defaultAdmin);
  }

  // ─── Minting ───────────────────────────────────────────────────────────────

  /**
   * @notice Mints `amount` tokens to address `to`.
   * @dev Enforces the MAX_SUPPLY cap. Only callable by MINTER_ROLE.
   * @param to      Recipient address — must not be zero or blacklisted.
   * @param amount  Amount in wei — must be greater than zero.
   */
  function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
    if (to == address(0)) revert ZeroAddress();
    if (amount == 0) revert ZeroAmount();

    uint256 available = MAX_SUPPLY - totalSupply();
    if (amount > available) revert ExceedsMaxSupply(amount, available);

    _mint(to, amount);
    emit TokensMinted(msg.sender, to, amount, totalSupply());
  }

  // ─── Pause ─────────────────────────────────────────────────────────────────

  /// @notice Pauses all token transfers. Emergency circuit breaker.
  function pause() external onlyRole(PAUSER_ROLE) {
    _pause();
  }

  /// @notice Resumes all token transfers.
  function unpause() external onlyRole(PAUSER_ROLE) {
    _unpause();
  }

  // ─── Compliance ────────────────────────────────────────────────────────────

  /**
   * @notice Flags an account, blocking it from sending or receiving tokens.
   * @dev Cannot blacklist the zero address or any account holding DEFAULT_ADMIN_ROLE.
   */
  function blacklistAccount(address account) external onlyRole(BLACKLIST_ROLE) {
    if (account == address(0)) revert ZeroAddress();
    require(
      !hasRole(DEFAULT_ADMIN_ROLE, account),
      "OneCurrency: cannot blacklist an admin"
    );
    _blacklisted[account] = true;
    emit AccountBlacklisted(account);
  }

  /**
   * @notice Removes the blacklist flag from an account.
   */
  function unblacklistAccount(address account) external onlyRole(BLACKLIST_ROLE) {
    if (account == address(0)) revert ZeroAddress();
    _blacklisted[account] = false;
    emit AccountUnblacklisted(account);
  }

  /**
   * @notice Returns true if the account is currently blacklisted.
   */
  function isBlacklisted(address account) external view returns (bool) {
    return _blacklisted[account];
  }

  /**
   * @notice Transfers ALL tokens from a blacklisted account to a specified address.
   * @dev Used for regulatory seizure. Bypasses the blacklist transfer check since
   *      this is an authorised compliance action, not a voluntary transfer.
   * @param from Source — must be a blacklisted account with a non-zero balance.
   * @param to   Destination — must not be the zero address.
   */
  function seizeTokens(address from, address to) external onlyRole(SEIZE_ROLE) {
    require(_blacklisted[from], "OneCurrency: account is not blacklisted");
    if (to == address(0)) revert ZeroAddress();

    uint256 amount = balanceOf(from);
    if (amount == 0) revert ZeroAmount();

    // Call ERC20._transfer directly to bypass our blacklist check in _update.
    // This is intentional — SEIZE_ROLE is an authorised compliance action.
    ERC20._transfer(from, to, amount);
    emit TokensSeized(from, to, amount);
  }

  // ─── Internal Override ─────────────────────────────────────────────────────

  /**
   * @dev Intercepts ALL token movements (mint, transfer, burn).
   * Injects the blacklist check and delegates pause logic to ERC20Pausable.
   */
  function _update(address from, address to, uint256 value)
    internal
    virtual
    override(ERC20, ERC20Pausable)
  {
    if (_blacklisted[from]) revert BlacklistedAccount(from);
    if (_blacklisted[to])   revert BlacklistedAccount(to);
    super._update(from, to, value);
  }
}
