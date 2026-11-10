// Generated ABI/runtime bytecode only. No deployment addresses.
export const agentABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "sender",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      }
    ],
    "name": "ERC721IncorrectOwner",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "operator",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "ERC721InsufficientApproval",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "approver",
        "type": "address"
      }
    ],
    "name": "ERC721InvalidApprover",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "operator",
        "type": "address"
      }
    ],
    "name": "ERC721InvalidOperator",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      }
    ],
    "name": "ERC721InvalidOwner",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "receiver",
        "type": "address"
      }
    ],
    "name": "ERC721InvalidReceiver",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "sender",
        "type": "address"
      }
    ],
    "name": "ERC721InvalidSender",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "ERC721NonexistentToken",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "EmptyMetadataURI",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidAgentWallet",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "agentId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "caller",
        "type": "address"
      }
    ],
    "name": "NotAgentOwner",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ReentrancyGuardReentrantCall",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "agentId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "metadataURI",
        "type": "string"
      }
    ],
    "name": "AgentMetadataUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "agentId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "agentWallet",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "metadataURI",
        "type": "string"
      }
    ],
    "name": "AgentMinted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "agentId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "previousWallet",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "newWallet",
        "type": "address"
      }
    ],
    "name": "AgentWalletUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "approved",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "Approval",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "operator",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "approved",
        "type": "bool"
      }
    ],
    "name": "ApprovalForAll",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "from",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "Transfer",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "agentId",
        "type": "uint256"
      }
    ],
    "name": "agentWalletOf",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "approve",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      }
    ],
    "name": "balanceOf",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "getApproved",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "operator",
        "type": "address"
      }
    ],
    "name": "isApprovedForAll",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "agentWallet",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "metadataURI",
        "type": "string"
      }
    ],
    "name": "mint",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "agentId",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "name",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "nextAgentId",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "ownerOf",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "from",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "safeTransferFrom",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "from",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      },
      {
        "internalType": "bytes",
        "name": "data",
        "type": "bytes"
      }
    ],
    "name": "safeTransferFrom",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "agentId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "newWallet",
        "type": "address"
      }
    ],
    "name": "setAgentWallet",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "operator",
        "type": "address"
      },
      {
        "internalType": "bool",
        "name": "approved",
        "type": "bool"
      }
    ],
    "name": "setApprovalForAll",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "agentId",
        "type": "uint256"
      },
      {
        "internalType": "string",
        "name": "metadataURI",
        "type": "string"
      }
    ],
    "name": "setMetadataURI",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes4",
        "name": "interfaceId",
        "type": "bytes4"
      }
    ],
    "name": "supportsInterface",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "agentId",
        "type": "uint256"
      }
    ],
    "name": "tokenURI",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "from",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "transferFrom",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;
