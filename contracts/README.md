# Wheel & Clay pottery NFT contracts

Status recorded on **2026-11-08 (UTC+8)**: the independent Wheel & Clay ERC-721 collection is deployed on Sepolia, and **NFT #1 has been minted through the application's actual mint client and verified after 12 blocks**. Live chain evidence and offline EVM tests are recorded separately below.

This directory contains the Solidity source, vendored dependencies, reproducible compilation artifact, and offline EVM fixtures. The collection is independent of official Squeeks. A token preserves a maker's pottery design and a certified SqueekCore round; it does not prove Squeek ownership, use of real hardware while making the piece, or creation during the selected round. It offers no guarantee of rarity, value, or returns.

## Sepolia deployment and evidence

| Item | Recorded value |
| --- | --- |
| Network | Sepolia, chain ID `11155111` |
| Collection | [`0xf83b2c5dc0650ccfb0a621b68c9bbbbdf35f0cc9`](https://eth-sepolia.blockscout.com/address/0xf83b2c5dc0650ccfb0a621b68c9bbbbdf35f0cc9) |
| Deployment transaction | [`0x08cf183e47db2df884605eff980d8cb6607ef295589077af8c34b86cf948d133`](https://eth-sepolia.blockscout.com/tx/0x08cf183e47db2df884605eff980d8cb6607ef295589077af8c34b86cf948d133) |
| Deployment receipt | Status `0x1`, block `12089425` |
| Verified NFT | [Wheel & Clay #1](https://wheel-and-clay.shop/?nft=1) · [Blockscout token](https://eth-sepolia.blockscout.com/token/0xf83b2c5dc0650ccfb0a621b68c9bbbbdf35f0cc9/instance/1) |
| Mint transaction | [`0x79796966ff7532aead4e6e3a3acb9ea89e5bac1f70d0cda98547c6d3cd9bde52`](https://eth-sepolia.blockscout.com/tx/0x79796966ff7532aead4e6e3a3acb9ea89e5bac1f70d0cda98547c6d3cd9bde52) |
| Runtime Keccak-256 | `0xaf82fa9bfc28bdb28892b83951677d218cbc8bacec0dc64b6c74a3a158279394` |
| Runtime SHA-256 | `2a46f14b1eecf7df0425c7b035e9621de2b0f4b45d2f9532431e0cc16ded36a1` |

Deployment values come from the saved [deployment record](deployment-sepolia.json) and agree with the application [NFT configuration](../nft-config.js) and [compilation artifact](artifacts/WheelAndClay.json). An offline consistency check matched all 21 compiled input source hashes and the artifact's 13,644-byte runtime against the saved runtime hashes.

The separate [verified mint record](deployment-sepolia.json) records NFT #1's identity, transaction, design hash and source. After the live mint and 12-block wait, verification matched maker and owner, the design hash and all 270 design bytes, certified round `646`, work `514`, the source data hash, and `tokenURI` JSON with its embedded SVG. The NFT retains its Simulation maker-mode label independently of its real certified kiln source. The actual client estimated 2,223,032 gas for this mint; that single estimate is not a fixed fee or a guarantee for other designs.

## Collection behavior

[`WheelAndClay.sol`](src/WheelAndClay.sol) inherits the original OpenZeppelin Contracts 5.4.0 `ERC721`, with collection name `Wheel & Clay` and symbol `WCLAY`. The collection has no administrator, upgrade proxy, withdrawal function, metadata editor, or external randomness entry point.

`mint(bytes design, uint64 roundId, uint64 expectedWork)` is nonpayable and charges **no contract mint fee**. Minting is optional: a user who chooses to mint must approve a wallet transaction and pay Sepolia network gas in test ETH. Token IDs start at 1, and `_safeMint` sends the token to the caller. Standard ERC-721 ownership, approvals, transfers, and receiver checks remain available.

Before entering the receiver callback, minting stores the piece and reserves this duplicate-prevention key:

```text
keccak256(abi.encode(maker, keccak256(design), roundId))
```

The same maker cannot mint the same design and round twice, even after transferring the first token. A different maker, design, or round is a different key; this is not a promise of globally unique shapes. A reverting receiver callback rolls back the mint and its reserved key.

`piece(uint256 tokenId)` returns this flat tuple, with the dynamic field last:

```text
address maker
uint64 roundId
uint64 work
bytes32 dataHash
bytes32 designHash
address coreImplementation
uint16 rendererVersion
bytes design
```

`ownerOf` reports current ownership; the saved `maker` remains unchanged after a transfer. `PieceFired(uint256 indexed tokenId, address indexed maker, uint64 indexed roundId, uint64 work, bytes32 designHash)` supports indexing alongside standard ERC-721 `Transfer`, `Approval`, and `ApprovalForAll` events. `roundSource(uint64)` exposes the same source checks used by minting, and `core()` returns the fixed source address.

## Fixed source and governance trust

| Source identity | Pinned value |
| --- | --- |
| SqueekCore | `0xfd6c166d4b8e2962e65746a13e5a0797cd4de0c4` |
| Expected implementation | `0x6869d6102696243fd17013ab955d99cd0c522ad3` |
| Expected storage layout digest | `0x9a9c008e029460808209571703fbf2679785874e0e6d3232f16a864d12abcb20` |

The constructor and source reader require Sepolia. In the same EVM call as the mint, the contract checks Core's reported implementation and layout identities, then calls `roundPage(r - 1, r, 1)`. It accepts only `certifiedThroughRound == r` and derives work from `end.cumulativeWork - start.cumulativeWork`. The result must match the caller's `expectedWork`; the caller cannot supply the stored source hash.

For positive work, the page must contain exactly one checkpoint for that round, with the expected cumulative work and a nonzero `dataHash`. For certified zero work, the page must contain no active checkpoint, and the contract stores a zero hash. Unknown rounds are rejected rather than treated as zero. **Zero work does not establish that the hamster was asleep.** Pausing new Core settlements does not prevent reading already-certified historical rounds.

Core is an independently governed, upgradeable proxy. Its identity methods are implemented by the code behind that proxy. The checks reject an ordinary identity change, but cannot prove that a malicious replacement implementation will not return the same expected identities while fabricating data. Clients should also verify the official proxy storage, implementation runtime code, and layout at a consistent confirmed block. This collection does not remove trust in Core's upgrade governance. Once a piece is minted, its metadata and source fields no longer read Core; a later Core upgrade cannot rewrite that piece.

Reference material: [official deployment and identity documentation](https://docs.squeekchain.com/developers/), [Core round semantics](https://docs.squeekchain.com/developers/core/), and the [official Core ABI](https://docs.squeekchain.com/assets/abi/SqueekCore.json). [`ISqueekCore.sol`](src/ISqueekCore.sol) contains the required read-only ABI subset.

## Full design data and rendering version 1

The contract stores the complete **270-byte `WC-v1` design** used by [`piece-link.js`](../piece-link.js) for reconstructing the pottery in 3D. It validates every field:

| Bytes | Content |
| --- | --- |
| `0–1` | `WC` magic bytes |
| `2` | Encoding version `1` |
| `3` | Form enum `0..2` |
| `4` | Glaze enum `0..15` |
| `5` | Surface enum `0..3` |
| `6` | Maker's simulation/live mode label `0..2` |
| `7` | Palette companion enum `0..3` |
| `8–9` | Big-endian `uint16` finish, `0..1000` |
| `10–11` | Reserved; both must be zero |
| `12–269` | All 129 big-endian `uint16` radius samples, each `2400..12300` |

Radius values use a scale of 10,000 and finish uses a scale of 1,000. Form, finish, palette, and surface remain part of the saved design. The mode and companion labels are supplied by the maker, not hardware attestations or proof of ownership of a Squeek. The larger version-2 sharing payload can carry a proposed round record, but it is not the contract's design input: the contract reads its own round source.

The deterministic kiln recipe uses the frozen source:

```text
seed32 = uint32(uint256(dataHash) >> 224) XOR uint32(roundId) XOR uint32(work)
energyBps = min(uint256(work) * 20, 10000)
phase = (seed32 % 6283) / 1000
flow = 0.18 + 0.62 * energyBps / 10000
```

This is a predictable creative mapping, and the maker can choose the round. It is not cryptographic or fair randomness. The WebGL renderer uses phase and flow to vary the glaze. The on-chain SVG uses the same seed and energy for static decorative bands; it does not execute the WebGL shader. Zero work retains static decoration. Renderer version `1` is frozen, with no update entry point.

### Embedded preview versus the 3D piece

[`WheelAndClayRenderer.sol`](src/WheelAndClayRenderer.sol) produces a Base64 JSON `tokenURI` entirely from saved fields. Its `image` is an embedded Base64 SVG explicitly labeled **2D profile preview**. Both silhouette edges use all 129 saved radii, the selected base glaze color, and deterministic kiln bands. The SVG uses a fixed 2.65-unit profile height; it does not reproduce form-dependent 3D dimensions, WebGL lighting, gloss, micro-surface detail, or the complete glaze texture.

The JSON includes the full Base64 design, maker, source identity and hash, certified round and work, recipe identifiers, and renderer version. These metadata bytes remain unchanged when ownership transfers or Core changes. The current owner is read separately through ERC-721.

`external_url` points to `https://wheel-and-clay.shop/?nft=ID`. The website reconstructs the 3D piece from `piece` at the collection address in its configuration. The website and domain are not a permanent execution environment embedded in the contract. If the website becomes unavailable, the full design and static preview remain readable from the contract.

## Build and offline tests

Pinned tools are solc `0.8.30`, OpenZeppelin Contracts `5.4.0`, EthereumJS VM `10.0.0`, and ethers `6.15.0`. Exact direct and transitive versions and package integrity values are in [`tools/package-lock.json`](tools/package-lock.json). The 207 official Solidity source files in [`vendor/openzeppelin-contracts`](vendor/openzeppelin-contracts) retain the upstream MIT [license](vendor/openzeppelin-contracts/LICENSE); the ERC-721 implementation is not a handwritten substitute. Upstream reference: [OpenZeppelin Contracts v5.4.0](https://github.com/OpenZeppelin/openzeppelin-contracts/tree/v5.4.0).

From the project root, prepare the pinned tools and compile as follows. These are reproduction instructions; no installation was performed for this documentation update.

```sh
mkdir -p /private/tmp/wheel-clay-contract-tools
cp contracts/tools/package.json contracts/tools/package-lock.json /private/tmp/wheel-clay-contract-tools/
npm ci --ignore-scripts --no-audit --no-fund --prefix /private/tmp/wheel-clay-contract-tools
node contracts/tools/compile.mjs
node tests/test_kiln_contract.mjs
```

Set `KILN_TOOLS_DIR` to use an already-prepared directory containing the same tool versions. Package lifecycle scripts are disabled. Compiler and test dependencies stay outside the website bundle.

[`tools/compile.mjs`](tools/compile.mjs) targets Shanghai with the optimizer enabled for 200 runs and `viaIR: true`. [`artifacts/WheelAndClay.json`](artifacts/WheelAndClay.json) records the ABI, creation and runtime bytecode, runtime Keccak-256, method selectors, compiler settings, OpenZeppelin version, and SHA-256 of every compiled source. The build rejects runtime bytecode exceeding the EIP-170 limit.

## Verification scope

An internal independent source and EVM review recorded **15/15 contract tests passed** and binds that result to source hashes and the runtime hash above. That result covers the local contract EVM tests only; it does not establish a successful Sepolia mint or acceptance of the current client, and it is not an external security audit.

[`test_kiln_contract.mjs`](../tests/test_kiln_contract.mjs) runs the actual compiled bytecode in an in-memory EthereumJS EVM, installs a local Core mock at the fixed address, and calls it from test addresses without private keys. It covers minting, design bounds, certified and zero-work rounds, source identity changes, duplicate prevention, transfers, receiver rollback and reentrancy, metadata decoding, and all preview silhouette samples. These tests use no RPC, wallet signing, or network broadcast.

The source-reading client tests passed **17/17**, and the NFT client tests passed **18/18**, using controlled fixtures. The successful public-network mint and post-confirmation readback above are separate evidence. That live client test does not establish browser-extension wallet usability or marketplace indexing. Desktop browser review separately covered shaping, kiln firing, comparisons, keepsakes, ordinary shared links and the contract-backed NFT viewer. The new collection contract and renderer have not received a third-party security audit.
