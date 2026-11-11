# Android 客户端任务书

**状态：未开始。存在一个必须先解决的硬阻塞——资源体积。**

## 核心阻塞：729 MB 装不进 Google Play

| 资源 | 体积 |
|---|---|
| 英美录音 `atlas/audio` | 426 MB |
| 插画 `atlas/img` | 203 MB |
| 缩略图 `atlas/thumb` | 88 MB |
| 词条分片 `atlas/entries` | 6.7 MB |
| **合计** | **约 729 MB** |

Google Play 单个 AAB 模块上限 **200 MB**。国内应用商店（华为/小米/OPPO）限制宽松得多（通常 2–4 GB），但为了通吃必须先做分包。

### 三条可选路线

| 方案 | 首装体积 | 代价 | 推荐度 |
|---|---|---|---|
| **A. 语音全走系统 TTS** | ~300 MB | 音质下降，口音依赖设备 TTS 引擎；`src/lib/audio.ts:47` 已有降级逻辑，改动最小 | ⭐⭐⭐ |
| **B. Play Asset Delivery 分包** | ~150 MB + 按需 400 MB | 需接入 PAD，国内商店不认 | ⭐⭐ |
| **C. 自有 CDN 首次下载语音包** | ~150 MB + 首次联网 400 MB | 要维护下载/校验/断点续传，但商店通吃 | ⭐⭐⭐ |

**建议先走 A 拿到可用的 APK，再评估要不要为音质投入 B/C。**

## 验收标准

- [ ] 产出可安装 APK，离线可用
- [ ] 触摸交互正常：点按、长按、滑动、无 300ms 延迟
- [ ] 无 hover 依赖的交互（移动端没有悬停）
- [ ] 刘海屏/挖孔屏安全区正确
- [ ] 物理返回键行为正确
- [ ] 自动发音遵守 Android 的自动播放策略
- [ ] 学习进度不会被系统回收

## 前置环境

```bash
# JDK 17+（推荐 21，Android Studio 自带 JBR）
# Android Studio → SDK Manager 安装：
#   Android SDK Platform 36
#   Android SDK Build-Tools 36
#   NDK (Side by side) 27.x
#   Android SDK Command-line Tools

export ANDROID_HOME="$HOME/AppData/Local/Android/Sdk"
export NDK_HOME="$ANDROID_HOME/ndk/27.x.x"
export PATH="$ANDROID_HOME/platform-tools:$PATH"

rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

验证：

```bash
adb devices
sdkmanager --list_installed | grep -E "platforms;android-3[56]|ndk;27"
```

## 构建

```bash
git checkout desktop-win
npm install

npx tauri android init          # 生成 src-tauri/gen/android
npx tauri android dev           # 连真机/模拟器热更新调试
npx tauri android build --apk   # 出 APK
npx tauri android build --aab   # 出 AAB（上架用）
npx tauri android build --apk --split-per-abi   # 按 ABI 拆分，单包更小
```

优先用**真机**调试。模拟器的 WebView 版本和 GPU 表现与真机差异大，星图动画在模拟器上卡不能说明问题。

## 必须验证的 Android 差异

### 1. WebView 版本下限

Android 用的是**系统 WebView**（Chrome），版本取决于设备。Tauri 2 的 `minSdk` 默认是 24，但 Android 7 的 WebView 未必支持本项目用到的 CSS：

| 特性 | 位置 | 最低要求 |
|---|---|---|
| `color-mix()` | `app.css` 滚动条 | Chrome 111+（2023-03） |
| `@container` + `cqw` | `app.css:922` | Chrome 105+ |
| `scrollbar-width` | 部分容器 | Chrome 121+ |
| `:has()` | 若有使用 | Chrome 105+ |

**决策点：** 要么把 `minSdk` 提到 26/28 以便假定 WebView 较新，要么为老设备准备降级样式。建议直接设 `minSdk 26` 并在 `AndroidManifest.xml` 里检查 WebView 版本。

### 2. 自动播放策略

`settings.autoplay` 默认开启，但 Android WebView 禁止无用户手势的音频播放。第一次进入学习页时的自动发音会静默失败。

需要改成：首次点击页面后再启用自动播放，或在 `onCreate` 里设置 `setMediaPlaybackRequiresUserGesture(false)`（Tauri 需要改生成的 Java/Kotlin 代码）。

- [ ] 首次进入页面不报错、不静默吞掉
- [ ] 用户点按后自动发音正常

### 3. 返回键

Tauri 2 的 Android 返回键默认可能直接退出应用。学习流程里按返回应该是「退出当前复习」而不是「退出 app」。

- [ ] 学习页返回 = 退出本轮复习
- [ ] 图鉴页返回 = 回上一级
- [ ] 首页返回 = 退出应用（带确认）

### 4. 安全区与手势

- [ ] 顶部刘海/挖孔不遮挡标题栏（用 `env(safe-area-inset-*)`）
- [ ] 底部手势条不遮挡 Tab 栏
- [ ] 375×812 到 430×932 之间各尺寸都正常

现有 CSS 的移动断点是 `@media (max-width: 759px)`（`app.css:654`、`1480`）。手机宽度都落在这个区间，理论上布局是现成的，但需要真机确认字号的 `clamp()` 结果是否可读。

### 5. 存储被回收

`localStorage` 在 Android WebView 中可能被系统清理（存储压力、用户清缓存）。学习进度丢失在这个应用里是不可接受的。

- [ ] 进度写入应用私有目录（Tauri 的 `appDataDir`），不再只依赖 localStorage
- [ ] 提供导出/导入

## 待办任务

### P0 · 打通构建

- [ ] 装齐 SDK/NDK/JDK，`npx tauri android init` 成功
- [ ] 真机跑起 `npx tauri android dev`
- [ ] 确认词库、插画、录音在 APK 内可读（路径协议与桌面端不同，需实测 `fetch("/atlas/index.json")`）
- [ ] 确定 `minSdk`，写进配置

### P1 · 体积与体验

- [ ] 语音改走系统 TTS（方案 A），资源降到 ~300 MB
- [ ] 自动播放策略适配
- [ ] 返回键行为
- [ ] 安全区适配
- [ ] 进度落盘

### P2 · 上架

- [ ] 生成 keystore 并配置签名
- [ ] 出 AAB，确认单模块 ≤ 200 MB
- [ ] Play 商店素材（截图、图标、隐私政策）
- [ ] 音量键/耳机按键行为确认（可选）

## 注意

- **`tauri.conf.json` 的 `bundle.android.debugApplicationIdSuffix` 已设为 `.debug`**，debug 包与正式包可以共存，便于对比。
- Android 工程会生成到 `src-tauri/gen/android`，需要提交进 Git（CI 要用），但 `build/` 目录要排除。
- Android 端同样受「Tauri 用系统 WebView」约束，**不存在真原生控件**，与桌面端是同一套渲染。
