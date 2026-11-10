// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AMEAgent} from "./AMEAgent.sol";

/// @notice Append-only activity attestations. Records are not proof of task or payment execution.
contract AMEReceipt {
    enum ReceiptType { TASK, PAYMENT, SWAP, ACTION }

    struct Receipt {
        uint256 agentId;
        ReceiptType receiptType;
        address issuer;
        uint256 timestamp;
        bytes32 dataHash;
        string metadataURI;
    }

    AMEAgent public immutable agentRegistry;
    uint256 public nextReceiptId = 1;
    mapping(uint256 => Receipt) private _receipts;

    error InvalidAgentRegistry();
    error UnauthorizedIssuer(uint256 agentId, address caller);
    error EmptyDataHash();
    error EmptyMetadataURI();
    error InvalidReceiptId(uint256 receiptId);

    event ReceiptCreated(uint256 indexed receiptId, uint256 indexed agentId, address indexed issuer, ReceiptType receiptType, bytes32 dataHash, string metadataURI);

    constructor(AMEAgent registry) {
        if (address(registry) == address(0) || address(registry).code.length == 0) revert InvalidAgentRegistry();
        agentRegistry = registry;
    }

    /// @notice The current NFT owner or assigned agent wallet may issue a receipt.
    function createReceipt(uint256 agentId, ReceiptType receiptType, bytes32 dataHash, string calldata metadataURI) external returns (uint256 receiptId) {
        // ownerOf reverts for nonexistent agents, including ID zero.
        address owner = agentRegistry.ownerOf(agentId);
        if (msg.sender != owner && msg.sender != agentRegistry.agentWalletOf(agentId)) revert UnauthorizedIssuer(agentId, msg.sender);
        if (dataHash == bytes32(0)) revert EmptyDataHash();
        if (bytes(metadataURI).length == 0) revert EmptyMetadataURI();

        receiptId = nextReceiptId++;
        _receipts[receiptId] = Receipt(agentId, receiptType, msg.sender, block.timestamp, dataHash, metadataURI);
        emit ReceiptCreated(receiptId, agentId, msg.sender, receiptType, dataHash, metadataURI);
    }

    function getReceipt(uint256 receiptId) external view returns (Receipt memory) {
        if (receiptId == 0 || receiptId >= nextReceiptId) revert InvalidReceiptId(receiptId);
        return _receipts[receiptId];
    }
}
