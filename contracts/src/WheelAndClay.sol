// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ERC721} from "../vendor/openzeppelin-contracts/token/ERC721/ERC721.sol";
import {ISqueekCore} from "./ISqueekCore.sol";
import {FiredPiece} from "./WheelAndClayTypes.sol";
import {WheelAndClayRenderer} from "./WheelAndClayRenderer.sol";

/// @notice 独立陶器作品 NFT；读取 SqueekCore 的认证轮次，不属于官方 Squeeks 集合。
/// @dev 无管理员、代理、费用、元数据修改入口或外部随机数。
contract WheelAndClay is ERC721 {
    uint256 public constant SOURCE_CHAIN_ID = 11155111;
    uint16 public constant RENDERER_VERSION = 1;
    ISqueekCore public constant core = ISqueekCore(0xFD6C166D4B8E2962E65746a13e5a0797CD4dE0c4);
    address public constant EXPECTED_CORE_IMPLEMENTATION = 0x6869D6102696243Fd17013ab955d99CD0c522ad3;
    bytes32 public constant EXPECTED_CORE_LAYOUT = 0x9a9c008e029460808209571703fbf2679785874e0e6d3232f16a864d12abcb20;

    uint256 public totalMinted;
    mapping(uint256 tokenId => FiredPiece) private _pieces;
    mapping(bytes32 makerDesignRound => bool) public fired;

    error WrongChain(uint256 chainId);
    error InvalidDesign(uint256 offset);
    error InvalidRound(uint64 roundId);
    error CoreIdentityChanged(address implementation, bytes32 layout);
    error UncertifiedRound(uint64 requested, uint64 certified);
    error MalformedRoundSource();
    error WorkChanged(uint64 expected, uint64 actual);
    error AlreadyFired(bytes32 key);

    event PieceFired(
        uint256 indexed tokenId,
        address indexed maker,
        uint64 indexed roundId,
        uint64 work,
        bytes32 designHash
    );

    constructor() ERC721("Wheel & Clay", "WCLAY") {
        if (block.chainid != SOURCE_CHAIN_ID) revert WrongChain(block.chainid);
    }

    /// @notice 零铸造费；钱包仍需支付 Sepolia 网络 gas。expectedWork 防止预览和执行不一致。
    function mint(bytes calldata design, uint64 roundId, uint64 expectedWork)
        external returns (uint256 tokenId)
    {
        _validateDesign(design);
        (uint64 work, bytes32 dataHash) = roundSource(roundId);
        if (work != expectedWork) revert WorkChanged(expectedWork, work);
        bytes32 designHash = keccak256(design);
        bytes32 key = keccak256(abi.encode(msg.sender, designHash, roundId));
        if (fired[key]) revert AlreadyFired(key);

        // 先冻结全部数据及防重状态，再进入 ERC721 接收回调。
        fired[key] = true;
        tokenId = ++totalMinted;
        _pieces[tokenId] = FiredPiece({
            maker: msg.sender,
            roundId: roundId,
            work: work,
            dataHash: dataHash,
            designHash: designHash,
            coreImplementation: EXPECTED_CORE_IMPLEMENTATION,
            rendererVersion: RENDERER_VERSION,
            design: design
        });
        _safeMint(msg.sender, tokenId);
        emit PieceFired(tokenId, msg.sender, roundId, work, designHash);
    }

    /// @notice 从一个已认证轮次读取真实工作量。零工作量只表示该轮结算为零。
    function roundSource(uint64 roundId) public view returns (uint64 work, bytes32 dataHash) {
        if (block.chainid != SOURCE_CHAIN_ID) revert WrongChain(block.chainid);
        if (roundId == 0) revert InvalidRound(roundId);
        address implementation = core.implementationCodeAddress();
        bytes32 layout = core.implementationStorageLayoutDigest();
        if (implementation != EXPECTED_CORE_IMPLEMENTATION || layout != EXPECTED_CORE_LAYOUT) {
            revert CoreIdentityChanged(implementation, layout);
        }
        ISqueekCore.RoundPage memory page = core.roundPage(roundId - 1, roundId, 1);
        if (page.certifiedThroughRound != roundId) {
            revert UncertifiedRound(roundId, page.certifiedThroughRound);
        }
        if (page.end.cumulativeWork < page.start.cumulativeWork) revert MalformedRoundSource();
        work = page.end.cumulativeWork - page.start.cumulativeWork;
        if (work == 0) {
            // 官方 Core 对零工作量轮次不建立 active checkpoint。
            if (page.rounds.length != 0) revert MalformedRoundSource();
            return (0, bytes32(0));
        }
        if (page.rounds.length != 1) revert MalformedRoundSource();
        ISqueekCore.RoundCheckpoint memory checkpoint = page.rounds[0];
        if (
            checkpoint.roundId != roundId || checkpoint.cumulativeWork != page.end.cumulativeWork
                || checkpoint.dataHash == bytes32(0)
        ) revert MalformedRoundSource();
        return (work, checkpoint.dataHash);
    }

    function piece(uint256 tokenId) external view returns (
        address maker,
        uint64 roundId,
        uint64 work,
        bytes32 dataHash,
        bytes32 designHash,
        address coreImplementation,
        uint16 rendererVersion,
        bytes memory design
    ) {
        _requireOwned(tokenId);
        FiredPiece storage p = _pieces[tokenId];
        return (p.maker, p.roundId, p.work, p.dataHash, p.designHash, p.coreImplementation, p.rendererVersion, p.design);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return WheelAndClayRenderer.tokenURI(tokenId, _pieces[tokenId]);
    }

    function _validateDesign(bytes calldata design) private pure {
        if (design.length != 270) revert InvalidDesign(design.length);
        if (uint8(design[0]) != 87 || uint8(design[1]) != 67 || uint8(design[2]) != 1) revert InvalidDesign(0);
        if (uint8(design[3]) > 2) revert InvalidDesign(3);
        if (uint8(design[4]) > 15) revert InvalidDesign(4);
        if (uint8(design[5]) > 3) revert InvalidDesign(5);
        if (uint8(design[6]) > 2) revert InvalidDesign(6);
        if (uint8(design[7]) > 3) revert InvalidDesign(7);
        if (_uint16(design, 8) > 1000) revert InvalidDesign(8);
        if (design[10] != 0 || design[11] != 0) revert InvalidDesign(10);
        for (uint256 i = 12; i < 270; i += 2) {
            uint16 radius = _uint16(design, i);
            if (radius < 2400 || radius > 12300) revert InvalidDesign(i);
        }
    }

    function _uint16(bytes calldata data, uint256 offset) private pure returns (uint16) {
        return (uint16(uint8(data[offset])) << 8) | uint16(uint8(data[offset + 1]));
    }
}
