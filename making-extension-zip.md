# 制作拓展插件 zip

本仓库的拓展以 zip 安装包分发。补丁版酒馆可直接用「导入拓展」按钮安装 zip；
原版酒馆则手动解压到拓展目录（方法见 [README](README.md)）。本文说明如何把
自己的拓展按规范打包成 zip。

## 1. 拓展目录结构

一个拓展就是一个文件夹，根目录必须包含 `manifest.json`:

```text
my-extension/
├── manifest.json   # 必须，拓展清单
├── index.js        # 入口脚本（manifest 中 js 字段指向的文件）
├── style.css       # 可选（manifest 中 css 字段指向的文件）
└── src/            # 可选，其他模块/资源，按需组织
```

打包时建议只包含运行所需文件。压包前先删掉 `.git/`、构建产物、本地备份等
无关内容——包内文件会被原样落盘到酒馆拓展目录。

## 2. manifest.json

必须是合法的 JSON 对象，字段要求：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `display_name` | 是（或 `name`） | 非空字符串，拓展显示名；两者至少有一个 |
| `js` | 是 | 入口脚本，如 `"index.js"`；文件必须真实存在于包内 |
| `css` | 否 | 样式表；**声明了就必须存在于包内** |
| `version` | 否 | 版本号字符串 |
| `author` | 否 | 作者 |
| `loading_order` | 否 | 加载顺序，数字，越小越先加载 |
| `hooks` | 否 | 事件钩子，如 `{"activate": "init"}` |

示例：

```json
{
    "display_name": "我的拓展",
    "loading_order": 100,
    "requires": [],
    "js": "index.js",
    "css": "style.css",
    "version": "1.0.0",
    "author": "你的名字",
    "hooks": {
        "activate": "init"
    }
}
```

注意：拓展脚本是浏览器 ES module，按模块相对路径解析——`import` 路径要
与实际目录结构一致，不能用 Node 内置模块或 `require()`。

## 3. zip 结构（两种都支持）

**结构一：manifest 位于 zip 根（推荐，安装目录名 = zip 文件名）**

```text
my-extension.zip
├── manifest.json
├── index.js
├── style.css
└── src/...
```

**结构二：单顶层目录（GitHub 的「Code → Download ZIP」自动生成的结构）**

```text
my-extension-main.zip
└── my-extension-main/
    ├── manifest.json
    ├── index.js
    └── ...
```

两种结构通吃。安装后的拓展文件夹名：结构一取 zip 文件名（去掉 `.zip`），
结构二取顶层目录名。文件夹名会经 sanitize 处理；同名目录已存在时安装会
失败（提示 `Directory already exists`），换一个文件名即可。

## 4. 安装前校验（不满足即拒绝）

补丁版安装端点会对 zip 做以下检查，**不通过的包不会被放入拓展目录**，
不会意外被当成拓展加载：

- `manifest.json` 必须存在（根或单顶层目录下），且是合法 JSON 对象；
- 必须提供 `display_name`/`name` 与 `js` 入口；
- `js`、`css`（若声明）指向的文件必须在包内；
- 拒绝路径穿越（`..`、绝对路径）、Windows 盘符路径、符号链接条目；
- 每个条目都会被检查，无法安全解压的条目会直接拒绝；
- zip 文件 ≤ 200 MB，解压后总大小 ≤ 512 MB（防 zip 炸弹）。

`__MACOSX/` 元数据与空目录条目会被自动忽略，不影响安装。

## 5. 本地测试

**补丁版：** 打开酒馆 → 顶栏「扩展程序」→ 点击「导入拓展」→ 选择 zip。
看到导入成功提示后刷新页面，在「管理扩展程序」中确认拓展加载无报错。

**原版：** 解压 zip，把文件夹放进 `data/default-user/extensions/`（或全局
`public/scripts/extensions/third-party/`），重启酒馆验证。

## 6. 上传到本仓库

本仓库每个 zip 独占一个文件，直接在 `main` 分支上新增/替换即可：

```bash
git clone https://github.com/JiYeHuanXiang/st-extension-pack.git
cd st-extension-pack
# 把你的 my-extension.zip 放到仓库根目录
git add my-extension.zip
git commit -m "add: my-extension.zip"
git push origin main
```

也可以在 GitHub 网页端直接「Add file → Upload files」上传。上传后刷新这份
文档或 README 的直链列表即可。
