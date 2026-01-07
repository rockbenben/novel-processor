# 小说文本整理器 (Novel Processor)

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-16.1.1-black)
![React](https://img.shields.io/badge/React-19.2.3-blue)
![Ant Design](https://img.shields.io/badge/UI-Ant_Design_6-1890ff)

**一键修复下载小说的格式问题，智能换行排版工具。**

下载的小说格式乱成一团？小说文本整理器一键解决！智能换行、章节分割、章节重排、段落缩进、繁简转换、去重复行、垃圾过滤全搞定，让杂乱网络小说秒变整齐易读，阅读体验瞬间提升！

## ✨ 核心功能

- **智能换行**：依据标点符号自动优化换行，合并破碎段落。
- **章节格式化**：自动识别并标准化“第 X 章”标题，支持章节重排。
- **排版优化**：
  - **段落缩进**：段首自动缩进两个全角空格。
  - **智能清理**：自动移除每行首尾多余空格。
  - **去重**：移除相邻的重复行。
  - **长段落优化**：自动拆分过长段落，提升移动阅读体验。
- **内容清洗**：
  - **繁简转换**：内置 OpenCC 引擎，支持高精度繁简互转。
  - **清除干扰**：支持自定义关键词过滤（如“群号”、“下载器”）。
  - **行尾去噪**：移除行末的页码或统计数字。
- **文件处理**：支持多文件批量处理、大文件模式、自动导出。

## 🚀 快速开始

### 安装依赖

```bash
git clone https://github.com/rockbenben/novel-processor.git
cd novel-processor
yarn install
# 或者
npm install
# 或者
pnpm install
```

### 启动开发服务器

```bash
yarn dev
# 或者
npm run dev
# 或者
pnpm dev
```

打开浏览器访问 `http://localhost:3000` 即可使用。

## 📖 使用指南

### 第一步：上传文件

支持拖拽上传 `.txt`, `.md`, `.markdown` 文件，或直接粘贴文本到输入框。

### 第二步：选择处理功能

在右侧面板勾选需要的功能：

- **排版优化**：推荐开启“智能换行”和“段落缩进”。
- **内容清洗**：按需开启“繁体转简体”或设置“过滤词”。

### 第三步：开始处理

点击“**开始处理**”按钮，处理结果将实时显示并自动复制到剪贴板。

### 第四步：保存结果

- 点击“**复制**”获取结果。
- 点击“**导出**”下载 `.txt` 文件。

## 🛠️ 技术栈

- **框架**: [Next.js](https://nextjs.org/) (App Router)
- **UI 组件**: [Ant Design](https://ant.design/)
- **文本处理**:
  - `js-opencc`: 繁简转化
  - `jschardet`: 编码检测
  - 自定义正则与文本处理算法

## 🤝 贡献指南

欢迎提交 Pull Request 或 Issue 来改进这个项目！

## 📄 许可证

本项目采用 [MIT](./LICENSE) 许可证。
