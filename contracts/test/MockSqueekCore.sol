// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ISqueekCore} from "../src/ISqueekCore.sol";

// 仅离线 EVM 测试安装在官方地址；不会部署到网络。
contract MockSqueekCore is ISqueekCore {
    address private _implementation;
    bytes32 private _layout;
    uint64 private _frontier;
    uint64 private _work;
    bytes32 private _dataHash;
    uint8 private _malformed;

    function configure(address implementation, bytes32 layout, uint64 frontier, uint64 work, bytes32 dataHash, uint8 malformed) external {
        _implementation = implementation; _layout = layout; _frontier = frontier;
        _work = work; _dataHash = dataHash; _malformed = malformed;
    }
    function implementationCodeAddress() external view returns (address) { return _implementation; }
    function implementationStorageLayoutDigest() external view returns (bytes32) { return _layout; }
    function roundPage(uint64 afterRound, uint64 throughRound, uint256 maxRecords) external view returns (RoundPage memory result) {
        require(throughRound == afterRound + 1 && maxRecords == 1, "wrong query");
        if (throughRound > _frontier) revert("unknown round");
        result.certifiedThroughRound = _malformed == 1 ? throughRound - 1 : throughRound;
        result.start = LedgerPosition(1000, 1000000000, 10875);
        result.end = LedgerPosition(_malformed == 2 ? 999 : 1000 + _work, 2000000000, 10875);
        if ((_work > 0 && _malformed != 3) || _malformed == 6) {
            result.rounds = new RoundCheckpoint[](1);
            result.rounds[0] = RoundCheckpoint(
                _malformed == 4 ? throughRound - 1 : throughRound,
                _malformed == 5 ? 999 : result.end.cumulativeWork,
                result.end.cumulativeBlockUnits, 10875, _dataHash
            );
        } else result.rounds = new RoundCheckpoint[](0);
    }
}
