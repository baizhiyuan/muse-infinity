# 验收反馈 #14 — 5 个 open 户外世界逐个巡检（地在头顶 / 埋进地形 / 全黑）

> 巡检人：Hermes（视觉 QA）｜服务器：`localhost:4174`（`npm run start`，PID 56257，cwd=`/Users/expansioai/project/muse-infinity`）
> served md5 == disk md5（`app.js` 与 `config/worlds.js` 均一致）→ 确认巡检的就是当前 checkout。
> 巡检方式：逐个硬刷新 `?stage=world_exploration&world=<key>`，HUD 到 `<key> · splat · READY` 后截图；grand-conservatory 另按 W 走 1.4s 验穿模。
> 范围：`config/worlds.js` 里 `enclosed:false, recommended:false` 的 5 个 open 世界（WORLD_ORDER 后 5 个）。

---

## 结论速览

**5 个 open 世界没有一个可交付。** 全部命中你担心的三类症状之一，且都是 splat 世界本体渲染问题（人物模型本身大多正常）：

| # | world key | 症状归类 | 地面方向 | 同行者 | 世界本体 | 结论 |
|---|---|---|---|---|---|---|
| 1 | grand-conservatory-with-lush-gardens | **埋进地形 + 上半全黑** | 糊地在下 | 苏格拉底/梵高走两步后**埋进糊地只露头** | 上半黑虚空+下半糊涂抹，无玻璃温室 | ❌ |
| 2 | mexican-courtyard-bedroom-fantasy | **地在头顶（倒置）** | **棕色地面倒挂在头顶** | 被头顶倒置地形**切掉头（无头）** | 蓝墙庭院在下方、地形翻到上面 | ❌ 最严重 |
| 3 | enchanted-water-garden-sanctuary | **全黑** | 无地面 | 三人全身清晰站立（人物 OK） | 世界几乎完全不渲染，整屏黑 + 浮空画框 | ❌ |
| 4 | dreamlike-coastal-villa-gardens | **全黑** | 底部零星糊碎片 | 只见苏格拉底，莫奈/梵高缺席画面 | 整屏黑，底部隐约金色露台糊块 | ❌ |
| 5 | sunlit-palace-gardens | **上半黑 + 糊地**（方向正常） | 糊地在地平线下（**未倒置**） | 三人全身站立在糊地（相对最好） | 上半黑虚空+下半糊烂涂抹风景 | ⚠️ 五个里最好但仍不合格 |

> 一句话判断：**这 5 个 open 世界的 splat 要么倒置（地在头顶）、要么根本不渲染（全黑）、要么糊成一层涂抹地面还把人物埋进去。** 方向对、人物落地的只有 sunlit-palace-gardens 一个，但它上半屏依然是黑虚空 + 世界糊烂。三类症状全部复现，无一幸免。

---

## 逐个结果

### 1. grand-conservatory-with-lush-gardens — ❌ 埋进地形 + 上半全黑
- 进场：上半屏全黑虚空，下半屏是糊烂涂抹的米粉色地面，看不到玻璃温室/花园/围合结构；相机像埋在涂抹层里往上看。
- **按 W 走 1.4s 后**：没有穿模碎裂，但苏格拉底、梵高**下沉埋进糊地、只露出头顶**（莫奈还半身可见）。典型"埋进地形"。
- `profile.groundY: 0.9`、`metric.scale: 2.4943`（bounds 跨 ±47），属于极端 scale 世界；渲染出来只有一层贴地涂抹，没有上半部世界。

### 2. mexican-courtyard-bedroom-fantasy — ❌ 地在头顶（最严重）
- 进场：**棕色地面/地形整块倒挂在上半屏头顶**，蓝色墙面庭院翻到下方——上下颠倒。
- 三位同行者**被头顶那层倒置地形切掉了头**（画面里只见躯干、无头）。
- 这是你说的"地在头顶"最直接的一例。`metric.scale: 2.9798`（5 个里最大），`ty: 1.5802`——极端 scale + ty，root matrix 的 Rx(π) 之后地面翻到相机上方。

### 3. enchanted-water-garden-sanctuary — ❌ 全黑
- 进场：**整屏黑虚空**，世界几乎完全不渲染，只有两块画框浮在黑底上。
- 三位同行者模型本身**清晰、全身、站立**（人物渲染没问题）——问题纯在 splat 世界不出图。
- `profile.spawn: {x:3.2, z:-17.58}`、`groundY:1.1`，spawn 落在 bounds 一角，很可能相机朝向没有 splat 数据的方向 / splat 只覆盖某半球。

### 4. dreamlike-coastal-villa-gardens — ❌ 全黑
- 进场：**大部分整屏黑**，仅底部有零星糊烂涂抹碎片（隐约金色露台）；两画框浮空。
- 画面里**只见苏格拉底一人**，莫奈/梵高不在取景内（follow/取景 + 世界黑双重问题）。
- `groundY: 5.6`（5 个里最高）、`metric.scale: 2.3438`——spawn 抬到 5.6m 高，相机悬在世界数据上方之外，看下去大半是黑。

### 5. sunlit-palace-gardens — ⚠️ 上半黑 + 糊地（五个里相对最好）
- 进场：上半屏黑虚空，下半屏是**糊烂涂抹的风景层**（能隐约看出草地/水面色块），但**地面在地平线下方、方向正常、没有倒置**。
- 三位同行者**全部全身站立在糊地上、方向朝前、不埋不缺头**——五个 open 世界里唯一"人物都在且落地正常"的。
- 仍不合格原因：世界本体糊成一片涂抹、上半屏黑虚空，谈不上"明亮的宫廷花园"。`meshUrl` 存在（`sunlit-palace-gardens-mesh.glb`）但当前走的是 splat 路径。

