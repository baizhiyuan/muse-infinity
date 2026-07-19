# 验收反馈 #15 — 本轮修复（commit 5388add）首次复查

> 巡检人：Hermes（视觉 QA）｜服务器：`localhost:4174`（PID 56257，cwd=项目根）
> served md5 == disk md5（`app.js` / `lib/museum3d.js` / `config/worlds.js` 三个都 MATCH）→ 复查的就是 `5388add` 当前 checkout。
> 本轮被复查的 commit：`5388add fix: clean finale landings + always-sharp canvases (feedback #13 + user report)`
> 复查范围：#13 里 5 处修复 —— (1) 同行者悬空 clamp、(2) yellow companionBoost 改 unlit、(3) emotion+perception 结局改道 floral→van-gogh、(4) 页脚 LOCAL FALLBACK→LOCAL ARCHIVE、(5) 展墙贴图 retry + anisotropy。

---

## 结论速览

| # | #13 遗留 → 本轮修复 | 复查结果 | 结论 |
|---|---|---|---|
| 1 | van-gogh 苏格拉底悬空 → clamp 到 camGround+0.35 | 苏格拉底脚落地（站中央隆起处，略高于两侧属地形正常），不再浮空 1m | ✅ 生效 |
| 2 | yellow companionBoost → unlit MeshBasicMaterial | **走近细看，三位同行者仍是金黄+黑点球状体、无人脸/beret/蓝衣/白大理石** | ❌ 仍无效 |
| 3 | emotion+perception 改道 floral→van-gogh，floral 彻底 shelve | 映射已改（`config/worlds.js:228`），floral 仍 finaleOnly 不可达 | ✅ 生效（代码） |
| 4 | 页脚 LOCAL FALLBACK → LOCAL ARCHIVE | 页脚已显示 `LOCAL ARCHIVE` | ✅ 生效 |
| 5 | 展墙贴图 retry 1 次 + max anisotropy | van-gogh 走廊两侧挂画全部显示真实图像、清晰、无空白板 | ✅ 生效 |

**5 处修复 4 处生效，唯一没解决的是 yellow 波点房的同行者染色（#2）。** 而且这轮把 floral shelve、emotion+perception 也改道到 van-gogh 后，**三个哲学结局里已有两个（emotion+perception、emotion+invention）落进 van-gogh，只有 invention+perception 仍落 yellow** —— 所以 yellow 的问题现在只影响一条结局分支，严重度比 #13 时下降，但那条分支落地画面依然是"认不出人的金波点球"。

> 核心判断：**这轮修复方向对、大部分见效，van-gogh 已经是一个干净可交付的落点**（走廊清晰明亮、三人落地、挂画有图、页脚正常）。#13 里"没有干净落点"的核心焦虑已解除。剩下唯一硬伤是 yellow 房 unlit 换材质在视觉上仍然无效 —— 而且我复查时发现这可能不是"染色"问题，而是**渲染出来的那三个球根本不是 companion 人物模型**（见下方根因）。

---

## 逐条复查

### 1. van-gogh 苏格拉底落地 —— ✅ 生效
- `?stage=world_exploration&world=van-gogh-inspired-gallery-interior`：走廊蓝调清晰明亮，Monet（左，深西装+beret）、Van Gogh（右，蓝西装+橙马甲）脚踩地板。
- 中间苏格拉底站在走廊中央隆起的"水流状"地面上，**脚接触地面、不再悬空约 1m**（#13 的病灶）。他比两侧两人略高，是因为站在中央地形隆起处，属正常，不是悬空。
- `groundAt` clamp 到 `camGround + 0.35`（museum3d.js:846-851）确实拦住了那块夹层 collider。修复生效。

### 2. yellow 波点房同行者染色 —— ❌ 仍无效（且疑似根因换了）
- `?world=yellow-polka-dot-infinity-room`（mesh · READY）：满屏金黄+黑点隧道，中央三个"同行者"是**光滑金黄+黑点的球状体**。
- **走近 0.9s 后放大细看**：仍旧是三个金黄球，表面覆着和房间一模一样的黑点，**没有任何人脸/beret/蓝衣/白大理石可辨**。unlit 换材质在视觉上没带来任何改善。
- **关键新发现（根因可能变了）**：这三个球表面渲染的是**房间那套黑点花纹**，不是人物 albedo。unlit MeshBasicMaterial 已按构造排除了一切光照/染色 —— 如果它真作用在 companion GLB 上，露出的该是 Monet 深西装/Van Gogh 蓝衣，而不是金黑波点。因此高度怀疑：**画面中央那三个球是房间 mesh 自带的装饰球体，真正的三个 companion 模型没显示出来**（被这些装饰球遮挡/重叠，或在该 mesh 世界的 groundAt/slot 放置下落到了看不见的位置）。
- 佐证：**同一套 companion GLB、同样的装配路径，在 van-gogh 世界里三人渲染得清清楚楚**（Monet/Socrates/Van Gogh 面容衣着全可辨）。所以模型和 unlit swap 本身没坏 —— 问题定位在这个 yellow mesh 世界里 companion 的可见性/放置，而不是材质染色。
- 建议下一步（给 Claude）：
  - 别再在"材质染色"方向调了（unlit 已是终点，无效说明不是染色问题）。
  - 在 `initMuseumExperience` 后打印 `companionModels[i].position` 与相机 spawn，确认三个 companion 在 yellow 世界里到底被放到了哪里、是否被房间装饰球遮挡。
  - 检查那三个金球是否来自世界 mesh 本身（`?render` 或场景 traverse 里非 companion 的 sphere），若是则 companion 被它们挡住 → 需要把 companion 往相机侧再拉近/抬高避让。