export const agentRuntimeBytecode = '0x608060405234801561000f575f5ffd5b5060043610610111575f3560e01c8063636d2f641161009e578063a22cb4651161006e578063a22cb46514610236578063b88d4fde14610249578063c87b56dd1461025c578063d0def5211461026f578063e985e9c514610282575f5ffd5b8063636d2f64146101f557806370a0823114610208578063851f5d691461021b57806395d89b411461022e575f5ffd5b8063095ea7b3116100e4578063095ea7b31461019257806323b872dd146101a557806330efc498146101b857806342842e0e146101cf5780636352211e146101e2575f5ffd5b806301ffc9a71461011557806306fdde031461013d578063081812fc14610152578063087dce941461017d575b5f5ffd5b610128610123366004610f15565b610295565b60405190151581526020015b60405180910390f35b6101456102e6565b6040516101349190610f5e565b610165610160366004610f70565b610375565b6040516001600160a01b039091168152602001610134565b61019061018b366004610fcc565b61039c565b005b6101906101a036600461102f565b610474565b6101906101b3366004611057565b610483565b6101c160065481565b604051908152602001610134565b6101906101dd366004611057565b61050c565b6101656101f0366004610f70565b610526565b610190610203366004611091565b610530565b6101c16102163660046110bb565b61060a565b610165610229366004610f70565b61064f565b610145610675565b6101906102443660046110d4565b610684565b610190610257366004611121565b61068f565b61014561026a366004610f70565b6106a7565b6101c161027d3660046111fe565b61074e565b610128610290366004611234565b610866565b5f6001600160e01b031982166380ac58cd60e01b14806102c557506001600160e01b03198216635b5e139f60e01b145b806102e057506301ffc9a760e01b6001600160e01b03198316145b92915050565b60605f80546102f49061125c565b80601f01602080910402602001604051908101604052809291908181526020018280546103209061125c565b801561036b5780601f106103425761010080835404028352916020019161036b565b820191905f5260205f20905b81548152906001019060200180831161034e57829003601f168201915b5050505050905090565b5f61037f82610893565b505f828152600460205260409020546001600160a01b03166102e0565b6103a46108cb565b82336103af82610893565b6001600160a01b0316146103e4576040516304ffad3160e21b8152600481018290523360248201526044015b60405180910390fd5b5f8290036104055760405163128e0ec160e11b815260040160405180910390fd5b5f84815260086020526040902061041d8385836112d8565b50837f859fac2fc059a2fa38efe7236e1c16278c1519298d62dd05582ff7fa392a10458484604051610450929190611392565b60405180910390a25061046f60015f51602061143c5f395f51905f5255565b505050565b61047f8282336108e6565b5050565b6001600160a01b0382166104ac57604051633250574960e11b81525f60048201526024016103db565b5f6104b88383336108f3565b9050836001600160a01b0316816001600160a01b031614610506576040516364283d7b60e01b81526001600160a01b03808616600483015260248201849052821660448201526064016103db565b50505050565b61046f83838360405180602001604052805f81525061068f565b5f6102e082610893565b6105386108cb565b813361054382610893565b6001600160a01b031614610573576040516304ffad3160e21b8152600481018290523360248201526044016103db565b6001600160a01b03821661059a5760405163b8dfc03960e01b815260040160405180910390fd5b5f8381526007602052604080822080546001600160a01b031981166001600160a01b038781169182179093559251911692839187917f74805688ff1e321e8ba9a2575ea8316cc3cff615cc85248b44db8b492e98945f91a4505061047f60015f51602061143c5f395f51905f5255565b5f6001600160a01b038216610634576040516322718ad960e21b81525f60048201526024016103db565b506001600160a01b03165f9081526003602052604090205490565b5f61065982610893565b50505f908152600760205260409020546001600160a01b031690565b6060600180546102f49061125c565b61047f33838361098e565b61069a848484610483565b6105063385858585610a55565b60606106b282610893565b505f82815260086020526040902080546106cb9061125c565b80601f01602080910402602001604051908101604052809291908181526020018280546106f79061125c565b80156107425780601f1061071957610100808354040283529160200191610742565b820191905f5260205f20905b81548152906001019060200180831161072557829003601f168201915b50505050509050919050565b5f6107576108cb565b6001600160a01b03841661077e5760405163b8dfc03960e01b815260040160405180910390fd5b5f82900361079f5760405163128e0ec160e11b815260040160405180910390fd5b60068054905f6107ae836113c0565b909155505f81815260076020908152604080832080546001600160a01b0319166001600160a01b038a16179055600890915290209091506107f08385836112d8565b50836001600160a01b0316336001600160a01b0316827f845e07cfebb57fd74ff2371137863e30091808a6aa5cc5f0e48893001af20c608686604051610837929190611392565b60405180910390a46108493382610b7d565b61085f60015f51602061143c5f395f51905f5255565b9392505050565b6001600160a01b039182165f90815260056020908152604080832093909416825291909152205460ff1690565b5f818152600260205260408120546001600160a01b0316806102e057604051637e27328960e01b8152600481018490526024016103db565b6108d3610b96565b60025f51602061143c5f395f51905f5255565b61046f8383836001610bc7565b5f6108ff848484610ccb565b90506001600160a01b0381161580159061092b5750836001600160a01b0316816001600160a01b031614155b1561085f575f8381526007602052604080822080546001600160a01b0319811690915590516001600160a01b039091169190829086907f74805688ff1e321e8ba9a2575ea8316cc3cff615cc85248b44db8b492e98945f908490a4509392505050565b6001600160a01b0383166109b75760405163a9fbf51f60e01b81525f60048201526024016103db565b6001600160a01b0382166109e957604051630b61174360e31b81526001600160a01b03831660048201526024016103db565b6001600160a01b038381165f81815260056020908152604080832094871680845294825291829020805460ff191686151590811790915591519182527f17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31910160405180910390a3505050565b6001600160a01b0383163b15610b7657604051630a85bd0160e11b81526001600160a01b0384169063150b7a0290610a979088908890879087906004016113e4565b6020604051808303815f875af1925050508015610ad1575060408051601f3d908101601f19168201909252610ace91810190611420565b60015b610b38573d808015610afe576040519150601f19603f3d011682016040523d82523d5f602084013e610b03565b606091505b5080515f03610b3057604051633250574960e11b81526001600160a01b03851660048201526024016103db565b805160208201fd5b6001600160e01b03198116630a85bd0160e11b14610b7457604051633250574960e11b81526001600160a01b03851660048201526024016103db565b505b5050505050565b61047f828260405180602001604052805f815250610dbd565b5f51602061143c5f395f51905f5254600203610bc557604051633ee5aeb560e01b815260040160405180910390fd5b565b8080610bdb57506001600160a01b03821615155b15610c9c575f610bea84610893565b90506001600160a01b03831615801590610c165750826001600160a01b0316816001600160a01b031614155b8015610c295750610c278184610866565b155b15610c525760405163a9fbf51f60e01b81526001600160a01b03841660048201526024016103db565b8115610c9a5783856001600160a01b0316826001600160a01b03167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b92560405160405180910390a45b505b50505f90815260046020526040902080546001600160a01b0319166001600160a01b0392909216919091179055565b5f828152600260205260408120546001600160a01b0390811690831615610cf757610cf7818486610dd4565b6001600160a01b03811615610d3157610d125f855f5f610bc7565b6001600160a01b0381165f90815260036020526040902080545f190190555b6001600160a01b03851615610d5f576001600160a01b0385165f908152600360205260409020805460010190555b5f8481526002602052604080822080546001600160a01b0319166001600160a01b0389811691821790925591518793918516917fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef91a4949350505050565b610dc78383610e38565b61046f335f858585610a55565b610ddf838383610e99565b61046f576001600160a01b038316610e0d57604051637e27328960e01b8152600481018290526024016103db565b60405163177e802f60e01b81526001600160a01b0383166004820152602481018290526044016103db565b6001600160a01b038216610e6157604051633250574960e11b81525f60048201526024016103db565b5f610e6d83835f6108f3565b90506001600160a01b0381161561046f576040516339e3563760e11b81525f60048201526024016103db565b5f6001600160a01b03831615801590610ef55750826001600160a01b0316846001600160a01b03161480610ed25750610ed28484610866565b80610ef557505f828152600460205260409020546001600160a01b038481169116145b949350505050565b6001600160e01b031981168114610f12575f5ffd5b50565b5f60208284031215610f25575f5ffd5b813561085f81610efd565b5f81518084528060208401602086015e5f602082860101526020601f19601f83011685010191505092915050565b602081525f61085f6020830184610f30565b5f60208284031215610f80575f5ffd5b5035919050565b5f5f83601f840112610f97575f5ffd5b50813567ffffffffffffffff811115610fae575f5ffd5b602083019150836020828501011115610fc5575f5ffd5b9250929050565b5f5f5f60408486031215610fde575f5ffd5b83359250602084013567ffffffffffffffff811115610ffb575f5ffd5b61100786828701610f87565b9497909650939450505050565b80356001600160a01b038116811461102a575f5ffd5b919050565b5f5f60408385031215611040575f5ffd5b61104983611014565b946020939093013593505050565b5f5f5f60608486031215611069575f5ffd5b61107284611014565b925061108060208501611014565b929592945050506040919091013590565b5f5f604083850312156110a2575f5ffd5b823591506110b260208401611014565b90509250929050565b5f602082840312156110cb575f5ffd5b61085f82611014565b5f5f604083850312156110e5575f5ffd5b6110ee83611014565b915060208301358015158114611102575f5ffd5b809150509250929050565b634e487b7160e01b5f52604160045260245ffd5b5f5f5f5f60808587031215611134575f5ffd5b61113d85611014565b935061114b60208601611014565b925060408501359150606085013567ffffffffffffffff81111561116d575f5ffd5b8501601f8101871361117d575f5ffd5b803567ffffffffffffffff8111156111975761119761110d565b604051601f8201601f19908116603f0116810167ffffffffffffffff811182821017156111c6576111c661110d565b6040528181528282016020018910156111dd575f5ffd5b816020840160208301375f6020838301015280935050505092959194509250565b5f5f5f60408486031215611210575f5ffd5b61121984611014565b9250602084013567ffffffffffffffff811115610ffb575f5ffd5b5f5f60408385031215611245575f5ffd5b61124e83611014565b91506110b260208401611014565b600181811c9082168061127057607f821691505b60208210810361128e57634e487b7160e01b5f52602260045260245ffd5b50919050565b601f82111561046f57805f5260205f20601f840160051c810160208510156112b95750805b601f840160051c820191505b81811015610b76575f81556001016112c5565b67ffffffffffffffff8311156112f0576112f061110d565b611304836112fe835461125c565b83611294565b5f601f841160018114611335575f851561131e5750838201355b5f19600387901b1c1916600186901b178355610b76565b5f83815260208120601f198716915b828110156113645786850135825560209485019460019092019101611344565b5086821015611380575f1960f88860031b161c19848701351681555b505060018560011b0183555050505050565b60208152816020820152818360408301375f818301604090810191909152601f909201601f19160101919050565b5f600182016113dd57634e487b7160e01b5f52601160045260245ffd5b5060010190565b6001600160a01b03858116825284166020820152604081018390526080606082018190525f9061141690830184610f30565b9695505050505050565b5f60208284031215611430575f5ffd5b815161085f81610efd56fe9b779b17422d0df92223018b32b4d1fa46e071723d6817e2486d003becc55f00a26469706673582212203abf0c3f9549c87ef058d32d21df492bca4a158a2e950d0ce1b5330f25b4af7264736f6c634300081c0033' as const;
