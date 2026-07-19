# MUSE∞ 中文残留（i18n）Bug 检查报告

> 需求：整个项目网页里不应出现任何中文。全项目扫描（CJK 字符：中日韩统一表意 + 全角标点 + 假名），已排除 `node_modules` / `.git` / `dist` / 我的反馈 `.md` 文档。
> 本文档只**指出问题 + 给英文修复参照**，不改代码 —— 交给 Claude 统一修复。

---

## 结论速览

**网页会渲染的源码里，唯一含中文的文件是 `config/worlds.js`。** 中文全部集中在 9 个世界的 `displayName` 和 `blurb` 两个字段（共 18 处）。它们被 `app.js:228` 直接渲染到 **02 / CHOOSE A WORLD（选世界场景）** 的世界卡片上 —— 这就是你在网页上看到中文的地方。

> 你提到「第二幕选择画像场景」：项目里第二幕是 `world_selection`（02 选世界），紧接着才是 `companion_selection`（03 选伴侣/画像）。中文出现在 **02 选世界**（卡片标题+描述）。03 选伴侣场景的数据源已确认无中文。

---

## 1. 唯一问题文件：`config/worlds.js`（18 处中文）

每个世界对象里有两个中文字段。**注意：每个世界已经有一个现成的英文 `name` 字段**，可直接作为修复参照或数据源。

| 世界 key | 现有英文 `name`（可复用） | ❌ 中文 `displayName`（第 N 行） | ❌ 中文 `blurb`（第 N 行） |
|---|---|---|---|
| bright-gallery-hall | Bright Gallery Hall | 明亮画廊大厅 (28) | 阳光穹顶下的白墙画廊长廊…… (29) |
| yellow-polka-dot-infinity-room | Yellow Polka Dot Infinity Room | 无限圆点镜屋 (43) | 草间弥生式的无限镜屋…… (44) |
| van-gogh-inspired-gallery-interior | Van Gogh Inspired Gallery Interior | 梵高画廊 (58) | 回旋笔触与星夜色调铺满的长廊…… (59) |
| elegant-floral-palace-interior | Elegant Floral Palace Interior | 花影宫殿 (72) | 繁花簇拥的宫殿厅堂…… (73) |
| fantasy-realm-of-shimmering-spheres | Fantasy Realm of Shimmering Spheres | 流光球境 (86) | 悬浮微光球体铺成的狭长梦径…… (87) |
| grand-conservatory-with-lush-gardens | Grand Conservatory with Lush Gardens | 琉璃温室花园 (102) | 钢架玻璃穹顶下的巨型温室花园…… (103) |
| mexican-courtyard-bedroom-fantasy | Mexican Courtyard Bedroom Fantasy | 墨西哥庭院卧室 (116) | 弗里达式的庭院与卧房…… (117) |
| enchanted-water-garden-sanctuary | Enchanted Water Garden Sanctuary | 水影花园圣所 (130) | 睡莲与倒影的水上圣所…… (131) |
| dreamlike-coastal-villa-gardens | Dreamlike Coastal Villa Gardens | 海岸别墅花园 (144) | 临海别墅的梦境庭园…… (145) |
| sunlit-palace-gardens | Sunlit Palace Gardens | 阳光宫苑 (158) | 沐浴晨光的宫廷花园…… (159) |

（`displayName`/`blurb` 各 9 个 = 18 处中文。）

---

## 2. 渲染链路（中文如何跑到网页上）

- `config/worlds.js` 定义 `displayName` + `blurb`（中文）。
- `app.js:228`（`worldSelectionView`）渲染世界卡片：
  ```js
  <b>${w.displayName}</b><em>${w.blurb}</em>
  ```
  → 卡片标题用 `displayName`、描述用 `blurb`，二者都是中文，直接显示在 **02 / CHOOSE A WORLD** 场景。
- 运行时 `worlds.json` 已确认**无中文**（这条路径干净），所以问题纯粹在 `config/worlds.js` 源文件。

---

## 3. 建议修复方向（供 Claude 执行，供参考不代改）

1. **把 9 个 `displayName` 改成英文** —— 最省事的做法是直接复用同对象已有的英文 `name`（如 `明亮画廊大厅` → `Bright Gallery Hall`），或起一个更短的展示名。
2. **把 9 个 `blurb` 翻成英文** —— 保持原意的一句话英文描述即可。
3. 修复后**重跑一次全项目 CJK 扫描**确认 0 残留（命令见文末）。
4. 附带检查：`blurb` 里用了中文破折号 `——` 和全角逗号 `,`，翻成英文时一并换成英文标点（`—` / `,`）。

---

## 4. 已排除 / 确认无中文的部分

- ✅ `app.js`、`server.mjs`、`index.html`、CSS、其它所有 `.js/.mjs/.html/.css/.json`：无中文。
- ✅ 运行时 `worlds.json`：无中文。
- ✅ 03 选伴侣（companion）场景数据源：无中文。
- ⚠️ `.omc/state/hud-stdin-cache.json` 里有中文，但那是 **Claude Code 的会话状态缓存**（含路径/transcript），**不属于网页、不会渲染**，无需处理（也不应提交）。

---

## 5. 复验命令（修复后 Claude/你可自查，期望输出为空）

```bash
cd /Users/expansioai/project/muse-infinity
python3 - <<'PY'
import os, re
cjk=re.compile(r'[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\u3040-\u30ff]')
exts=('.js','.mjs','.html','.css','.json','.jsx','.ts','.tsx')
skip={'node_modules','.git','dist','build','.next','.omc'}
for dp,dns,fns in os.walk('.'):
    dns[:]=[d for d in dns if d not in skip]
    for fn in fns:
        if fn.endswith(exts):
            p=os.path.join(dp,fn)
            for i,l in enumerate(open(p,encoding='utf-8',errors='ignore'),1):
                if cjk.search(l): print(f"{p}:{i}: {l.rstrip()[:120]}")
PY
```

---

## 一句话交接（可贴给 Claude）
> 全项目 CJK 扫描：网页源码里唯一含中文的文件是 `config/worlds.js`，中文集中在 9 个世界的 `displayName`(28/43/58/72/86/102/116/130/144/158 行) 和 `blurb`(29/44/59/73/87/103/117/131/145/159 行) 共 18 处，被 `app.js:228` 渲染到 02/CHOOSE A WORLD 选世界卡片上。请把这 18 处全部改成英文：`displayName` 可直接复用同对象已有的英文 `name` 字段，`blurb` 翻成等义英文一句话，并把中文破折号 `——`/全角逗号 `,` 换成英文标点。运行时 `worlds.json`、`app.js`、`server.mjs`、CSS、其它 JSON 均已确认无中文；`.omc/state/*.json` 里的中文是 Claude Code 会话缓存、非网页内容、忽略。改完重跑本报告第 5 节的 CJK 扫描确认 0 残留。
