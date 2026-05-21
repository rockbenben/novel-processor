<h1 align="center">
📖 小说文本整理器
</h1>
<p align="center">
    <a href="./README.en.md">English</a> | 中文
</p>
<p align="center">
    <em>一键修复网络小说排版、智能换行、章节重排、繁简转换、广告清理</em>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="https://tools.newzone.top/zh/novel-processor"><img src="https://img.shields.io/badge/%E5%9C%A8%E7%BA%BF%E4%BD%93%E9%AA%8C-novel--processor-blue" alt="在线体验"></a>
</p>

**小说文本整理器** 是专为网络小说、电子书等长篇文本设计的一站式整理工具。自动修复格式错乱、清理广告水印、规范章节标题、按章节重排、可选繁简转换，让杂乱的小说文本秒变整齐易读。整个处理流程在浏览器本地运行，文件不会上传到任何服务器。

👉 **在线体验**：<https://tools.newzone.top/zh/novel-processor>

![小说文本整理器界面](./public/novel-processor.png "小说文本整理器使用界面")

## 这个工具能解决什么问题？

下载的小说常见痛点：

- **排版乱**：段落不分、章节连写、空行混乱
- **广告水印**：下载器标记、群号推广、"分卷阅读"
- **格式不统一**：繁简混杂、全角 / 半角字符乱
- **断行错乱**：句子被错误打断、不该断的地方多空行
- **章节错位**：目录乱序、章节标题没换行

## 核心功能

- 📝 **智能换行**：根据中文标点、纯数字行、特殊起始符判断段落边界，重新合并 / 分段。
- 🏷️ **章节格式化**：识别"第 X 章"、"Chapter N"等格式并规范化，支持章节重排。
- 🎨 **排版优化**：段落缩进、长段落自动拆分、首尾空格清理、相邻重复行去除。
- 🧹 **内容清洗**：自定义关键词过滤、行尾噪声移除、保护正文阈值。
- 🔄 **繁简转换**：内置 OpenCC 引擎，支持高精度繁简互转。
- 🛡️ **保护词典**：与简繁转换工具共享同一份词典，定义"不被转换"的词组清单。
- 📦 **批量处理**：支持多文件批量处理、大文件模式、自动导出。
- 🌐 **多语言 UI**：基于 next-intl，支持 18 种界面语言。

## 三个主操作按钮

| 按钮         | 行为                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------- |
| **开始处理** | 跑完整流程：按右侧配置依次执行换行、清理、章节、过滤等所有勾选项                                    |
| **章节分割** | 只做一件事 —— 把行内连写的章节标题拆成独立行，其他内容不动                                          |
| **章节重排** | 从每章标题里提取序号（第十二章 / Chapter 5 / 第三卷 第四章 等），按序号重排整本小说。无序号章节置后 |

处理完成后内容会自动复制到剪贴板并显示在结果卡。

## 配置面板（右栏三段 Collapse）

### 1. 排版（默认展开）

- **智能换行**（默认开）：根据中文标点重新合并断行
  - 子开关 **段落缩进**（仅在智能换行启用时显示，默认开）：每段开头加 `\t` 缩进
- **智能分段**（默认关）：长段落按句子算法（compromise NLP + 中文标点）拆分成更短段落

### 2. 内容清理（默认折叠）

- **章节标题格式化**（默认开）：识别 "第 X 章"、"Chapter N" 等格式并规范化
- **清除行尾数字**（默认关）：仅对长度 ≥ 10 的行移除末尾数字（避免误删短标题里的年份）
- **修整空格**（默认开）：移除每行首尾空格
- **去除相邻重复行**（默认关）：仅删除**相邻**重复行，避免误删频繁出现的短对白（"嗯"、"好"等）
- **特殊起始文本**：填小说名或常见标题词。匹配的行会强制独立成段
- **过滤词** + **过滤阈值**：
  - 过滤词：逗号分隔的关键词（如 `群号,下载器`），所有含这些词的整行被删除
  - 过滤阈值：长度大于 N 的行豁免删除（保护正文）；填 0 表示不启用豁免

### 3. 高级设置（默认折叠）

- **繁简转换** Segmented：
  - **不转换** → 跳过此步
  - **繁 → 简** → 使用 `tw → cn`
  - **简 → 繁** → 使用 `cn → tw`
- **单文件模式**：限制为一次只处理一个文件
- **直接导出**：处理完直接下载，跳过页面预览（仅单文件模式可见）

## 保护词典

页面右下角的「保护词典」面板：

- **总开关**：启用 / 禁用全部规则
- 显示当前 s2t / t2s 规则数量
- **管理规则**按钮：打开抽屉，增删改单条规则、批量导入 / 导出

工具与「简繁转换」共享同一份保护词典（同 localStorage 键），一处编辑两处生效。**仅在高级设置的繁简转换实际启用时**才参与处理；设为"不转换"时面板会显示「规则当前未生效」。

## 支持的文件格式

支持拖拽上传 `.txt`、`.md`、`.markdown` 文件，或直接粘贴文本到输入框。

## 技术栈

- **框架**：[Next.js 16](https://nextjs.org/)（App Router）
- **UI**：[Ant Design](https://ant.design/) + [Tailwind CSS 4](https://tailwindcss.com/)
- **i18n**：[next-intl](https://next-intl-docs.vercel.app/)
- **文本处理**：
  - [js-opencc](https://github.com/rockbenben/js-opencc)：繁简转换
  - [compromise](https://github.com/spencermountain/compromise)：英文 NLP 句子边界
  - [jschardet](https://github.com/aadsm/jschardet)：编码检测

## 快速开始

### 环境要求

- Node.js >= 20.9.0
- 包管理器：Yarn（推荐）、npm 或 pnpm

### 安装与启动

```bash
git clone https://github.com/rockbenben/novel-processor.git
cd novel-processor

# 安装依赖
yarn install

# 启动开发服务器
yarn dev
```

打开 [http://localhost:3000](http://localhost:3000) 即可使用。

### 构建生产版本

```bash
yarn build
```

## 贡献指南

欢迎提交 Pull Request 或 Issue 改进本项目。

1. Fork 本仓库
2. 创建分支：`git checkout -b feature/AmazingFeature`
3. 提交更改：`git commit -m 'feat: add some AmazingFeature'`
4. 推送分支：`git push origin feature/AmazingFeature`
5. 提交 Pull Request

## 相关链接

- 📖 [使用文档](https://docs.newzone.top/zh/guide/tools/novel-processor)
- 🐛 [报告问题](https://github.com/rockbenben/novel-processor/issues)
- 🔗 [简繁转换工具](https://github.com/rockbenben/chinese-conversion)（共享保护词典）

## License

本项目采用 [MIT](./LICENSE) 许可证。
