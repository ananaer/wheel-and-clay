// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

// 固定字段在前、动态设计在后；字段顺序是浏览器只读 ABI 的一部分。
struct FiredPiece {
    address maker;
    uint64 roundId;
    uint64 work;
    bytes32 dataHash;
    bytes32 designHash;
    address coreImplementation;
    uint16 rendererVersion;
    bytes design;
}
