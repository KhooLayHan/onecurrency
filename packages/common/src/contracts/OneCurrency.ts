export const OneCurrencyABI =[
  "function mint(address to, uint256 amount) public",
  "function burn(uint256 amount) public",
  "function balanceOf(address account) public view returns (uint256)",
  "function isBlacklisted(address account) public view returns (bool)",
  
  // Events
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event AccountBlacklisted(address indexed account)",
  "event AccountUnblacklisted(address indexed account)"
] as const;

export const ONECURRENCY_ADDRESS = "0xYourDeployedContractAddressHere";