# 验收反馈 #13 — 最终世界入场巡检（4174 带 .env / GPT-5.6 LIVE）

> 巡检人：Hermes（视觉 QA）｜服务器：`localhost:4174`（`npm run start`，served md5 == disk md5，确认当前 checkout）
> 已验 commit：`85877fa`（修 #12 两处缺陷 + Marble 观感去 ACES）、`d5f9bc2`（保留三终章专属世界）
> LIVE 链路：`/api/dialogue` 实测 `"live":true,"model":"gpt-5.6"`，回应高质量 —— **LIVE 本身正常**（详见点 2）

---

## 结论速览

- **点 1 全绿**：chooser 恰好 6 卡、全有缩略图、Shimmering Spheres 首位 RECOMMENDED、4 个旧世界（bright hall/floral/dot room/van-gogh）已从 chooser 隐藏。
- **点 2 大体通过 + 2 个遗留**：进场黑幕→流光球境淡入正常、三人中景踩地、点展墙触发大师弹窗且 **GPT-5.6 LIVE 真回应**。但：(a) **球世界里展墙画作看不见（空白板）** —— 数据在（弹窗缩略图正常加载），是 3D 贴图被自发光环境冲白；(b) 页脚全局标签写死 `LOCAL FALLBACK`，与弹窗内 `· LIVE` 徽标矛盾（标签语义 bug，非链路问题）。
- **点 3 严重：#12 两处修复代码写了但视觉全部没生效，且 floral 去 ACES 后回退**：
  - **floral：回退（最严重）** —— 去 ACES 后不是"变亮"，而是**上半屏全黑虚空 + 下半屏糊烂涂抹地面**，无花宫墙体/建筑；三人半身陷进糊地。
  - **yellow：companionBoost 无效** —— 三位同行者仍被金黄+黑点完全吞没，就是装饰性波点球，认不出人形。
  - **van-gogh：苏格拉底仍悬空** —— groundAt cap 0.6m 的修复没生效，中间苏格拉底照旧浮空约 1m；但该世界本体很好（蓝调走廊清晰、莫奈/梵高逼真、挂画正常）。
- **点 4 逻辑全绿但落进破碎世界**：端到端闭环路由正确（emotion+perception → floral（finaleOnly，不在 chooser 6 个）→ 藏品 Claude Monet 匹配），专属感成立。**但 demo 主链最终落进的正是回退最严重的 floral 世界** —— 终章观感破碎。

> 核心判断：这轮 3 个终章世界（恰好就是 3 个哲学结局的落点）视觉都不合格，而 demo 一定会落进其中之一。**逻辑闭环没问题，问题全在终章世界的渲染。** 上一轮表现最好、最稳的 bright-gallery-hall 已被退役，导致现在没有一个"干净可交付"的落点世界。

---

## 逐条结果

### 1. 02 选世界：恰好 6 卡 + 缩略图，首张 Shimmering Spheres(RECOMMENDED)，不含 4 旧世界 —— ✅ 通过
- chooser 恰好 6 张：Shimmering Spheres / Glass Conservatory / Mexican Courtyard / Water Garden / Coastal Villa / Sunlit Gardens。
- 全部有真实场景缩略图；Shimmering Spheres 第一 + `WALKABLE ROOM · RECOMMENDED`。
- 未出现 Bright Gallery Hall / Floral Palace / Infinity Dot Room / Van Gogh Gallery（`listWorlds()` 已按 `finaleOnly` 过滤，`config/worlds.js:215`）。

