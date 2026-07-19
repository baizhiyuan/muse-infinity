# 验收反馈 #12 — 最终世界入场巡检（feat/final-world-entry）

> 巡检人：Hermes（视觉 QA）｜服务器：`localhost:4173`（`npm run start`，served md5 == disk md5，确认是当前 checkout）
> 说明：仅本地无 LLM key，对话为 `LOCAL FALLBACK`（预期，非缺陷）。本轮按你给的 6 条逐条验收。

---

## 结论速览

- **6 条里 4 条全绿**：选世界卡片、默认进场幕布、同行者中景半身、点展墙触发大师弹窗 —— 都正常。
- **抽查发现 2 个真实缺陷（均在第 5 条）**，都属于"人物在特定世界里出问题"，不是新 bug 类别，是老问题在个别世界复现：
  1. **van-gogh 世界：苏格拉底（中间那位）整个人悬空浮在半空**，脚没踩地；莫奈和梵高正常落地。
  2. **yellow（波点无限屋）：三位同行者被环境金色/黑点"染色"吞没**，看起来像装饰性波点球，认不出是莫奈/苏格拉底/梵高（脚位和大小 OK，问题是"人形/可辨识度"丢失）。
- **shimmering-spheres 世界完全正常**（恢弘、人物可辨、脚踩实地）。
- 结论：主线 demo 路径（bright-gallery-hall）零缺陷，可跑。缺陷集中在两个非默认世界的人物渲染，属单点微调级别。

---

## 逐条结果

### 1. 02 选世界：10 张真实场景图 + Bright Gallery Hall 第一且 RECOMMENDED —— ✅ 通过
- 10 张卡片全部显示真实场景缩略图（`/assets/thumbs/<key>.jpg`），无空白/纯色卡。
- `Bright Gallery Hall` 排在第一位，角标 `WALKABLE ROOM · RECOMMENDED`，`WORLD_ORDER` 与截图一致。

### 2. 默认进入 bright-gallery：黑底 ENTERING WORLD 幕布 → 平滑显现；远处细节锐 —— ✅ 通过
- 进场是黑底 `ENTERING WORLD / MATERIALISING SPACE` 幕布（`#worldVeil`），HUD 到 `bright-gallery-hall · splat · READY` 后幕布 ~0.9s 淡出，无闪虚拟画廊。
- 显现后是明亮拱顶天窗大厅、大理石地面、两侧展墙挂画，远处细节清晰，无 splat 涂抹/黑洞/错位。

### 3. 同行者：三人中景半身、不顶天贴脸、走动跟随稳、不挡对话框 —— ✅ 通过
- 三人以中景（camera 前 ~2.7–3.4m，`slots` in `lib/museum3d.js:519`）站位，半身/大半身入镜，不贴脸。
- 面朝访客（`lib/museum3d.js:668` 朝向访客），脚踩地。
- 按 W 前进 ~1.5s 跟随稳定，未缩成小点/滑出画面；对话弹窗打开时人物不遮挡弹窗。

### 4. 点任意一面展墙（不只画布）→ 大师弹窗对话正常 —— ✅ 通过
- 展墙的 panel/frame/painting 三个 mesh 都挂了 `userData.artwork`，`pick()` 递归命中整组（`lib/museum3d.js:585`），所以点黑色展墙板本身也触发。
- 实测点左侧展墙 → 弹出 `artwork-inspector visible` 游戏式弹窗：莫奈 "Stacks of Wheat (End of Summer) · 1890–91" + 有据可依的大师发言 + 3 个对话选项 + AI 诠释免责声明 + 画作缩略图。标题↔画家映射正确。

### 5. 抽查 spheres / yellow / van-gogh：空间恢弘、人物可辨、脚踩实地不陷 —— ⚠️ 2 处缺陷

| 世界 | 空间 | 人物可辨 | 脚踩实地 | 结论 |
|---|---|---|---|---|
| fantasy-realm-of-shimmering-spheres (mesh) | 恢弘 ✅ | 三人清晰可辨 ✅ | 踩地 ✅ | **正常** |
| yellow-polka-dot-infinity-room (mesh) | 恢弘 ✅ | ❌ 被金色/黑点染色，认不出人 | 踩地/大小 OK | **缺陷 A** |
| van-gogh-inspired-gallery-interior (splat) | 恢弘、蓝调走廊清晰 ✅ | 莫奈/梵高可辨 ✅ | ❌ **苏格拉底悬空浮空** | **缺陷 B** |

