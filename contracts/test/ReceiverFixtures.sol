// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC721Receiver} from "../vendor/openzeppelin-contracts/token/ERC721/IERC721Receiver.sol";

interface IKilnMint {
    function mint(bytes calldata design, uint64 roundId, uint64 expectedWork) external returns (uint256);
}

contract RejectingReceiver {
    function fire(address kiln, bytes calldata design, uint64 roundId, uint64 work) external {
        IKilnMint(kiln).mint(design, roundId, work);
    }
}

// 相同 maker/design/round 在接收回调中再次铸造也必须失败。
contract ReenteringReceiver is IERC721Receiver {
    bytes private _design;
    uint64 private _round;
    uint64 private _work;
    bool public duplicateRejected;

    function fire(address kiln, bytes calldata design, uint64 roundId, uint64 work) external {
        _design = design; _round = roundId; _work = work;
        IKilnMint(kiln).mint(design, roundId, work);
    }
    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4) {
        try IKilnMint(msg.sender).mint(_design, _round, _work) { revert("duplicate was accepted"); }
        catch { duplicateRejected = true; }
        return IERC721Receiver.onERC721Received.selector;
    }
}
