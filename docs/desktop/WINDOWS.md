# Windows 客户端任务书

**状态：基础版已完成并通过验证。** 目标是把它做到可正式分发。

## 验收标准

- [x] 双击 exe 即可运行，无需安装、无需联网
- [x] 全部 7,298 个词条、插画、英美录音在离线状态可用
- [x] 主题默认跟随系统，运行中切换系统深浅色即时生效
- [x] 不出现浏览器行为（右键菜单、F5 刷新、Ctrl+F、缩放、开发者工具）
- [ ] 提供 NSIS 安装包，可自定义安装目录
- [ ] 安装包带数字签名，双击不触发 SmartScreen 警告
- [ ] 学习进度落盘，重装/换机可导出导入

## 环境（本机实测版本）

| 组件 | 版本 | 说明 |
|---|---|---|
| Node | 26.13.0 | 20+ 即可 |
| npm | 11.20.0 | 会拦截 esbuild 的 postinstall，见文末 |
| Rust | 1.99.1 | `stable-x86_64-pc-windows-msvc` |
| MSVC | 14.44.35207 | 来自 VS 2022 Build Tools 的 C++ 工作负载 |
| Windows SDK | 10.0.26100.0 | |
| WebView2 | 系统自带 | Win 11 预装，Win 10 需确认 |

VS Installer 里确认勾选「使用 C++ 的桌面开发」，缺它 `cargo build` 会找不到链接器。

## 构建

```bash
npm install

npm run desktop:build:fast   # 只编译 exe
npm run desktop:build        # 出 NSIS 安装包
```

| 产物 | 路径 | 大小 |
|---|---|---|
| 免安装 exe | `src-tauri/target/release/app.exe` | 653 MB |
| NSIS 安装包 | `src-tauri/target/release/bundle/nsis/*.exe` | 未实测，预计 500–650 MB |

**耗时实测：** 首次全量 Rust 编译 24 分 55 秒；改前端后重新嵌入资源 12–13 分钟；单独 `vite build` 60 秒。增量改 Rust 代码约 20 秒（但必须仍走 `npx tauri build`，否则资产不嵌入）。

## 待办任务

### P0 · 必须在分发前完成

- [ ] **打包 NSIS 安装包并实测**。`bundle.targets` 已设为 `["nsis"]`，但尚未跑过完整打包流程。注意 653 MB 的压缩会很慢，建议留 20 分钟以上。
- [ ] **进度落盘**。当前所有学习记录在 `localStorage`（`src/store/store.ts:100`）。桌面端应改为写入 `%APPDATA%\com.wordatlas.app\` 下的 JSON，并保留 localStorage 作为迁移来源。同时提供「导出/导入学习记录」按钮，位于 `src/pages/Me.tsx`。
- [ ] **窗口状态记忆**。记住上次的窗口尺寸与位置，写到同一个配置文件里。

### P1 · 体验与体积

- [ ] **体积瘦身**。音频 426 MB 是主要负担。方案 A：语音全走系统 TTS（`src/lib/audio.ts:47` 已有降级逻辑），资源降到约 250 MB；方案 B：录音改为首次启动可选下载。
- [ ] **启动速度**。当前 exe 653 MB，冷启动需要把资源映射进内存。可考虑把 `atlas/` 放到资源目录而非内嵌，用 Tauri 的 `resources` 配置。
- [ ] **原生菜单栏**。目前没有菜单。加「文件 / 视图 / 帮助」，把导出、主题切换、关于放进去。

### P2 · 分发

- [ ] **代码签名**。需要 OV/EV 代码签名证书（约 $100–400/年）。未签名时 SmartScreen 会警告。
- [ ] **自动更新**。接入 `tauri-plugin-updater`，配一个静态 JSON 作为更新源。
- [ ] **CI 自动出包**。`.github/workflows/` 下加 `windows-latest` job，public 仓库免费。

## 已知问题

| 问题 | 原因 | 处理 |
|---|---|---|
| `cargo build --release` 产物只有 8.8 MB 且报「localhost 拒绝连接」 | 绕开 CLI 时不会嵌入 `frontendDist` | 只用 `npx tauri build` |
| 窗口右侧被裁 | 默认尺寸超过 150% 缩放下的逻辑屏幕 | 已改为 1100×700 |
| npm 提示 esbuild postinstall 未执行 | npm 11 的 install-scripts 策略 | 构建正常，如报错再 `npm install-scripts approve esbuild` |
| 每次构建重写 `dist/`（730 MB） | Vite 复制整个 `public/` | 磁盘留 15 GB 以上 |

## 验证方法

用 WebView2 的调试端口直接读页面状态，比截图可靠：

```bash
WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9222" \
  ./src-tauri/target/release/app.exe
# 另开终端
curl http://127.0.0.1:9222/json/list
```

已验证的指标见 [README.md](./README.md) 的表格。
