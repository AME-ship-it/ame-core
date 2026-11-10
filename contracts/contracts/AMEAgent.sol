// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Transferable agent identity. Wallet assignment does not create or custody a wallet.
contract AMEAgent is ERC721, ReentrancyGuard {
    uint256 public nextAgentId = 1;
    mapping(uint256 => address) private _agentWallets;
    mapping(uint256 => string) private _metadataURIs;

    error InvalidAgentWallet();
    error EmptyMetadataURI();
    error NotAgentOwner(uint256 agentId, address caller);

    event AgentMinted(uint256 indexed agentId, address indexed owner, address indexed agentWallet, string metadataURI);
    event AgentWalletUpdated(uint256 indexed agentId, address indexed previousWallet, address indexed newWallet);
    event AgentMetadataUpdated(uint256 indexed agentId, string metadataURI);

    constructor() ERC721("AME Agent", "AME") {}

    modifier onlyAgentOwner(uint256 agentId) {
        if (_requireOwned(agentId) != msg.sender) revert NotAgentOwner(agentId, msg.sender);
        _;
    }

    /// @notice Mint to the caller. Free, permissionless minting for the core phase.
    function mint(address agentWallet, string calldata metadataURI) external nonReentrant returns (uint256 agentId) {
        if (agentWallet == address(0)) revert InvalidAgentWallet();
        if (bytes(metadataURI).length == 0) revert EmptyMetadataURI();
        agentId = nextAgentId++;
        _agentWallets[agentId] = agentWallet;
        _metadataURIs[agentId] = metadataURI;
        emit AgentMinted(agentId, msg.sender, agentWallet, metadataURI);
        _safeMint(msg.sender, agentId);
    }

    function agentWalletOf(uint256 agentId) external view returns (address) {
        _requireOwned(agentId);
        return _agentWallets[agentId];
    }

    function tokenURI(uint256 agentId) public view override returns (string memory) {
        _requireOwned(agentId);
        return _metadataURIs[agentId];
    }

    function setAgentWallet(uint256 agentId, address newWallet) external nonReentrant onlyAgentOwner(agentId) {
        if (newWallet == address(0)) revert InvalidAgentWallet();
        address previous = _agentWallets[agentId];
        _agentWallets[agentId] = newWallet;
        emit AgentWalletUpdated(agentId, previous, newWallet);
    }

    function setMetadataURI(uint256 agentId, string calldata metadataURI) external nonReentrant onlyAgentOwner(agentId) {
        if (bytes(metadataURI).length == 0) revert EmptyMetadataURI();
        _metadataURIs[agentId] = metadataURI;
        emit AgentMetadataUpdated(agentId, metadataURI);
    }

    /// @dev Transfers invalidate the previous wallet's receipt-writing authority.
    function _update(address to, uint256 agentId, address auth) internal override returns (address from) {
        from = super._update(to, agentId, auth);
        if (from != address(0) && from != to) {
            address previous = _agentWallets[agentId];
            delete _agentWallets[agentId];
            emit AgentWalletUpdated(agentId, previous, address(0));
        }
    }
}
