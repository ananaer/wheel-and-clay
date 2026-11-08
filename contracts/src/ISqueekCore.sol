// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

// 官方 ABI 子集；只读接口，不包含结算、签名或管理员操作。
// 来源：https://docs.squeekchain.com/assets/abi/SqueekCore.json
interface ISqueekCore {
    struct LedgerPosition {
        uint64 cumulativeWork;
        uint96 cumulativeBlockUnits;
        uint32 workPerThousandBlocks;
    }

    struct RoundCheckpoint {
        uint64 roundId;
        uint64 cumulativeWork;
        uint96 cumulativeBlockUnits;
        uint32 workPerThousandBlocks;
        bytes32 dataHash;
    }

    struct RoundPage {
        uint64 certifiedThroughRound;
        LedgerPosition start;
        LedgerPosition end;
        RoundCheckpoint[] rounds;
    }

    function implementationCodeAddress() external view returns (address);
    function implementationStorageLayoutDigest() external view returns (bytes32);
    function roundPage(uint64 afterRound, uint64 throughRound, uint256 maxRecords)
        external view returns (RoundPage memory result);
}
