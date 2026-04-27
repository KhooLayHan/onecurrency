import { type Abi, parseAbi } from "viem";

export const OneCurrencyABI: Abi = parseAbi([
  "function mint(address to, uint256 amount) public",
  "function burn(uint256 amount) public",
  "function transfer(address to, uint256 amount) public returns (bool)",
  "function balanceOf(address account) public view returns (uint256)",

  "function isBlacklisted(address account) public view returns (bool)",
  "function blacklistAccount(address account) public",
  "function unblacklistAccount(address account) public",
  "function seizeTokens(address from, address to) public",

  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event AccountBlacklisted(address indexed account)",
  "event AccountUnblacklisted(address indexed account)",
  "event TokensSeized(address indexed from, address indexed to, uint256 amount)",

  "function DEFAULT_ADMIN_ROLE() public view returns (bytes32)",
  "function MINTER_ROLE() public view returns (bytes32)",
  "function BLACKLIST_ROLE() public view returns (bytes32)",
  "function hasRole(bytes32 role, address account) public view returns (bool)",

  "error AccessControlUnauthorizedAccount(address account, bytes32 neededRole)",
  "error BlacklistedAccount(address account)",
]);

export const ONECURRENCY_ADDRESS: string =
  "0x5fbdb2315678afecb367f032d93f642f64180aa3";
