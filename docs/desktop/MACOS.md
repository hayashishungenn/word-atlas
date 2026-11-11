# macOS 客户端任务书

**状态：未开始。** Tauri 壳本身跨平台，理论上复制 `src-tauri/` 即可，但 macOS 有独立的工具链、签名与 WebView 差异，必须逐项验证。

## 验收标准

- [ ] 双击 .app 可运行，资源全部本地
- [ ] 支持 Apple Silicon（arm64）与 Intel（x86_64），或产出 universal 二进制
- [ ] 主题跟随系统，包含运行中切换
- [ ] 无浏览器行为：右键菜单、Cmd+R 刷新、Cmd+F、捏合缩放、开发者工具
- [ ] 通过 Apple 公证（notarization），首次打开不出现「无法验证开发者」
- [ ] 语音在无录音时降级到系统语音可用

## 前置环境

```bash
xcode-select --install          # 必需，提供 clang 与 Apple SDK
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
brew install node
```

Android 或 iOS 端点需要 Android Studio / Xcode 实体，这里不需要。

验证工具链：

```bash
rustc --version          # 需要 1.90+
xcodebuild -version
npx tauri --version      # 需要 2.x
```

## 构建

```bash
npm install
git checkout desktop-win

npm run desktop            # 开发模式，起 vite + 窗口
npm run desktop:build      # 产出 .app 与 .dmg
```

指定架构：

```bash
# Apple Silicon
npx tauri build --target aarch64-apple-darwin
# Intel
npx tauri build --target x86_64-apple-darwin
# 通用二进制（体积翻倍，但一份安装包通吃）
rustup target add aarch64-apple-darwin x86_64-apple-darwin
npx tauri build --target universal-apple-darwin
```

产物在 `src-tauri/target/<target>/release/bundle/`。默认同时产出 `.app` 与 `.dmg`；如只需要 dmg，把 `tauri.conf.json` 的 `bundle.targets` 设为 `["dmg"]`。

## 必须验证的 macOS 差异

### 1. 渲染引擎不同 —— 这是最大风险

Windows 用 **WebView2（Chromium）**，macOS 用 **WKWebView（WebKit）**。同一份前端代码在两端表现可能不同。本项目的 CSS 用到这些有差异的特性：

| 特性 | 位置 | 风险 |
|---|---|---|
| `color-mix()` | `src/styles/app.css` 末尾的滚动条 | WebKit 支持，但透明度混合结果可能有差 |
| `@container` + `cqw` | `app.css:922` 词卡字号自适应 | Safari 16+ 支持，仍需实测 |
| `::-webkit-scrollbar` | 同上 | WebKit 支持 |
| `scrollbar-width` | 部分滚动容器 | Safari 18.2+ 才支持，旧版会忽略 |
| 系统字体回退 | `--serif` / `--sans` | 两端中文字体不同，排版需目视检查 |

**排查方式：** 先 `npm run dev` 用 Safari 打开 `http://localhost:5188` 对一遍，再打进 app 验证。

### 2. 语音降级

`src/lib/audio.ts:47` 依赖 `speechSynthesis`。macOS 的可用 voice 列表与 Windows 完全不同，且代码里用 `/premium|enhanced|natural|google/i` 挑最优 voice，两端匹配结果必然不同。

必须在真机上逐项确认：

- [ ] 录音能正常播放
- [ ] 删掉某条录音后，降级语音能出声
- [ ] 英式 / 美式口音切换正确（`en-GB` / `en-US`）
- [ ] 语速调节生效

### 3. 窗口装饰

当前 `tauri.conf.json` 没有设 `titleBarStyle`，走系统默认标题栏——这是最稳的选择。若要更原生：

```json
"titleBarStyle": "Overlay",
"hiddenTitle": true
```

改成 Overlay 后需要自己处理红绿灯按钮的避让（前端加 `padding-left: 78px` 之类的安全区），否则左上角logo 会被交通灯盖住。**第一版建议先保持默认。**

### 4. 右键与快捷键

`src/lib/desktop.ts` 里拦截的是 Ctrl 系快捷键。macOS 用户习惯用 **Cmd**，代码里已同时判断 `e.ctrlKey || e.metaKey`，但需要实测：

- [ ] Cmd+Q 正常退出（不能被拦截）
- [ ] Cmd+W 正常关窗
- [ ] Cmd+C / Cmd+V 在输入框内正常
- [ ] Cmd+R / Cmd+F 被拦截
- [ ] 右键菜单在导航上不出现、在输入框内出现

## 签名与公证

未签名时用户首次打开会看到「无法验证开发者」，必须签名并公证才能正式分发。

需要 Apple Developer Program（**$99/年**）。准备好后设置环境变量再构建：

```bash
export APPLE_CERTIFICATE="<base64 编码的 .p12>"
export APPLE_CERTIFICATE_PASSWORD="<证书密码>"
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_ID="your@apple.id"
export APPLE_PASSWORD="<App 专用密码>"
export APPLE_TEAM_ID="<Team ID>"

npx tauri build --target universal-apple-darwin
```

Tauri 会自动完成 codesign + notarytool 提交。验证：

```bash
spctl -a -vvv -t install "src-tauri/target/release/bundle/macos/Word Atlas.app"
codesign -dv --verbose=4 "src-tauri/target/release/bundle/macos/Word Atlas.app"
```

还需要 hardened runtime 与最低权限的 `entitlements.plist`；本应用不访问摄像头/麦克风/网络服务，保持最小权限即可。注意：播放网络音频不需要 entitlement，但**麦克风权限不要申请**，否则会触发审核问询。

## 待办任务

### P0

- [ ] 在 Mac 上跑通 `npm run desktop`，确认窗口与资源正常
- [ ] 完成上面「必须验证的 macOS 差异」全部勾选项
- [ ] 产出未签名的 `.dmg` 并在另一台 Mac 上试装（先用 `xattr -dr com.apple.quarantine` 绕过隔离验证功能）
- [ ] 修掉 WebKit 特有的样式问题

### P1

- [ ] 进度落盘到 `~/Library/Application Support/com.wordatlas.app/`
- [ ] 窗口状态记忆
- [ ] 原生菜单栏（macOS 菜单栏是系统级要求，缺席会显得不像原生应用）
- [ ] 适配 `titleBarStyle: Overlay`（可选）

### P2

- [ ] Apple Developer 账号 + 证书
- [ ] 公证流水线
- [ ] CI `macos-latest` job

## 注意

- **无法从 Windows 构建 macOS 包。** 必须在一台 Mac 上做，或用 GitHub Actions 的 `macos-latest`（public 仓库免费）。
- 仓库有 1.5 GB（含 `.git`），迁移到 Mac 时用移动硬盘拷整个目录，不要重新 `git clone`。
- `docs/deployment.md` 里提到的 `.github/workflows/pages.yml` 在当前仓库中并不存在，不要被误导。
