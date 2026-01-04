import {
  BgColorsOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  ScissorOutlined,
  FileTextOutlined,
  FontSizeOutlined,
  CodeOutlined,
  GlobalOutlined,
  BookOutlined,
  FileSearchOutlined,
  EditOutlined,
  SwapOutlined,
  FileSyncOutlined,
  NodeIndexOutlined,
  VideoCameraOutlined,
  FileMarkdownOutlined,
  TranslationOutlined,
  LinkOutlined,
  UnorderedListOutlined,
  ProfileOutlined,
  OrderedListOutlined,
  ToolOutlined,
  MessageOutlined,
} from "@ant-design/icons";
import Link from "next/link";

interface Project {
  title: string;
  description: string;
  key: string;
  icon: React.ReactNode;
  href?: string;
}

const projectCategories = {
  translate: ["json-translate", "subtitle-translator", "md-translator"],
  textParser: ["text-splitter", "chinese-conversion", "novel-processor", "regex-matcher", "text-processor"],
  jsonParser: ["json-value-extractor", "json-node-edit", "json-value-transformer", "json-value-swapper", "json-node-inserter", "json-sort-classify", "json-match-update"],
  dataParser: ["data-parser/flare", "data-parser/img-prompt"],
};

export const projects: Project[] = [
  {
    title: "JSON 翻译器",
    description: "批量翻译 JSON 文件的工具",
    key: "json-translate",
    icon: <TranslationOutlined />,
    href: "https://tools.newzone.top/zh/json-translate",
  },
  {
    title: "字幕翻译器",
    description: "自动翻译 SRT、ASS、VTT 字幕文件",
    key: "subtitle-translator",
    icon: <VideoCameraOutlined />,
    href: "https://tools.newzone.top/zh/subtitle-translator",
  },
  {
    title: "Markdown 翻译器",
    description: "翻译 Markdown 文档的专业工具",
    key: "md-translator",
    icon: <FileMarkdownOutlined />,
    href: "https://tools.newzone.top/zh/md-translator",
  },
  {
    title: "文本分割器",
    description: "按字符数、分隔符、段落智能分割文本",
    key: "text-splitter",
    icon: <ScissorOutlined />,
    href: "https://tools.newzone.top/zh/text-splitter",
  },
  {
    title: "简繁转换",
    description: "批量转换简体、台湾繁体、香港繁体和日本新字体",
    key: "chinese-conversion",
    icon: <SwapOutlined />,
    href: "https://tools.newzone.top/zh/chinese-conversion",
  },
  {
    title: "长文本/小说整理器",
    description: "一键修复下载小说的格式问题，智能换行排版",
    key: "novel-processor",
    icon: <FontSizeOutlined />,
    href: "https://tools.newzone.top/zh/novel-processor",
  },
  {
    title: "正则文本助手",
    description: "集成正则匹配、排序、过滤等功能，进行文本批量处理",
    key: "regex-matcher",
    icon: <CodeOutlined />,
    href: "https://tools.newzone.top/zh/regex-matcher",
  },
  {
    title: "自用文本处理",
    description: "自用多种规则的文本处理工具",
    key: "text-processor",
    icon: <ProfileOutlined />,
    href: "https://tools.newzone.top/zh/text-processor",
  },
  {
    title: "JSON 值提取器",
    description: "从 JSON 中提取指定路径的值",
    key: "json-value-extractor",
    icon: <FileSearchOutlined />,
    href: "https://tools.newzone.top/zh/json-value-extractor",
  },
  {
    title: "JSON 节点编辑器",
    description: "编辑 JSON 中的特定节点",
    key: "json-node-edit",
    icon: <EditOutlined />,
    href: "https://tools.newzone.top/zh/json-node-edit",
  },
  {
    title: "JSON 值转换器",
    description: "批量转换 JSON 中的值",
    key: "json-value-transformer",
    icon: <FileSyncOutlined />,
    href: "https://tools.newzone.top/zh/json-value-transformer",
  },
  {
    title: "JSON 值交换器",
    description: "交换 JSON 中的键值对",
    key: "json-value-swapper",
    icon: <SwapOutlined />,
    href: "https://tools.newzone.top/zh/json-value-swapper",
  },
  {
    title: "JSON 节点插入器",
    description: "向 JSON 中插入新节点",
    key: "json-node-inserter",
    icon: <NodeIndexOutlined />,
    href: "https://tools.newzone.top/zh/json-node-inserter",
  },
  {
    title: "JSON 排序分类",
    description: "对 JSON 进行排序和分类",
    key: "json-sort-classify",
    icon: <OrderedListOutlined />,
    href: "https://tools.newzone.top/zh/json-sort-classify",
  },
  {
    title: "JSON 匹配更新",
    description: "根据条件匹配并更新 JSON",
    key: "json-match-update",
    icon: <UnorderedListOutlined />,
    href: "https://tools.newzone.top/zh/json-match-update",
  },
  {
    title: "Flare 数据解析",
    description: "解析 Flare 格式数据",
    key: "data-parser/flare",
    icon: <LinkOutlined />,
    href: "https://tools.newzone.top/zh/data-parser/flare",
  },
  {
    title: "图像提示词解析",
    description: "解析和处理 AI 图像提示词",
    key: "data-parser/img-prompt",
    icon: <UnorderedListOutlined />,
    href: "https://tools.newzone.top/zh/data-parser/img-prompt",
  },
];

