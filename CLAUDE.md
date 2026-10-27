# 项目约定

开始任何工作之前，先完整阅读项目里的 constitution.md，后续所有工作都不能违反其中的原则。

## 开发路径指引

- **RN App（Expo）项目固定在根目录 `rnapp/`**，不要再新建其他 App 项目目录。它是移动端 App 的唯一工程，任务清单（tasks.md）里所有「涉及文件」的路径均指该目录下的文件。
- 路由目录为 `rnapp/src/app/`（expo-router 文件路由，采用 SDK 模板默认的 src 布局），路由路径与 plan.md 第三章一致；主题常量在 `rnapp/src/theme.ts`，通用组件在 `rnapp/src/components/`。
- 常用命令（须在 `rnapp/` 目录下执行）：
  - `npm start`：启动 Expo 开发服务器，用 Expo Go 扫码在手机上预览。
  - `npx expo start --tunnel`：局域网 / 网络受限时用隧道模式预览。
  - `npx tsc --noEmit`：TypeScript 类型检查。
  - `npx expo install <包名>`：安装与当前 SDK 兼容的依赖版本（不要用 `npm install` 直接加包）。
- 数据 / 技术决策请遵循 spec.md、plan.md、data-model.md，与 tasks.md 保持一致。

## Supabase 后端

- 云端项目：「AI XinYi」，ref `qftpinzgdvrbdokutlwa`（新加坡 ap-southeast-1）。Supabase CLI 已全局安装并已 `supabase login`、`supabase link`。
- 本地工程：`rnapp/supabase/`（config.toml、migrations/）。建表迁移已推送到云端（依据 data-model.md 附录 A）。
- 应用连接配置：`rnapp/.env`（`EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`，已 gitignore，勿提交）；客户端入口在 `rnapp/src/lib/supabase.ts`。
- 常用命令（在 `rnapp/` 下）：`supabase db push`（部署新迁移到云端）、`supabase migration new <name>`（新建迁移）、`supabase functions new <name>` / `supabase functions deploy <name>`（Edge Function）。
