import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { captureRef } from 'react-native-view-shot';
import type { ViewInstance } from 'react-native';

/**
 * 贺卡导出（T32，spec 14）：
 * - 用 react-native-view-shot 的 captureRef 捕获贺卡 View；
 * - 用 expo-media-library 申请相册权限并保存到相册。
 * 注：Expo SDK 58 中 expo-media-library 主入口的 saveToLibraryAsync 已废弃并会在运行时抛错，
 * 这里改用官方推荐的新类 API `Asset.create(filePath)`（等价于保存到相册）。
 */

export type CardExportResult = {
  ok: boolean;
  message: string;
};

/**
 * 捕获贺卡并保存到系统相册。
 * @param cardRef 指向贺卡 View 的 ref（ViewInstance 由 react-native 导出）
 */
export async function exportCardToLibrary(cardRef: {
  current: ViewInstance | null;
}): Promise<CardExportResult> {
  const node = cardRef.current;
  if (!node) {
    return { ok: false, message: '贺卡还没准备好，请稍后再试。' };
  }

  // 捕获为临时 PNG，清晰度按 View 原始像素输出（不缩小）
  const uri = await captureRef(node, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
  });

  // 申请相册权限：writeOnly=true 仅请求「添加照片」权限（更贴合隐私承诺，不申请整库读取）
  const permission = await requestPermissionsAsync(true);
  if (!permission.granted) {
    return { ok: false, message: '没有相册权限，请在系统设置中允许保存图片后重试。' };
  }

  // 保存到相册（SDK 58 新 API：Asset.create 等价于 saveToLibraryAsync）
  await Asset.create(uri);
  return { ok: true, message: '贺卡已保存到相册' };
}
