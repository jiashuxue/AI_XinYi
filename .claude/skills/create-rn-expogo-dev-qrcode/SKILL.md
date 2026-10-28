---
name: create-rn-expogo-dev-qrcode
description: 为 React Native（Expo）项目启动 Expo Go 真机测试：启动 dev server、把开发服务器地址（exp://…）转成二维码并打开给用户真机扫码。当用户在 RN/Expo 项目里说「我要进行真机测试」「给我二维码扫码测试」「用 Expo Go 扫码测一下」「真机预览」等需要真机扫码的场景时，务必使用本 skill。
---

# 生成 Expo Go 真机测试二维码

把 Expo 开发服务器的地址转成一个可扫码的二维码（PNG 图片），让用户用手机上的 Expo Go（Android）或系统相机（iOS）扫码打开 App 进行真机测试。

## 工作流程

### 1. 定位应用目录

- 本项目约定应用目录固定为 `rnapp/`，优先使用它。
- 若 `rnapp/` 不存在，找包含 `expo` 依赖的 `package.json`：`grep -rl '"expo"' --include=package.json .`，取对应目录。

以下所有命令都在该应用目录（记为 `<appDir>`）下执行。

### 2. 确认 / 启动 dev server

先判断是否已有 dev server 在跑（Expo 默认端口 8081）：

```bash
# Windows（本项目环境）
netstat -ano | findstr :8081

# macOS / Linux
lsof -i :8081
```

- 若已有进程监听 8081，说明 server 已在跑，直接跳到第 3 步取地址。
- 若没在跑，启动它（后台运行并把输出写到日志文件，便于下一步提取地址）：

  ```bash
  cd <appDir> && npx expo start > /tmp/expo-dev.log 2>&1 &
  # 或使用工具的后台运行方式启动，同样把 stdout/stderr 重定向到日志
  ```

  两种连接模式：
  - **局域网模式（默认）**：`npx expo start` —— 要求手机和电脑连同一个 WiFi。
  - **隧道模式（跨网络 / 网络受限）**：`npx expo start --tunnel` —— 手机和电脑只要都能上网即可，但首次连接较慢，且可能需要 Expo 账号登录（`npx expo login`）。

  默认用局域网模式；若用户提到「不在同一网络」「连不上」或明确要隧道，则用 `--tunnel`。

### 3. 提取开发服务器地址

从日志中轮询 `exp://` 开头的地址（最多等约 60 秒，Expo 首次启动 Metro 需要一点时间）：

```bash
grep -oE 'exp://[^ ]+' /tmp/expo-dev.log | head -1
```

常见格式：
- 局域网：`exp://192.168.1.5:8081`
- 隧道：`exp://<随机>.exp.direct:80`（或 `exp://<随机>.exp.direct`）

若 60 秒内没取到地址，读取日志排查（常见原因：端口被占、依赖未安装、隧道需要登录）。

### 4. 生成二维码

用本 skill 自带的脚本，把地址转成 PNG 二维码（同时打印终端 ASCII 备用和地址文本）：

```bash
node <本skill目录>/scripts/generate-qrcode.mjs "<devServerUrl>" "<appDir>"
```

- 脚本会从 `<appDir>/node_modules` 解析 `qrcode` 依赖。
- 若脚本报「未找到 qrcode 依赖」，先在应用目录装一下再重试：`npx expo install qrcode`（或 `npm i -D qrcode`）。
- 记下脚本输出里的「PNG 二维码已生成：<路径>」，下一步要用。

### 5. 打开二维码给用户扫码

用系统默认看图工具打开 PNG，让用户直接拿手机扫：

```bash
# Windows
cmd //c start "" "<PNG路径>"
# 或
explorer.exe "<PNG路径>"

# macOS
open "<PNG路径>"

# Linux
xdg-open "<PNG路径>"
```

同时把 `exp://` 地址作为纯文本打印给用户（万一扫码失败可手动在 Expo Go 里输入），并附带终端 ASCII 二维码作为备用。

### 6. 说明连接要求

最后简要提醒用户：
- 局域网模式：手机和电脑必须连**同一个 WiFi**。
- 隧道模式：只要两边都能上网即可；手机端用 Expo Go 直接扫码即可打开。

## 注意事项

- 只生成「当前开发服务器地址」的二维码，不要臆造地址；地址以 dev server 日志里打印的为准。
- dev server 保持后台运行，不要中途杀掉，否则扫码后手机连不上。
- 生成的 PNG 默认写在系统临时目录，不会污染仓库，无需手动清理。
