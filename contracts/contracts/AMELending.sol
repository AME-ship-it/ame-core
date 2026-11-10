// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {AMEAgent} from "./AMEAgent.sol";

interface IAMEPriceOracle {
    /// @dev Common quote unit: USD-like 1e18. Mock quotes are not market prices.
    function price(address token) external view returns (int256 answer, uint256 updatedAt);
}

/// @notice Unaudited local/testnet-only isolated credit experiment. Never deploy with real-value assets.
contract AMELending is ERC4626, ReentrancyGuard, Ownable2Step {
    using SafeERC20 for IERC20;
    uint256 public constant BPS = 10_000;
    uint256 public constant LTV_BPS = 5_000;
    uint256 public constant LIQUIDATION_BPS = 7_000;
    uint256 public constant BONUS_BPS = 500;
    uint256 public constant APR_BPS = 500;
    uint256 public constant INTEREST_DENOMINATOR = 365 days * BPS;
    uint256 public constant MAX_PRICE_AGE = 1 hours;
    uint256 public constant LOAN_TERM = 30 days;
    uint256 public constant HISTORY_MIN_AGE = 1 days;
    uint256 public constant MAX_AMOUNT = type(uint128).max;
    AMEAgent public immutable agentRegistry;
    IERC20 public immutable collateralAsset;
    IAMEPriceOracle public immutable oracle;
    uint256 public immutable loanUnit;
    uint256 public immutable collateralUnit;
    uint256 public immutable minimumBorrow;
    uint256 public immutable borrowCap;
    bool public borrowingPaused;
    uint256 public totalPrincipal;
    uint256 public totalInterestNumerator;
    uint256 public lastAccrual;
    uint256 public totalCollateral;
    uint256 public totalBadDebt;
    uint256 public nextPositionId = 1;
    uint256 public nextFinancialReceiptId = 1;

    struct Position {
        uint256 agentId;
        address borrower;
        address operator;
        uint256 collateral;
        uint256 principal;
        uint256 interestNumerator;
        uint256 lastAccrual;
        uint256 openedAt;
        uint256 dueAt;
        uint256 principalRepaid;
        uint256 interestPaid;
        uint256 principalSeconds;
        bool closed;
    }
    struct History { uint256 completedLoans; uint256 liquidations; uint256 principalRepaid; uint256 interestPaid; uint256 qualifyingLoans; uint256 lateRepayments; }
    mapping(uint256 => Position) private _positions;
    mapping(uint256 => History) public history;
    error InvalidConfiguration();
    error InvalidAmount();
    error InvalidPosition();
    error Unauthorized();
    error Unhealthy();
    error NotLiquidatable();
    error InvalidPrice();
    error UnsupportedToken();
    error BorrowingDisabled();
    error InsufficientLiquidity();
    error Slippage();
    event PositionOpened(uint256 indexed positionId, uint256 indexed agentId, address indexed borrower);
    event OperatorSet(uint256 indexed positionId, address indexed operator);
    event CollateralAdded(uint256 indexed positionId, uint256 amount);
    event CollateralRemoved(uint256 indexed positionId, uint256 amount);
    event Borrowed(uint256 indexed positionId, uint256 amount, address indexed receiver);
    /// @dev Canonical engine-generated receipts only; no arbitrary receipt import/credit function exists.
    event FinancialReceipt(uint256 indexed receiptId, uint256 indexed positionId, uint256 indexed agentId, uint8 kind, address payer, uint256 principal, uint256 interest);
    event Liquidated(uint256 indexed positionId, address indexed liquidator, uint256 repaid, uint256 collateralSeized, uint256 badDebt);
    event BorrowingPauseChanged(bool paused);

    constructor(IERC20 loanToken, IERC20 collateralToken, AMEAgent registry, IAMEPriceOracle priceOracle, address guardian)
        ERC20("AME Test Credit Shares", "ameTEST") ERC4626(loanToken) Ownable(guardian)
    {
        if (block.chainid != 31337 && block.chainid != 46630) revert InvalidConfiguration();
        if (address(loanToken).code.length == 0 || address(collateralToken).code.length == 0 ||
            address(registry).code.length == 0 || address(priceOracle).code.length == 0 || address(loanToken) == address(collateralToken)) revert InvalidConfiguration();
        uint8 ld = IERC20Metadata(address(loanToken)).decimals();
        uint8 cd = IERC20Metadata(address(collateralToken)).decimals();
        if (ld > 18 || cd > 18) revert InvalidConfiguration();
        loanUnit = 10 ** ld; collateralUnit = 10 ** cd;
        minimumBorrow = 10 * loanUnit; borrowCap = 1_000_000 * loanUnit;
        collateralAsset = collateralToken; agentRegistry = registry; oracle = priceOracle; lastAccrual = block.timestamp; borrowingPaused = true;
    }

    function _decimalsOffset() internal pure override returns (uint8) { return 6; }
    function availableLiquidity() public view returns (uint256) { return IERC20(asset()).balanceOf(address(this)); }
    function _previewInterest() internal view returns (uint256) {
        return totalInterestNumerator + totalPrincipal * APR_BPS * (block.timestamp - lastAccrual);
    }
    function totalAssets() public view override returns (uint256) {
        return availableLiquidity() + totalPrincipal + _previewInterest() / INTEREST_DENOMINATOR;
    }
    function maxWithdraw(address supplier) public view override returns (uint256) {
        return Math.min(super.maxWithdraw(supplier), availableLiquidity());
    }
    function maxRedeem(address supplier) public view override returns (uint256) {
        return Math.min(super.maxRedeem(supplier), convertToShares(availableLiquidity()));
    }
    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override nonReentrant {
        _amount(assets); if (shares == 0 || receiver == address(this)) revert InvalidAmount();
        uint256 beforeCash = availableLiquidity();
        uint256 beforeCaller = IERC20(asset()).balanceOf(caller);
        super._deposit(caller, receiver, assets, shares);
        if (availableLiquidity() != beforeCash + assets || IERC20(asset()).balanceOf(caller) + assets != beforeCaller) revert UnsupportedToken();
    }
    function _withdraw(address caller, address receiver, address supplier, uint256 assets, uint256 shares) internal override nonReentrant {
        _amount(assets); if (receiver == address(this)) revert InvalidAmount();
        uint256 beforeCash = availableLiquidity();
        uint256 beforeReceiver = IERC20(asset()).balanceOf(receiver);
        super._withdraw(caller, receiver, supplier, assets, shares);
        if (availableLiquidity() + assets != beforeCash || IERC20(asset()).balanceOf(receiver) != beforeReceiver + assets) revert UnsupportedToken();
    }
    /// @notice Slippage-bounded entry points for the UI; standard ERC4626 methods remain available.
    function depositWithMinShares(uint256 assets, address receiver, uint256 minShares) external returns (uint256 shares) {
        shares = deposit(assets, receiver); if (shares < minShares) revert Slippage();
    }
    function withdrawWithMaxShares(uint256 assets, address receiver, address supplier, uint256 maxShares) external returns (uint256 shares) {
        shares = withdraw(assets, receiver, supplier); if (shares > maxShares) revert Slippage();
    }
    function _amount(uint256 value) internal pure { if (value == 0 || value > MAX_AMOUNT) revert InvalidAmount(); }
    function _position(uint256 id) internal view returns (Position storage p) {
        p = _positions[id]; if (p.borrower == address(0)) revert InvalidPosition();
    }
    function position(uint256 id) external view returns (Position memory p) {
        p = _position(id); p.interestNumerator += p.principal * APR_BPS * (block.timestamp - p.lastAccrual);
        p.principalSeconds += p.principal * (block.timestamp - p.lastAccrual);
        p.lastAccrual = block.timestamp;
    }
    function _accrue(Position storage p) internal {
        totalInterestNumerator = _previewInterest(); lastAccrual = block.timestamp;
        p.interestNumerator += p.principal * APR_BPS * (block.timestamp - p.lastAccrual);
        p.principalSeconds += p.principal * (block.timestamp - p.lastAccrual);
        p.lastAccrual = block.timestamp;
    }
    function debtOf(uint256 id) public view returns (uint256) {
        Position storage p = _position(id);
        uint256 numerator = p.interestNumerator + p.principal * APR_BPS * (block.timestamp - p.lastAccrual);
        return p.principal + Math.ceilDiv(numerator, INTEREST_DENOMINATOR);
    }
    function _prices() internal view returns (uint256 lp, uint256 cp) {
        (int256 l, uint256 lt) = oracle.price(asset());
        (int256 c, uint256 ct) = oracle.price(address(collateralAsset));
        if (l <= 0 || c <= 0 || l > 1e36 || c > 1e36 || lt == 0 || ct == 0 || lt > block.timestamp || ct > block.timestamp ||
            block.timestamp - lt > MAX_PRICE_AGE || block.timestamp - ct > MAX_PRICE_AGE) revert InvalidPrice();
        return (uint256(l), uint256(c));
    }
    function _value(uint256 collateral, uint256 lp, uint256 cp) internal view returns (uint256) {
        return Math.mulDiv(Math.mulDiv(collateral, cp, collateralUnit), loanUnit, lp);
    }
    function borrowable(uint256 id) external view returns (uint256) {
        Position storage p = _position(id);
        if (p.closed || borrowingPaused || agentRegistry.ownerOf(p.agentId) != p.borrower || (p.dueAt != 0 && block.timestamp >= p.dueAt)) return 0;
        (uint256 lp, uint256 cp) = _prices(); uint256 limit = Math.mulDiv(_value(p.collateral, lp, cp), LTV_BPS, BPS);
        return Math.min(Math.min(limit > debtOf(id) ? limit - debtOf(id) : 0, availableLiquidity()), borrowCap - totalPrincipal);
    }
    function healthFactor(uint256 id) external view returns (uint256) {
        uint256 debt = debtOf(id); if (debt == 0) return type(uint256).max;
        (uint256 lp, uint256 cp) = _prices();
        return Math.mulDiv(_value(_positions[id].collateral, lp, cp), LIQUIDATION_BPS * 1e14, debt);
    }
    function openPosition(uint256 agentId) external nonReentrant returns (uint256 id) {
        if (agentRegistry.ownerOf(agentId) != msg.sender) revert Unauthorized();
        id = nextPositionId++; Position storage p = _positions[id];
        p.agentId = agentId; p.borrower = msg.sender; p.lastAccrual = block.timestamp;
        emit PositionOpened(id, agentId, msg.sender);
    }
    function setOperator(uint256 id, address operator) external nonReentrant {
        Position storage p = _position(id);
        if (p.closed || msg.sender != p.borrower || agentRegistry.ownerOf(p.agentId) != p.borrower ||
            (operator != address(0) && operator != agentRegistry.agentWalletOf(p.agentId))) revert Unauthorized();
        p.operator = operator; emit OperatorSet(id, operator);
    }
    function addCollateral(uint256 id, uint256 amount) external nonReentrant {
        _amount(amount); Position storage p = _position(id);
        if (p.closed || p.borrower != msg.sender || p.collateral + amount > MAX_AMOUNT) revert Unauthorized();
        p.collateral += amount; totalCollateral += amount;
        _in(collateralAsset, msg.sender, amount); emit CollateralAdded(id, amount);
    }
    function removeCollateral(uint256 id, uint256 amount) external nonReentrant {
        _amount(amount); Position storage p = _position(id);
        if (p.borrower != msg.sender || amount > p.collateral) revert Unauthorized();
        uint256 remaining = p.collateral - amount; uint256 debt = debtOf(id);
        if (debt != 0) {
            (uint256 lp, uint256 cp) = _prices();
            if (block.timestamp >= p.dueAt || debt > Math.mulDiv(_value(remaining, lp, cp), LTV_BPS, BPS)) revert Unhealthy();
        }
        p.collateral = remaining; totalCollateral -= amount;
        _out(collateralAsset, msg.sender, amount); emit CollateralRemoved(id, amount);
    }
    function borrow(uint256 id, uint256 amount) external nonReentrant {
        _amount(amount); Position storage p = _position(id);
        if (borrowingPaused) revert BorrowingDisabled();
        if (p.closed || agentRegistry.ownerOf(p.agentId) != p.borrower ||
            (msg.sender != p.borrower && (msg.sender != p.operator || p.operator == address(0) || agentRegistry.agentWalletOf(p.agentId) != p.operator))) revert Unauthorized();
        if (p.dueAt != 0 && block.timestamp >= p.dueAt) revert BorrowingDisabled();
        _accrue(p);
        if (p.principal == 0 && amount < minimumBorrow) revert InvalidAmount();
        if (amount > availableLiquidity() || totalPrincipal + amount > borrowCap) revert InsufficientLiquidity();
        (uint256 lp, uint256 cp) = _prices();
        if (p.principal + Math.ceilDiv(p.interestNumerator, INTEREST_DENOMINATOR) + amount > Math.mulDiv(_value(p.collateral, lp, cp), LTV_BPS, BPS)) revert Unhealthy();
        if (p.openedAt == 0) { p.openedAt = block.timestamp; p.dueAt = block.timestamp + LOAN_TERM; }
        p.principal += amount; totalPrincipal += amount;
        // Operator initiation never redirects proceeds away from the original borrower.
        _out(IERC20(asset()), p.borrower, amount);
        emit Borrowed(id, amount, p.borrower); _receipt(id, p, 0, msg.sender, amount, 0);
    }
    function repay(uint256 id, uint256 maxAmount) external nonReentrant returns (uint256 paid) {
        _amount(maxAmount); Position storage p = _position(id); _accrue(p);
        uint256 interestDue = Math.ceilDiv(p.interestNumerator, INTEREST_DENOMINATOR);
        uint256 debt = p.principal + interestDue; if (debt == 0) revert InvalidAmount();
        paid = Math.min(maxAmount, debt); uint256 interestPaid = Math.min(paid, interestDue);
        uint256 retiredNumerator = interestPaid == interestDue ? p.interestNumerator : interestPaid * INTEREST_DENOMINATOR;
        p.interestNumerator -= retiredNumerator; totalInterestNumerator -= retiredNumerator;
        uint256 principalPaid = paid - interestPaid; p.principal -= principalPaid; totalPrincipal -= principalPaid;
        p.principalRepaid += principalPaid; p.interestPaid += interestPaid;
        History storage h = history[p.agentId]; h.principalRepaid += principalPaid; h.interestPaid += interestPaid;
        if (p.principal == 0 && p.interestNumerator == 0) {
            p.closed = true; h.completedLoans++;
            if (block.timestamp > p.dueAt) h.lateRepayments++;
            if (block.timestamp <= p.dueAt && block.timestamp - p.openedAt >= HISTORY_MIN_AGE && p.principalSeconds >= minimumBorrow * HISTORY_MIN_AGE && p.interestPaid > 0) h.qualifyingLoans++;
        }
        _in(IERC20(asset()), msg.sender, paid); _receipt(id, p, 1, msg.sender, principalPaid, interestPaid);
    }
    function liquidate(uint256 id, uint256 maxRepay, uint256 minCollateralOut) external nonReentrant returns (uint256 paid, uint256 seized) {
        Position storage p = _position(id); _accrue(p);
        uint256 debt = p.principal + Math.ceilDiv(p.interestNumerator, INTEREST_DENOMINATOR);
        if (debt == 0) revert NotLiquidatable();
        (uint256 lp, uint256 cp) = _prices(); uint256 value = _value(p.collateral, lp, cp);
        if (block.timestamp < p.dueAt && debt <= Math.mulDiv(value, LIQUIDATION_BPS, BPS)) revert NotLiquidatable();
        uint256 capacity = Math.mulDiv(value, BPS, BPS + BONUS_BPS);
        paid = Math.min(debt, capacity);
        if (paid < debt) seized = p.collateral;
        else {
            uint256 quote = Math.mulDiv(Math.mulDiv(paid, BPS + BONUS_BPS, BPS, Math.Rounding.Ceil), lp, loanUnit, Math.Rounding.Ceil);
            seized = Math.min(p.collateral, Math.mulDiv(quote, collateralUnit, cp, Math.Rounding.Ceil));
        }
        if (paid > maxRepay || seized < minCollateralOut) revert Slippage();
        totalPrincipal -= p.principal; totalInterestNumerator -= p.interestNumerator;
        p.principal = 0; p.interestNumerator = 0; p.closed = true;
        p.collateral -= seized; totalCollateral -= seized;
        uint256 loss = debt - paid; totalBadDebt += loss; history[p.agentId].liquidations++;
        if (paid != 0) _in(IERC20(asset()), msg.sender, paid);
        if (seized != 0) _out(collateralAsset, msg.sender, seized);
        _receipt(id, p, 2, msg.sender, paid, loss); emit Liquidated(id, msg.sender, paid, seized, loss);
    }
    function reputationScore(uint256 agentId) external view returns (uint256) {
        History storage h = history[agentId]; uint256 earned = Math.min(h.qualifyingLoans, 10) * 10;
        uint256 penalty = Math.min(h.liquidations + h.lateRepayments, 4) * 25;
        return earned > penalty ? earned - penalty : 0;
    }
    function setBorrowingPaused(bool value) external onlyOwner { borrowingPaused = value; emit BorrowingPauseChanged(value); }
    function _receipt(uint256 id, Position storage p, uint8 kind, address payer, uint256 principal, uint256 interest) internal {
        emit FinancialReceipt(nextFinancialReceiptId++, id, p.agentId, kind, payer, principal, interest);
    }
    function _in(IERC20 token, address from, uint256 amount) internal {
        uint256 beforeBalance = token.balanceOf(address(this)); uint256 beforeSender = token.balanceOf(from);
        token.safeTransferFrom(from, address(this), amount);
        if (token.balanceOf(address(this)) != beforeBalance + amount || token.balanceOf(from) + amount != beforeSender) revert UnsupportedToken();
    }
    function _out(IERC20 token, address to, uint256 amount) internal {
        uint256 beforeBalance = token.balanceOf(address(this)); uint256 recipientBalance = token.balanceOf(to);
        token.safeTransfer(to, amount);
        if (token.balanceOf(address(this)) + amount != beforeBalance || token.balanceOf(to) != recipientBalance + amount) revert UnsupportedToken();
    }
}




