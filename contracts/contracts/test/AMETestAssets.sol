// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IAMEPriceOracle} from "../AMELending.sol";

/// @notice Malicious transfer behaviors for local adversarial tests only.
contract AMEAdversarialToken is ERC20 {
    uint8 private immutable _tokenDecimals;
    uint256 public feeBps;
    address public callbackTarget;
    bytes public callbackData;
    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        require(block.chainid == 31337 || block.chainid == 46630, "TEST CHAINS ONLY"); _tokenDecimals = decimals_;
    }
    function decimals() public view override returns (uint8) { return _tokenDecimals; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function setFee(uint256 fee) external { require(fee <= 1000); feeBps = fee; }
    function setCallback(address target, bytes calldata data) external { callbackTarget = target; callbackData = data; }
    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0) && callbackTarget != address(0)) {
            (bool ok,) = callbackTarget.call(callbackData); require(ok, "CALLBACK REJECTED");
        }
        uint256 fee = from == address(0) || to == address(0) ? 0 : value * feeBps / 10_000;
        super._update(from, to, value - fee); if (fee != 0) super._update(from, address(0), fee);
    }
}

/// @notice Administrator-set MOCK prices, not an oracle integration or real market data.
contract AMETestOracle is IAMEPriceOracle, Ownable {
    struct Quote { int256 answer; uint256 updatedAt; }
    mapping(address => Quote) private _quotes;
    constructor(address admin) Ownable(admin) { require(block.chainid == 31337 || block.chainid == 46630, "TEST CHAINS ONLY"); }
    function setPrice(address token, int256 answer, uint256 updatedAt) external onlyOwner { _quotes[token] = Quote(answer, updatedAt); }
    function price(address token) external view returns (int256, uint256) { Quote memory q = _quotes[token]; return (q.answer, q.updatedAt); }
}

/// @notice Valueless test faucet. No fee, rebasing or callback controls.
contract AMETestToken is ERC20 {
    uint8 private immutable _tokenDecimals;
    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        require(block.chainid == 31337 || block.chainid == 46630, "TEST CHAINS ONLY"); _tokenDecimals = decimals_;
    }
    function decimals() public view override returns (uint8) { return _tokenDecimals; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}
