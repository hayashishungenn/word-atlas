# 桌面端交接 · Desktop Handoff

把「词光 Word Atlas」包装成 Windows / macOS / Android 三端可分发的应用。当前 Windows 端已完成并验证，macOS 与 Android 尚未开始。

## 仓库与分支

| 项 | 值 |
|---|---|
| 你的 fork | `github.com/hayashishungenn/word-atlas` |
| 上游原仓库 | `github.com/designfuchen/word-atlas` |
| 工作分支 | **`desktop-win`**（所有桌面端改动都在这里） |
| 本地 remote | `origin` = fork，`upstream` = 原作者 |

```bash
git clone https://github.com/hayashishungenn/word-atlas.git
cd word-atlas
git checkout desktop-win
npm install
```

同步上游更新：`git fetch upstream && git merge upstream/main`

## 三端现状

| 端 | 状态 | 构建机要求 | 任务书 |
|---|---|---|---|
| Windows 10/11 | ✅ 可用，已验证 | 任意 Windows | [WINDOWS.md](./WINDOWS.md) |
| macOS 26+ | ⬜ 未开始 | **必须是 macOS** | [MACOS.md](./MACOS.md) |
| Android 15/16 | ⬜ 未开始，有体积硬阻塞 | 任意平台 | [ANDROID.md](./ANDROID.md) |

**关键限制：没有一台机器能出全三端。** Tauri 不支持交叉编译到 macOS（需 Apple 工具链）或到 Windows（需 MSVC + NSIS，官方不支持）。发布矩阵必须按平台分机器或交给 CI。

## 已完成的工作

### 1. Tauri 2 壳（`src-tauri/`）

- 窗口 1100×700，最小 880×620，居中，深色底 `#0D1120` 避免启动白闪
- `identifier: com.wordatlas.app`，`productName: Word Atlas`，`version: 1.0.0`
- 图标由 `public/icon-512.png` 生成，含桌面 + Android + iOS 全套
- `beforeDevCommand` / `beforeBuildCommand` 复用现有 `npm run dev` / `npm run build`
- `zoomHotkeysEnabled: false`、`devtools: false`

### 2. 桌面适配

- `src/main.tsx`：在 Tauri 环境中跳过 Service Worker 注册（资源全在本地，自定义协议下 SW 也不可靠）
- `src/lib/desktop.ts`：仅在桌面壳中挂载 `hardenDesktopShell()`，清除浏览器行为
- `src/styles/app.css`：末尾新增 `.is-desktop` 段落，主题色细滚动条 + chrome 区域禁用选中

### 3. 主题跟随系统

- `store.ts` 的 `defaultSettings.theme` 改为 `"system"`
- `index.html` 首屏脚本不再强制深色，并按系统方案同步 `meta[theme-color]`
- `App.tsx` 新增 `useSystemDark()`，订阅 `matchMedia` 的 change 事件，运行中切换系统主题即时生效

## 构建（Windows）

```bash
npm install
npm run desktop:build:fast   # 只出 exe，不打包安装器
npm run desktop:build        # 出 NSIS 安装包
```

产物：`src-tauri/target/release/app.exe`（653 MB，单文件免安装，资源全内嵌）

耗时实测（本机）：首次全量 Rust 编译 **24 分 55 秒**；改前端后重新嵌入资源 **12–13 分钟**；`vite build` 约 **60 秒**。

## 必须知道的五个坑

1. **不能用 `cargo build --release`。** 绕过 CLI 时资产不嵌入，产物只有 8.8 MB，启动后连 `localhost:5188` 失败，显示「无法访问此页面」。**只能用 `npx tauri build` 或 npm 脚本。**
2. **默认窗口别开太大。** 在 150% 缩放的笔记本上逻辑屏幕只有 1138×711，设 1280×860 会超出屏幕被裁切。当前 1100×700 是保守值。
3. **`dist/` 是 730 MB。** 每次构建都会重写一遍，磁盘留 15 GB 以上（`dist` + `src-tauri/target` 1.6 GB）。
4. **npm 11 会拦截 esbuild 的 postinstall。** 目前不影响构建；若报找不到 esbuild 二进制，执行 `npm install-scripts approve esbuild`。
5. **`.gitattributes` 已统一为 LF。** 跨 Windows/macOS 提交前不要改动 `core.autocrlf`，否则整个仓库 diff 会变脏。

## 已验证的行为（Windows 构建，CDP 实测）

| 项目 | 结果 |
|---|---|
| 视口 | 1100×700，DPR 1.5 |
| 横向溢出 | 无（scrollWidth = clientWidth = 1085） |
| 词库索引 | `/atlas/index.json` → 200，7,298 词 |
| 词条分片 | `/atlas/entries/0.json` → 200，100 条 |
| 插画 | `/atlas/img/*.webp` → 200，`image/webp` |
| 录音 | `/atlas/audio/uk/*.mp3` → 200，`audio/mpeg` |
| 破损图片 | 0 / 26 |
| 主题 | 跟随系统，两种方案 + 运行中切换均正确 |
| 右键菜单 | 导航上拦截，输入框内保留 |
| F5 / Ctrl+R / Ctrl+F / Ctrl+Shift+I | 全部拦截 |
| Ctrl+K 搜索面板 | 正常 |

## 代码地图

| 文件 | 作用 |
|---|---|
| `src-tauri/tauri.conf.json` | 窗口、打包、安全配置 |
| `src-tauri/src/lib.rs` | Tauri Builder 入口 |
| `src-tauri/src/main.rs` | Windows 下隐藏控制台窗口 |
| `src/lib/desktop.ts` | 浏览器痕迹清除（仅桌面壳） |
| `src/main.tsx` | SW 跳过 + 挂载 desktop.ts |
| `src/App.tsx` | `useSystemDark()`、主题应用 |
| `src/store/store.ts` | 设置默认值（含 theme） |
| `src/styles/app.css` | 末尾 `.is-desktop` 段落 |

## 三端共同的待办

- [ ] 学习进度从 `localStorage` 改为落盘（`appDataDir` 下的 JSON 或 SQLite），并提供导入导出
- [ ] 资源瘦身：语音改走系统 TTS 或分包下载，把 653 MB 压到 ~250 MB
- [ ] 代码签名（Windows 需证书，macOS 需 Apple Developer $99/年）
- [ ] 自动更新（Tauri updater plugin）
- [ ] CI：`.github/workflows/` 下按平台分别出包（public 仓库的 Actions 免费）
