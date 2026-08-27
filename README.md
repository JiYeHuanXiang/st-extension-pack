# ST 扩展合集（st-extension-pack）

SillyTavern 第三方扩展合集，一次安装同时获得两个扩展：

| 扩展 | 功能 |
|---|---|
| [char-creator](char-creator/) | 角色卡制作助手：双模式（原创/IP）AI 填模板生成角色卡 |
| [deep-roleplay](deep-roleplay/) | 深度扮演：DeepSeek V4 思考模式下注入角色沉浸提示词 |

## 安装（SillyTavern 内）

1. 打开 **Extensions（扩展）** 面板
2. 点击 **Install extension（安装扩展）**
3. 输入本仓库 URL：`https://github.com/JiYeHuanXiang/st-extension-pack`
4. 安装后刷新页面，即可在扩展列表看到「ST 扩展合集（角色卡制作助手 + 深度扮演）」

> 注意：SillyTavern 的 URL 安装机制是 git clone 整个仓库并读取**根目录**的
> `manifest.json`，因此本仓库被设计为「合集扩展」形式——根目录是一个入口
> manifest，内部再挂载两个子扩展。安装后扩展列表里只会显示一个合集条目，
> 两个功能同时启用。

## 单独安装某一个扩展

如果你只需要其中一个扩展，不要直接安装本仓库（合集）。请将对应子目录
（`char-creator/` 或 `deep-roleplay/`）整个复制到你的 SillyTavern
`public/scripts/extensions/third-party/` 目录下，刷新页面即可。

## 与本地已有扩展的去重

如果你本地的 `third-party/` 目录下已经存在 `char-creator` 或 `deep-roleplay`
目录，安装本合集后会出现重复加载（双份按钮）。请二选一：

- 删除本地 `third-party/char-creator` 和 `third-party/deep-roleplay`，改用合集；或
- 不安装合集，仅手动复制需要的子目录。

## 更新

扩展面板中选中合集条目，点击 **Update（更新）** 即可拉取本仓库最新提交。

## 反馈

如有问题请在仓库提 issue。