---

## 根因判断（给 Claude）

1. **共性：splat 路径在这 5 个极端 scale 世界上系统性失败。** 五个 `metric.scale` 都在 1.75~2.98（远大于终章世界的 ~1），`groundY` 0.1~5.6 跨度极大。`config/worlds.js:9-11` 说 splat 用手工复现 root matrix（`scale·Rx(π)+ty`）——scale/ty 越极端，Rx(π) 翻转后越容易把地面甩到相机上方（#2 倒置）或把相机抬出数据范围（#3/#4 全黑）。这不是逐个 nudge 能救的，是 splat 变换在大世界上不成立。

2. **#2 地在头顶 = Rx(π) 后 ty 未把世界压回相机下方。** mexican-courtyard scale 2.98 / ty 1.58 最极端，倒置最明显。要么该世界的 ty 符号/量级不对，要么这个 asset 的 marble root matrix 和手工复现的不一致。

3. **#3/#4 全黑 = spawn/相机在 splat 覆盖范围之外。** water-garden spawn 在 bounds 角落、coastal-villa groundY 抬到 5.6m，相机看向/悬停在没有 splat 数据的空域，所以整屏黑。

4. **#1/#5 糊地 + 埋人 = splat 只渲染出贴地一层、且 groundAt 把人踩到涂抹层里。** 上半世界没数据（黑），下半是低分辨率涂抹；人物 groundAt 命中这层糊面导致下沉（#1 走两步后只露头）。

**可交付性结论：这 5 个 open 世界目前都不能作为可展示落点。** 与 #13 一致的老结论——open/户外 splat 世界结构上就把访客扔在一层糊地/黑虚空里。若这 5 个要保留在 chooser（它们正是 `WORLD_ORDER` 的可选项），至少需要：
- 对有 mesh 版的世界（`fantasy-realm...`已是mesh默认；`sunlit-palace-gardens` 有 `-mesh.glb`）**优先切 `render:"mesh"`** 验证是否消除倒置/全黑；
- 对纯 splat 且极端 scale 的（mexican/water-garden/coastal-villa/grand-conservatory）**逐个复核 `metric.scale/ty` 与 spawn/groundY**，或干脆从 chooser 撤下。

---

## 优先级 next steps（按症状严重度）

1. **[高·必修] #2 mexican-courtyard 地在头顶（倒置）。** 最刺眼的破坏。查 `metric.ty:1.5802` 与 Rx(π) 复现是否把地面压回相机下方；对照该 asset 原始 marble root matrix 校验符号。
2. **[高] #3/#4 全黑（water-garden / coastal-villa）。** spawn/groundY 把相机放到了 splat 数据外。要么修正 spawn 落回世界中心 + 降 groundY，要么这两个 splat 本就只覆盖局部、直接从 chooser 撤。
3. **[中] #1 grand-conservatory 埋人 + 上半黑。** groundAt 命中糊涂抹层导致苏格拉底/梵高走两步下沉只露头；上半世界无数据。
4. **[中] #5 sunlit-palace-gardens 有 mesh 版可试。** 它 splat 已是"方向对、人站地"的最好情况，切到 `-mesh.glb` 很可能直接把糊地/上半黑一起解决——是 5 个里回本最快的。
5. **[结构] 复用终章世界的经验。** 终章世界（shimmering-spheres mesh）之所以稳，是因为走 mesh + 合理 scale。open 世界要么给 mesh，要么承认 splat 大世界不可交付、精简 chooser。

---

## 给 Claude 的一句话交接

> 4174 巡检 5 个 open 户外世界（`?stage=world_exploration&world=<key>`）——三类症状全复现、无一可交付：**#2 `mexican-courtyard-bedroom-fantasy` 地在头顶（棕色地形倒挂上半屏、同行者被切成无头）**，最严重，查 `metric.scale 2.9798/ty 1.5802` 的 Rx(π) 复现是否把地面甩到相机上方；**#3 `enchanted-water-garden-sanctuary` 和 #4 `dreamlike-coastal-villa-gardens` 整屏全黑**（世界几乎不渲染、只剩浮空画框；spawn 落 bounds 角 / groundY 抬到 5.6m 把相机放到 splat 数据外）；**#1 `grand-conservatory-with-lush-gardens` 上半黑虚空+下半糊地，按 W 走两步苏格拉底/梵高埋进糊地只露头**；**#5 `sunlit-palace-gardens` 相对最好（地面方向正常、三人全身站地）但上半仍黑、世界糊烂**——它有 `sunlit-palace-gardens-mesh.glb`，优先把 `render` 切 `mesh` 试，很可能一次解决糊地+上半黑，是回本最快的。共性根因：这 5 个都是极端 scale（1.75~2.98）的 splat 世界，`config/worlds.js:9-11` 手工复现 `scale·Rx(π)+ty` root matrix 在大世界上系统性失败（倒置 / 相机出数据范围 / 只渲染一层糊涂抹）。建议：有 mesh 版的切 mesh，纯 splat 极端 scale 的逐个核对 metric/spawn 或从 chooser 撤下。人物模型本身基本正常，问题全在 splat 世界本体。

---

## 附：巡检环境确认（全绿）

- 服务器 4174 存活、PID 56257 cwd = 项目根、served md5 == disk md5（`app.js` `097fb9...`、`config/worlds.js` `a3b50c...`）→ 巡检当前 checkout。
- 深链 `?stage=world_exploration&world=<key>` 正常路由，5 个世界 HUD 均到 `<key> · splat · READY`。
- 人物模型（Monet/Socrates/Van Gogh）在多数世界里本体清晰可辨——问题集中在 splat 世界渲染，非人物资产。
