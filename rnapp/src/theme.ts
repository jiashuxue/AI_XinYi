import { Platform } from 'react-native';

/**
 * 主题：「纸、墨、邮」—— 像收到一封手写明信片
 * 参照 prototype/index-v2.html（苔绿 · 明信片版），颜色值与原型 CSS 变量一致。
 * · 亚麻绿调纸面（paper #ECEFE4）
 * · 苔藓绿墨为主强调（moss #31513D）
 * · 琥珀金作邮票 / 金线点缀（gold #B08D42）
 * · 楷体标题 + 系统无衬线正文
 */
export const colors = {
  paper: '#ECEFE4', // 亚麻绿纸底（页面背景）
  paper2: '#E2E7D6', // 纸边深一档
  card: '#F7F6EE', // 明信片白（卡片 / 底部导航）
  card2: '#F0F0E4', // 明信片深一档
  ink: '#33382E', // 墨绿黑正文
  inkSoft: '#7A806E', // 灰绿墨（次要文字）
  line: '#D4D8C6', // 细线（边框）
  lineSoft: '#E1E4D4', // 更淡线
  moss: '#31513D', // 苔藓绿 主强调
  mossDeep: '#223A2B', // 深苔绿
  mossSoft: '#E3EADF', // 苔绿浅底
  gold: '#B08D42', // 琥珀金 点缀
  goldSoft: '#E2D5AE', // 金浅
  onMoss: '#F7F6EE', // 主强调底上的浅色文字（原型 --card 色）
} as const;

export const fonts = {
  /**
   * 楷体（标题 / 强调文字）：
   * · iOS 用系统自带 Kaiti SC
   * · Android 无内置楷体，暂以衬线（serif）兜底
   * 后续可引入霞鹜文楷（LXGW WenKai）字体文件，与原型字形完全一致
   */
  kai: Platform.select({ ios: 'Kaiti SC', android: 'serif', default: 'serif' }) as string,
  // 正文不显式指定 fontFamily，即系统默认无衬线
} as const;

/** 圆角，对应原型各处圆角尺寸 */
export const radius = { sm: 10, md: 14, lg: 16, pill: 999 } as const;

/** 页面左右留白，对应原型 .screen 的 22px */
export const pagePadding = 22;

/** 卡片阴影，对应原型 rgba(50,60,40,.3) 的柔和投影 */
export const cardShadow = {
  shadowColor: '#32402A',
  shadowOpacity: 0.16,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
} as const;
