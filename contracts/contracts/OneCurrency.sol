// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC1363} from "@openzeppelin/contracts/token/ERC20/extensions/ERC1363.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20FlashMint} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20FlashMint.sol";
import {ERC20Pausable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/**
 * @title OneCurrency
 * @dev Implementation of the OneCurrency hybrid stablecoin.
 * 
 * Features:
 * - ERC20 Standard (18 decimals via OpenZeppelin)
 * - Role-Based Access Control (Admin, Minter, Blacklist Manager)
 * - Blacklist functionality for compliance and fraud prevention
 */
contract OneCurrency is ERC20, ERC20Burnable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BLACKLIST_ROLE = keccak256("BLACKLIST_ROLE");

    mapping (address => bool) private _blacklisted;

    // Events for the Audit Trail
    event AccountBlacklisted(address indexed account);
    event AccountUnblacklisted(address indexed account);

    error BlacklistedAccount(address account);

    /**
     * @dev Constructor grants the DEFAULT_ADMIN_ROLE, MINTER_ROLE, 
     * and BLACKLIST_ROLE to the deployer.
     */
    constructor(address defaultAdmin) ERC20("OneCurrency", "ONE") {
        require(defaultAdmin != address(0), "default admin cannot be zero");
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, defaultAdmin);
        _grantRole(BLACKLIST_ROLE, defaultAdmin);
    }

    /**
     * @dev Mints `amount` tokens and assigns them to `to`.
     * Requirements: Caller must have the `MINTER_ROLE`.
     */
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    /**
     * @dev Blacklists an account, preventing it from sending or receiving tokens.
     * Requirements: Caller must have the `BLACKLIST_ROLE`.
     */
    function blacklistAccount(address account) public onlyRole(BLACKLIST_ROLE) {
        require(account != address(0), "cannot blacklist zero address");
        _blacklisted[account] = true;
        emit AccountBlacklisted(account);
    }

    /**
     * @dev Unblacklists an account.
     * Requirements: Caller must have the `BLACKLIST_ROLE`.
     */
    function unblacklistAccount(address account) public onlyRole(BLACKLIST_ROLE) {
        require(account != address(0), "cannot unblacklist zero address");
        _blacklisted[account] = false;
        emit AccountUnblacklisted(account);
    }

    /**
     * @dev Checks if an account is currently blacklisted.
     */
    function isBlacklisted(address account) public view returns (bool) {
        return _blacklisted[account];
    }

    /**
     * @dev This function intercepts ALL token movements (minting, transferring, burning).
     * We inject our compliance checks here.
     */
    function _update(address from, address to, uint256 value) internal virtual override {
        if (_blacklisted[from]) {
            revert BlacklistedAccount(from);
        }

        if (_blacklisted[to]) {
            revert BlacklistedAccount(to);
        }

        super._update(from, to, value);
    }

    function getMinterRole() public pure returns (bytes32) {
        return MINTER_ROLE;
    }

    function getDefaultAdminRole() public pure returns (bytes32) {
        return DEFAULT_ADMIN_ROLE;
    }

    function getBlacklistRole() public pure returns (bytes32) {
        return BLACKLIST_ROLE;
    }
}