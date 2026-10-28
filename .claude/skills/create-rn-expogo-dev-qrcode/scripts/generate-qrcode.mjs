#!/usr/bin/env node
/**
 * 将 Expo Go 开发服务器地址生成二维码（PNG 文件 + 终端 ASCII 备用）。
 *
 * 用法：
 *   node generate-qrcode.mjs <devServerUrl> <appDir> [outputPngPath]
 *
 *   <devServerUrl>   形如 exp://192.168.1.5:8081 的 Expo 开发服务器地址
 *   <appDir>         Expo 应用根目录（用于从该目录的 node_modules 解析 qrcode 依赖）
 *   [outputPngPath]  可选，PNG 输出路径；默认写到系统临时目录下的 expo-go-qrcode.png
 */

import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const url = process.argv[2];
const appDir = process.argv[3];
const pngPath = process.argv[4] || join(tmpdir(), 'expo-go-qrcode.png');

if (!url || !appDir) {
  console.error('用法：node generate-qrcode.mjs <devServerUrl> <appDir> [outputPngPath]');
  process.exit(1);
}

let QRCode;
try {
  // qrcode 是 CommonJS 包，用 createRequire 从 appDir 的 node_modules 解析，
  // 这样脚本本身即使放在 skill 目录里也能正确加载到项目依赖。
  const require = createRequire(resolve(appDir, 'package.json'));
  QRCode = require('qrcode');
} catch (err) {
  console.error('未找到 qrcode 依赖，请先在应用目录执行：npm i -D qrcode（或 npx expo install qrcode），然后重试。');
  console.error(err.message);
  process.exit(1);
}

// 生成 PNG 二维码（供真机扫码，最可靠）
try {
  await QRCode.toFile(pngPath, url, { width: 480, margin: 2 });
  console.log(`PNG 二维码已生成：${pngPath}`);
} catch (err) {
  console.error('生成 PNG 失败：', err.message);
  process.exit(1);
}

// 终端 ASCII 二维码作为备用（需要支持 ANSI 颜色的终端才能正常扫码）
try {
  const ascii = await QRCode.toString(url, { type: 'terminal', small: true });
  console.log('\n终端 ASCII 二维码（备用）：\n');
  console.log(ascii);
} catch {
  // ASCII 失败不影响主流程
}

console.log(`\n开发服务器地址：${url}`);