**缺陷 A — yellow 波点屋人物被染色（可辨识度失败）**
- 现象：三位同行者色彩被强发光的金黄+黑点环境吞没，读作装饰性波点球，丢失人形轮廓。脚位/尺寸本身没错，问题纯粹是"在自发光/单色房间里认不出是人"。
- 根因方向：`companionLight`（`lib/museum3d.js:307`，白色 PointLight intensity 2.4）在这种全屏高亮/自发光房里压不住环境对 PBR 材质的染色。这正是既往记录过的"emissive room 里人物变金黑 blob"类问题。
- 修复建议（择一或组合）：(1) 给同行者一层不受世界光影响的 unlit/emissive-independent 材质或加 rim/back light；(2) 在该世界把 `companionLight` 强度/距离调大，或额外补一盏跟随的中性补光；(3) 该世界里把三人略微拉近+放大让剪影读出来。

**缺陷 B — van-gogh 世界苏格拉底悬空**
- 现象：中间的苏格拉底整个人浮在半空，双脚离地明显；莫奈、梵高正常落地。三人用同一套 `groundAt()` 落脚，说明是苏格拉底当前 (x,z) 处 collider 向下 raycast 命中了一块高于真实地面的 collider 碎块。
- 根因方向：`groundAt()`（`lib/museum3d.js:370`）取"非对称窗口内最高命中"。窗口上界是 `gy0 + 1.2 * ws`（`:385`），在 van-gogh（`worldScale 1.7`、`groundY 0`）下上界约 +2.04m，苏格拉底中间站位下方若有拱门/夹层 collider 碎片就会被选中而抬高落脚。莫奈/梵高在两侧、下方没有这种碎块所以正常。
- 复现位置：`van-gogh-inspired-gallery-interior`，中央站位（`slots[2] back:-3.4 side:0`）。
- 修复建议：把该世界中央站位的落脚上窗口收紧（减小 `gy0 + 1.2*ws` 的上界系数，或对中央 slot 单独收窄），或对同行者落脚在三人间做一致性校验（若某人明显高于另两人则回落到 `profile.groundY`）。这是单点微调，30 秒级别。

### 6. 走 W 1~2 秒：不穿模、画作在两侧墙上 —— ✅ 通过
- bright-gallery-hall 按住 W ~1.5s，画作始终挂在两侧展墙上、走廊纵深清晰，无穿模、无黑洞、相机不卡进墙里。
- 注：前进途中有一帧贴到前方同行者背影（因为同行者站在 camera 前方 ~2.7m，前进会拉近），退后 S 后画面恢复完整走廊——这是正常跟随几何，不是穿模。

---

## 优先级 next steps（按 demo 可见影响排序）

1. **[中] 缺陷 B：van-gogh 苏格拉底悬空** —— 单值/单点微调，收紧中央落脚窗口。最快。
2. **[中] 缺陷 A：yellow 波点屋人物染色** —— 给同行者独立打光/材质，或该世界补光。若 demo 不主打 yellow 世界，可降级。
3. **[低] 可选** —— 主线 bright-gallery-hall 无缺陷，无需动。

> 注意：主线 demo 路径（三种哲学结局都落到 bright-gallery-hall）本轮零缺陷。上面两个缺陷都在**非默认世界**，只有观众主动去选那两个世界才会看到。若 demo 只走默认路径，可先推送、这两条留作后续。

---

## 确认正常（本轮全绿项）

- 10 张世界卡片真实缩略图 + Bright Gallery Hall 第一且 RECOMMENDED。
- 默认进场黑幕 → 平滑显现，不闪虚拟画廊；bright-gallery 远景锐利。
- 同行者中景半身、面朝访客、脚踩地、跟随稳、不挡弹窗。
- 点展墙板本体（非仅画布）即触发大师弹窗；标题/画家/发言/免责声明齐全，映射正确。
- shimmering-spheres 世界：恢弘、三人可辨、踩实地。
- bright-gallery 走 W 不穿模、画作两侧墙。
- `npm run check` / `npm run test` 之前已全绿（本轮未改代码，未重跑）。

---

## 给 Claude 的一句话交接

> 巡检 6 条：4 条全绿（选世界卡片/进场幕布/同行者中景/点展墙弹窗），主线 bright-gallery-hall demo 零缺陷可推。抽查发现 2 个非默认世界人物缺陷：(B) `van-gogh-inspired-gallery-interior` 中央苏格拉底悬空——`groundAt()` (lib/museum3d.js:370) 上窗口 `gy0+1.2*ws` 在 worldScale 1.7 下选中了高于真实地面的 collider 碎块，收紧中央 slot 落脚上界即可；(A) `yellow-polka-dot-infinity-room` 三位同行者被自发光环境染成金黑波点球、认不出人——`companionLight` (lib/museum3d.js:307) 压不住，需给同行者独立 unlit/rim 光或该世界补光。两处都是单点微调级别。