const projectsMap = projects.reduce((acc: Record<string, Project>, project) => {
  acc[project.key] = project;
  return acc;
}, {});

export const useAppMenu = () => {
  const createMenuItem = (projectKey: string) => {
    const project = projectsMap[projectKey];
    if (!project) return null;

    return {
      label: project.href ? (
        <a href={project.href} target="_blank" rel="noopener noreferrer">
          {project.title}
        </a>
      ) : (
        <Link href={`/${project.key}`}>{project.title}</Link>
      ),
      key: project.key,
      icon: project.icon,
    };
  };

  const generateCategoryItems = (categoryKeys: string[]) => {
    return categoryKeys.map(createMenuItem).filter(Boolean);
  };

  const otherToolsItems = [
    {
      label: (
        <a href="https://www.aishort.top/" target="_blank" rel="noopener noreferrer">
          ChatGPT Shortcut
        </a>
      ),
      key: "aishort",
      icon: <ExperimentOutlined />,
    },
    {
      label: (
        <a href="http://chat.newzone.top/?lang=zh" target="_blank" rel="noopener noreferrer">
          ChatBox
        </a>
      ),
      key: "ChatBox",
      icon: <MessageOutlined />,
    },
    {
      label: (
        <a href="https://prompt.newzone.top/app/zh" target="_blank" rel="noopener noreferrer">
          IMGPrompt
        </a>
      ),
      key: "IMGPrompt",
      icon: <BgColorsOutlined />,
    },
    {
      label: (
        <a href="https://newzone.top/" target="_blank" rel="noopener noreferrer">
          LearnData 开源笔记
        </a>
      ),
      key: "LearnData",
      icon: <BookOutlined />,
    },
  ];

  const menuItems = [
    {
      label: <Link href="/">首页</Link>,
      key: "home",
    },
    {
      label: "翻译工具",
      key: "translate",
      icon: <GlobalOutlined />,
      children: generateCategoryItems(projectCategories.translate),
    },
    {
      label: "文本解析",
      key: "textParser",
      icon: <FileTextOutlined />,
      children: generateCategoryItems(projectCategories.textParser),
    },
    {
      label: "JSON 解析",
      key: "jsonParser",
      icon: <DatabaseOutlined />,
      children: generateCategoryItems(projectCategories.jsonParser),
    },
    {
      label: "数据解析",
      key: "dataParser",
      icon: <FileSearchOutlined />,
      children: generateCategoryItems(projectCategories.dataParser),
    },
    {
      label: "其他工具",
      key: "otherTools",
      icon: <ToolOutlined />,
      children: otherToolsItems,
    },
    {
      label: <Link href="https://tools.newzone.top/zh/feedback">反馈与建议</Link>,
      key: "feedback",
    },
  ];

  return menuItems;
};
