// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IAMEPriceOracle} from "../AMELending.sol";

/// @notice Valueless test assets. No administrator mint, transfer tax or external callbacks.
contract AMEPublicTestToken is ERC20 {
    uint8 private immutable _precision;
    uint256 public immutable claimAmount;
    uint256 public immutable supplyCap;
    uint256 public constant CLAIM_INTERVAL = 1 days;
    mapping(address => uint256) public nextClaimAt;
    error ClaimUnavailable();
    event Claimed(address indexed wallet, uint256 amount, uint256 nextClaimAt);
    constructor(string memory name_, string memory symbol_, uint8 precision_, uint256 amount_)
        ERC20(name_, symbol_)
    {
        require(block.chainid == 31337 || block.chainid == 46630, "TEST CHAINS ONLY");
        require(precision_ <= 18 && amount_ > 0 && amount_ <= 1000 * 10 ** precision_, "INVALID CLAIM");
        _precision = precision_; claimAmount = amount_; supplyCap = amount_ * 100_000;
    }
    function decimals() public view override returns (uint8) { return _precision; }
    function claim() external {
        if (block.timestamp < nextClaimAt[msg.sender] || totalSupply() + claimAmount > supplyCap) revert ClaimUnavailable();
        nextClaimAt[msg.sender] = block.timestamp + CLAIM_INTERVAL;
        _mint(msg.sender, claimAmount);
        emit Claimed(msg.sender, claimAmount, nextClaimAt[msg.sender]);
    }
}

/// @notice Fixed MOCK quotes only: 1 tUSD = 1 synthetic unit, 1 tCOL = 2 synthetic units.
/// Anyone may refresh the timestamp, but nobody can change quotes or tracked tokens.
/// Freshness checks in AMELending remain intact; this is not a market-price feed.
contract AMEPublicTestOracle is IAMEPriceOracle {
    address public immutable loanToken;
    address public immutable collateralToken;
    uint256 public updatedAt;
    event MockQuotesRefreshed(uint256 timestamp);
    constructor(address loan_, address collateral_) {
        require(block.chainid == 31337 || block.chainid == 46630, "TEST CHAINS ONLY");
        require(loan_.code.length > 0 && collateral_.code.length > 0 && loan_ != collateral_, "INVALID TOKENS");
        loanToken = loan_; collateralToken = collateral_; updatedAt = block.timestamp;
    }
    function refresh() external { updatedAt = block.timestamp; emit MockQuotesRefreshed(updatedAt); }
    function price(address token) external view returns (int256 answer, uint256 timestamp) {
        if (token == loanToken) return (1e18, updatedAt);
        if (token == collateralToken) return (2e18, updatedAt);
        return (0, 0);
    }
}