### 2. 默认进场（Act-4）：黑幕→流光球境；三人中景踩地；展墙+画作；点展墙弹窗 —— ⚠️ 大体通过 + 2 遗留
- **进场幕布** ✅：黑底 `ENTERING WORLD / Shimmering Spheres / MATERIALISING SPACE`，HUD 到 `mesh · READY` 后淡出（`done+hidden`），不闪虚拟画廊。
- **三人中景踩地** ✅：三位中景可辨、脚踩球体地面、面朝访客、不陷地。
- **点展墙 → 大师弹窗 + LIVE** ✅（重点复查通过）：点左侧展墙板本体即触发 `artwork-inspector` + 大师对话弹窗；弹窗内出现 **"Claude Monet · LIVE"** 徽标 + GPT-5.6 真回应（扣住《睡莲》无地平线/光的漂移）。`curl POST /api/dialogue` 实测 `"live":true,"model":"gpt-5.6"`，链路确证 LIVE。
- **遗留 (a) — 球世界画作看不见（空白板）** ⚠️：两侧展墙画框在流光球世界里呈**空白米色板**，看不到画。但**数据没丢**——点开弹窗里《睡莲》缩略图 843px 正常加载。根因：球世界自发光/高亮环境把展墙上的 3D 贴图平面冲成白板（上上轮"架空空白板"在这个世界仍在，只是从"漂浮空板"变成"贴地但无图"）。建议给展墙画作平面独立打光或提高其材质自发光，让贴图在强环境光下也读得出。
- **遗留 (b) — 页脚 LOCAL FALLBACK 与弹窗 LIVE 矛盾** ⚠️：左下页脚全局标签固定显示 `LOCAL FALLBACK`，而同屏弹窗已是 `· LIVE`。根因：页脚那串来自 `app.js:30` 的 worldStatus（idle/loading/ready/**fallback**），绑定的是"世界加载来源"，跟对话 live 无关，命名/展示会让人误判成"对话没 LIVE"。建议要么改页脚文案（别用 FALLBACK 这个词表世界加载态），要么让它随对话 live 结果更新。

### 3. 三终章世界抽查 —— ❌ 三个都不合格（两处 #12 修复视觉未生效 + floral 回退）

| 世界 | 期望（本轮修复目标）| 实际 | 结论 |
|---|---|---|---|
| elegant-floral-palace-interior | 去 ACES 后更亮更接近原版；站地不陷地 | **上半黑虚空+下半糊地，无墙体；三人陷地** | ❌ 回退 |
| yellow-polka-dot-infinity-room | companionBoost 自发光→人形可辨 | 仍是金黄黑点波点球，认不出人 | ❌ 修复无效 |
| van-gogh-inspired-gallery-interior | 苏格拉底落地（groundAt cap 0.6m）| 苏格拉底仍悬空~1m；世界本体优秀 | ❌ 修复无效（单点）|

**floral —— 去 ACES 后回退（最严重）**
- 现象：旋转四周都是**上半屏全黑虚空 + 下半屏糊烂涂抹的米粉色地面**，没有花宫墙/花/建筑；相机像埋在涂抹层里往上看；三位同行者半身陷进糊地（只见上半身）。
- 判断：`85877fa` 把 splat 世界改成 `NoToneMapping + exposure 1.0`（去掉 ACES 0.92）。对这个 asset 而言，结果不是"变亮接近原版"，而是把原本尚可的画面压成"黑顶 + 糊地"。至少对 floral，去 ACES 是净负面。建议对 floral 单独回退到 ACES，或换 asset。
- 附带：三块展墙里两块空白板、一块加载出《睡莲》——贴图加载不稳定（与点 2(a) 同类）。

**yellow —— companionBoost 视觉无效**
- 现象：`companionBoost: true` + emissiveMap=map 已写进 `85877fa`，但视觉上三人仍被金环境完全吞没，就是波点球，认不出脸/衣服/人形。
- 判断：emissiveIntensity 0.55 的自发光量级压不住这个满屏高亮金黄环境，或 emissiveMap 用自身 albedo（本就偏金）反而强化了融入。建议改用**不受世界光影响的 rim/back 补光 + 提高对比**，或给同行者一层纯 unlit 描边，而不是用自身贴图做 emissive。

**van-gogh —— 苏格拉底悬空修复无效（单点）**
- 现象：中间苏格拉底照旧浮空约 1m，莫奈/梵高正常落地。`groundAt()` 上窗口已 cap 到 `Math.min(1.2*ws,0.6)`（museum3d.js），但没解决。
- 判断：说明抬高苏格拉底的不是"窗口太宽选中高碎块"，而是**该 (x,z) 处向下 raycast 命中的最高点本身就在 gy0+0.6m 以内的一块夹层 collider**，cap 0.6m 拦不住它。建议：对中央 slot 直接用 `profile.groundY`（不 raycast），或对三人做落脚一致性校验（某人明显高于另两人则回落 groundY）。世界本体优秀，只差这一脚。

### 4. 端到端闭环：走到哲学结局 → ENTER YOUR WORLD → 落进非 6 选项世界 + 画家匹配 —— ✅ 逻辑通过（但落点破碎）
- 深链 `?stage=decision` 选 perception 分支 → world_transformation(08) → manifesto → 点 `ENTER YOUR WORLD`。
- 落进 `elegant-floral-palace-interior`（HUD 确认），**是 finaleOnly 世界，不在 chooser 的 6 个里** → 专属感成立。
- 藏品画家匹配 ✅：弹窗 `CLAUDE MONET · 1906`，与 `PHILOSOPHY_QUERIES["emotion+perception"]="Claude Monet"` 一致；映射 `PHILOSOPHY_WORLDS` 三条（floral=Monet / yellow=Kandinsky / van-gogh=Van Gogh）逻辑正确。
- **但**：这条 demo 主链最终落地画面就是点 3 里回退最严重的 floral（黑虚空+糊地+陷地）。逻辑对，观感碎。
- 备注：demo 深链因未走完整 roundtable，结局标题落到 fallback「The World Between Worlds」（分数无明显 top-two 时的失败分支）；走完整流程分数拉开后会给专属标题，这条不影响世界路由验证。

---

## 优先级 next steps（按 demo 可见影响排序）

1. **[高·必修] 给 demo 一个干净的落点世界。** 现在 3 个哲学结局落点（floral/yellow/van-gogh）视觉都不合格，demo 必落其一。最快两条路：
   - (A) **把 van-gogh 的苏格拉底落地修好**（世界本体已经是三个里最好的：清晰、明亮、人物逼真、挂画正常），然后让至少一条主 demo 分支走 emotion+invention→van-gogh；或
   - (B) **恢复/新增一个 benchmark 级明亮世界**做落点（上一轮 bright-gallery-hall 被退役后就没有"稳的"了）。
2. **[高] floral 去 ACES 回退。** 至少对 floral 单独恢复 ACES（现在的 NoToneMapping 让它从"暗"变成"黑虚空+糊地"，是净负面）。若坚持去 ACES 匹配 Marble 观感，需要换更好的 floral asset。
3. **[中] van-gogh 苏格拉底悬空。** cap 0.6m 没拦住，改中央 slot 直接用 `profile.groundY` 或三人落脚一致性校验。单点，30 秒级。
4. **[中] yellow 人物染色。** 自发光量级不够；换 rim/back 补光或 unlit 描边而非自身 albedo emissive。
5. **[低] 球世界展墙画作贴图冲白 + 页脚 LOCAL FALLBACK 标签语义。** 贴图给独立打光；页脚文案别用 FALLBACK 表世界加载态。

> 一句话：**逻辑闭环这轮全对（6 卡 chooser、进场幕布、点展墙 LIVE、专属世界路由、画家匹配），剩下的全是三个终章世界的渲染质量，而 demo 一定落进其中之一。** 当务之急是保证至少一个哲学结局能落进一个"干净、明亮、人物落地可辨"的世界。

---

## 确认正常（本轮全绿项）

- chooser 恰好 6 卡 + 全缩略图 + Shimmering Spheres 首位 RECOMMENDED + 4 旧世界已隐藏。
- 默认进场黑幕→流光球境淡入，不闪虚拟画廊。
- 流光球世界三人中景、面朝访客、脚踩地、可辨。
- 点展墙板本体触发大师弹窗；GPT-5.6 LIVE 链路确证（`/api/dialogue` `live:true model:gpt-5.6`，弹窗 `· LIVE` + 真回应）。
- 端到端闭环路由正确：结局→finaleOnly 专属世界（不在 chooser）→藏品画家匹配。
- van-gogh 世界本体（除苏格拉底外）：蓝调走廊清晰、莫奈/梵高逼真、挂画贴图正常、无黑洞。

---

## 给 Claude 的一句话交接

> 4174/带 .env 巡检：逻辑闭环全绿（6 卡 chooser✓、进场幕布✓、点展墙触发 GPT-5.6 LIVE 真回应✓、结局→finaleOnly 专属世界路由 + 画家匹配✓）。但 **#12 两处修复视觉都没生效，且 floral 去 ACES 回退**：(1) `elegant-floral-palace-interior` 去 ACES(NoToneMapping) 后变成上半黑虚空+下半糊地、三人陷地——至少对 floral 单独恢复 ACES 或换 asset；(2) `van-gogh-inspired-gallery-interior` 中央苏格拉底仍悬空~1m，`groundAt()` cap `min(1.2*ws,0.6)` 没拦住（命中点本身在 0.6m 内的夹层 collider）——改中央 slot 直接用 `profile.groundY` 或三人落脚一致性校验；(3) `yellow-polka-dot-infinity-room` companionBoost(emissiveMap=map, intensity 0.55) 视觉无效、仍是金波点球——换 rim/back 补光或 unlit 描边。关键：3 个哲学结局落点(floral/yellow/van-gogh)视觉都不合格而 demo 必落其一，bright-gallery-hall 退役后没有干净落点了——优先把 van-gogh 苏格拉底修好（该世界本体最好）或恢复一个 benchmark 明亮世界当落点。另两个小项：球世界展墙画作贴图被环境光冲成空白板（数据在、弹窗缩略图正常，给展墙平面独立打光）；页脚全局 `LOCAL FALLBACK` 标签(app.js:30 worldStatus)与弹窗 `· LIVE` 矛盾，会误导。
