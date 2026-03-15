import { type Abi, parseAbi } from "viem";

export const OneCurrencyABI: Abi = parseAbi([
  "function mint(address to, uint256 amount) public",
  "function burn(uint256 amount) public",
  "function balanceOf(address account) public view returns (uint256)",

  "function isBlacklisted(address account) public view returns (bool)",
  "function blacklistAccount(address account) public",
  "function unBlacklistAccount(address account) public",

  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event AccountBlacklisted(address indexed account)",
  "event AccountUnblacklisted(address indexed account)",

  "function DEFAULT_ADMIN_ROLE() public view returns (bytes32)",
  "function MINTER_ROLE() public view returns (bytes32)",
  "function BLACKLIST_ROLE() public view returns (bytes32)",
  "function hasRole(bytes32 role, address account) public view returns (bool)",

  "error AccessControlUnauthorizedAccount(address account, bytes32 neededRole)",
  "error BlacklistedAccount(address account)",
]);

export const ONECURRENCY_ADDRESS: string =
  "0x5fbdb2315678afecb367f032d93f642f64180aa3"; // contract address from `pnpm hardhat run scripts/deploy.ts`
