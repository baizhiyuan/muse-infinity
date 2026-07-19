# MUSE∞ 网页调试诊断报告

> 调试环境：本地 `http://localhost:4173`，分支 `feat/splat-integration`
> 完整走通路径：Scene 00 THRESHOLD → 01 BETWEEN WORLDS → 02 选世界 → 03 选伴侣 → 04 THE LIVING GALLERY（可行走 3D 画廊）
> 参照文档：`LATEST_PRODUCT_SPEC.md`

---

## 一、整体流程 vs 产品预期

**预期**（`LATEST_PRODUCT_SPEC.md`）：输入一个存在主义问题 → GPT 生成策展脊柱 → 选伴侣 → 走进「一个连续的梦境画廊世界」，多区域、多材质、每区多幅画。核心 wow：「我的问题变成了一座可走的博物馆」。

**实际实现**：一串叙事式滚动幕，最后进入**单个**大理石长廊。

| 差异 | 说明 | Spec 依据 |
| --- | --- | --- |
| 缺 Act 1「问题闸门」 | 没有让用户输入自己的问题，直接进预设固定叙事，核心 wow 未体现 | Spec Act 1 / Final demo structure |
| 只有一个连续长廊 | 缺 4–5 个不同材质区域（水光花园 / 情感天空 / 记忆庭院 / 无限回廊） | Act 3 |
| 全大理石柱廊 | 正是 spec 明确要避免的「all-marble feeling」 | Priority 1: visual coherence |

---

## 二、严重视觉问题（Scene 04 可行走画廊）

### 🔴 P0 — Splat 世界渲染成一团模糊涂抹（最严重）
- **现象**：下半屏和地面被一大片灰蓝/米色的模糊高斯涂抹覆盖（像被抹开的油污/雾团），完全不像「宏伟温室」环境。摄像机基本站在了 splat 点云内部，近处高斯被拉成一片糊。
- **根因**：`lib/museum3d.js:147-173` `buildWorldEnvironment()`。
  - 世界 collider 为 `min.y=-32.06 → max.y=0.83`（OpenCV +y down）。
  - 代码只把 `GROUND_Y=0.83` 放到地板，绕 X 翻转 180° 后世界主体压到了地板以下 / 包裹住相机。
  - `WORLD_SCALE=1.3`、`position z=-18` 的落位没让相机站在世界「房间地面」上。
  - `WORLD_YAW=0` / `CENTER_X` 等常量注释里都写着「tune / try」，说明这套对齐参数没调好就上了。
- **修复方向**：重新推导 `GROUND_Y` / `WORLD_SCALE` / `WORLD_YAW` / `position`，让相机站在世界地面上、朝向房间内部；逐一 tune 注释里标注的候选值并截图验证。

### 🟠 P1 — 天花板拱顶发黑、悬浮错位
- 顶部深色穹顶与米色柱廊接缝生硬；右转视角时拱顶结构飘在半空、和柱子对不齐，几何错位明显。

### 🟠 P1 — 画作过暗 / 融进背景
- 两侧墙上画作在模糊 splat 与暗顶夹击下对比度极低，多幅几乎看不清。
- 违反 spec「第一个场景要明亮、浪漫、通透」（Priority 1）。

---

## 三、数据 / 内容 bug

### 🔴 内容错误 — 世界选择页（Scene 02）
- 「PICASSO / WORLD OF FRACTURE」卡片配图写的是 **"A Sunday on La Grande Jatte"**。
- 这是**修拉（Georges Seurat）**的点彩名作，**不是毕加索**。张冠李戴，评委一眼可见的硬伤。

### 🟡 伴侣选择页（Scene 03）
- 最下排一张雕塑面孔肖像卡视觉偏诡异 / 像「融化」，与 spec「用公有领域真实历史肖像」的调性不符，建议换图。

---

## 四、确认正常的部分

- 画作卡数据正确（如 Monet *Stacks of Wheat (End of Summer)* 1890–91，署名 Art Institute of Chicago，有 VIEW MUSEUM RECORD）。
- 控制台**无 JS 报错**，路径可完整走通。
- 本地 fallback 诚实标注（`LOCAL FALLBACK` / `AI INTERPRETATION — NOT AUTHENTIC QUOTATION`）。

---

## 五、修复优先级

1. **P0 — Splat 世界对齐**：占了半屏糊，毁灭性，最先修。（`lib/museum3d.js:147-173`）
2. **P0 — 毕加索/修拉配错画**：Scene 02 数据修正。
3. **P1 — 拱顶错位 + 画作过暗**：提升第一场景通透度。
4. **P1 — Scene 03 诡异肖像换图**。
5. **P2 — 补 Act 1 问题输入 + 多材质区域**（对齐 spec，工作量较大，可后置）。

---

## 六、注意

- `git status` 显示 `lib/museum3d.js` 当前有**未提交改动**（正是这次 splat 对齐的尝试）。修改前先确认没有其他 agent 正在改这个文件，避免冲突。
- 验证命令：`npm run test`；`npm run check`。