### 3. emotion+perception 改道 + floral shelve —— ✅ 生效（代码层）
- `config/worlds.js:228` 已是 `"emotion+perception": "van-gogh-inspired-gallery-interior"`；floral 注释标注"black-void interior asset-quality defect, shelved"，仍 `finaleOnly:true`（`config/worlds.js:98-99`），chooser 与结局都不可达。
- 现在三个哲学结局落点：emotion+perception→van-gogh、emotion+invention→van-gogh、invention+perception→yellow。**两条落进已验证干净的 van-gogh**，符合 #13 "给 demo 一个干净落点"的诉求。
- 副作用提示：emotion+perception 和 emotion+invention 现在落进**同一个** van-gogh 世界，但藏品仍按各自画家个性化（Monet vs Van Gogh 藏品），"专属感"靠藏品维持、世界复用 —— 可接受，但如果 demo 想要"每个结局不同世界"，van-gogh 承接两条是个权衡点，值得你知道。

### 4. 页脚 LOCAL FALLBACK → LOCAL ARCHIVE —— ✅ 生效
- van-gogh 世界页脚左下已显示 `LOCAL ARCHIVE`（截图确认），不再是会被误读成"对话没 LIVE"的 `LOCAL FALLBACK`。

### 5. 展墙画作贴图 retry + anisotropy —— ✅ 生效
- van-gogh 走廊两侧挂画**全部显示真实图像**（风景/星空色调画作可见），无 #13 里的空白米色板。retry 一次救回了 flaky fetch，max anisotropy 让贴图在斜角/走动时保持清晰。
- 注：本轮 van-gogh 世界没复现"忽清忽糊"或"空白板"，该修复达标。

---

## 优先级 next steps

1. **[中·唯一硬伤] yellow 波点房 companion 不可见。** 改查放置/遮挡，别再调材质（unlit 已到头）。确认中央那三个金球是不是房间装饰 mesh、真正的 companion 被挡在哪。因现在只影响 invention+perception 一条结局，降为中优先级。
2. **[低·知会] 两条结局共用 van-gogh。** 如需"每结局不同世界"，得再找 emotion+perception 的独立干净落点（floral 已 shelve）。当前用藏品个性化维持专属感，可接受。
3. 其余 #13 项（1/3/4/5）均已修复通过，无需再动。

---

## 给 Claude 的一句话交接

> 复查 `5388add`（4174，served==disk）：**5 处修复 4 处通过 —— van-gogh 苏格拉底已落地（clamp camGround+0.35 生效）、展墙挂画有图不再空白板（retry+anisotropy 生效）、页脚已 LOCAL ARCHIVE、floral 已 shelve 且 emotion+perception 改道 van-gogh，van-gogh 现在是一个干净可交付的落点（走廊清晰明亮、三人落地、挂画正常）。唯一没解决的是 #2 `yellow-polka-dot-infinity-room` 的 companionBoost：换成 unlit MeshBasicMaterial 后，走近细看中央三个"同行者"仍是金黄+黑点的光滑球体、认不出人 —— 但关键是它们表面渲染的是房间的黑点花纹而不是人物 albedo，而 unlit 已按构造排除一切光照，所以这已经不是"被金环境染色"的问题，高度怀疑画面中央那三个球是 yellow 世界 mesh 自带的装饰球体、真正的三个 companion GLB 被它们遮挡或放到了看不见的位置（同一套 GLB 同一装配路径在 van-gogh 世界里三人渲染得清清楚楚，证明模型和 swap 本身没坏）。请别再往材质染色方向调，改查 companion 在这个 mesh 世界的 position/遮挡：在 initMuseumExperience 后打印 companionModels[i].position 与相机 spawn，确认它们是否被房间装饰球挡住，需要的话往相机侧拉近/抬高避让。因 yellow 现在只承接 invention+perception 一条结局分支，严重度已低于 #13。另外知会一点：emotion+perception 与 emotion+invention 现在都落 van-gogh（靠 Monet/Van Gogh 藏品各自个性化维持专属感），如果要每个结局不同世界，需再给 emotion+perception 找一个独立的干净落点（floral 已因黑虚空 asset 被 shelve）。**

---

## 确认正常（本轮复查全绿项）

- 服务器 4174 存活、served md5 == disk md5（复查当前 checkout）。
- van-gogh 世界：走廊蓝调清晰明亮、Monet/Socrates/Van Gogh 三人落地可辨、两侧挂画全部有真实图像、页脚 LOCAL ARCHIVE。
- 苏格拉底悬空修复生效（clamp camGround+0.35）。
- floral shelve + emotion+perception 改道 van-gogh，映射代码正确、floral 不可达。
- 展墙贴图 retry + anisotropy 生效，无空白板、无忽清忽糊。
