// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Base64} from "../vendor/openzeppelin-contracts/utils/Base64.sol";
import {Strings} from "../vendor/openzeppelin-contracts/utils/Strings.sol";
import {FiredPiece} from "./WheelAndClayTypes.sol";

/// @dev v1 为冻结的二维器形预览；完整 270 字节 design 用于前端重建三维器物。
library WheelAndClayRenderer {
    using Strings for uint256;

    function tokenURI(uint256 tokenId, FiredPiece memory p) internal pure returns (string memory) {
        string memory image = string.concat("data:image/svg+xml;base64,", Base64.encode(bytes(svg(p))));
        string memory json = string.concat(
            '{"name":"Wheel & Clay #', tokenId.toString(),
            '","description":"Independent Wheel & Clay pottery. Frozen maker design and certified Sepolia SqueekCore round. Image is a 2D profile preview, not a 3D rendering. Zero work does not establish animal sleep. Not an official Squeeks NFT.",',
            '"image":"', image, '","external_url":"https://wheel-and-clay.shop/?nft=', tokenId.toString(),
            '","attributes":', attributes(p), ',"properties":', properties(p), '}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function recipe(FiredPiece memory p) private pure returns (uint32 seed, uint256 energyBps) {
        seed = uint32(uint256(p.dataHash) >> 224) ^ uint32(p.roundId) ^ uint32(p.work);
        energyBps = uint256(p.work) * 20;
        if (energyBps > 10000) energyBps = 10000;
    }

    function attributes(FiredPiece memory p) private pure returns (string memory) {
        (uint32 seed, uint256 energyBps) = recipe(p);
        return string.concat(
            '[{"trait_type":"Certified round","value":"', uint256(p.roundId).toString(),
            '"},{"trait_type":"Certified work","value":"', uint256(p.work).toString(),
            '"},{"trait_type":"Kiln energy bps","value":', energyBps.toString(),
            '},{"trait_type":"Kiln seed32","value":', uint256(seed).toString(),
            '},{"trait_type":"Renderer version","value":', uint256(p.rendererVersion).toString(),
            '},{"trait_type":"Preview","value":"2D profile"}]'
        );
    }

    function properties(FiredPiece memory p) private pure returns (string memory) {
        return string.concat(
            '{"design_encoding":"WC-v1-270","design_base64":"', Base64.encode(p.design),
            '","design_hash":"', Strings.toHexString(uint256(p.designHash), 32),
            '","maker":"', Strings.toHexString(p.maker),
            '","source_chain_id":11155111,"source_core":"0xfd6c166d4b8e2962e65746a13e5a0797cd4de0c4",',
            '"source_implementation":"', Strings.toHexString(p.coreImplementation),
            '","source_data_hash":"', Strings.toHexString(uint256(p.dataHash), 32),
            '","recipe":"WC-kiln-v1","maker_mode_label":', uint256(uint8(p.design[6])).toString(), '}'
        );
    }

    function svg(FiredPiece memory p) private pure returns (string memory) {
        string memory outline = silhouette(p.design);
        (uint32 seed, uint256 energyBps) = recipe(p);
        uint256 shift = uint256(seed % 6283);
        uint256 flow = 1800 + 6200 * energyBps / 10000;
        return string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="733" viewBox="0 0 36000 44000" role="img">',
            '<title>Wheel &amp; Clay - 2D profile preview</title>',
            '<desc>129 saved radii at their exact 2.65-unit design height. Decorative kiln bands derive from the certified round; no 3D claim.</desc>',
            '<rect width="36000" height="44000" fill="#101114"/>',
            '<defs><clipPath id="pot"><path d="', outline, '"/></clipPath></defs>',
            '<path d="', outline, '" fill="', glazeColor(uint8(p.design[4])), '" stroke="#f1e8d4" stroke-width="80"/>',
            '<g clip-path="url(#pot)" fill="none" stroke="#f0dfb0" stroke-opacity=".32" stroke-width="600">',
            '<path d="M 2000 ', (14000 + shift).toString(), ' Q 18000 ', (14000 + shift + flow).toString(),
            ' 34000 ', (14000 + shift).toString(), ' M 2000 ', (22000 + shift).toString(),
            ' Q 18000 ', (22000 + shift + flow).toString(), ' 34000 ', (22000 + shift).toString(),
            ' M 2000 ', (30000 + shift).toString(), ' Q 18000 ', (30000 + shift + flow).toString(),
            ' 34000 ', (30000 + shift).toString(), '"/></g>',
            '<text x="18000" y="41000" fill="#c8c2b9" text-anchor="middle" font-family="sans-serif" font-size="900">',
            'WHEEL &amp; CLAY / 2D PROFILE</text></svg>'
        );
    }

    function silhouette(bytes memory design) private pure returns (string memory path) {
        for (uint256 i = 0; i < 129; ++i) {
            uint256 radius = (uint256(uint8(design[12 + i * 2])) << 8) | uint256(uint8(design[13 + i * 2]));
            path = string.concat(path, i == 0 ? "M " : " L ", (18000 - radius).toString(), " ", (37000 - i * 26500 / 128).toString());
        }
        for (uint256 i = 129; i > 0; --i) {
            uint256 j = i - 1;
            uint256 radius = (uint256(uint8(design[12 + j * 2])) << 8) | uint256(uint8(design[13 + j * 2]));
            path = string.concat(path, " L ", (18000 + radius).toString(), " ", (37000 - j * 26500 / 128).toString());
        }
        return string.concat(path, " Z");
    }

    function glazeColor(uint8 index) private pure returns (string memory) {
        string[16] memory colors = [
            string("#286e61"), "#ddd5bd", "#233d73", "#74351f", "#9caf95", "#176f81", "#729aba", "#232b31",
            "#7e6b9b", "#743c65", "#c89194", "#c9604c", "#d4aa49", "#a56f34", "#68744a", "#89938d"
        ];
        return colors[index];
    }
}
