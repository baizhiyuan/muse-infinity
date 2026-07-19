# MUSE∞ 验收反馈 —— A/B/C/D 无法验收（服务器跑错目录）

> 结论先行：**Claude 这轮代码大概率没问题，但一行都没跑起来。**
> 4173 端口的服务器 serve 的是**另一个 checkout**，不是 Claude 编辑的目录。
> 所以 A/B/C/D 四个 URL 的 `?stage=` / `?world=` / `?render=` 参数全部被忽略，页面永远停在 Scene 00 THRESHOLD。

---

## 一、现象

| # | URL | 期望 | 实际看到 |
| --- | --- | --- | --- |
| A | `/?stage=world_exploration` | 无限镜屋 HD mesh，正立、比例正常、可 WASD | 停在 Scene 00 落地页（"The Impossible Museum"），未进 3D |
| B | `...&render=splat` | 同房间 splat 版 | 同上，参数被忽略 |
| C | `...&world=van-gogh-inspired-gallery-interior` | 梵高画廊 splat | 同上，参数被忽略 |
| D | `/?stage=world_selection` | 列出 9 个世界卡片 | 同上，停在 Scene 00 |

注：落地页本身已更新且很漂亮（明亮玻璃温室花园、紫藤、雕像、倒影池），入口按钮也变成了 "Begin with a life question"（Act 1 问题闸门）。但**深链跳转完全没生效**。

---

## 二、根因：两个 checkout，服务器跑在错误的那个上

- 4173 端口的 node 进程（**PID 40124**，启动于 03:13）工作目录是：
  `/Users/expansioai/project/muse-test-interaction/muse-infinity`
- `server.mjs:16` 用 `process.cwd()` 作为静态根，所以它只 serve 那个 **muse-test-interaction** 副本。
- Claude 和调试助手的改动都在当前工作目录：
  `/Users/expansioai/project/muse-infinity`

### 证据
1. 两个 `app.js` 的 md5 不同：
   - 当前目录：`e6d9178cdced47c6913b497b8e9f9407`
   - 服务器实际吐出：`3aa4531eae6271a61d857285ac913789`（= test-interaction 副本）
2. Claude 新建的 `config/worlds.js`（9 世界注册表）**只存在于当前目录**；test-interaction 副本里没有这个文件。
3. 服务器 serve 的 `app.js` 尾行仍是旧的硬编码 `setStage("threshold")`——没有 `?stage=` 深链、没有 `resolveSelectedWorld`。而当前目录的 `app.js:820` 已经有：
   ```js
   const __start = new URLSearchParams(location.search).get("stage");
   setStage(STAGES.includes(__start) ? __start : "threshold");
   ```

---

## 三、解决办法（二选一）

### 方案 1（推荐）：在正确的目录重启服务器
```bash
# 杀掉跑错目录的旧进程
kill 40124
# 在 Claude 实际编辑的目录重启
cd /Users/expansioai/project/muse-infinity && node server.mjs
```
然后硬刷新 A/B/C/D 重新验收。

### 方案 2：如果本意是在 test-interaction 目录工作
让 Claude 改那个目录，或把当前目录的改动同步过去。

---

## 四、给 Claude 的一句话交接

> 我无法验收 A/B/C/D：4173 端口的 server（PID 40124）cwd 是 `/Users/expansioai/project/muse-test-interaction/muse-infinity`，而你的改动在 `/Users/expansioai/project/muse-infinity`。server.mjs 用 `process.cwd()` 当静态根，所以新代码（含 `config/worlds.js`、`?stage=` 深链）根本没被 serve。请在正确目录重启服务器后我再验收。代码本身没验证过对错——只是没跑起来。
