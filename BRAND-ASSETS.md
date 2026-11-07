# Squeekchain 物料来源

轮间是独立社区作品。本项目使用以下公开官方素材，不表示官方背书或任何 NFT 的所有权。

| 文件 | 原始来源 | 用途 |
| --- | --- | --- |
| squeekchain-wordmark.svg | https://squeekchain.com/assets/squeekchain-lettering-CwK9_aj2.svg | 首页与作品卡官方字标，保留原件 |
| squeekchain-hamster-mark.svg | https://squeekchain.com/genesis 的 `svg[data-mark="square"]` | 官网原始轮廓；补入命名空间与官网计算颜色，首页金色遮罩与曲面窑印为社区视觉延展 |
| squeek-8889-sepolia.svg | https://api.squeekchain.com/v1/squeeks/8889 的 metadata.imageDataUri | Sepolia 样例原始矢量角色，配色灵感 |
| squeek-8890-sepolia.svg | https://api.squeekchain.com/v1/squeeks/8890 的 metadata.imageDataUri | Sepolia 样例原始矢量角色，配色灵感 |
| squeek-8891-sepolia.svg | https://api.squeekchain.com/v1/squeeks/8891 的 metadata.imageDataUri | Sepolia 样例原始矢量角色，配色灵感 |

原始文件位于 `brand-research/official/`。公开应用使用上表字标、仓鼠标志与三张角色的展示副本，不包含研究库的社区创作图片或被否决的生成式陶瓷角色。

三张角色 SVG 于 2026-11-07 从官方公开 API 的 `metadata.imageDataUri` 原样解码，保留其黑底和图形；对应的是 Sepolia 样例，不是当前主网藏品或用户钱包持有证明。仓鼠 mark 从公开 DOM 提取，仅补入独立 SVG 所需的命名空间和官网原色变量；首页的 `#FFC048` 遮罩、动力环及器物金色窑印是本项目设计的品牌延展。

Squeektoshi 是真实跑轮输入的来源；Squeeks 是配色灵感。当前映射为 #8891 → 烟紫、#8890 → 珊瑚橘、#8889 → 孔雀蓝；名字与釉色映射由轮间设计。选角会改变陶器釉色并保存样例 ID，不改变官方 NFT，不授予持有权。官方 [DotGrid 文档](https://docs.squeekchain.com/developers/dotgrid/)说明图像是确定性渲染，不能把本项目配色变化宣传成官方 NFT 的动态属性。

陶器与作品卡是浏览器生成并保存的本机作品，不铸造、签名或登记到链上。实时或模拟状态随作品记录保留；“实时模式作品”表示使用该模式的跑轮信号，不是链上作品认证，虚拟陶轮圈数也不是仓鼠传感器原始计数。

用于复核原件的 SHA-256：

| 文件 | SHA-256 |
| --- | --- |
| squeekchain-wordmark.svg | `44c8a84112211ff2f83504c3827069efe4d6fa4f539ccd2dd5a7f8acc5fc6922` |
| squeekchain-hamster-mark.svg | `7911a341c236c1ee7c4a94cf38c3c5888d432f6e9b52a3047487b0ab90f6b093` |
| squeek-8889-sepolia.svg | `69262410977a23e6c9d14c0a55316270039e0edc392f80f787867fda6f479fa8` |
| squeek-8890-sepolia.svg | `5eb969213f31808c2783e28d9ada47aefea3c76160eca3618ddf1f82ebbd4e26` |
| squeek-8891-sepolia.svg | `065d8e704f9e46fdb1708d4ea0d5c3ecb2fcecf2768149ee156e626d1e496369` |

## 滚动性能的展示副本

`squeek-8889-display.png`、`squeek-8890-display.png`、`squeek-8891-display.png` 是对应官方 SVG 的 750×750 无改绘浏览器栅格化副本。用于主图、缩略图和作品卡，避免约 1,100 个 SVG use 元素反复进入可视区时的栅格化长停顿；原始 SVG 与来源哈希保留。生成页面 `tools/rasterize.html` 只读本地 SVG，结果不包含新增或替换的角色内容。
