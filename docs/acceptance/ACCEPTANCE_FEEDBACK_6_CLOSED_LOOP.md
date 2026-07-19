# MUSE∞ 视觉验证 —— ① 闭环 + ② 同行者跟随

> 服务器 4173（= 你的目录，md5 一致）。两件都用硬刷新亲眼验了。

---

## ① 闭环（核心交付）—— ✅ 数据链全通，⚠️ 落地世界视觉差

走 emotion 路径：`?stage=decision&demo=true` → 点「02 turn inner experience into a shared language」→ manifesto → ENTER YOUR WORLD。

**逻辑链逐项核对，全部正确：**

| 检查点 | 期望 | 实际 | 结果 |
|---|---|---|---|
| manifesto 标题 | The Infinite Interior | "The Infinite Interior" | ✅ |
| 落地世界 HUD | van-gogh-inspired-gallery-interior · splat | `van-gogh-inspired-gallery-interior · splat · READY` | ✅ |
| 左上铭牌 | The Infinite Interior | "The Infinite Interior" | ✅ |
| stage | world_exploration | world_exploration | ✅ |

**→ emotion → The Infinite Interior → 梵高画廊 的闭环打通了。** 契约层名副其实。

**但落地的视觉质量差**（正是全世界巡检里我标「崩」的那个 splat 世界）：
- 环境漆黑/糊，几乎看不出是梵高画廊。
- 墙上画作能辨认出是梵高风格的作品（星夜色调），但整体太暗。
- 同行者尺度/贴地在这个 splat 世界里仍不稳。
- **闭环逻辑成立，但如果 demo 走 emotion 这条，观众落进的是最弱的一个世界。**

> 注：另两条按 config 映射应为 perception→花影宫殿(#3，也偏糊)、invention→无限圆点镜屋(#1，最好)。**invention 这条落地的是最强的圆点屋 mesh 世界** —— 如果 demo 只演一条，建议演 invention。

---

## ② 同行者跟随（这轮你修的）—— ✅ 跟随修好了，⚠️ 但人物被同化成金团

默认圆点屋 `?stage=world_exploration`，静止 → 按 W 走 1.5s → 停 → 对比：

- ✅ **跟随成立**：走动后三个同行者**都还在画面里、相对位置稳定，Monet 没有掉队**。这轮跟随修复确认有效（对比上一轮扇形版走动直接消失，是修好了）。
- ⚠️ **但新问题：三个同行者被渲染成金色+黑点的团块，完全同化进圆点环境**，认不出是 Monet/Van Gogh/Socrates 三个人，看起来像三个装饰性金球悬在隧道中央。
- 原因推测：圆点屋 mesh 是强反光/自发光的金黄环境，同行者贴图/材质被环境光染成金色，加上离相机偏远、被圆点纹理淹没 → 失去人形辨识度。（右上角 HUD 的三张肖像卡是好的，但世界里的 3D 人认不出。）

---

## 综合结论

| 项 | 逻辑/契约 | 视觉 |
|---|---|---|
| ① 闭环 emotion→The Infinite Interior→梵高画廊 | ✅ 全对 | ⚠️ 落地世界最弱(暗/糊) |
| ② 同行者跟随 | ✅ 三人跟随、Monet 不掉队 | ⚠️ 人物被同化成金团、失去辨识度 |

**核心 demo 逻辑成立、可演。** 剩下都是视觉打磨：(a) 换 demo 主线到 invention（落地最强的圆点屋），(b) 让同行者在圆点屋里能被认出是人。

---

## 对你规划的回应（优先级建议）

1. **[P0] demo 主线走 invention** —— emotion 落地的梵高 splat 世界太弱；invention 落地的是最强的圆点屋 mesh。若只演一条，演 invention 最稳。（若必须演 emotion，先救梵高世界的亮度/落位。）
2. **[P0] 修同行者在圆点屋里的辨识度** —— 现在是金团。给人物加自身材质/描边/轻微背光，或拉近距离+放大，让观众看出是三个历史人物走在身边（这是 spec 的 wow 点「身边的人改变了你看画的方式」）。
3. **[P1] 封闭感天穹** —— 可以做，但排在上面两个视觉问题之后；圆点屋本身包裹感已不错，优先级低于「同行者辨识度」。
4. **[P1] 点画作→GPT-5.6 对话** —— 我还没验 Act4 这条（点画作触发同行者 live 回应）。你要的话我下一轮专门验这个。
5. **[P2] 多区域 vs 单世界** —— 同意锁定单世界。把 invention→圆点屋这一条打磨到最好，比铺多区域更稳。
6. **test-interaction 未提交工作** —— 你说可能丢；要保全我可以帮你 commit 到一个分支，只需你点头。

---

## 一句话交接（可直接贴给 Claude）
> 两件视觉验证结果：① **闭环逻辑全对** —— emotion→manifesto"The Infinite Interior"→HUD van-gogh-inspired-gallery-interior·splat→铭牌"The Infinite Interior"，链路名副其实；但 emotion 落地的梵高 splat 世界是全场最弱(暗/糊/落位不稳)，建议 demo 主线改走 **invention**（落地最强的圆点屋 mesh）。② **同行者跟随修好了** —— 走动 1.5s 后三人都在、Monet 不再掉队；但新问题是三个同行者在圆点屋里被环境金光同化成「金色+黑点团块」，认不出是人，需要给人物加自身材质/描边/背光或拉近放大，恢复人形辨识度（这是 spec 的核心 wow）。下一步优先级：demo 走 invention + 修同行者辨识度 > 封闭感天穹 > 验 Act4 点画作对话。
