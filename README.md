# ST 扩展合集

两个 SillyTavern 拓展的 zip 安装包：

| 文件 | 拓展 | 说明 |
| --- | --- | --- |
| `char-creator.zip` | 角色卡制作助手 | 在角色编辑器内通过 AI 分阶段生成角色卡 |
| `deep-roleplay.zip` | 深度扮演 | 把角色沉浸提示词注入上下文，强化 RP（需 DeepSeek V4 系列模型） |

## 安装方式

### 补丁版酒馆（一键导入，推荐）
 - https://github.com/JiYeHuanXiang/sillytavern-patch

补丁版自带 zip 导入功能：

1. 下载对应拓展的 zip 文件（链接见下方）。
2. 打开酒馆，点击顶栏「扩展程序」打开拓展设置面板。
3. 点击「导入拓展」按钮，在文件浏览器中选择刚下载的 zip。
4. 看到「导入成功」提示后刷新页面，在「管理扩展程序」中确认拓展已启用。

zip 直链：

- 角色卡制作助手：<https://github.com/JiYeHuanXiang/st-extension-pack/raw/main/char-creator.zip>
- 深度扮演：<https://github.com/JiYeHuanXiang/st-extension-pack/raw/main/deep-roleplay.zip>

### 原版酒馆（手动解压）
 - https://github.com/SillyTavern/SillyTavern

原版没有 zip 导入功能，需要手动把拓展文件放进拓展目录：

1. 下载 zip 并解压，得到一个包含 `manifest.json` 的文件夹。
2. 把这个文件夹放入酒馆的用户拓展目录 `data/default-user/extensions/`（全局安装则放入 `public/scripts/extensions/third-party/`）。
3. 放置后目录结构应形如 `data/default-user/extensions/char-creator/manifest.json`、`data/default-user/extensions/deep-roleplay/manifest.json`。
4. 重启酒馆（或刷新页面），在「扩展程序」面板中确认拓展已加载。

> 注意：「深度扮演」要求当前使用 OpenAI 兼容 API，且模型名同时包含 `deepseek`、`v4` 和 `pro`/`flash`（如 `deepseek-v4-flash`），否则点击按钮时会提示模型不符。
